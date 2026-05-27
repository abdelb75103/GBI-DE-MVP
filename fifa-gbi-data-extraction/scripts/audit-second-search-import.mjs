import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SEARCH_BATCH_LABEL = 'Second search - Ishanka - 2026-05-26';
const IMPORT_DIR = 'data/imports/second-search-2026-05-26';
const DEFAULT_FILES = [
  { source: 'Medline', fileName: '20260526 Medline ris (44).ris' },
  { source: 'Embase', fileName: '20260526 Embase.ris' },
  { source: 'SportDiscus', fileName: '20260526 SportDiscus.ris' },
  { source: 'PubMed', fileName: '20260526 Pubmed.nbib' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stripBom = (value) => value.replace(/^\uFEFF/, '');
const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '));

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
  return String(doi)
    .trim()
    .toLowerCase()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
};

const extractDoi = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const match = normalized.match(/10\.\d{4,9}\/[^\s,;"']+/i);
  return match?.[0].replace(/[.)\]]+$/, '') ?? '';
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
  return preparedTitleScore(a, b);
};

const preparedTitleScore = (a, b) => {
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
        title,
        abstract: firstNonEmpty(record.AB?.join(' '), record.N2?.join(' ')) || null,
        leadAuthor: pickAuthor(authors),
        year: firstNonEmpty(record.PY?.[0], record.Y1?.[0])?.slice(0, 4) || null,
        doi: extractDoi(firstNonEmpty(record.DO?.[0])) || null,
        sourceRecordId: firstNonEmpty(record.ID?.[0], record.UR?.[0]) || null,
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
        year: firstNonEmpty(record.DP?.[0])?.match(/\d{4}/)?.[0] ?? null,
        doi: extractDoi(firstNonEmpty(record.AID?.find((value) => /\[doi\]/i.test(value))?.replace(/\s*\[doi\]\s*/i, ''))) || null,
        sourceRecordId: firstNonEmpty(record.PMID?.[0]) || null,
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
    applyAbstracts: false,
    dir: path.join(process.cwd(), IMPORT_DIR),
    env: path.join(process.cwd(), '.env.local'),
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply-abstracts') options.applyAbstracts = true;
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
    preparedTitle: prepareTitle(record.title),
  };
  state.all.push(prepared);
  if (prepared.normalizedDoi) {
    state.byDoi.set(prepared.normalizedDoi, [...(state.byDoi.get(prepared.normalizedDoi) ?? []), prepared]);
  }
  if (prepared.duplicateKey && !state.byKey.has(prepared.duplicateKey)) {
    state.byKey.set(prepared.duplicateKey, prepared);
  }
};

const findDuplicate = (record, state) => {
  const doi = normalizeDoi(record.doi);
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

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const writeCsv = async (filePath, rows) => {
  const headers = [
    'source',
    'reason',
    'score',
    'matched_area',
    'matched_study_id',
    'title',
    'matched_title',
    'doi',
    'matched_doi',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];
  await fs.writeFile(filePath, `${lines.join('\n')}\n`);
};

const requestJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FIFA-GBI-title-abstract-screening/1.0 (local import audit)' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const europePmcSearch = async (query) => {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=3`;
  const payload = await requestJson(url);
  return payload?.resultList?.result ?? [];
};

const crossrefByDoi = async (doi) => {
  if (!doi) return null;
  const payload = await requestJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const item = payload?.message;
  const abstract = stripTags(item?.abstract);
  const title = Array.isArray(item?.title) ? item.title[0] : null;
  if (!abstract || !title) return null;
  return { provider: 'crossref', title, abstract, score: null };
};

const ncbiByPmid = async (pmid, expectedTitle) => {
  if (!/^\d+$/.test(String(pmid ?? ''))) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=xml`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FIFA-GBI-title-abstract-screening/1.0 (local import audit)' },
    });
    if (!response.ok) return null;
    const xml = await response.text();
    const title = stripTags(xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? '');
    const abstractParts = [...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((match) => stripTags(match[1]));
    const abstract = normalizeWhitespace(abstractParts.join(' '));
    if (!title || !abstract) return null;
    return { provider: 'ncbi_pubmed', title, abstract, score: titleScore(expectedTitle, title) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const mapWithConcurrency = async (items, concurrency, iteratee) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await iteratee(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

const findAbstract = async (record) => {
  const doi = normalizeDoi(record.normalized_doi ?? record.doi);
  const pmid = String(record.source_record_id ?? '').match(/^\d+$/)?.[0] ?? null;
  const queries = [];
  if (doi) queries.push({ provider: 'europe_pmc_doi', query: `DOI:"${doi}"`, minScore: 60 });
  if (pmid) queries.push({ provider: 'europe_pmc_pmid', query: `EXT_ID:${pmid} AND SRC:MED`, minScore: 0 });

  for (const item of queries) {
    const results = await europePmcSearch(item.query);
    const match = results
      .filter((result) => result.abstractText && result.title)
      .map((result) => ({ result, score: titleScore(record.title, result.title) }))
      .filter((result) => result.score >= item.minScore)
      .sort((a, b) => b.score - a.score)[0];
    if (match) {
      return {
        provider: item.provider,
        title: match.result.title,
        abstract: stripTags(match.result.abstractText),
        score: match.score,
        externalId: match.result.pmid ?? match.result.id ?? null,
      };
    }
    await sleep(120);
  }

  const ncbi = await ncbiByPmid(pmid, record.title);
  if (ncbi) return ncbi;
  await sleep(120);

  const crossref = await crossrefByDoi(doi);
  if (crossref) {
    crossref.score = titleScore(record.title, crossref.title);
    if (crossref.score >= 60) return crossref;
  }

  return null;
};

const main = async () => {
  const options = parseArgs();
  const env = await parseEnvFile(options.env);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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

  const state = { all: [], byDoi: new Map(), byKey: new Map() };
  for (const row of screeningRows) {
    if (row.metadata?.searchBatchLabel === SEARCH_BATCH_LABEL) continue;
    addCandidate(state, {
      ...row,
      sourceTable: 'screening_records',
      title: row.title,
      leadAuthor: row.lead_author,
    });
  }
  for (const row of paperRows) {
    addCandidate(state, {
      ...row,
      sourceTable: 'papers',
      stage: 'extraction',
      title: row.extracted_title ?? row.title,
      leadAuthor: row.lead_author,
    });
  }

  const imported = [];
  const duplicates = [];
  for (const record of sourceRecords) {
    const duplicate = findDuplicate(record, state);
    if (duplicate.duplicate) {
      const matched = duplicate.matched;
      duplicates.push({
        source: record.source,
        reason: duplicate.reason,
        score: duplicate.score,
        matched_area: matched.sourceTable === 'pending_second_search'
          ? 'within_second_search'
          : matched.sourceTable === 'papers'
            ? 'existing_extraction'
            : `existing_${matched.stage}`,
        matched_study_id: matched.assigned_study_id ?? '',
        title: record.title,
        matched_title: matched.title,
        doi: normalizeDoi(record.doi),
        matched_doi: normalizeDoi(matched.normalized_doi ?? matched.doi),
      });
      continue;
    }
    imported.push(record);
    addCandidate(state, {
      id: `pending-${imported.length}`,
      assigned_study_id: null,
      sourceTable: 'pending_second_search',
      stage: 'title_abstract',
      title: record.title,
      leadAuthor: record.leadAuthor,
      year: record.year,
      doi: record.doi,
      normalized_doi: normalizeDoi(record.doi),
    });
  }

  const duplicateSummary = duplicates.reduce((summary, row) => {
    summary.byReason[row.reason] = (summary.byReason[row.reason] ?? 0) + 1;
    summary.byMatchedArea[row.matched_area] = (summary.byMatchedArea[row.matched_area] ?? 0) + 1;
    if (row.reason === 'doi' && row.score < 90) summary.riskyDoiTitleMatches += 1;
    if (row.reason === 'fuzzy_title' && row.score < 95) summary.riskyFuzzyMatches += 1;
    return summary;
  }, { byReason: {}, byMatchedArea: {}, riskyDoiTitleMatches: 0, riskyFuzzyMatches: 0 });

  const missingRows = (await fetchAll(
    supabase,
    'screening_records',
    'id, assigned_study_id, title, abstract, doi, normalized_doi, source_record_id, metadata',
    (query) => query.eq('stage', 'title_abstract').eq('metadata->>searchBatchLabel', SEARCH_BATCH_LABEL),
  )).filter((row) => !row.abstract?.trim());

  let checkedMissingAbstracts = 0;
  const abstractFinds = await mapWithConcurrency(missingRows, 5, async (row) => {
    const found = await findAbstract(row);
    checkedMissingAbstracts += 1;
    if (checkedMissingAbstracts % 20 === 0 || checkedMissingAbstracts === missingRows.length) {
      console.error(`Checked missing abstracts: ${checkedMissingAbstracts}/${missingRows.length}`);
    }
    return {
      id: row.id,
      assignedStudyId: row.assigned_study_id,
      title: row.title,
      provider: found?.provider ?? null,
      score: found?.score ?? null,
      found: Boolean(found?.abstract),
      abstract: found?.abstract ?? null,
      externalTitle: found?.title ?? null,
    };
  });

  let updatedAbstracts = 0;
  if (options.applyAbstracts) {
    for (const item of abstractFinds.filter((entry) => entry.found)) {
      const row = missingRows.find((candidate) => candidate.id === item.id);
      const metadata = {
        ...(row?.metadata ?? {}),
        missingAbstractFetchedAt: new Date().toISOString(),
        missingAbstractProvider: item.provider,
        missingAbstractTitleScore: item.score,
      };
      const { error } = await supabase
        .from('screening_records')
        .update({ abstract: item.abstract, metadata, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw new Error(`Failed to update abstract for ${item.assignedStudyId}: ${error.message}`);
      updatedAbstracts += 1;
    }
  }

  const report = {
    searchBatchLabel: SEARCH_BATCH_LABEL,
    parsed: sourceRecords.length,
    reconstructedImported: imported.length,
    reconstructedDuplicates: duplicates.length,
    duplicateSummary,
    missingAbstractsBeforeFetch: missingRows.length,
    abstractsFound: abstractFinds.filter((entry) => entry.found).length,
    abstractsUpdated: updatedAbstracts,
    missingAbstractsAfterFetch: missingRows.length - updatedAbstracts,
    abstractFinds: abstractFinds.map((entry) => {
      const redacted = { ...entry };
      delete redacted.abstract;
      return redacted;
    }),
  };

  await fs.writeFile(path.join(options.dir, 'DEDUPLICATION_AUDIT.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeCsv(path.join(options.dir, 'deduplication-removed-records.csv'), duplicates);
  await fs.writeFile(
    path.join(options.dir, 'MISSING_ABSTRACT_FETCH_REPORT.json'),
    `${JSON.stringify({
      searchBatchLabel: SEARCH_BATCH_LABEL,
      missingAbstractsBeforeFetch: missingRows.length,
      abstractsFound: report.abstractsFound,
      abstractsUpdated: updatedAbstracts,
      missingAbstractsAfterFetch: report.missingAbstractsAfterFetch,
      results: report.abstractFinds,
    }, null, 2)}\n`,
  );

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
