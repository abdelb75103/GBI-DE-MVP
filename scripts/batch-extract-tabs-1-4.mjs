import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');
const outputDir = path.join(repoRoot, 'exports');

const INCLUDED_STATUSES = [
  'extracted',
  'american_data',
  'uefa',
  'referee',
  'mental_health',
  'aspetar_asprev',
  'flagged',
  'fifa_data',
];

const TAB_FIELDS = {
  studyDetails: ['leadAuthor', 'title', 'yearOfPublication', 'journal', 'doi', 'studyDesign'],
  participantCharacteristics: [
    'fifaDiscipline',
    'country',
    'levelOfPlay',
    'sex',
    'ageCategory',
    'meanAge',
    'sampleSizePlayers',
    'numberOfTeams',
    'observationDuration',
  ],
  definitions: [
    'injuryDefinition',
    'illnessDefinition',
    'incidenceDefinition',
    'burdenDefinition',
    'severityDefinition',
    'recurrenceDefinition',
    'mechanismReporting',
  ],
  exposure: [
    'seasonLength',
    'numberOfSeasons',
    'exposureMeasurementUnit',
    'totalExposure',
    'matchExposure',
    'trainingExposure',
  ],
};

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
  if (profile.role === 'admin') {
    return true;
  }
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
    if (builder) {
      query = builder(query);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function buildPresenceMap(papers, extractions, extractionFields) {
  const extractionById = new Map(extractions.map((row) => [row.id, row]));
  const presenceByPaper = new Map();

  papers.forEach((paper) => {
    const tabs = {};
    Object.entries(TAB_FIELDS).forEach(([tab, fieldIds]) => {
      tabs[tab] = Object.fromEntries(fieldIds.map((fieldId) => [fieldId, new Set()]));
    });
    presenceByPaper.set(paper.id, {
      paper,
      tabs,
    });
  });

  extractionFields.forEach((field) => {
    const extraction = extractionById.get(field.extraction_id);
    if (!extraction || !presenceByPaper.has(extraction.paper_id)) return;
    const value = typeof field.value === 'string' ? field.value.trim() : '';
    if (!value) return;
    const paperRecord = presenceByPaper.get(extraction.paper_id);
    if (!paperRecord?.tabs?.[extraction.tab]?.[field.field_id]) return;
    paperRecord.tabs[extraction.tab][field.field_id].add(value);
  });

  return presenceByPaper;
}

function buildJobs(presenceByPaper) {
  const jobs = [];

  for (const [paperId, record] of presenceByPaper.entries()) {
    const studyDetailsMissing = TAB_FIELDS.studyDetails.filter(
      (fieldId) => record.tabs.studyDetails[fieldId].size === 0,
    );
    if (studyDetailsMissing.length > 0) {
      jobs.push({
        paperId,
        assignedStudyId: record.paper.assigned_study_id,
        status: record.paper.status,
        tab: 'studyDetails',
        fields: studyDetailsMissing,
      });
    }

    ['participantCharacteristics', 'definitions', 'exposure'].forEach((tab) => {
      const presentCount = TAB_FIELDS[tab].filter((fieldId) => record.tabs[tab][fieldId].size > 0).length;
      if (presentCount === 0) {
        jobs.push({
          paperId,
          assignedStudyId: record.paper.assigned_study_id,
          status: record.paper.status,
          tab,
          fields: TAB_FIELDS[tab],
        });
      }
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
      tab: job.tab,
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
    let sawOnlyLimitErrors = true;

    for (let attempt = 0; attempt < cookies.length; attempt += 1) {
      const cookie = cookies[(cookieIndex + attempt) % cookies.length];
      try {
        return await callExtract(baseUrl, cookie, job);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isLimitError = /limit|quota|usage/i.test(message);
        if (!isLimitError) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (!sawOnlyLimitErrors) {
      break;
    }

    cooldownCount += 1;
    console.warn(`[extract] quota cooldown ${cooldownCount} for ${job.assignedStudyId} ${job.tab}`);
    await new Promise((resolve) => setTimeout(resolve, 75000));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function callFieldUpdate(baseUrl, cookie, update) {
  const response = await fetch(`${baseUrl}/api/extract/field`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `gbi_active_profile=${cookie}`,
    },
    body: JSON.stringify(update),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

function normalizeDoi(value) {
  if (!value) return value;
  return value
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/\.$/, '')
    .trim();
}

function normalizeYear(value) {
  if (!value) return value;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : value.trim();
}

function normalizeTitle(value) {
  if (!value) return value;
  return value
    .replace(/\.pdf$/i, '')
    .replace(/^[^-]+-\s*\d{4}\s*-\s*/i, '')
    .trim();
}

function normalizeStudyDesign(value) {
  if (!value) return value;
  const normalized = value.trim().toLowerCase();
  const dictionary = new Map([
    ['prospective cohort study', 'prospective cohort'],
    ['prospective cohort', 'prospective cohort'],
    ['prospective', 'prospective cohort'],
    ['cohort study', 'cohort study'],
    ['retrospective cohort', 'retrospective cohort'],
    ['retrospective cohort - prospective data', 'retrospective cohort - prospective data'],
    ['retrospective study on prospective data', 'retrospective cohort - prospective data'],
    ['cluster randomized controlled trial', 'cluster randomized controlled trial'],
    ['cluster-randomized controlled trial', 'cluster randomized controlled trial'],
    ['cluster randomised controlled trial', 'cluster randomized controlled trial'],
    ['cluster-randomised controlled trial', 'cluster randomized controlled trial'],
    ['randomized controlled trial', 'randomized controlled trial'],
    ['randomised control trial', 'randomized controlled trial'],
    ['randomized controlled trial (cluster)', 'randomized controlled trial (cluster)'],
    ['prospective intervention study', 'prospective intervention study'],
    ['case series', 'case series'],
    ['case-control', 'case-control'],
    ['cross-sectional study', 'cross-sectional'],
    ['cross-sectional', 'cross-sectional'],
    ['descriptive epidemiology study', 'descriptive epidemiology study'],
    ['descriptive epidemiological study', 'descriptive epidemiology study'],
    ['descriptive and observational study', 'descriptive epidemiology study'],
    ['other', 'other'],
  ]);
  return dictionary.get(normalized) ?? value.trim();
}

function collectIssues(presenceByPaper) {
  const issues = [];

  for (const [paperId, record] of presenceByPaper.entries()) {
    const study = Object.fromEntries(
      Object.entries(record.tabs.studyDetails).map(([fieldId, values]) => [fieldId, [...values][0] ?? null]),
    );

    if (study.yearOfPublication && !/^\d{4}$/.test(study.yearOfPublication)) {
      issues.push({ paperId, assignedStudyId: record.paper.assigned_study_id, tab: 'studyDetails', fieldId: 'yearOfPublication', issue: 'non_four_digit_year', value: study.yearOfPublication });
    }
    if (study.doi && !/^(10\.)/i.test(normalizeDoi(study.doi))) {
      issues.push({ paperId, assignedStudyId: record.paper.assigned_study_id, tab: 'studyDetails', fieldId: 'doi', issue: 'suspicious_doi', value: study.doi });
    }
    if (study.title && (/\.pdf$/i.test(study.title) || /^[^-]+-\s*\d{4}\s*-\s*/i.test(study.title))) {
      issues.push({ paperId, assignedStudyId: record.paper.assigned_study_id, tab: 'studyDetails', fieldId: 'title', issue: 'filename_like_title', value: study.title });
    }
    if (study.studyDesign && study.studyDesign.trim() !== normalizeStudyDesign(study.studyDesign)) {
      issues.push({ paperId, assignedStudyId: record.paper.assigned_study_id, tab: 'studyDetails', fieldId: 'studyDesign', issue: 'normalizable_design_variant', value: study.studyDesign });
    }

    const participant = Object.fromEntries(
      Object.entries(record.tabs.participantCharacteristics).map(([fieldId, values]) => [fieldId, [...values][0] ?? null]),
    );
    if (participant.sampleSizePlayers && !/^[\d.,\n\s+-]+$/.test(participant.sampleSizePlayers)) {
      issues.push({ paperId, assignedStudyId: record.paper.assigned_study_id, tab: 'participantCharacteristics', fieldId: 'sampleSizePlayers', issue: 'non_numeric_sample_size', value: participant.sampleSizePlayers });
    }

    const exposure = Object.fromEntries(
      Object.entries(record.tabs.exposure).map(([fieldId, values]) => [fieldId, [...values][0] ?? null]),
    );
    ['totalExposure', 'matchExposure', 'trainingExposure'].forEach((fieldId) => {
      const value = exposure[fieldId];
      if (value && !/^[\d.,\n\s+-]+$/.test(value) && !/^(n\/a|-+)$/i.test(value)) {
        issues.push({ paperId, assignedStudyId: record.paper.assigned_study_id, tab: 'exposure', fieldId, issue: 'non_numeric_exposure', value });
      }
    });
  }

  return issues;
}

async function applySafeFixes(baseUrl, cookie, presenceByPaper) {
  const fixes = [];

  for (const [paperId, record] of presenceByPaper.entries()) {
    const study = Object.fromEntries(
      Object.entries(record.tabs.studyDetails).map(([fieldId, values]) => [fieldId, [...values][0] ?? null]),
    );

    const candidates = [
      ['doi', study.doi, normalizeDoi(study.doi)],
      ['yearOfPublication', study.yearOfPublication, normalizeYear(study.yearOfPublication)],
      ['title', study.title, normalizeTitle(study.title)],
      ['studyDesign', study.studyDesign, normalizeStudyDesign(study.studyDesign)],
    ];

    for (const [fieldId, oldValue, nextValue] of candidates) {
      if (!oldValue || !nextValue || oldValue === nextValue) continue;
      await callFieldUpdate(baseUrl, cookie, {
        paperId,
        tab: 'studyDetails',
        fieldId,
        value: nextValue,
      });
      fixes.push({ paperId, assignedStudyId: record.paper.assigned_study_id, fieldId, oldValue, newValue: nextValue });
    }
  }

  return fixes;
}

async function main() {
  const env = loadEnvFile(envPath);
  const baseUrl = process.env.GBI_BASE_URL || 'http://localhost:3001';
  const requestedConcurrency = Number.parseInt(process.env.GBI_EXTRACT_CONCURRENCY || '2', 10);
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
  ).filter((paper) => INCLUDED_STATUSES.includes(paper.status));
  const paperIds = new Set(papers.map((paper) => paper.id));
  const extractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter((row) =>
    paperIds.has(row.paper_id),
  );
  const extractionIds = new Set(extractions.map((row) => row.id));
  const extractionFields = (await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')).filter(
    (row) => extractionIds.has(row.extraction_id),
  );

  const initialPresence = buildPresenceMap(papers, extractions, extractionFields);
  const jobs = buildJobs(initialPresence);
  const results = [];

  let cursor = 0;
  async function worker(workerIndex) {
    while (cursor < jobs.length) {
      const currentIndex = cursor;
      cursor += 1;
      const job = jobs[currentIndex];
      const label = `${currentIndex + 1}/${jobs.length} ${job.assignedStudyId} ${job.tab} [w${workerIndex}]`;
      try {
        const payload = await callExtractWithRetry(baseUrl, cookies, workerIndex - 1, job);
        results.push({ ...job, ok: true, model: payload.model });
        console.log(`[extract] ${label} ok`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ...job, ok: false, error: message });
        console.error(`[extract] ${label} failed: ${message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, (_, index) => worker(index + 1)));

  const refreshedExtractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter((row) =>
    paperIds.has(row.paper_id),
  );
  const refreshedExtractionIds = new Set(refreshedExtractions.map((row) => row.id));
  const refreshedFields = (
    await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')
  ).filter((row) => refreshedExtractionIds.has(row.extraction_id));
  const refreshedPresence = buildPresenceMap(papers, refreshedExtractions, refreshedFields);
  const fixes = await applySafeFixes(baseUrl, cookies[0], refreshedPresence);

  const finalExtractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter((row) =>
    paperIds.has(row.paper_id),
  );
  const finalExtractionIds = new Set(finalExtractions.map((row) => row.id));
  const finalFields = (await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')).filter(
    (row) => finalExtractionIds.has(row.extraction_id),
  );
  const finalPresence = buildPresenceMap(papers, finalExtractions, finalFields);
  const issues = collectIssues(finalPresence);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    paperCount: papers.length,
    jobCount: jobs.length,
    extractionSuccessCount: results.filter((item) => item.ok).length,
    extractionFailureCount: results.filter((item) => !item.ok).length,
    safeFixCount: fixes.length,
    issueCount: issues.length,
    failures: results.filter((item) => !item.ok),
    fixes,
    issues,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `tabs-1-4-extraction-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`report=${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
