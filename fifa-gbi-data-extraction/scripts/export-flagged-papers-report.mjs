import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = path.resolve(process.cwd(), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'exports');

const loadEnvFile = (filePath) => {
  const entries = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return null;
      }
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1).trim()];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
};

const parseCsv = (input) => {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    if (char !== '\r') {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
};

const stringifyCsv = (rows) =>
  rows
    .map((row) =>
      row
        .map((value) => {
          const stringValue = value == null ? '' : String(value);
          if (/[",\n]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(','),
    )
    .join('\n');

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const normalizeLookupText = (value) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const titleFromFilename = (title) =>
  normalizeWhitespace(title)
    .replace(/\.pdf$/i, '')
    .replace(/^[^-]+-\s*\d{4}\s*-\s*/i, '')
    .replace(/^[^-]+-\s*/i, '')
    .replace(/\s+\.\.$/, '')
    .trim();

const normalizeFlagReason = (reason) => normalizeWhitespace(reason || '');

const getFlagGroup = (reason) => {
  const normalized = normalizeFlagReason(reason).toLowerCase();

  if (/definition|defintion|no definition/.test(normalized)) {
    return 'Definition issue';
  }

  if (/abstract|poster/.test(normalized)) {
    return 'Abstract or poster only';
  }

  if (/duplicate|previous dataset|retrospective|retrospecvetive|secondary anlysis|3 cohorts/.test(normalized)) {
    return 'Duplicate or overlapping dataset';
  }

  if (/fifa data|^fifa$/.test(normalized)) {
    return 'FIFA tournament data';
  }

  if (/american|ncaa/.test(normalized)) {
    return 'American or non-target competition';
  }

  if (/(exposure|expousre|expsoure|eexposure)/.test(normalized) || /per 100 players/.test(normalized)) {
    return 'Exposure issue';
  }

  if (/cannot access|english version|uplaoded|uploaded|spanish|portuges/.test(normalized)) {
    return 'Access or file issue';
  }

  if (/exclude|incorrect paper|referees not players|american football|recreation and indoor|specifc popualtion|systeatic review|video analysis/.test(normalized)) {
    return 'Likely exclude or out of scope';
  }

  if (/public info/.test(normalized)) {
    return 'Public-data concern';
  }

  if (/check|read note|note/.test(normalized)) {
    return 'Needs manual review';
  }

  if (!normalized) {
    return 'Unspecified';
  }

  return normalizeFlagReason(reason);
};

const findCandidateReviewCsvs = (rootDir) => {
  const candidates = [];
  const queues = [rootDir, path.join(rootDir, 'docs')];

  for (const dir of queues) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      if (/^review_.*included.*\.csv$/i.test(entry.name)) {
        const fullPath = path.join(dir, entry.name);
        candidates.push({
          path: fullPath,
          mtimeMs: fs.statSync(fullPath).mtimeMs,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
};

const loadReviewIndex = (rootDir) => {
  const candidates = findCandidateReviewCsvs(rootDir);
  if (candidates.length === 0) {
    return {
      byDoi: new Map(),
      byTitle: new Map(),
      sourcePath: null,
    };
  }

  const sourcePath = candidates[0].path;
  const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, ''));
  const [header = [], ...dataRows] = rows;
  const byDoi = new Map();
  const byTitle = new Map();

  for (const row of dataRows) {
    const record = Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']));
    const doi = normalizeLookupText(record.DOI || '');
    const title = normalizeLookupText(record.Title || '');

    if (doi && !byDoi.has(doi)) {
      byDoi.set(doi, record);
    }

    if (title && !byTitle.has(title)) {
      byTitle.set(title, record);
    }
  }

  return { byDoi, byTitle, sourcePath };
};

const matchReviewRecord = (paper, reviewIndex) => {
  const doiKeys = [paper.doi, paper.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''), paper.normalizedDoi]
    .filter(Boolean)
    .map((value) => normalizeLookupText(value));
  for (const doiKey of doiKeys) {
    if (reviewIndex.byDoi.has(doiKey)) {
      return { matchType: 'doi', record: reviewIndex.byDoi.get(doiKey) };
    }
  }

  const titleKeys = [paper.title, titleFromFilename(paper.title)]
    .filter(Boolean)
    .map((value) => normalizeLookupText(value));
  for (const titleKey of titleKeys) {
    if (reviewIndex.byTitle.has(titleKey)) {
      return { matchType: 'title', record: reviewIndex.byTitle.get(titleKey) };
    }
  }

  return { matchType: '', record: null };
};

const formatNotes = (notes) =>
  notes
    .slice()
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map((note) => `${note.created_at}: ${normalizeWhitespace(note.body)}`)
    .join(' | ');

const main = async () => {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
  }

  const env = loadEnvFile(envPath);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials are not configured in .env.local');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('papers')
    .select(
      'id, assigned_study_id, title, lead_author, year, doi, normalized_doi, status, flag_reason, uploaded_at, paper_notes(body, created_at)',
    )
    .not('flag_reason', 'is', null)
    .order('assigned_study_id');

  if (error) {
    throw new Error(`Failed to load flagged papers: ${error.message}`);
  }

  const reviewIndex = loadReviewIndex(ROOT_DIR);
  const papers = (data ?? []).map((paper) => {
    const rawFlagComment = normalizeFlagReason(paper.flag_reason);
    const flagGroup = getFlagGroup(rawFlagComment);
    const dbNotes = Array.isArray(paper.paper_notes) ? paper.paper_notes : [];
    const reviewMatch = matchReviewRecord(
      {
        title: paper.title ?? '',
        doi: paper.doi ?? '',
        normalizedDoi: paper.normalized_doi ?? '',
      },
      reviewIndex,
    );
    const reviewRecord = reviewMatch.record;
    const csvNotes = normalizeWhitespace(reviewRecord?.Notes ?? '');

    return {
      paperId: paper.id,
      assignedStudyId: paper.assigned_study_id ?? '',
      title: paper.title ?? '',
      leadAuthor: paper.lead_author ?? '',
      year: paper.year ?? '',
      doi: paper.doi ?? '',
      status: paper.status ?? '',
      uploadedAt: paper.uploaded_at ?? '',
      rawFlagComment,
      normalizedFlagComment: rawFlagComment.toLowerCase(),
      flagGroup,
      dbNoteCount: dbNotes.length,
      dbNotes: formatNotes(dbNotes),
      csvNotes,
      combinedNotes: [formatNotes(dbNotes), csvNotes].filter(Boolean).join(' || '),
      covidenceNumber: reviewRecord?.['Covidence #'] ?? '',
      reviewStudy: reviewRecord?.Study ?? '',
      reviewRef: reviewRecord?.Ref ?? '',
      reviewTitle: reviewRecord?.Title ?? '',
      reviewMatchType: reviewMatch.matchType,
      reviewSourceCsv: reviewIndex.sourcePath ? path.relative(ROOT_DIR, reviewIndex.sourcePath) : '',
    };
  });

  const groupCounts = new Map();
  for (const paper of papers) {
    groupCounts.set(paper.flagGroup, (groupCounts.get(paper.flagGroup) ?? 0) + 1);
  }

  papers.sort((left, right) => {
    const groupCompare =
      (groupCounts.get(right.flagGroup) ?? 0) - (groupCounts.get(left.flagGroup) ?? 0) ||
      left.flagGroup.localeCompare(right.flagGroup);
    if (groupCompare !== 0) {
      return groupCompare;
    }

    return left.assignedStudyId.localeCompare(right.assignedStudyId) || left.title.localeCompare(right.title);
  });

  const detailHeader = [
    'flag_group',
    'group_count',
    'raw_flag_comment',
    'assigned_study_id',
    'paper_id',
    'paper_title',
    'lead_author',
    'year',
    'doi',
    'status',
    'db_note_count',
    'db_notes',
    'review_csv_notes',
    'combined_notes',
    'covidence_number',
    'review_study',
    'review_ref',
    'review_title',
    'review_match_type',
    'review_source_csv',
  ];

  const detailRows = [
    detailHeader,
    ...papers.map((paper) => [
      paper.flagGroup,
      groupCounts.get(paper.flagGroup) ?? 0,
      paper.rawFlagComment,
      paper.assignedStudyId,
      paper.paperId,
      paper.title,
      paper.leadAuthor,
      paper.year,
      paper.doi,
      paper.status,
      paper.dbNoteCount,
      paper.dbNotes,
      paper.csvNotes,
      paper.combinedNotes,
      paper.covidenceNumber,
      paper.reviewStudy,
      paper.reviewRef,
      paper.reviewTitle,
      paper.reviewMatchType,
      paper.reviewSourceCsv,
    ]),
  ];

  const summaryHeader = ['flag_group', 'paper_count', 'raw_flag_comments'];
  const summaryRows = [
    summaryHeader,
    ...Array.from(groupCounts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([flagGroup, count]) => {
        const comments = Array.from(
          new Set(
            papers
              .filter((paper) => paper.flagGroup === flagGroup)
              .map((paper) => paper.rawFlagComment)
              .filter(Boolean),
          ),
        ).join(' | ');
        return [flagGroup, count, comments];
      }),
  ];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const detailPath = path.join(OUTPUT_DIR, `flagged-papers-review-${dateStamp}.csv`);
  const summaryPath = path.join(OUTPUT_DIR, `flagged-papers-review-summary-${dateStamp}.csv`);

  fs.writeFileSync(detailPath, `\uFEFF${stringifyCsv(detailRows)}\n`);
  fs.writeFileSync(summaryPath, `\uFEFF${stringifyCsv(summaryRows)}\n`);

  console.log(`Flagged papers: ${papers.length}`);
  console.log(`Detail CSV: ${detailPath}`);
  console.log(`Summary CSV: ${summaryPath}`);
  console.log(`Review source CSV: ${reviewIndex.sourcePath ?? 'not found'}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
