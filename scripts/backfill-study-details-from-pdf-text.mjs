import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

function normalizeKey(value) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/^\d+-/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function walkPdfFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPdfFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function buildPdfIndex(pdfPaths) {
  const exact = new Map();
  for (const pdfPath of pdfPaths) {
    const base = path.basename(pdfPath);
    const key = normalizeKey(base);
    if (!key) continue;
    if (!exact.has(key)) exact.set(key, []);
    exact.get(key).push(pdfPath);
  }
  return exact;
}

function findLocalPdf(paper, pdfIndex, pdfPaths) {
  const candidates = [
    paper.original_file_name,
    paper.extracted_title,
    paper.title,
    path.basename(paper.storage_object_path || ''),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const key = normalizeKey(candidate);
    const exact = pdfIndex.get(key);
    if (exact?.length) return exact[0];
  }

  const titleKey = normalizeKey(paper.title);
  if (!titleKey) return null;
  return pdfPaths.find((pdfPath) => normalizeKey(path.basename(pdfPath)).includes(titleKey)) ?? null;
}

function extractPdfText(pdfPath) {
  try {
    return execFileSync('pdftotext', ['-f', '1', '-l', '2', pdfPath, '-'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function normalizeDoi(value) {
  return value
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[)\].,;]+$/g, '')
    .trim();
}

function extractDoi(text) {
  const match = text.match(/\b(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i);
  return match ? normalizeDoi(match[1]) : null;
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

function formatLeadAuthorFromCrossref(author) {
  if (!author?.family) return null;
  const initials = initialsFromGivenNames(author.given || '');
  return initials ? `${author.family} ${initials}` : author.family;
}

async function fetchCrossref(doi) {
  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GBI-DE-MVP study details backfill',
    },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.message ?? null;
}

function extractJournalFromText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 20)) {
    const match = line.match(/^(.+?)\s+\((?:19|20)\d{2}\)\s+\d/);
    if (match && !/doi|downloaded|accepted|published/i.test(match[1])) {
      return match[1].trim();
    }
  }

  const originalPublication = text.match(/Original Publication:\s*[\s\S]{0,400}?,\s*(?:19|20)\d{2},\s*([^,\n]+),/i);
  if (originalPublication) {
    return originalPublication[1].trim();
  }

  const citeLine = text.match(/\b([A-Z][A-Za-z&'’\- ]+(?:Journal|Medicine|Sports|Orthopaedics|Psychology|Obesity|Research))\s+(?:19|20)\d{2}[;,(]/);
  if (citeLine) {
    return citeLine[1].trim();
  }

  return null;
}

function extractStudyDesign(text) {
  const lower = text.toLowerCase();
  if (/cross-sectional/.test(lower)) return 'cross-sectional';
  if (/case-control/.test(lower)) return 'case-control';
  if (/retrospective cohort|retrospective study/.test(lower)) return 'retrospective cohort';
  if (/study design:\s*descriptive epidemiology|descriptive epidemiology study/.test(lower)) return 'case series';
  if (/case series/.test(lower)) return 'case series';
  if (
    /prospective cohort|prospective study|prospectively investigate|prospectively followed|followed prospectively|one-season prospective cohort study|prospective cohort study/.test(lower)
  ) {
    return 'prospective cohort';
  }
  if (/randomi[sz]ed controlled trial|cluster-randomi[sz]ed|intervention study/.test(lower)) {
    return 'other';
  }
  return null;
}

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
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
      'id,assigned_study_id,status,title,lead_author,year,journal,doi,extracted_title,original_file_name,storage_object_path',
      (query) => query.in('status', INCLUDED_STATUSES).order('assigned_study_id', { ascending: true }),
    ),
    fetchAllRows(supabase, 'extractions', 'id,paper_id,tab', (query) => query.eq('tab', 'studyDetails')),
    fetchAllRows(
      supabase,
      'extraction_fields',
      'id,extraction_id,field_id,value',
      (query) => query.in('field_id', ['leadAuthor', 'yearOfPublication', 'journal', 'doi', 'studyDesign']),
    ),
  ]);

  const pdfPaths = walkPdfFiles(repoRoot);
  const pdfIndex = buildPdfIndex(pdfPaths);
  const extractionByPaperId = new Map(extractions.map((row) => [row.paper_id, row]));
  const fieldByKey = new Map(extractionFields.map((row) => [`${row.extraction_id}:${row.field_id}`, row]));

  const report = [];
  const paperUpdates = [];
  const extractionInserts = [];
  const fieldUpdates = [];

  for (const paper of papers) {
    const extraction = extractionByPaperId.get(paper.id);
    const current = {
      leadAuthor: extraction ? (fieldByKey.get(`${extraction.id}:leadAuthor`)?.value || '').trim() : '',
      yearOfPublication: extraction ? (fieldByKey.get(`${extraction.id}:yearOfPublication`)?.value || '').trim() : '',
      journal: extraction ? (fieldByKey.get(`${extraction.id}:journal`)?.value || '').trim() : '',
      doi: extraction ? (fieldByKey.get(`${extraction.id}:doi`)?.value || '').trim() : '',
      studyDesign: extraction ? (fieldByKey.get(`${extraction.id}:studyDesign`)?.value || '').trim() : '',
    };

    const needsAnything =
      !current.leadAuthor ||
      !current.yearOfPublication ||
      !current.journal ||
      !current.doi ||
      !current.studyDesign;
    if (!needsAnything) continue;

    const pdfPath = findLocalPdf(paper, pdfIndex, pdfPaths);
    if (!pdfPath) continue;
    const text = extractPdfText(pdfPath);
    if (!text.trim()) continue;

    const doi = extractDoi(text);
    let crossref = null;
    if (doi) {
      crossref = await fetchCrossref(doi);
      await new Promise((resolve) => setTimeout(resolve, 125));
    }

    const derived = {
      leadAuthor: current.leadAuthor || formatLeadAuthorFromCrossref(crossref?.author?.[0]),
      yearOfPublication:
        current.yearOfPublication ||
        paper.year ||
        String(crossref?.issued?.['date-parts']?.[0]?.[0] ?? '').trim() ||
        '',
      journal: current.journal || crossref?.['container-title']?.[0] || extractJournalFromText(text) || '',
      doi: current.doi || paper.doi || doi || '',
      studyDesign: current.studyDesign || extractStudyDesign(text) || '',
    };

    const pendingPaper = {};
    const pendingFields = [];

    if (!paper.lead_author && derived.leadAuthor) pendingPaper.lead_author = derived.leadAuthor;
    if (!paper.year && derived.yearOfPublication) pendingPaper.year = derived.yearOfPublication;
    if (!paper.journal && derived.journal) pendingPaper.journal = derived.journal;
    if (!paper.doi && derived.doi) pendingPaper.doi = derived.doi;

    const candidateFields = [
      ['leadAuthor', derived.leadAuthor],
      ['yearOfPublication', derived.yearOfPublication],
      ['journal', derived.journal],
      ['doi', derived.doi],
      ['studyDesign', derived.studyDesign],
    ];

    for (const [fieldId, value] of candidateFields) {
      if (!value) continue;
      const existing = current[fieldId] || '';
      if (!existing) {
        pendingFields.push({ fieldId, value });
      }
    }

    if (Object.keys(pendingPaper).length === 0 && pendingFields.length === 0) {
      continue;
    }

    report.push({
      studyId: paper.assigned_study_id,
      status: paper.status,
      pdfPath,
      derived,
      pendingPaper,
      pendingFields,
      doiSource: doi ? 'pdf-text' : null,
      crossrefUsed: Boolean(crossref),
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

    if (pendingFields.length > 0) {
      fieldUpdates.push({
        paperId: paper.id,
        fields: pendingFields,
      });
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:]/g, '-');
  const reportPath = path.join(outputDir, `study-details-pdf-backfill-${stamp}.json`);
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
      papersUpdated: paperUpdates.length,
      fieldUpdateGroups: fieldUpdates.length,
      sample: report.slice(0, 12),
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
  for (const update of fieldUpdates) {
    const extraction = freshExtractionByPaperId.get(update.paperId);
    if (!extraction) continue;
    for (const field of update.fields) {
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
