import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SEARCH_BATCH = 'second';
const SEARCH_RUN_DATE = '2026-05-26';
const SEARCH_PROVIDED_BY = 'Ishanka Weerasekara';
const SEARCH_BATCH_LABEL = `Second search - Ishanka - ${SEARCH_RUN_DATE}`;
const IMPORT_DIR = 'data/imports/second-search-2026-05-26';
const DEFAULT_FILES = [
  { source: 'Medline', fileName: '20260526 Medline ris (44).ris' },
  { source: 'Embase', fileName: '20260526 Embase.ris' },
  { source: 'SportDiscus', fileName: '20260526 SportDiscus.ris' },
  { source: 'PubMed', fileName: '20260526 Pubmed.nbib' },
];

const stripBom = (value) => value.replace(/^\uFEFF/, '');
const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeText = (text) => String(text ?? '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\w\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeDoi = (doi) => String(doi ?? '')
  .trim()
  .toLowerCase()
  .replace(/^doi:\s*/i, '')
  .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');

const extractDoi = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const match = normalized.match(/10\.\d{4,9}\/[^\s,;"']+/i);
  return match?.[0].replace(/[.)\]]+$/, '') ?? '';
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return '';
};

const duplicateKey = (title, author, year) => `${normalizeText(title)}|${normalizeText(author)}|${year?.trim() || ''}`;

const prepareTitle = (title) => {
  const normalized = normalizeText(title);
  return {
    normalized,
    tokens: new Set(normalized.split(' ').filter((word) => word.length > 2)),
  };
};

const titleScore = (titleA, titleB) => {
  const a = prepareTitle(titleA);
  const b = prepareTitle(titleB);
  if (!a.normalized || !b.normalized || a.tokens.size === 0 || b.tokens.size === 0) return 0;

  const longer = a.normalized.length >= b.normalized.length ? a.normalized : b.normalized;
  const shorter = a.normalized.length < b.normalized.length ? a.normalized : b.normalized;
  const substringScore = longer.includes(shorter) ? (shorter.length / longer.length) * 100 : 0;

  const smaller = a.tokens.size <= b.tokens.size ? a.tokens : b.tokens;
  const larger = a.tokens.size <= b.tokens.size ? b.tokens : a.tokens;
  let intersectionSize = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersectionSize += 1;
  }
  const unionSize = a.tokens.size + b.tokens.size - intersectionSize;
  return Math.round(Math.max((intersectionSize / unionSize) * 100, substringScore));
};

const splitTaggedRecords = (text, tagPattern) => {
  const records = [];
  let current = {};
  let activeTag = '';

  for (const rawLine of stripBom(text).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const match = line.match(tagPattern);
    if (match) {
      const tag = match[1];
      const value = normalizeWhitespace(match[2]);
      if (tag === 'ER' || tag === 'PMID') {
        if (Object.keys(current).length > 0 && tag === 'PMID') {
          records.push(current);
          current = {};
        }
      }
      activeTag = tag;
      current[tag] = [...(current[tag] ?? []), value];
      if (tag === 'ER') {
        records.push(current);
        current = {};
        activeTag = '';
      }
      continue;
    }
    if ((line.startsWith(' ') || line.startsWith('\t')) && activeTag) {
      const values = current[activeTag] ?? [];
      values[values.length - 1] = normalizeWhitespace(`${values[values.length - 1] ?? ''} ${line}`);
      current[activeTag] = values;
    }
  }
  if (Object.keys(current).length > 0) records.push(current);
  return records;
};

const pickAuthor = (authors) => {
  const first = authors.map(normalizeWhitespace).find(Boolean);
  if (!first) return null;
  const [surname, initials] = first.split(',').map((part) => normalizeWhitespace(part));
  return [surname, initials].filter(Boolean).join(' ') || first;
};

const parseReferences = (text, fileName, source) => {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.ris')) {
    return splitTaggedRecords(text, /^([A-Z0-9]{2,4})\s*-\s*(.*)$/).map((record) => {
      const title = firstNonEmpty(record.TI?.[0], record.T1?.[0], record.CT?.[0]);
      const authors = record.AU ?? record.A1 ?? [];
      return {
        source,
        importFileName: fileName,
        title,
        abstract: firstNonEmpty(record.AB?.join(' '), record.N2?.join(' ')) || null,
        leadAuthor: pickAuthor(authors),
        authors: authors.join('; ') || null,
        journal: firstNonEmpty(record.JO?.[0], record.JF?.[0], record.T2?.[0]) || null,
        year: firstNonEmpty(record.PY?.[0], record.Y1?.[0])?.slice(0, 4) || null,
        doi: extractDoi(firstNonEmpty(record.DO?.[0])) || null,
        sourceRecordId: firstNonEmpty(record.ID?.[0], record.UR?.[0]) || null,
        raw: Object.fromEntries(Object.entries(record).map(([key, values]) => [key, values.join(' | ')])),
      };
    }).filter((record) => record.title);
  }

  if (lowerName.endsWith('.nbib') || lowerName.endsWith('.txt')) {
    return splitTaggedRecords(text, /^([A-Z]{2,4})\s*-\s*(.*)$/).map((record) => {
      const authors = record.AU ?? record.FAU ?? [];
      return {
        source,
        importFileName: fileName,
        title: firstNonEmpty(record.TI?.join(' '), record.TT?.join(' ')),
        abstract: firstNonEmpty(record.AB?.join(' ')) || null,
        leadAuthor: pickAuthor(authors),
        authors: authors.join('; ') || null,
        journal: firstNonEmpty(record.JT?.[0], record.TA?.[0]) || null,
        year: firstNonEmpty(record.DP?.[0])?.match(/\d{4}/)?.[0] ?? null,
        doi: extractDoi(firstNonEmpty(record.AID?.find((value) => /\[doi\]/i.test(value))?.replace(/\s*\[doi\]\s*/i, ''))) || null,
        sourceRecordId: firstNonEmpty(record.PMID?.[0]) || null,
        raw: Object.fromEntries(Object.entries(record).map(([key, values]) => [key, values.join(' | ')])),
      };
    }).filter((record) => record.title);
  }

  throw new Error(`Unsupported reference file type: ${fileName}`);
};

const parseEnvFile = async (envPath) => {
  const values = {};
  const text = await fs.readFile(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    apply: false,
    dir: path.join(process.cwd(), IMPORT_DIR),
    env: path.join(process.cwd(), '.env.local'),
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dir') options.dir = args[++index];
    else if (arg === '--env') options.env = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

const fetchAll = async (supabase, table, select, buildQuery) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(select).range(from, from + 999);
    query = buildQuery ? buildQuery(query) : query;
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const addCandidate = (state, record) => {
  const prepared = {
    ...record,
    normalizedDoi: normalizeDoi(record.normalized_doi ?? record.doi) || null,
    duplicateKey: duplicateKey(record.title, record.leadAuthor, record.year),
  };
  state.all.push(prepared);
  if (prepared.normalizedDoi) {
    state.byDoi.set(prepared.normalizedDoi, [...(state.byDoi.get(prepared.normalizedDoi) ?? []), prepared]);
  }
  if (prepared.duplicateKey && !state.byKey.has(prepared.duplicateKey)) {
    state.byKey.set(prepared.duplicateKey, prepared);
  }
};

const findStrictDuplicate = (record, state) => {
  const doi = normalizeDoi(record.normalized_doi ?? record.doi);
  if (doi) {
    const match = (state.byDoi.get(doi) ?? [])
      .map((candidate) => ({ candidate, score: titleScore(record.title, candidate.title) }))
      .filter((candidate) => candidate.score >= 80)
      .sort((a, b) => b.score - a.score)[0];
    if (match) return { duplicate: true, reason: 'doi', score: match.score, matched: match.candidate };
  }

  const exact = state.byKey.get(duplicateKey(record.title, record.leadAuthor, record.year));
  if (exact) return { duplicate: true, reason: 'title_author_year', score: 100, matched: exact };
  return { duplicate: false };
};

const nextStudyIds = async (supabase, count) => {
  const [paperRows, screeningRows] = await Promise.all([
    fetchAll(supabase, 'papers', 'assigned_study_id'),
    fetchAll(supabase, 'screening_records', 'assigned_study_id'),
  ]);

  const maxSequence = [...paperRows, ...screeningRows].reduce((max, row) => {
    const match = /^S(\d+)$/i.exec(row.assigned_study_id ?? '');
    const sequence = match ? Number.parseInt(match[1], 10) : 0;
    return Math.max(max, sequence);
  }, 0);

  return Array.from({ length: count }, (_, index) => `S${String(maxSequence + index + 1).padStart(3, '0')}`);
};

const chunk = (values, size) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const main = async () => {
  const options = parseArgs();
  const env = await parseEnvFile(options.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase URL or service role key.');
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const sourceRecords = [];
  for (const item of DEFAULT_FILES) {
    const filePath = path.join(options.dir, item.fileName);
    const text = await fs.readFile(filePath, 'utf8');
    sourceRecords.push(...parseReferences(text, item.fileName, item.source));
  }

  const screeningRows = await fetchAll(
    supabase,
    'screening_records',
    'id, assigned_study_id, stage, title, lead_author, year, doi, normalized_doi, metadata',
  );
  const paperRows = await fetchAll(
    supabase,
    'papers',
    'id, assigned_study_id, title, extracted_title, lead_author, year, doi, normalized_doi',
  );

  const baselineState = { all: [], byDoi: new Map(), byKey: new Map() };
  for (const row of screeningRows) {
    if (row.metadata?.searchBatchLabel === SEARCH_BATCH_LABEL) continue;
    addCandidate(baselineState, {
      ...row,
      sourceTable: 'screening_records',
      title: row.title,
      leadAuthor: row.lead_author,
    });
  }
  for (const row of paperRows) {
    addCandidate(baselineState, {
      ...row,
      sourceTable: 'papers',
      stage: 'extraction',
      title: row.extracted_title ?? row.title,
      leadAuthor: row.lead_author,
    });
  }

  const strictImported = [];
  const strictDuplicates = [];
  for (const record of sourceRecords) {
    const duplicate = findStrictDuplicate(record, baselineState);
    if (duplicate.duplicate) {
      strictDuplicates.push({ record, duplicate });
      continue;
    }
    strictImported.push(record);
    addCandidate(baselineState, {
      sourceTable: 'pending_second_search',
      stage: 'title_abstract',
      title: record.title,
      leadAuthor: record.leadAuthor,
      year: record.year,
      doi: record.doi,
      normalized_doi: normalizeDoi(record.doi),
    });
  }

  const actualSecondBatchRows = screeningRows.filter((row) => row.metadata?.searchBatchLabel === SEARCH_BATCH_LABEL);
  const previouslyRestoredInBatch = actualSecondBatchRows.filter((row) => row.metadata?.restoredAfterDeduplicationAudit).length;
  const actualState = { all: [], byDoi: new Map(), byKey: new Map() };
  for (const row of actualSecondBatchRows) {
    addCandidate(actualState, {
      ...row,
      sourceTable: 'screening_records',
      title: row.title,
      leadAuthor: row.lead_author,
    });
  }

  const restoreCandidates = [];
  const alreadyPresent = [];
  for (const record of strictImported) {
    const duplicate = findStrictDuplicate(record, actualState);
    if (duplicate.duplicate) {
      alreadyPresent.push({ record, duplicate });
      continue;
    }
    restoreCandidates.push(record);
    addCandidate(actualState, {
      sourceTable: 'pending_restore',
      stage: 'title_abstract',
      title: record.title,
      leadAuthor: record.leadAuthor,
      year: record.year,
      doi: record.doi,
      normalized_doi: normalizeDoi(record.doi),
    });
  }

  let restored = 0;
  const now = new Date().toISOString();
  const restoredRows = restoreCandidates.map((record) => ({
    title: record.title,
    source: record.source,
    doi: normalizeDoi(record.doi) || null,
    hasAbstract: Boolean(record.abstract?.trim()),
  }));

  if (options.apply && restoreCandidates.length > 0) {
    const studyIds = await nextStudyIds(supabase, restoreCandidates.length);
    const rows = restoreCandidates.map((record, index) => ({
      id: crypto.randomUUID(),
      stage: 'title_abstract',
      assigned_study_id: studyIds[index],
      title: record.title.trim(),
      abstract: record.abstract ?? null,
      lead_author: record.leadAuthor,
      journal: record.journal,
      year: record.year,
      doi: record.doi,
      normalized_doi: normalizeDoi(record.doi) || null,
      source_label: `${SEARCH_BATCH_LABEL} - ${record.source}`,
      source_record_id: record.sourceRecordId,
      ai_status: 'not_run',
      metadata: {
        searchBatch: SEARCH_BATCH,
        searchBatchLabel: SEARCH_BATCH_LABEL,
        searchRunDate: SEARCH_RUN_DATE,
        searchProvidedBy: SEARCH_PROVIDED_BY,
        importFileName: record.importFileName,
        importSource: record.source,
        importSourceLabel: `${SEARCH_BATCH_LABEL} - ${record.source}`,
        importRaw: record.raw,
        normalizedDoi: normalizeDoi(record.doi) || null,
        duplicateKeyV2: crypto.createHash('sha256').update(duplicateKey(record.title, record.leadAuthor, record.year)).digest('hex'),
        titleFingerprint: normalizeText(record.title),
        restoredAfterDeduplicationAudit: true,
        restoredReason: 'fuzzy_title_removed_in_initial_import',
        restoredAt: now,
      },
      created_at: now,
      updated_at: now,
    }));

    for (const batch of chunk(rows, 250)) {
      const { error } = await supabase.from('screening_records').insert(batch);
      if (error) throw new Error(`Failed to insert restored records: ${error.message}`);
      restored += batch.length;
    }
  }

  const report = {
    mode: options.apply ? 'apply' : 'dry-run',
    searchBatchLabel: SEARCH_BATCH_LABEL,
    parsed: sourceRecords.length,
    strictDuplicateRemoval: strictDuplicates.length,
    strictExpectedImported: strictImported.length,
    actualSecondBatchBeforeRestore: actualSecondBatchRows.length,
    previouslyRestoredInBatch,
    alreadyPresentUnderStrictRules: alreadyPresent.length,
    restoreCandidates: restoreCandidates.length,
    restored,
    restoredWithAbstracts: restoreCandidates.filter((record) => record.abstract?.trim()).length,
    restoredMissingAbstracts: restoreCandidates.filter((record) => !record.abstract?.trim()).length,
    restoredRows,
  };

  const reportFileName = options.apply ? 'FUZZY_RESTORE_REPORT.json' : 'FUZZY_RESTORE_DRY_RUN_REPORT.json';
  await fs.writeFile(path.join(options.dir, reportFileName), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
