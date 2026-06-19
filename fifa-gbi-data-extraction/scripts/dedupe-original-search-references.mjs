import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SEARCH_RUN_DATE = '2024-05-28';
const SEARCH_BATCH_LABEL = `Original search - Ishanka - ${SEARCH_RUN_DATE}`;
const IMPORT_DIR = path.resolve('data/imports/original-search-2024-05-28');
const OUTPUT_DIR = path.join(IMPORT_DIR, 'deduplicated');

const DEFAULT_FILES = [
  { source: 'Embase', fileName: '20240528 EMBASE 1-3000.ris' },
  { source: 'Embase', fileName: '20240528 EMBASE 3001-6000.ris' },
  { source: 'Embase', fileName: '20240528 EMBASE 6001-9000.ris' },
  { source: 'Embase', fileName: '20240528 EMBASE 9001-12000.ris' },
  { source: 'Embase', fileName: '20240528 EMBASE 12001-15000.ris' },
  { source: 'Embase', fileName: '20240528 EMBASE 15001-15260.ris' },
  { source: 'Medline', fileName: '20240528 Medline 1-2000.ris' },
  { source: 'Medline', fileName: '20240528 Medline 2001-5000.ris' },
  { source: 'Medline', fileName: '20240528 Medline 5001-8000.ris' },
  { source: 'Medline', fileName: '20240528 Medline 8001-11000.ris' },
  { source: 'Medline', fileName: '20240538 Medline 11000-12911.ris' },
  { source: 'SportDiscus', fileName: '20240528 Sportdiscuss 9872.ris' },
  { source: 'PubMed', fileName: '20240528 pubmed First 10000 full texts .nbib' },
];

const STRATEGY_COUNTS = {
  Embase: 15260,
  Medline: 12911,
  SportDiscus: 9877,
  PubMed: 14595,
};

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

const extractDoi = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const match = normalized.match(/10\.\d{4,9}\/[^\s,;"']+/i);
  return match?.[0].replace(/[.)\]]+$/, '') ?? '';
};

const normalizeDoi = (doi) => extractDoi(doi).toLowerCase();

const generateKey = (title, author, year) => crypto
  .createHash('sha256')
  .update(`${normalizeText(title)}|${normalizeText(author)}|${String(year ?? '').trim()}`)
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

const countTaggedRecords = (text, fileName) => {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.ris')) {
    return (stripBom(text).match(/^ER\s*-/gm) ?? []).length;
  }
  if (lowerName.endsWith('.nbib') || lowerName.endsWith('.txt')) {
    return (stripBom(text).match(/^PMID\s*-/gm) ?? []).length;
  }
  return 0;
};

class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(value) {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value]);
    }
    return this.parent[value];
  }

  union(left, right) {
    const rootLeft = this.find(left);
    const rootRight = this.find(right);
    if (rootLeft === rootRight) return false;
    if (this.rank[rootLeft] < this.rank[rootRight]) {
      this.parent[rootLeft] = rootRight;
    } else if (this.rank[rootLeft] > this.rank[rootRight]) {
      this.parent[rootRight] = rootLeft;
    } else {
      this.parent[rootRight] = rootLeft;
      this.rank[rootLeft] += 1;
    }
    return true;
  }
}

const groupBy = (records, keyFn) => {
  const map = new Map();
  records.forEach((record, index) => {
    const key = keyFn(record);
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), index]);
  });
  return map;
};

const completenessScore = (record) => [
  record.abstract ? 30 : 0,
  record.doi ? 20 : 0,
  record.sourceRecordId ? 12 : 0,
  record.authors ? 10 : 0,
  record.journal ? 8 : 0,
  record.year ? 8 : 0,
  record.leadAuthor ? 6 : 0,
  Math.min(record.title.length, 300) / 100,
].reduce((sum, value) => sum + value, 0);

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const toCsv = (rows, columns) => [
  columns.join(','),
  ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
].join('\n');

const risEscape = (value) => normalizeWhitespace(value).replace(/\r?\n/g, ' ');

const toRis = (records) => records.map((record) => {
  const authors = String(record.authors ?? '').split(';').map(normalizeWhitespace).filter(Boolean);
  const lines = [
    'TY  - JOUR',
    `TI  - ${risEscape(record.title)}`,
  ];
  for (const author of authors) lines.push(`AU  - ${risEscape(author)}`);
  if (record.abstract) lines.push(`AB  - ${risEscape(record.abstract)}`);
  if (record.journal) lines.push(`JO  - ${risEscape(record.journal)}`);
  if (record.year) lines.push(`PY  - ${risEscape(record.year)}`);
  if (record.doi) lines.push(`DO  - ${risEscape(record.doi)}`);
  if (record.sourceRecordId) lines.push(`ID  - ${risEscape(record.sourceRecordId)}`);
  lines.push(`N1  - Dedupe group: ${record.dedupeGroupId}; sources: ${risEscape(record.sourceDatabases)}`);
  lines.push('ER  -');
  return lines.join('\n');
}).join('\n\n');

const increment = (target, key, amount = 1) => {
  target[key] = (target[key] ?? 0) + amount;
};

const summarizeReasons = (reasons) => {
  const order = ['doi_title_compatible', 'title_author_year'];
  const unique = new Set(reasons);
  return order.filter((reason) => unique.has(reason)).join('; ') || 'strict_duplicate_cluster';
};

const writeJson = async (filePath, value) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const main = async () => {
  const parsedBySource = {};
  const parsedByFile = {};
  const taggedRecordsBySource = {};
  const taggedRecordsByFile = {};
  const records = [];

  for (const item of DEFAULT_FILES) {
    const filePath = path.join(IMPORT_DIR, item.fileName);
    const text = await fs.readFile(filePath, 'utf8');
    const taggedRecordCount = countTaggedRecords(text, item.fileName);
    const parsed = parseReferences(text, item.fileName, item.source);
    taggedRecordsByFile[item.fileName] = taggedRecordCount;
    increment(taggedRecordsBySource, item.source, taggedRecordCount);
    parsedByFile[item.fileName] = parsed.length;
    increment(parsedBySource, item.source, parsed.length);
    records.push(...parsed.map((record, offset) => ({
      ...record,
      importFileName: item.fileName,
      originalIndex: records.length + offset,
      normalizedDoi: normalizeDoi(record.doi),
      titleAuthorYearKey: record.title && record.leadAuthor && record.year
        ? generateKey(record.title, record.leadAuthor, record.year)
        : '',
      preparedTitle: prepareTitle(record.title),
    })));
  }

  const unionFind = new UnionFind(records.length);
  const edgeReasons = new Map();

  const addEdge = (left, right, reason, score) => {
    unionFind.union(left, right);
    const key = [Math.min(left, right), Math.max(left, right)].join(':');
    edgeReasons.set(key, [...(edgeReasons.get(key) ?? []), { reason, score }]);
  };

  for (const indexes of groupBy(records, (record) => record.normalizedDoi).values()) {
    for (let leftOffset = 0; leftOffset < indexes.length; leftOffset += 1) {
      for (let rightOffset = leftOffset + 1; rightOffset < indexes.length; rightOffset += 1) {
        const left = indexes[leftOffset];
        const right = indexes[rightOffset];
        const score = calculatePreparedFuzzyTitleScore(records[left].preparedTitle, records[right].preparedTitle);
        if (score >= 80) addEdge(left, right, 'doi_title_compatible', score);
      }
    }
  }

  for (const indexes of groupBy(records, (record) => record.titleAuthorYearKey).values()) {
    if (indexes.length < 2) continue;
    const [first, ...rest] = indexes;
    for (const index of rest) addEdge(first, index, 'title_author_year', 100);
  }

  const clusters = new Map();
  records.forEach((record, index) => {
    const root = unionFind.find(index);
    clusters.set(root, [...(clusters.get(root) ?? []), index]);
  });

  const deduplicatedRecords = [];
  const duplicateRows = [];
  const duplicateReasonCounts = {};
  const removedBySource = {};
  const keptRepresentativeBySource = {};
  let dedupeGroupCounter = 0;

  for (const indexes of clusters.values()) {
    dedupeGroupCounter += 1;
    const groupId = `OS20240528-D${String(dedupeGroupCounter).padStart(5, '0')}`;
    const groupRecords = indexes.map((index) => records[index]);
    const sorted = [...groupRecords].sort((left, right) => {
      const scoreDelta = completenessScore(right) - completenessScore(left);
      if (scoreDelta !== 0) return scoreDelta;
      return left.originalIndex - right.originalIndex;
    });
    const representative = sorted[0];
    const groupEdgeReasons = [];
    for (const left of indexes) {
      for (const right of indexes) {
        if (right <= left) continue;
        const edgeKey = [left, right].join(':');
        groupEdgeReasons.push(...(edgeReasons.get(edgeKey) ?? []));
      }
    }
    const groupReasonSummary = summarizeReasons(groupEdgeReasons.map((reason) => reason.reason));
    const memberSources = [...new Set(groupRecords.map((record) => record.source))].sort();
    const memberFiles = [...new Set(groupRecords.map((record) => record.importFileName))].sort();
    const memberSourceIds = [...new Set(groupRecords.map((record) => record.sourceRecordId).filter(Boolean))].sort();

    increment(keptRepresentativeBySource, representative.source);
    const deduplicatedRecord = {
      dedupeGroupId: groupId,
      sourceDatabases: memberSources.join('; '),
      sourceFiles: memberFiles.join('; '),
      sourceRecordIds: memberSourceIds.join('; '),
      duplicateMemberCount: groupRecords.length,
      representativeSource: representative.source,
      representativeImportFileName: representative.importFileName,
      title: representative.title,
      leadAuthor: representative.leadAuthor,
      authors: representative.authors,
      year: representative.year,
      journal: representative.journal,
      doi: representative.doi,
      normalizedDoi: representative.normalizedDoi,
      sourceRecordId: representative.sourceRecordId,
      abstract: representative.abstract,
    };
    deduplicatedRecords.push(deduplicatedRecord);

    for (const duplicate of sorted.slice(1)) {
      increment(duplicateReasonCounts, groupReasonSummary);
      increment(removedBySource, duplicate.source);
      duplicateRows.push({
        dedupeGroupId: groupId,
        removedSource: duplicate.source,
        removedImportFileName: duplicate.importFileName,
        removedTitle: duplicate.title,
        removedLeadAuthor: duplicate.leadAuthor,
        removedYear: duplicate.year,
        removedDoi: duplicate.doi,
        removedSourceRecordId: duplicate.sourceRecordId,
        reason: groupReasonSummary,
        keptRepresentativeSource: representative.source,
        keptRepresentativeImportFileName: representative.importFileName,
        keptRepresentativeTitle: representative.title,
        keptRepresentativeLeadAuthor: representative.leadAuthor,
        keptRepresentativeYear: representative.year,
        keptRepresentativeDoi: representative.doi,
      });
    }
  }

  deduplicatedRecords.sort((left, right) => left.dedupeGroupId.localeCompare(right.dedupeGroupId));
  duplicateRows.sort((left, right) => left.dedupeGroupId.localeCompare(right.dedupeGroupId));

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const dedupedCsvColumns = [
    'dedupeGroupId',
    'sourceDatabases',
    'sourceFiles',
    'sourceRecordIds',
    'duplicateMemberCount',
    'representativeSource',
    'representativeImportFileName',
    'title',
    'leadAuthor',
    'authors',
    'year',
    'journal',
    'doi',
    'normalizedDoi',
    'sourceRecordId',
    'abstract',
  ];
  const removedCsvColumns = [
    'dedupeGroupId',
    'removedSource',
    'removedImportFileName',
    'removedTitle',
    'removedLeadAuthor',
    'removedYear',
    'removedDoi',
    'removedSourceRecordId',
    'reason',
    'keptRepresentativeSource',
    'keptRepresentativeImportFileName',
    'keptRepresentativeTitle',
    'keptRepresentativeLeadAuthor',
    'keptRepresentativeYear',
    'keptRepresentativeDoi',
  ];

  const summary = {
    searchBatchLabel: SEARCH_BATCH_LABEL,
    generatedAt: new Date().toISOString(),
    inputDirectory: IMPORT_DIR,
    outputDirectory: OUTPUT_DIR,
    strategyCounts: STRATEGY_COUNTS,
    availableTaggedRecords: Object.values(taggedRecordsBySource).reduce((sum, value) => sum + value, 0),
    availableTaggedRecordsBySource: taggedRecordsBySource,
    availableTaggedRecordsByFile: taggedRecordsByFile,
    dedupeInputRecords: records.length,
    dedupeInputRecordsBySource: parsedBySource,
    dedupeInputRecordsByFile: parsedByFile,
    excludedRecordsWithoutTitle: Object.values(taggedRecordsBySource).reduce((sum, value) => sum + value, 0) - records.length,
    deduplicatedRecords: deduplicatedRecords.length,
    duplicatesRemoved: duplicateRows.length,
    duplicateReasonCounts,
    removedBySource,
    keptRepresentativeBySource,
    recordsWithYear: deduplicatedRecords.filter((record) => record.year).length,
    recordsWithAbstract: deduplicatedRecords.filter((record) => record.abstract).length,
    recordsWithDoi: deduplicatedRecords.filter((record) => record.doi).length,
    recordsWithSourceRecordId: deduplicatedRecords.filter((record) => record.sourceRecordId).length,
    caveats: [
      'PubMed original-search export is incomplete against the strategy count: 10,000 records are present from 14,595 reported hits.',
      'SportDiscus parsed complete-record count is 9,872 while the strategy document reports 9,877.',
      'Automatic duplicate removal used strict DOI+compatible-title and exact title+lead-author+year matches only; no fuzzy title-only removals were applied.',
    ],
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'original-search-2024-05-28-deduplicated-records.csv'),
    `${toCsv(deduplicatedRecords, dedupedCsvColumns)}\n`,
  );
  await writeJson(
    path.join(OUTPUT_DIR, 'original-search-2024-05-28-deduplicated-records.json'),
    deduplicatedRecords,
  );
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'original-search-2024-05-28-deduplicated-records.ris'),
    `${toRis(deduplicatedRecords)}\n`,
  );
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'original-search-2024-05-28-duplicates-removed.csv'),
    `${toCsv(duplicateRows, removedCsvColumns)}\n`,
  );
  await writeJson(path.join(OUTPUT_DIR, 'DEDUPLICATION_AUDIT.json'), {
    summary,
    duplicatesRemoved: duplicateRows,
  });

  const report = `# Superseded Local Deduplication Reconstruction

Generated: ${summary.generatedAt}

Search batch label: \`${SEARCH_BATCH_LABEL}\`

Input folder: \`${IMPORT_DIR}\`

Output folder: \`${OUTPUT_DIR}\`

This report describes a local deduplication reconstruction for audit/reproducibility only. It does not exactly reproduce Rayyan's duplicate decisions and is not the source of truth for original-search imported, duplicate-removed, or screened totals.

Canonical source-of-truth file:

\`../RAYYAN_SOURCE_OF_TRUTH.md\`

Canonical Rayyan counts:

| Rayyan item | Count |
| --- | ---: |
| Imported references / all references | 48,043 |
| Deleted duplicate records | 24,839 |
| Post-dedupe screening set | 23,204 |
| Total duplicates status/workload count | 37,723 |
| Not duplicate | 426 |
| Unresolved duplicates | 0 |
| Resolved duplicates | 12,458 |

Use \`24,839\`, not \`37,723\`, when reporting duplicate records removed.

## Output Files

- \`original-search-2024-05-28-deduplicated-records.csv\` - local reconstruction output for audit comparison only
- \`original-search-2024-05-28-deduplicated-records.json\` - structured deduplicated records with full field values
- \`original-search-2024-05-28-deduplicated-records.ris\` - RIS-style export of retained representative records
- \`original-search-2024-05-28-duplicates-removed.csv\` - audit trail for every removed duplicate
- \`DEDUPLICATION_AUDIT.json\` - machine-readable summary plus removed-duplicate rows

## Parsed By Source For Local Reconstruction

| Source | Strategy/document count | Available tagged records | Dedupe-input records with title |
| --- | ---: | ---: | ---: |
| Embase | ${STRATEGY_COUNTS.Embase.toLocaleString('en-US')} | ${(taggedRecordsBySource.Embase ?? 0).toLocaleString('en-US')} | ${(parsedBySource.Embase ?? 0).toLocaleString('en-US')} |
| Medline | ${STRATEGY_COUNTS.Medline.toLocaleString('en-US')} | ${(taggedRecordsBySource.Medline ?? 0).toLocaleString('en-US')} | ${(parsedBySource.Medline ?? 0).toLocaleString('en-US')} |
| SportDiscus | ${STRATEGY_COUNTS.SportDiscus.toLocaleString('en-US')} | ${(taggedRecordsBySource.SportDiscus ?? 0).toLocaleString('en-US')} | ${(parsedBySource.SportDiscus ?? 0).toLocaleString('en-US')} |
| PubMed | ${STRATEGY_COUNTS.PubMed.toLocaleString('en-US')} | ${(taggedRecordsBySource.PubMed ?? 0).toLocaleString('en-US')} | ${(parsedBySource.PubMed ?? 0).toLocaleString('en-US')} |

## Dedupe Rules

Automatic duplicate removal used only:

- exact normalized DOI match plus compatible title score of at least 80
- exact normalized title + lead author + year match

No fuzzy title-only duplicate removals were applied.

## Caveats

- PubMed is incomplete against the original strategy count: the available file contains 10,000 of 14,595 reported hits.
- SportDiscus remains five records short against the strategy/document count: 9,872 parsed complete records versus 9,877 reported.
- The local reconstruction can be regenerated for audit comparison if the missing PubMed split or corrected SportDiscus export is obtained, but Rayyan remains the canonical source for the original-search reference flow actually screened.
`;

  await fs.writeFile(path.join(OUTPUT_DIR, 'DEDUPLICATION_REPORT.md'), report);

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
