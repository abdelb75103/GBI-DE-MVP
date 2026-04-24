import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');
const defaultOutPath = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'audit',
  'tab2',
  'tab2-agecategory-recovery-batch-2026-04-12.json',
);
const defaultReviewPath = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'audit',
  'tab2',
  'tab2-agecategory-recovery-review-2026-04-12.json',
);

const INCLUDED_STATUSES = [
  'extracted',
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

async function fetchAllRows(supabase, table, select, builder) {
  const rows = [];
  const pageSize = 1000;
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

function splitValues(raw) {
  return String(raw ?? '')
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstNonBlank(values) {
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function titleSuggestsYouth(title) {
  return /\b(youth|adolescent|adolescen|children|child|junior|academy|schoolboy|schoolgirl|school-aged|high school|secondary school|under[- ]?\d+|u[- ]?\d{1,2})\b/i.test(
    title,
  );
}

function titleSuggestsSenior(title) {
  return /\b(professional|elite|first team|senior|premier league|top[- ]level|world cup|champions league|national team|olympic|olympics|first league|lower league)\b/i.test(
    title,
  );
}

function titleSuggestsCollege(title) {
  return /\b(ncaa|college|collegiate|intercollegiate)\b/i.test(title);
}

function classifyAmericanPaper(title) {
  if (/\b(rio|high school)\b/i.test(title)) {
    return {
      value: 'high school',
      rationale: "User-approved American-data shortcut: RIO/high-school cohorts are high school.",
      rule: 'american_high_school_shortcut',
    };
  }
  if (titleSuggestsCollege(title)) {
    return {
      value: 'college',
      rationale: "User-approved American-data shortcut: NCAA/college/collegiate cohorts are college.",
      rule: 'american_college_shortcut',
    };
  }
  return null;
}

function parseAgeEvidence(meanAgeRaw) {
  const parts = splitValues(meanAgeRaw);
  if (parts.length === 0) return null;

  const classifications = [];

  for (const part of parts) {
    const rangeMatch = part.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const min = Number(rangeMatch[1]);
      const max = Number(rangeMatch[2]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        if (max < 18) classifications.push('youth');
        else if (min >= 18) classifications.push('senior');
        else classifications.push('ambiguous');
        continue;
      }
    }

    const firstNumberMatch = part.match(/(\d+(?:\.\d+)?)/);
    if (!firstNumberMatch) continue;
    const n = Number(firstNumberMatch[1]);
    if (!Number.isFinite(n)) continue;
    if (n < 18) classifications.push('youth');
    else if (n >= 18) classifications.push('senior');
  }

  if (classifications.length === 0) return null;
  if (classifications.includes('ambiguous')) return null;
  if (classifications.every((item) => item === 'youth')) {
    return {
      value: 'Youth',
      rationale: `Conservative mean-age inference: reported age expression(s) remain clearly below 18 (${parts.join('; ')}).`,
      rule: 'mean_age_youth',
    };
  }
  if (classifications.every((item) => item === 'senior')) {
    return {
      value: 'Senior',
      rationale: `Conservative mean-age inference: reported age expression(s) remain on the adult side of 18 (${parts.join('; ')}).`,
      rule: 'mean_age_senior',
    };
  }
  return null;
}

function inferAgeCategory(record) {
  const title = record.title ?? '';
  const status = record.status;
  const levelOfPlay = (record.levelOfPlay ?? '').trim().toLowerCase();

  if (status === 'uefa') {
    return {
      value: 'Senior',
      rationale: "User-approved UEFA shortcut: UEFA cohorts are treated as senior for age-category completeness recovery.",
      rule: 'uefa_senior_shortcut',
    };
  }

  if (status === 'american_data') {
    const american = classifyAmericanPaper(title);
    if (american) return american;
  }

  if (titleSuggestsYouth(title)) {
    return {
      value: 'Youth',
      rationale: 'Paper title explicitly indicates a youth/adolescent/high-school/U-age cohort.',
      rule: 'title_youth',
    };
  }

  if (titleSuggestsCollege(title)) {
    return {
      value: 'college',
      rationale: 'Paper title explicitly indicates a college/collegiate/NCAA cohort.',
      rule: 'title_college',
    };
  }

  if (titleSuggestsSenior(title)) {
    return {
      value: 'Senior',
      rationale: 'Paper title explicitly indicates a senior/professional/elite cohort.',
      rule: 'title_senior',
    };
  }

  if (
    /\bprofessional\b/.test(levelOfPlay) ||
    /\belite\b/.test(levelOfPlay) ||
    /\bnational team\b/.test(levelOfPlay) ||
    /\bolympic/.test(levelOfPlay) ||
    /\btop-level\b/.test(levelOfPlay) ||
    /\bfirst and lower league\b/.test(levelOfPlay)
  ) {
    return {
      value: 'Senior',
      rationale: `Existing levelOfPlay '${record.levelOfPlay}' supports a broad senior fill for ageCategory.`,
      rule: 'level_of_play_senior',
    };
  }

  if (/\bcolleg/i.test(levelOfPlay)) {
    return {
      value: 'college',
      rationale: `Existing levelOfPlay '${record.levelOfPlay}' supports a college fill for ageCategory.`,
      rule: 'level_of_play_college',
    };
  }

  const ageFromMean = parseAgeEvidence(record.meanAge);
  if (ageFromMean) return ageFromMean;

  return null;
}

async function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutPath;
  const reviewPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultReviewPath;

  const env = loadEnvFile(envPath);
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
  ).filter((paper) => INCLUDED_STATUSES.includes(paper.status));

  const paperIds = new Set(papers.map((paper) => paper.id));
  const extractions = (await fetchAllRows(supabase, 'extractions', 'id,paper_id,tab')).filter(
    (row) => paperIds.has(row.paper_id) && row.tab === 'participantCharacteristics',
  );
  const extractionIds = new Set(extractions.map((row) => row.id));
  const fields = (await fetchAllRows(supabase, 'extraction_fields', 'extraction_id,field_id,value')).filter(
    (row) => extractionIds.has(row.extraction_id),
  );

  const extractionByPaperId = new Map(extractions.map((row) => [row.paper_id, row.id]));
  const fieldMapByExtractionId = new Map();
  for (const field of fields) {
    const bucket = fieldMapByExtractionId.get(field.extraction_id) ?? new Map();
    const values = bucket.get(field.field_id) ?? [];
    values.push(field.value);
    bucket.set(field.field_id, values);
    fieldMapByExtractionId.set(field.extraction_id, bucket);
  }

  const records = papers.map((paper) => {
    const extractionId = extractionByPaperId.get(paper.id);
    const fieldMap = extractionId ? fieldMapByExtractionId.get(extractionId) : undefined;
    return {
      studyId: paper.assigned_study_id,
      status: paper.status,
      title: paper.title ?? '',
      ageCategory: firstNonBlank(fieldMap?.get('ageCategory') ?? []),
      sex: firstNonBlank(fieldMap?.get('sex') ?? []),
      meanAge: firstNonBlank(fieldMap?.get('meanAge') ?? []),
      levelOfPlay: firstNonBlank(fieldMap?.get('levelOfPlay') ?? []),
    };
  });

  const updates = [];
  const unresolved = [];
  const skipped = [];
  const countsByRule = {};

  for (const record of records) {
    if (record.ageCategory.trim()) {
      skipped.push({ ...record, reason: 'already_has_ageCategory' });
      continue;
    }

    const inferred = inferAgeCategory(record);
    if (!inferred) {
      unresolved.push({ ...record, reason: 'needs_manual_review' });
      continue;
    }

    updates.push({
      studyId: record.studyId,
      fieldId: 'ageCategory',
      value: inferred.value,
      mode: 'add_if_blank',
      rationale: inferred.rationale,
    });
    countsByRule[inferred.rule] = (countsByRule[inferred.rule] ?? 0) + 1;
  }

  const payload = {
    notes:
      'Targeted Tab 2 ageCategory completeness-recovery batch for the 499-paper included universe. Adds broad raw ageCategory fills only when ageCategory is blank, using user-approved UEFA/American shortcuts plus conservative title/levelOfPlay/meanAge inference.',
    updates,
    metadata: {
      generatedAt: new Date().toISOString(),
      paperCount: records.length,
      updateCount: updates.length,
      unresolvedCount: unresolved.length,
      countsByRule,
      statuses: INCLUDED_STATUSES,
    },
  };

  const review = {
    generatedAt: new Date().toISOString(),
    paperCount: records.length,
    updateCount: updates.length,
    unresolvedCount: unresolved.length,
    countsByRule,
    unresolved,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2));
  console.log(`batch=${outPath}`);
  console.log(`review=${reviewPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
