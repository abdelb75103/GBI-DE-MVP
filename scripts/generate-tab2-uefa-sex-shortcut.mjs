import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Generate a UEFA-specific Tab 2 sex shortcut batch from the user-approved ECIS/WECIS rule.
 *
 * Approved rule
 * -------------
 * - UEFA papers up to 2017 default to men's cohorts
 * - after 2017, women's cohorts may also exist and the title should signal that
 * - ECIS = men
 * - WECIS = women
 *
 * This script applies that rule only to blank UEFA sex fields.
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

function inferUefaSexFromTitle(title) {
  const normalized = (title ?? '').toLowerCase();
  const explicitWomen = /\bwecis\b|\bwomen'?s\b|\bfemale\b|\bgirls'?\b/.test(normalized);
  if (explicitWomen) return 'female';

  const explicitMen = /\becis\b|uefa elite club injury study|\bmale\b|\bmen'?s\b|\bboys'?\b/.test(normalized);
  if (explicitMen) return 'male';

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = Number.parseInt(yearMatch[1], 10);
    if (Number.isFinite(year) && year <= 2017) return 'male';
  }

  return null;
}

async function main() {
  const outPath =
    process.argv[2] ||
    path.join(
      repoRoot,
      'Data Analysis',
      'Data Cleaning',
      'audit',
      'tab2',
      'tab2-uefa-sex-shortcut-2026-04-12.json',
    );

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: papers, error } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title')
    .eq('status', 'uefa')
    .order('assigned_study_id', { ascending: true });
  if (error) throw new Error(`Failed to load uefa papers: ${error.message}`);

  const paperIds = (papers ?? []).map((row) => row.id);
  const { data: extractions, error: extractionError } = await supabase
    .from('extractions')
    .select('id,paper_id')
    .in('paper_id', paperIds)
    .eq('tab', 'participantCharacteristics');
  if (extractionError) throw new Error(`Failed to load extractions: ${extractionError.message}`);

  const extractionIds = (extractions ?? []).map((row) => row.id);
  const { data: existingFields, error: fieldError } = await supabase
    .from('extraction_fields')
    .select('extraction_id,value')
    .in('extraction_id', extractionIds)
    .eq('field_id', 'sex');
  if (fieldError) throw new Error(`Failed to load sex fields: ${fieldError.message}`);

  const paperIdByExtractionId = new Map((extractions ?? []).map((row) => [row.id, row.paper_id]));
  const filledPaperIds = new Set();
  for (const row of existingFields ?? []) {
    if (typeof row.value !== 'string' || !row.value.trim()) continue;
    const paperId = paperIdByExtractionId.get(row.extraction_id);
    if (paperId) filledPaperIds.add(paperId);
  }

  const updates = [];
  for (const paper of papers ?? []) {
    if (filledPaperIds.has(paper.id)) continue;
    const inferredSex = inferUefaSexFromTitle(paper.title);
    if (!inferredSex) continue;

    updates.push({
      studyId: paper.assigned_study_id,
      fieldId: 'sex',
      value: inferredSex,
      mode: 'add_if_blank',
      rationale: 'User-approved UEFA sex shortcut based on ECIS/WECIS and pre/post-2017 title logic.',
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        notes:
          'UEFA sex shortcut from the approved ECIS/WECIS rule. Blank sex values only. WECIS/women titles -> female; ECIS or pre-2017 UEFA titles -> male.',
        updates,
      },
      null,
      2,
    ),
  );

  console.log(outPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
