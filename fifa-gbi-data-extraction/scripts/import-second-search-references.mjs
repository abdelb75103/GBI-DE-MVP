import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SEARCH_BATCH = 'second';
const SEARCH_RUN_DATE = '2026-05-26';
const SEARCH_PROVIDED_BY = 'Ishanka Weerasekara';
const SEARCH_BATCH_LABEL = `Second search - Ishanka - ${SEARCH_RUN_DATE}`;

const DEFAULT_FILES = [
  { source: 'Medline', fileName: '20260526 Medline ris (44).ris' },
  { source: 'Embase', fileName: '20260526 Embase.ris' },
  { source: 'SportDiscus', fileName: '20260526 SportDiscus.ris' },
  { source: 'PubMed', fileName: '20260526 Pubmed.nbib' },
];

const stripBom = (value) => value.replace(/^\uFEFF/, '');
const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return '';
};

const normalizeText = (text) => {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeDoi = (doi) => {
  if (!doi) return '';
  return String(doi).trim().toLowerCase().replace(/^doi:\s*/i, '');
};

const extractDoi = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const match = normalized.match(/10\.\d{4,9}\/[^\s,;"']+/i);
  return match?.[0].replace(/[.)\]]+$/, '') ?? '';
};

const generateDuplicateKey = (title, author, year) => crypto
  .createHash('sha256')
  .update(`${normalizeText(title)}|${normalizeText(author)}|${year?.trim() || ''}`)
  .digest('hex');

const prepareTitle = (title) => {
  const normalized = normalizeText(title);
  return {
    normalized,
    tokens: new Set(normalized.split(' ').filter((word) => word.length > 2)),
  };
};

const calculatePreparedFuzzyTitleScore = (prepared1, prepared2) => {
  const normalized1 = prepared1.normalized;
  const normalized2 = prepared2.normalized;
  if (!normalized1 || !normalized2) return 0;

  const tokens1 = prepared1.tokens;
  const tokens2 = prepared2.tokens;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
  const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
  const substringScore = longer.includes(shorter) ? (shorter.length / longer.length) * 100 : 0;

  const smaller = tokens1.size <= tokens2.size ? tokens1 : tokens2;
  const larger = tokens1.size <= tokens2.size ? tokens2 : tokens1;
  let intersectionSize = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersectionSize += 1;
  }
  const unionSize = tokens1.size + tokens2.size - intersectionSize;
  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;

  return Math.round(Math.max(jaccard * 100, substringScore));
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
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    apply: false,
    force: false,
    dir: process.cwd(),
    env: path.join(process.cwd(), '.env.local'),
    files: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dir') {
      options.dir = args[++index];
    } else if (arg === '--env') {
      options.env = args[++index];
    } else if (arg === '--file') {
      const value = args[++index];
      const [source, ...rest] = value.split('=');
      const filePath = rest.join('=');
      if (!source || !filePath) throw new Error('--file must use Source=/path/to/file format');
      options.files.push({ source, filePath });
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.files.length === 0) {
    options.files = DEFAULT_FILES.map((item) => ({
      source: item.source,
      filePath: path.join(options.dir, item.fileName),
    }));
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

const loadExistingCandidates = async (supabase) => {
  const [titleAbstract, fullText, papers] = await Promise.all([
    fetchAll(
      supabase,
      'screening_records',
      'id, assigned_study_id, stage, title, lead_author, year, doi, normalized_doi, metadata',
      (query) => query.eq('stage', 'title_abstract'),
    ),
    fetchAll(
      supabase,
      'screening_records',
      'id, assigned_study_id, stage, title, lead_author, year, doi, normalized_doi, metadata',
      (query) => query.eq('stage', 'full_text'),
    ),
    fetchAll(supabase, 'papers', 'id, assigned_study_id, title, extracted_title, lead_author, year, doi, normalized_doi'),
  ]);

  return [
    ...titleAbstract.map((row) => ({ ...row, sourceTable: 'screening_records', title: row.title, leadAuthor: row.lead_author })),
    ...fullText.map((row) => ({ ...row, sourceTable: 'screening_records', title: row.title, leadAuthor: row.lead_author })),
    ...papers.map((row) => ({
      ...row,
      sourceTable: 'papers',
      stage: 'extraction',
      title: row.extracted_title ?? row.title,
      leadAuthor: row.lead_author,
    })),
  ];
};

const prepareCandidate = (record) => {
  const normalizedDoi = normalizeDoi(record.normalized_doi ?? record.doi) || null;
  const duplicateKey = generateDuplicateKey(record.title, record.leadAuthor, record.year);
  const preparedTitle = prepareTitle(record.title);
  return {
    ...record,
    normalizedDoi,
    duplicateKey,
    preparedTitle,
  };
};

const findDuplicate = (candidate, state) => {
  const candidateDoi = normalizeDoi(candidate.doi);
  const preparedCandidateTitle = prepareTitle(candidate.title);
  if (candidateDoi) {
    const doiMatchesForCandidate = state.byDoi.get(candidateDoi) ?? [];
    const doiMatch = doiMatchesForCandidate
      .map((record) => ({
        record,
        score: calculatePreparedFuzzyTitleScore(preparedCandidateTitle, record.preparedTitle),
      }))
      .filter((match) => match.score >= 80)
      .sort((a, b) => b.score - a.score)[0];
    if (doiMatch) return { duplicate: true, reason: 'doi', score: doiMatch.score, matched: doiMatch.record };
  }

  const key = generateDuplicateKey(candidate.title, candidate.leadAuthor, candidate.year);
  const exactMatch = state.byKey.get(key);
  if (exactMatch) return { duplicate: true, reason: 'title_author_year', score: 100, matched: exactMatch };

  return { duplicate: false, reason: '', score: 0, matched: null };
};

const addCandidateToState = (state, record) => {
  const prepared = prepareCandidate(record);
  state.all.push(prepared);
  if (prepared.normalizedDoi) {
    state.byDoi.set(prepared.normalizedDoi, [...(state.byDoi.get(prepared.normalizedDoi) ?? []), prepared]);
  }
  if (prepared.duplicateKey && !state.byKey.has(prepared.duplicateKey)) {
    state.byKey.set(prepared.duplicateKey, prepared);
  }
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

const increment = (target, key) => {
  target[key] = (target[key] ?? 0) + 1;
};

const main = async () => {
  const options = parseArgs();
  const env = await parseEnvFile(options.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase URL or service role key.');

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const parsedBySource = {};
  const missingAbstractBySource = {};
  const allReferences = [];
  for (const item of options.files) {
    const text = await fs.readFile(item.filePath, 'utf8');
    const records = parseReferences(text, path.basename(item.filePath), item.source);
    parsedBySource[item.source] = records.length;
    missingAbstractBySource[item.source] = records.filter((record) => !record.abstract?.trim()).length;
    allReferences.push(...records.map((record) => ({ ...record, importFileName: path.basename(item.filePath) })));
  }

  const existing = await loadExistingCandidates(supabase);
  const existingSecondSearchRows = existing.filter((record) => record.metadata?.searchBatchLabel === SEARCH_BATCH_LABEL).length;
  if (options.apply && existingSecondSearchRows > 0 && !options.force) {
    throw new Error(
      `${existingSecondSearchRows} records already exist for ${SEARCH_BATCH_LABEL}. Refusing to re-apply without --force.`,
    );
  }
  const candidateState = { all: [], byDoi: new Map(), byKey: new Map() };
  for (const record of existing) {
    addCandidateToState(candidateState, record);
  }
  const duplicateCounts = {};
  const duplicateByMatchedArea = {};
  const duplicateExamples = [];
  const insertable = [];

  for (const reference of allReferences) {
    const duplicate = findDuplicate(reference, candidateState);
    if (duplicate.duplicate) {
      increment(duplicateCounts, duplicate.reason);
      increment(duplicateByMatchedArea, duplicate.matched?.sourceTable === 'papers' ? 'extraction' : duplicate.matched?.stage ?? 'unknown');
      if (duplicateExamples.length < 25) {
        duplicateExamples.push({
          title: reference.title,
          source: reference.source,
          reason: duplicate.reason,
          score: duplicate.score,
          matchedStudyId: duplicate.matched?.assigned_study_id ?? null,
          matchedTitle: duplicate.matched?.title ?? null,
        });
      }
      continue;
    }

    insertable.push(reference);
    addCandidateToState(candidateState, {
      id: `pending-${insertable.length}`,
      assigned_study_id: null,
      sourceTable: 'pending_second_search',
      stage: 'title_abstract',
      title: reference.title,
      leadAuthor: reference.leadAuthor,
      year: reference.year,
      doi: reference.doi,
      normalized_doi: normalizeDoi(reference.doi) || null,
    });
  }

  const report = {
    mode: options.apply ? 'apply' : 'dry-run',
    searchBatch: SEARCH_BATCH,
    searchBatchLabel: SEARCH_BATCH_LABEL,
    searchRunDate: SEARCH_RUN_DATE,
    searchProvidedBy: SEARCH_PROVIDED_BY,
    parsed: allReferences.length,
    parsedBySource,
    removedAfterDeduplication: allReferences.length - insertable.length,
    removedAfterDeduplicationByReason: duplicateCounts,
    removedAfterDeduplicationByMatchedArea: duplicateByMatchedArea,
    imported: 0,
    leftForScreening: insertable.length,
    missingAbstractsInParsedBySource: missingAbstractBySource,
    missingAbstractsLeftForScreening: insertable.filter((record) => !record.abstract?.trim()).length,
    duplicateExamples,
  };

  if (!options.apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const studyIds = await nextStudyIds(supabase, insertable.length);
  const now = new Date().toISOString();
  const rows = insertable.map((reference, index) => ({
    id: crypto.randomUUID(),
    stage: 'title_abstract',
    assigned_study_id: studyIds[index],
    title: reference.title.trim(),
    abstract: reference.abstract ?? null,
    lead_author: reference.leadAuthor,
    journal: reference.journal,
    year: reference.year,
    doi: reference.doi,
    normalized_doi: normalizeDoi(reference.doi) || null,
    source_label: `${SEARCH_BATCH_LABEL} - ${reference.source}`,
    source_record_id: reference.sourceRecordId,
    ai_status: 'not_run',
    metadata: {
      searchBatch: SEARCH_BATCH,
      searchBatchLabel: SEARCH_BATCH_LABEL,
      searchRunDate: SEARCH_RUN_DATE,
      searchProvidedBy: SEARCH_PROVIDED_BY,
      importFileName: reference.importFileName,
      importSource: reference.source,
      importSourceLabel: `${SEARCH_BATCH_LABEL} - ${reference.source}`,
      importRaw: reference.raw,
      normalizedDoi: normalizeDoi(reference.doi) || null,
      duplicateKeyV2: generateDuplicateKey(reference.title, reference.leadAuthor, reference.year),
      titleFingerprint: normalizeText(reference.title),
    },
    created_at: now,
    updated_at: now,
  }));

  for (const batch of chunk(rows, 250)) {
    const { error } = await supabase.from('screening_records').insert(batch);
    if (error) throw new Error(`Failed to insert second-search records: ${error.message}`);
    report.imported += batch.length;
  }

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
