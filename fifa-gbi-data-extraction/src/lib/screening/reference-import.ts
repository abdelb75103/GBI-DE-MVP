import { calculateFuzzyTitleScore, normalizeDoi } from '@/lib/dedupe';

export type ImportedReference = {
  title: string;
  abstract: string | null;
  leadAuthor: string | null;
  authors: string | null;
  journal: string | null;
  year: string | null;
  doi: string | null;
  sourceRecordId: string | null;
  sourceLabel: string;
  raw: Record<string, string>;
};

export type ReferenceFormat = 'csv' | 'ris' | 'nbib';

const normalizeWhitespace = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const stripBom = (value: string) => value.replace(/^\uFEFF/, '');

const firstNonEmpty = (...values: Array<unknown>) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return '';
};

const getCaseInsensitive = (row: Record<string, string>, keys: string[]) => {
  const normalizedKeys = new Map(Object.keys(row).map((key) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), key]));
  for (const key of keys) {
    const match = normalizedKeys.get(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (match) return row[match];
  }
  return '';
};

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;
  const source = stripBom(text);

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => normalizeWhitespace(header));
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = normalizeWhitespace(values[index]);
    });
    return record;
  });
}

const splitTaggedRecords = (text: string, tagPattern: RegExp) => {
  const records: Array<Record<string, string[]>> = [];
  let current: Record<string, string[]> = {};
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

const pickAuthor = (authors: string[]) => {
  const first = authors.map(normalizeWhitespace).find(Boolean);
  if (!first) return null;
  const [surname, initials] = first.split(',').map((part) => normalizeWhitespace(part));
  return [surname, initials].filter(Boolean).join(' ') || first;
};

export function parseReferences(text: string, fileName: string, sourceLabel: string): ImportedReference[] {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.ris')) {
    return splitTaggedRecords(text, /^([A-Z0-9]{2})\s+-\s+(.*)$/).map((record) => {
      const title = firstNonEmpty(record.TI?.[0], record.T1?.[0], record.CT?.[0]);
      const abstract = firstNonEmpty(record.AB?.join(' ')) || null;
      const authors = record.AU ?? record.A1 ?? [];
      return {
        title,
        abstract,
        leadAuthor: pickAuthor(authors),
        authors: authors.join('; ') || null,
        journal: firstNonEmpty(record.JO?.[0], record.JF?.[0], record.T2?.[0]) || null,
        year: firstNonEmpty(record.PY?.[0], record.Y1?.[0])?.slice(0, 4) || null,
        doi: firstNonEmpty(record.DO?.[0]) || null,
        sourceRecordId: firstNonEmpty(record.ID?.[0], record.UR?.[0]) || null,
        sourceLabel,
        raw: Object.fromEntries(Object.entries(record).map(([key, values]) => [key, values.join(' | ')])),
      };
    }).filter((record) => record.title);
  }

  if (lowerName.endsWith('.nbib') || lowerName.endsWith('.txt')) {
    return splitTaggedRecords(text, /^([A-Z]{2,4})\s+-\s+(.*)$/).map((record) => {
      const authors = record.AU ?? record.FAU ?? [];
      return {
        title: firstNonEmpty(record.TI?.join(' '), record.TT?.join(' ')),
        abstract: firstNonEmpty(record.AB?.join(' ')) || null,
        leadAuthor: pickAuthor(authors),
        authors: authors.join('; ') || null,
        journal: firstNonEmpty(record.JT?.[0], record.TA?.[0]) || null,
        year: firstNonEmpty(record.DP?.[0])?.match(/\d{4}/)?.[0] ?? null,
        doi: firstNonEmpty(record.AID?.find((value) => /\[doi\]/i.test(value))?.replace(/\s*\[doi\]\s*/i, '')) || null,
        sourceRecordId: firstNonEmpty(record.PMID?.[0]) || null,
        sourceLabel,
        raw: Object.fromEntries(Object.entries(record).map(([key, values]) => [key, values.join(' | ')])),
      };
    }).filter((record) => record.title);
  }

  return parseCsv(text).map((row) => {
    const title = firstNonEmpty(getCaseInsensitive(row, ['Title', 'Article Title', 'Study', 'Name']));
    const authorText = firstNonEmpty(getCaseInsensitive(row, ['Authors', 'Author', 'First Author']));
    return {
      title,
      abstract: firstNonEmpty(getCaseInsensitive(row, ['Abstract', 'Abstract Note', 'Summary'])) || null,
      leadAuthor: firstNonEmpty(getCaseInsensitive(row, ['Lead Author', 'First Author']), authorText.split(/[;,]/)[0]) || null,
      authors: authorText || null,
      journal: firstNonEmpty(getCaseInsensitive(row, ['Journal', 'Publication', 'Source Title'])) || null,
      year: firstNonEmpty(getCaseInsensitive(row, ['Published Year', 'Year', 'Publication Year']))?.match(/\d{4}/)?.[0] ?? null,
      doi: firstNonEmpty(getCaseInsensitive(row, ['DOI', 'DOI URL'])) || null,
      sourceRecordId: firstNonEmpty(getCaseInsensitive(row, ['Covidence #', 'PMID', 'ID', 'Ref', 'Record ID'])) || null,
      sourceLabel,
      raw: row,
    };
  }).filter((record) => record.title);
}

export const normalizeImportedDoi = (doi: string | null) => normalizeDoi(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');

export async function enrichReference(reference: ImportedReference): Promise<ImportedReference & { enrichment: Record<string, unknown> }> {
  if (reference.abstract && reference.doi && reference.journal) {
    return { ...reference, enrichment: { provider: 'import', enriched: false } };
  }

  const query = reference.doi ? `DOI:${normalizeImportedDoi(reference.doi)}` : reference.title;
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=1`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      return { ...reference, enrichment: { provider: 'europe_pmc', enriched: false, error: response.status } };
    }
    const payload = await response.json() as {
      resultList?: { result?: Array<Record<string, string | undefined>> };
    };
    const result = payload.resultList?.result?.[0];
    if (!result) {
      return { ...reference, enrichment: { provider: 'europe_pmc', enriched: false } };
    }
    const titleScore = calculateFuzzyTitleScore(reference.title, result.title);
    if (titleScore < 80 && !reference.doi) {
      return { ...reference, enrichment: { provider: 'europe_pmc', enriched: false, titleScore } };
    }
    return {
      ...reference,
      abstract: reference.abstract ?? result.abstractText ?? null,
      journal: reference.journal ?? result.journalTitle ?? null,
      year: reference.year ?? result.pubYear ?? null,
      doi: reference.doi ?? result.doi ?? null,
      sourceRecordId: reference.sourceRecordId ?? result.pmid ?? result.id ?? null,
      enrichment: {
        provider: 'europe_pmc',
        enriched: true,
        titleScore,
        pmid: result.pmid ?? null,
      },
    };
  } catch (error) {
    return {
      ...reference,
      enrichment: {
        provider: 'europe_pmc',
        enriched: false,
        error: error instanceof Error ? error.message : 'enrichment failed',
      },
    };
  }
}
