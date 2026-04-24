import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Create a reproducible before/after completeness profile for Tab 2 participant-characteristics fields.
 *
 * Why this script exists
 * ----------------------
 * The cleaning workflow requires three explicit artifacts for each intervention:
 * 1. a "before" completeness snapshot
 * 2. the intervention itself
 * 3. an "after" completeness snapshot
 *
 * This script is the machine-readable profile step for Tab 2.
 */

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');
const auditDir = path.join(repoRoot, 'Data Analysis', 'Data Cleaning', 'audit', 'tab2');

const DEFAULT_STATUSES = [
  'american_data',
  'uefa',
  'referee',
  'mental_health',
  'flagged',
  'aspetar_asprev',
  'fifa_data',
];

const TAB2_FIELDS = [
  'fifaDiscipline',
  'country',
  'levelOfPlay',
  'sex',
  'ageCategory',
  'meanAge',
  'sampleSizePlayers',
  'numberOfTeams',
  'observationDuration',
];

function parseFields() {
  const raw = process.env.GBI_TAB2_FIELDS?.trim();
  if (!raw) return TAB2_FIELDS;
  const selected = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return TAB2_FIELDS.filter((fieldId) => selected.includes(fieldId));
}

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

async function fetchAllRows(supabase, table, select, builder) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (builder) query = builder(query);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function parseStatuses() {
  const raw = process.env.GBI_TAB2_STATUSES?.trim();
  if (!raw) return DEFAULT_STATUSES;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const env = loadEnvFile(envPath);
  const statuses = parseStatuses();
  const selectedFields = parseFields();
  const label = process.env.GBI_TAB2_PROFILE_LABEL?.trim() || 'snapshot';
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const papers = (
    await fetchAllRows(
      supabase,
      'papers',
      'id,assigned_study_id,status,title',
      (query) => query.order('assigned_study_id', { ascending: true }),
    )
  ).filter((paper) => statuses.includes(paper.status));
  const paperIds = new Set(papers.map((paper) => paper.id));

  const extractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter(
    (row) => paperIds.has(row.paper_id) && row.tab === 'participantCharacteristics',
  );
  const extractionIds = new Set(extractions.map((row) => row.id));
  const fields = (await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')).filter(
    (row) => extractionIds.has(row.extraction_id) && selectedFields.includes(row.field_id),
  );

  const extractionById = new Map(extractions.map((row) => [row.id, row]));
  const byPaper = new Map();
  for (const paper of papers) {
    byPaper.set(paper.id, {
      studyId: paper.assigned_study_id,
      title: paper.title,
      status: paper.status,
      fields: Object.fromEntries(selectedFields.map((fieldId) => [fieldId, new Set()])),
    });
  }

  for (const row of fields) {
    const extraction = extractionById.get(row.extraction_id);
    if (!extraction) continue;
    const value = typeof row.value === 'string' ? row.value.trim() : '';
    if (!value) continue;
    byPaper.get(extraction.paper_id)?.fields[row.field_id]?.add(value);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    label,
    statuses,
    fields: selectedFields,
    paperCount: papers.length,
    statusCounts: {},
    fieldSummary: {},
    easyBacklog: [],
  };

  for (const paper of papers) {
    report.statusCounts[paper.status] = (report.statusCounts[paper.status] ?? 0) + 1;
  }

  for (const fieldId of selectedFields) {
    let nonMissingPapers = 0;
    const missingByStatus = {};
    for (const record of byPaper.values()) {
      if (record.fields[fieldId].size > 0) {
        nonMissingPapers += 1;
      } else {
        missingByStatus[record.status] = (missingByStatus[record.status] ?? 0) + 1;
      }
    }
    const missingPapers = papers.length - nonMissingPapers;
    report.fieldSummary[fieldId] = {
      nonMissingPapers,
      missingPapers,
      completenessPct: Number(((nonMissingPapers / papers.length) * 100).toFixed(1)),
      missingnessPct: Number(((missingPapers / papers.length) * 100).toFixed(1)),
      missingByStatus,
    };
  }

  for (const record of byPaper.values()) {
    const missing = selectedFields.filter((fieldId) => record.fields[fieldId].size === 0);
    if (missing.length > 0 && missing.length <= 2) {
      report.easyBacklog.push({
        studyId: record.studyId,
        status: record.status,
        missing,
      });
    }
  }
  report.easyBacklog.sort((left, right) => left.studyId.localeCompare(right.studyId));

  fs.mkdirSync(auditDir, { recursive: true });
  const outPath = path.join(auditDir, `tab2-completeness-${label}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`report=${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
