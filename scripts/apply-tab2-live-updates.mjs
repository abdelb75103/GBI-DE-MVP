import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Apply an approved manual Tab 2 participant-characteristics micro-batch to the live app database.
 *
 * Why this script exists
 * ----------------------
 * The Tab 2 workflow needs a reproducible, auditable way to:
 * - apply reviewed manual fills when Gemini is quota-limited
 * - stay additive by default
 * - allow narrowly scoped corrections when a live value is clearly wrong
 * - keep the intervention itself separate from profiling and later standardization
 *
 * Usage
 * -----
 * node scripts/apply-tab2-live-updates.mjs path/to/updates.json
 *
 * Input JSON shape
 * ----------------
 * {
 *   "notes": "Short intervention description",
 *   "updates": [
 *     {
 *       "studyId": "S011",
 *       "fieldId": "ageCategory",
 *       "value": "Senior",
 *       "mode": "add_if_blank" | "replace_if_different",
 *       "rationale": "Direct source-based reason for the update"
 *     }
 *   ]
 * }
 *
 * Methodological stance
 * ---------------------
 * This is a completeness-recovery script for raw live extraction values only.
 * It does not standardize or canonicalize values for the analysis sheet.
 */

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');

function loadEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: node scripts/apply-tab2-live-updates.mjs <updates.json>');
  }

  const payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  const updates = Array.isArray(payload.updates) ? payload.updates : [];
  if (updates.length === 0) {
    throw new Error('No updates provided.');
  }

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const studyIds = [...new Set(updates.map((item) => item.studyId))];
  const { data: papers, error: papersError } = await supabase
    .from('papers')
    .select('id,assigned_study_id')
    .in('assigned_study_id', studyIds);
  if (papersError) throw new Error(`Failed to load papers: ${papersError.message}`);

  const paperByStudyId = new Map((papers ?? []).map((row) => [row.assigned_study_id, row]));
  const paperIds = (papers ?? []).map((row) => row.id);

  const { data: extractions, error: extractionError } = await supabase
    .from('extractions')
    .select('id,paper_id,tab')
    .in('paper_id', paperIds)
    .eq('tab', 'participantCharacteristics');
  if (extractionError) throw new Error(`Failed to load extractions: ${extractionError.message}`);

  const extractionByPaperId = new Map((extractions ?? []).map((row) => [row.paper_id, row]));

  const missingPaperIds = paperIds.filter((paperId) => !extractionByPaperId.has(paperId));
  for (const paperId of missingPaperIds) {
    const { data: created, error: createError } = await supabase
      .from('extractions')
      .insert({
        paper_id: paperId,
        tab: 'participantCharacteristics',
        model: 'human-input',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id,paper_id,tab')
      .single();
    if (createError || !created) {
      throw new Error(`Failed to create participantCharacteristics extraction: ${createError?.message ?? 'Unknown error'}`);
    }
    extractionByPaperId.set(paperId, created);
  }

  const extractionIds = [...new Set([...extractionByPaperId.values()].map((row) => row.id))];
  const { data: existingFields, error: fieldsError } = await supabase
    .from('extraction_fields')
    .select('id,extraction_id,field_id,value')
    .in('extraction_id', extractionIds);
  if (fieldsError) throw new Error(`Failed to load extraction fields: ${fieldsError.message}`);

  const existingByKey = new Map(
    (existingFields ?? []).map((row) => [`${row.extraction_id}:${row.field_id}`, row]),
  );

  const rowsToUpsert = [];
  const applied = [];
  const skipped = [];

  for (const update of updates) {
    const paper = paperByStudyId.get(update.studyId);
    if (!paper) {
      skipped.push({ ...update, reason: 'paper_not_found' });
      continue;
    }

    const extraction = extractionByPaperId.get(paper.id);
    if (!extraction) {
      skipped.push({ ...update, reason: 'extraction_not_found' });
      continue;
    }

    const key = `${extraction.id}:${update.fieldId}`;
    const existing = existingByKey.get(key);
    const existingValue = typeof existing?.value === 'string' ? existing.value.trim() : '';
    const nextValue = typeof update.value === 'string' ? update.value.trim() : '';

    if (update.mode === 'add_if_blank' && existingValue) {
      skipped.push({ ...update, existingValue, reason: 'nonblank_preserved' });
      continue;
    }

    if (update.mode === 'replace_if_different' && existingValue === nextValue) {
      skipped.push({ ...update, existingValue, reason: 'already_matches' });
      continue;
    }

    if (!nextValue) {
      skipped.push({ ...update, existingValue, reason: 'blank_new_value' });
      continue;
    }

    rowsToUpsert.push({
      extraction_id: extraction.id,
      field_id: update.fieldId,
      value: nextValue,
      status: 'reported',
      updated_at: new Date().toISOString(),
      updated_by: null,
    });
    applied.push({
      ...update,
      previousValue: existingValue || null,
      extractionId: extraction.id,
    });
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('extraction_fields')
      .upsert(rowsToUpsert, { onConflict: 'extraction_id,field_id' });
    if (upsertError) throw new Error(`Failed to upsert extraction fields: ${upsertError.message}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    notes: payload.notes ?? null,
    requestedCount: updates.length,
    appliedCount: applied.length,
    skippedCount: skipped.length,
    applied,
    skipped,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
