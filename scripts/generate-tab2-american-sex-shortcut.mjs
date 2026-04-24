import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Generate a Tab 2 sex-only shortcut batch for american_data papers using the user-approved
 * default value "male and female" where sex is still blank.
 *
 * Why this script exists
 * ----------------------
 * After the conservative title-based shortcut, a large number of american_data papers still had
 * blank sex values. The user explicitly approved using a status-level default for those papers.
 *
 * Methodological stance
 * ---------------------
 * This is a user-approved operational shortcut, not a paper-specific extraction. It only fills
 * blank sex values for american_data and does not overwrite any already-populated sex field.
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
  const outPath =
    process.argv[2] ||
    path.join(
      repoRoot,
      'Data Analysis',
      'Data Cleaning',
      'audit',
      'tab2',
      'tab2-american-sex-shortcut-2026-04-12.json',
    );

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: papers, error } = await supabase
    .from('papers')
    .select('id,assigned_study_id,status')
    .eq('status', 'american_data')
    .order('assigned_study_id', { ascending: true });
  if (error) throw new Error(`Failed to load american_data papers: ${error.message}`);

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
    updates.push({
      studyId: paper.assigned_study_id,
      fieldId: 'sex',
      value: 'male and female',
      mode: 'add_if_blank',
      rationale: "User-approved status-level shortcut for american_data sex on 2026-04-12.",
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        notes:
          "Status-level american_data sex shortcut. Fills blank sex values with 'male and female' only where no existing sex value is present.",
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
