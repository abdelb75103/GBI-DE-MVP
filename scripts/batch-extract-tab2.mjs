import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Fill missing Tab 2 participant-characteristics fields in the live app database by calling the
 * existing extraction API for only the missing fields per paper.
 *
 * Why a separate script exists
 * ----------------------------
 * The broader `batch-extract-tabs-1-4.mjs` runner spends quota on Tabs 1, 3, and 4. For the
 * current workflow we only want Tab 2, and we want a repeatable, auditable script that:
 * - profiles Tab 2 completeness before extraction
 * - requests only the missing participant-characteristics fields
 * - profiles Tab 2 completeness again afterwards
 * - writes a report artifact with the exact jobs run and any issues found
 * - supports batched reruns when Gemini quota makes a full sweep impractical
 *
 * Methodological stance
 * ---------------------
 * This is a completeness-recovery step, not a standardization step. Raw extracted values are
 * preserved in the app DB as returned by the extraction model. Standardization, canonicalization,
 * and analysis-sheet building remain separate human-in-the-loop steps.
 */

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');
const auditDir = path.join(repoRoot, 'Data Analysis', 'Data Cleaning', 'audit', 'tab2');

const DEFAULT_INCLUDED_STATUSES = [
  'extracted',
  'american_data',
  'uefa',
  'referee',
  'mental_health',
  'aspetar_asprev',
  'flagged',
  'fifa_data',
];

const TAB = 'participantCharacteristics';
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

const DEFAULT_PROFILE_COOKIE =
  'eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImZ1bGxOYW1lIjoiQWJkZWxSYWhtYW4gQmFiaWtlciIsInJvbGUiOiJhZG1pbiJ9';
const PROJECT_LEAD_PROFILE_IDS = new Set([
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
]);

function encodeCookie(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function canAccessWorkspace(profile) {
  if (profile.role === 'admin') return true;
  return profile.role === 'extractor' && PROJECT_LEAD_PROFILE_IDS.has(profile.id);
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
  if (!raw) return DEFAULT_INCLUDED_STATUSES;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPresenceMap(papers, extractions, extractionFields, selectedFields) {
  const extractionById = new Map(extractions.map((row) => [row.id, row]));
  const presenceByPaper = new Map();

  papers.forEach((paper) => {
    presenceByPaper.set(paper.id, {
      paper,
      fields: Object.fromEntries(selectedFields.map((fieldId) => [fieldId, new Set()])),
    });
  });

  extractionFields.forEach((field) => {
    const extraction = extractionById.get(field.extraction_id);
    if (!extraction || extraction.tab !== TAB || !presenceByPaper.has(extraction.paper_id)) return;
    const value = typeof field.value === 'string' ? field.value.trim() : '';
    if (!value) return;
    const record = presenceByPaper.get(extraction.paper_id);
    record?.fields?.[field.field_id]?.add(value);
  });

  return presenceByPaper;
}

function summarizePresence(presenceByPaper, selectedFields) {
  const missingPapersByField = Object.fromEntries(selectedFields.map((fieldId) => [fieldId, []]));
  const nonMissingPapersByField = Object.fromEntries(selectedFields.map((fieldId) => [fieldId, 0]));

  for (const record of presenceByPaper.values()) {
    selectedFields.forEach((fieldId) => {
      if (record.fields[fieldId].size > 0) {
        nonMissingPapersByField[fieldId] += 1;
      } else {
        missingPapersByField[fieldId].push(record.paper.assigned_study_id);
      }
    });
  }

  return {
    paperCount: presenceByPaper.size,
    nonMissingPapersByField,
    missingPapersByField,
  };
}

function buildJobs(presenceByPaper, selectedFields) {
  const jobs = [];

  for (const [paperId, record] of presenceByPaper.entries()) {
    const missingFields = selectedFields.filter((fieldId) => record.fields[fieldId].size === 0);
    if (missingFields.length === 0) continue;
    jobs.push({
      paperId,
      assignedStudyId: record.paper.assigned_study_id,
      status: record.paper.status,
      fields: missingFields,
    });
  }

  return jobs.sort((left, right) => left.assignedStudyId.localeCompare(right.assignedStudyId));
}

async function callExtract(baseUrl, cookie, job) {
  const response = await fetch(`${baseUrl}/api/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `gbi_active_profile=${cookie}`,
    },
    body: JSON.stringify({
      paperId: job.paperId,
      tab: TAB,
      fields: job.fields,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function callExtractWithRetry(baseUrl, cookies, cookieIndex, job) {
  let lastError = null;
  let cooldownCount = 0;

  while (cooldownCount < 20) {
    for (let attempt = 0; attempt < cookies.length; attempt += 1) {
      const cookie = cookies[(cookieIndex + attempt) % cookies.length];
      try {
        return await callExtract(baseUrl, cookie, job);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isLimitError = /limit|quota|usage/i.test(message);
        if (!isLimitError) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    cooldownCount += 1;
    console.warn(`[tab2] quota cooldown ${cooldownCount} for ${job.assignedStudyId}`);
    await new Promise((resolve) => setTimeout(resolve, 75000));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function collectIssues(presenceByPaper) {
  const issues = [];

  const allowedDisciplines = new Set([
    'Association football (11-a-side)',
    'Futsal',
    'Beach soccer',
    'Para football',
  ]);
  const allowedSexTokens = new Set(['male', 'female', 'mixed', 'unclear']);

  for (const [paperId, record] of presenceByPaper.entries()) {
    const valueOf = (fieldId) => [...record.fields[fieldId]][0] ?? null;
    const assignedStudyId = record.paper.assigned_study_id;

    const discipline = valueOf('fifaDiscipline');
    if (discipline && !allowedDisciplines.has(discipline)) {
      issues.push({ paperId, assignedStudyId, fieldId: 'fifaDiscipline', issue: 'unexpected_discipline_value', value: discipline });
    }

    const sex = valueOf('sex');
    if (sex) {
      const tokens = sex
        .split(/\n+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      if (tokens.some((token) => !allowedSexTokens.has(token))) {
        issues.push({ paperId, assignedStudyId, fieldId: 'sex', issue: 'unexpected_sex_value', value: sex });
      }
    }

    const sampleSizePlayers = valueOf('sampleSizePlayers');
    if (sampleSizePlayers && !/^[\d.,\n\s+-]+$/.test(sampleSizePlayers)) {
      issues.push({ paperId, assignedStudyId, fieldId: 'sampleSizePlayers', issue: 'non_numeric_sample_size', value: sampleSizePlayers });
    }

    const numberOfTeams = valueOf('numberOfTeams');
    if (numberOfTeams && !/^[\d.,\n\s+-]+$/.test(numberOfTeams)) {
      issues.push({ paperId, assignedStudyId, fieldId: 'numberOfTeams', issue: 'non_numeric_team_count', value: numberOfTeams });
    }
  }

  return issues;
}

async function main() {
  const env = loadEnvFile(envPath);
  const baseUrl = process.env.GBI_BASE_URL || 'http://localhost:3001';
  const requestedConcurrency = Number.parseInt(process.env.GBI_EXTRACT_CONCURRENCY || '2', 10);
  const offset = Number.parseInt(process.env.GBI_TAB2_OFFSET || '0', 10);
  const limit = Number.parseInt(process.env.GBI_TAB2_LIMIT || '0', 10);
  const statuses = parseStatuses();
  const selectedFields = parseFields();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const profilesWithKeys = await fetchAllRows(supabase, 'profiles', 'id,full_name,role,gemini_api_key');
  const availableCookies = profilesWithKeys
    .filter((profile) => profile.gemini_api_key && canAccessWorkspace(profile))
    .map((profile) =>
      encodeCookie({
        id: profile.id,
        fullName: profile.full_name,
        role: profile.role,
      }),
    );
  const cookies = availableCookies.length > 0 ? availableCookies : [process.env.GBI_ACTIVE_PROFILE_COOKIE || DEFAULT_PROFILE_COOKIE];
  const concurrency = Math.max(1, Math.min(requestedConcurrency, cookies.length));

  const papers = (
    await fetchAllRows(
      supabase,
      'papers',
      'id,assigned_study_id,status,title',
      (query) => query.order('assigned_study_id', { ascending: true }),
    )
  ).filter((paper) => statuses.includes(paper.status));
  const paperIds = new Set(papers.map((paper) => paper.id));

  const extractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter((row) =>
    paperIds.has(row.paper_id),
  );
  const extractionIds = new Set(extractions.map((row) => row.id));
  const extractionFields = (await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')).filter(
    (row) => extractionIds.has(row.extraction_id),
  );

  const initialPresence = buildPresenceMap(papers, extractions, extractionFields, selectedFields);
  const initialSummary = summarizePresence(initialPresence, selectedFields);
  const allJobs = buildJobs(initialPresence, selectedFields);
  const jobs = (limit > 0 ? allJobs.slice(offset, offset + limit) : allJobs.slice(offset));
  const results = [];

  let cursor = 0;
  async function worker(workerIndex) {
    while (cursor < jobs.length) {
      const currentIndex = cursor;
      cursor += 1;
      const job = jobs[currentIndex];
      const label = `${currentIndex + 1}/${jobs.length} ${job.assignedStudyId} [w${workerIndex}] ${job.fields.join(',')}`;
      try {
        const payload = await callExtractWithRetry(baseUrl, cookies, workerIndex - 1, job);
        results.push({ ...job, ok: true, model: payload.model });
        console.log(`[tab2] ${label} ok`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ...job, ok: false, error: message });
        console.error(`[tab2] ${label} failed: ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, (_, index) => worker(index + 1)));

  const finalExtractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter((row) =>
    paperIds.has(row.paper_id),
  );
  const finalExtractionIds = new Set(finalExtractions.map((row) => row.id));
  const finalFields = (await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')).filter(
    (row) => finalExtractionIds.has(row.extraction_id),
  );

  const finalPresence = buildPresenceMap(papers, finalExtractions, finalFields, selectedFields);
  const finalSummary = summarizePresence(finalPresence, selectedFields);
  const issues = collectIssues(finalPresence);

  fs.mkdirSync(auditDir, { recursive: true });
  const reportPath = path.join(auditDir, `tab2-extraction-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    statuses,
    fields: selectedFields,
    paperCount: papers.length,
    totalBacklogCount: allJobs.length,
    selectedOffset: offset,
    selectedLimit: limit > 0 ? limit : null,
    jobCount: jobs.length,
    extractionSuccessCount: results.filter((item) => item.ok).length,
    extractionFailureCount: results.filter((item) => !item.ok).length,
    initialSummary,
    finalSummary,
    selectedJobs: jobs,
    failures: results.filter((item) => !item.ok),
    issues,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`report=${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
