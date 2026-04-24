import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Generate a conservative Tab 2 sex-only live-update batch from explicit cohort labels in paper titles.
 *
 * Why this script exists
 * ----------------------
 * After the broader tag-level shortcuts, sex remained one of the main low-completeness fields.
 * Some papers make the cohort sex explicit in the title itself (for example "male", "female",
 * "women's", "men's", or "male and female"). Those cases can be handled reproducibly without
 * full-paper extraction or model usage.
 *
 * Methodological stance
 * ---------------------
 * This script only emits updates where the title contains an explicit sex label. It intentionally
 * avoids ambiguous phrases such as "sex differences" unless the actual cohort wording is explicit.
 */

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');

const TARGET_STATUSES = [
  'american_data',
  'uefa',
  'referee',
  'mental_health',
  'flagged',
  'aspetar_asprev',
  'fifa_data',
];

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

function inferSexFromTitle(title) {
  const normalized = (title ?? '').toLowerCase();
  const hasMale = /\bmale\b|\bmen'?s\b|\bboys'?\b/.test(normalized);
  const hasFemale = /\bfemale\b|\bwomen'?s\b|\bgirls'?\b/.test(normalized);

  if (
    /male and female|female and male|men and women|women and men|boys and girls|girls and boys/.test(normalized) ||
    (hasMale && hasFemale)
  ) {
    return 'mixed';
  }
  if (hasFemale) return 'female';
  if (hasMale) return 'male';
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
      'tab2-title-sex-shortcut-2026-04-12.json',
    );

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: papers, error } = await supabase
    .from('papers')
    .select('id,assigned_study_id,status,title')
    .in('status', TARGET_STATUSES)
    .order('assigned_study_id', { ascending: true });
  if (error) throw new Error(`Failed to load papers: ${error.message}`);

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
    const inferredSex = inferSexFromTitle(paper.title);
    if (!inferredSex) continue;

    updates.push({
      studyId: paper.assigned_study_id,
      fieldId: 'sex',
      value: inferredSex,
      mode: 'add_if_blank',
      rationale: 'Conservative title-based shortcut from explicit cohort wording in the paper title.',
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        notes:
          'Title-based Tab 2 sex shortcut. Includes only papers whose titles explicitly identify the cohort as male, female, women, men, or a mixed male-and-female cohort.',
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
