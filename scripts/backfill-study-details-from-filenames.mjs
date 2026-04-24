import crypto from 'node:crypto';
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

function cleanPdfLikeText(value) {
  if (!value) return '';
  return value
    .replace(/^.*\//, '')
    .replace(/^\d+-/, '')
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.\.+$/g, '')
    .replace(/\s+\.\s*/g, '. ')
    .trim();
}

function normalizeTitle(value) {
  if (!value) return null;
  return value
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\.+$/g, '.')
    .replace(/\s+\.$/, '.')
    .trim();
}

function looksLikeStructuredLeadAuthor(value) {
  if (!value) return false;
  return /^[A-Z][A-Za-z'`.-]+(?: [A-Z][A-Za-z.-]+)+$/.test(value.trim());
}

function normalizeAuthorToken(value) {
  return value
    .replace(/\bAO\b.*$/i, '')
    .replace(/\bORCID\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function initialsFromGivenNames(givenNames) {
  return givenNames
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function convertFullNameToLeadAuthor(value) {
  const cleaned = normalizeAuthorToken(value);
  if (!cleaned) return null;
  if (looksLikeStructuredLeadAuthor(cleaned)) {
    return cleaned.replace(/\.$/, '');
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  const initials = initialsFromGivenNames(given);
  if (!initials) return null;
  return `${surname} ${initials}`;
}

function parseFilenameCandidate(rawValue) {
  const cleaned = cleanPdfLikeText(rawValue);
  if (!cleaned) return null;

  const match = cleaned.match(/^(.*?)\s+-\s+((?:19|20)\d{2})\s+-\s+(.+)$/);
  if (!match) return null;

  const [, authorSegment, year, titleSegment] = match;
  const firstAuthorRaw = authorSegment.split(/\s+and\s+/i)[0]?.trim() ?? '';
  const leadAuthor = convertFullNameToLeadAuthor(firstAuthorRaw);
  const title = normalizeTitle(titleSegment);

  return {
    leadAuthor,
    year,
    title,
    raw: cleaned,
  };
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

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  };
}

function pickSource(paper) {
  return (
    paper.extracted_title ||
    paper.original_file_name ||
    paper.storage_object_path ||
    paper.title ||
    ''
  );
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const [papers, extractions, extractionFields] = await Promise.all([
    fetchAllRows(
      supabase,
      'papers',
      'id,assigned_study_id,status,title,lead_author,year,extracted_title,original_file_name,storage_object_path',
      (query) => query.in('status', INCLUDED_STATUSES).order('assigned_study_id', { ascending: true }),
    ),
    fetchAllRows(
      supabase,
      'extractions',
      'id,paper_id,tab',
      (query) => query.eq('tab', 'studyDetails'),
    ),
    fetchAllRows(
      supabase,
      'extraction_fields',
      'id,extraction_id,field_id,value',
      (query) => query.in('field_id', ['leadAuthor', 'title', 'yearOfPublication', 'studyId']),
    ),
  ]);

  const extractionByPaperId = new Map(extractions.map((row) => [row.paper_id, row]));
  const fieldByKey = new Map(
    extractionFields.map((row) => [`${row.extraction_id}:${row.field_id}`, row]),
  );

  const report = [];
  const paperUpdates = [];
  const fieldUpdates = [];
  const extractionInserts = [];

  for (const paper of papers) {
    const parsed = parseFilenameCandidate(pickSource(paper));
    if (!parsed) continue;

    const extraction = extractionByPaperId.get(paper.id);
    const pendingPaper = {};
    const pendingFields = [];

    if (!paper.lead_author && parsed.leadAuthor) {
      pendingPaper.lead_author = parsed.leadAuthor;
    }

    if (!paper.year && parsed.year) {
      pendingPaper.year = parsed.year;
    }

    if (!paper.title && parsed.title) {
      pendingPaper.title = parsed.title;
    }

    const fieldTargets = [
      ['leadAuthor', parsed.leadAuthor],
      ['yearOfPublication', parsed.year],
      ['title', parsed.title || normalizeTitle(paper.title)],
    ];

    for (const [fieldId, nextValue] of fieldTargets) {
      if (!nextValue) continue;
      if (!extraction) {
        pendingFields.push({ fieldId, value: nextValue, missingExtraction: true });
        continue;
      }

      const existing = fieldByKey.get(`${extraction.id}:${fieldId}`);
      const existingValue = typeof existing?.value === 'string' ? existing.value.trim() : '';
      if (!existingValue) {
        pendingFields.push({ fieldId, value: nextValue, missingExtraction: false });
      }
    }

    if (Object.keys(pendingPaper).length === 0 && pendingFields.length === 0) {
      continue;
    }

    report.push({
      paperId: paper.id,
      studyId: paper.assigned_study_id,
      status: paper.status,
      source: parsed.raw,
      parsed,
      paperUpdates: pendingPaper,
      fieldUpdates: pendingFields.map((item) => ({ fieldId: item.fieldId, value: item.value })),
    });

    if (Object.keys(pendingPaper).length > 0) {
      paperUpdates.push({ id: paper.id, values: pendingPaper });
    }

    if (!extraction && pendingFields.length > 0) {
      extractionInserts.push({
        id: crypto.randomUUID(),
        paper_id: paper.id,
        tab: 'studyDetails',
        model: 'human-input',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    fieldUpdates.push({
      paperId: paper.id,
      extractionId: extraction?.id ?? null,
      fields: pendingFields,
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:]/g, '-');
  const reportPath = path.join(outputDir, `study-details-filename-backfill-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        apply,
        generatedAt: new Date().toISOString(),
        report,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(JSON.stringify({
      apply,
      reportPath,
      matchedPapers: report.length,
      paperUpdates: paperUpdates.length,
      fieldUpdateGroups: fieldUpdates.filter((item) => item.fields.length > 0).length,
      sample: report.slice(0, 10),
    }, null, 2));
    return;
  }

  for (const update of paperUpdates) {
    const { error } = await supabase
      .from('papers')
      .update({ ...update.values, updated_at: new Date().toISOString() })
      .eq('id', update.id);
    if (error) throw new Error(`Failed to update paper ${update.id}: ${error.message}`);
  }

  if (extractionInserts.length > 0) {
    const { error } = await supabase.from('extractions').insert(extractionInserts);
    if (error) throw new Error(`Failed to create studyDetails extractions: ${error.message}`);
  }

  const freshExtractions = await fetchAllRows(
    supabase,
    'extractions',
    'id,paper_id,tab',
    (query) => query.eq('tab', 'studyDetails'),
  );
  const freshExtractionByPaperId = new Map(freshExtractions.map((row) => [row.paper_id, row]));

  const fieldRows = [];
  for (const item of fieldUpdates) {
    const extraction = freshExtractionByPaperId.get(item.paperId);
    if (!extraction) continue;

    const studyIdField = {
      id: crypto.randomUUID(),
      extraction_id: extraction.id,
      field_id: 'studyId',
      value: papers.find((paper) => paper.id === item.paperId)?.assigned_study_id ?? null,
      status: 'reported',
      updated_at: new Date().toISOString(),
      updated_by: null,
    };

    fieldRows.push(studyIdField);

    for (const field of item.fields) {
      fieldRows.push({
        id: crypto.randomUUID(),
        extraction_id: extraction.id,
        field_id: field.fieldId,
        value: field.value,
        status: 'reported',
        updated_at: new Date().toISOString(),
        updated_by: null,
      });
    }
  }

  if (fieldRows.length > 0) {
    const { error } = await supabase
      .from('extraction_fields')
      .upsert(fieldRows, { onConflict: 'extraction_id,field_id' });
    if (error) throw new Error(`Failed to upsert extraction fields: ${error.message}`);
  }

  console.log(JSON.stringify({
    apply,
    reportPath,
    matchedPapers: report.length,
    papersUpdated: paperUpdates.length,
    fieldsUpserted: fieldRows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
