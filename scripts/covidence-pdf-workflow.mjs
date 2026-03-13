#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

function printUsage() {
  console.log(`Usage:
  node scripts/covidence-pdf-workflow.mjs prepare --references <csv> --existing <dir> --output <dir> [--downloads <dir>]
  node scripts/covidence-pdf-workflow.mjs collect --output <dir> [--downloads <dir>]

Commands:
  prepare   Parse the exported Covidence CSV, scan an existing PDF folder, and create a missing-paper queue.
  collect   Move PDFs downloaded during the recorded session from Downloads into the output folder and update the manifest.
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: [] };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }

  return { command, args };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeCsv(filePath, rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function csvEscape(value) {
  const text = String(value);
  if (/[,"\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
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
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current);
      current = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripDiacritics(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
}

function normalizeText(value) {
  return normalizeWhitespace(stripDiacritics(value).toLowerCase())
    .replace(/https?:\/\/(dx\.)?doi\.org\//g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(rawValue) {
  if (!rawValue) {
    return '';
  }
  const cleaned = rawValue
    .replace(/PT\s*-\s*Article/gi, ' ')
    .replace(/https?:\/\/(dx\.)?doi\.org\//gi, '')
    .trim();
  const match = cleaned.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match ? match[0].toLowerCase() : '';
}

function tokenizeTitle(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function getTitleVariants(rawName) {
  const withoutExtension = rawName.replace(/\.pdf$/i, '');
  const normalizedFull = normalizeText(withoutExtension);
  const yearMatch = withoutExtension.match(/\b(19|20)\d{2}\b/);
  let afterYear = '';
  if (yearMatch) {
    afterYear = withoutExtension.slice(yearMatch.index + yearMatch[0].length).replace(/^[-_\s.]+/, '');
  }

  const dotSplit = withoutExtension.split(' - ');
  const finalSegment = dotSplit.length >= 3 ? dotSplit.slice(2).join(' - ') : withoutExtension;

  return Array.from(
    new Set([
      normalizedFull,
      normalizeText(afterYear),
      normalizeText(finalSegment),
    ].filter(Boolean)),
  );
}

function buildCandidateKey(fileEntry) {
  const narrowed = fileEntry.titleVariants
    .filter((variant) => variant && variant !== normalizeText(fileEntry.baseName))
    .sort((left, right) => right.length - left.length);
  return `${fileEntry.year || 'unknown'}::${narrowed[0] || fileEntry.titleVariants[0] || normalizeText(fileEntry.baseName)}`;
}

function aggregatePdfCandidates(pdfFiles) {
  const grouped = new Map();
  for (const fileEntry of pdfFiles) {
    const key = buildCandidateKey(fileEntry);
    const existing = grouped.get(key);
    if (existing) {
      existing.paths.push(fileEntry.relativePath);
      existing.titleVariants = Array.from(new Set([...existing.titleVariants, ...fileEntry.titleVariants]));
      continue;
    }
    grouped.set(key, {
      key,
      year: fileEntry.year,
      baseName: fileEntry.baseName,
      titleVariants: [...fileEntry.titleVariants],
      paths: [fileEntry.relativePath],
    });
  }
  return Array.from(grouped.values());
}

function scoreTitleMatch(reference, fileEntry) {
  const referenceTokens = reference.titleTokens;
  if (referenceTokens.length === 0) {
    return { score: 0, reasons: [] };
  }

  let bestScore = 0;
  let bestReasons = [];

  for (const variant of fileEntry.titleVariants) {
    if (!variant) {
      continue;
    }

    if (variant === reference.normalizedTitle) {
      return { score: 1, reasons: ['exact_normalized_title'] };
    }

    const variantTokens = variant
      .split(' ')
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
    const variantTokenSet = new Set(variantTokens);
    const overlap = referenceTokens.filter((token) => variantTokenSet.has(token)).length;
    const coverage = overlap / referenceTokens.length;
    const containment =
      variant.includes(reference.normalizedTitle) || reference.normalizedTitle.includes(variant) ? 0.15 : 0;
    const yearBoost = reference.year && fileEntry.year === reference.year ? 0.1 : 0;
    const citationBoost =
      reference.studyLabel && normalizeText(fileEntry.baseName).includes(normalizeText(reference.studyLabel)) ? 0.1 : 0;
    const authorBoost =
      reference.studyAuthor && normalizeText(fileEntry.baseName).includes(reference.studyAuthor) ? 0.12 : 0;

    const score = Math.min(1, coverage + containment + yearBoost + citationBoost + authorBoost);
    if (score > bestScore) {
      bestScore = score;
      bestReasons = [
        coverage > 0 ? `token_overlap:${overlap}/${referenceTokens.length}` : '',
        containment > 0 ? 'title_containment' : '',
        yearBoost > 0 ? 'year_match' : '',
        citationBoost > 0 ? 'study_label_match' : '',
        authorBoost > 0 ? 'study_author_match' : '',
      ].filter(Boolean);
    }
  }

  return { score: bestScore, reasons: bestReasons };
}

function listPdfFiles(dirPath) {
  const results = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) {
        continue;
      }
      const stats = fs.statSync(fullPath);
      const yearMatch = entry.name.match(/\b(19|20)\d{2}\b/);
      results.push({
        path: fullPath,
        baseName: entry.name,
        relativePath: path.relative(dirPath, fullPath),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        year: yearMatch ? yearMatch[0] : '',
        titleVariants: getTitleVariants(entry.name),
      });
    }
  }

  walk(dirPath);
  return results;
}

function buildReferenceRows(csvRows) {
  return csvRows.map((row, index) => {
    const title = row.Title?.trim() ?? '';
    const studyLabel = row.Study?.trim() ?? '';
    const studyAuthor = normalizeText(studyLabel).split(' ')[0] ?? '';
    const doi = normalizeDoi(row.DOI ?? '');
    const year = String(row['Published Year'] ?? '').trim();
    const covidenceNumber = String(row['Covidence #'] ?? '').trim();
    const normalizedTitle = normalizeText(title);
    return {
      rowIndex: index + 2,
      title,
      studyLabel,
      studyAuthor,
      doi,
      year,
      covidenceNumber,
      normalizedTitle,
      titleTokens: tokenizeTitle(title),
      raw: row,
    };
  });
}

function reconcileReferences(referenceRows, pdfFiles) {
  const pdfCandidates = aggregatePdfCandidates(pdfFiles);
  const rows = [];
  const summary = {
    totalReferences: referenceRows.length,
    exactExisting: 0,
    ambiguousExisting: 0,
    missing: 0,
  };

  for (const reference of referenceRows) {
    const scored = pdfCandidates
      .map((fileEntry) => ({
        fileEntry,
        ...scoreTitleMatch(reference, fileEntry),
      }))
      .filter((entry) => entry.score >= 0.6)
      .sort((left, right) => right.score - left.score);

    const top = scored[0];
    const second = scored[1];
    const topHasAuthor = top?.reasons.includes('study_author_match') ?? false;
    const topHasYear = top?.reasons.includes('year_match') ?? false;
    const topHasContainment = top?.reasons.includes('title_containment') ?? false;
    const confident =
      Boolean(
        top &&
          (top.score >= 0.98 ||
            (top.score >= 0.86 &&
              (!second || second.score < 0.72 || top.fileEntry.key === second.fileEntry.key || top.score - second.score >= 0.12)) ||
            (top.score >= 0.8 && topHasAuthor && topHasYear) ||
            (top.score >= 0.78 && topHasContainment && topHasYear && (!second || top.score - second.score >= 0.05))),
      );
    const ambiguous = Boolean(top && !confident && top.score >= 0.72);

    let status = 'missing';
    let matchedFile = '';
    let matchScore = '';
    let matchReason = '';

    if (confident) {
      status = 'existing';
      matchedFile =
        top.fileEntry.paths.length === 1
          ? top.fileEntry.paths[0]
          : `${top.fileEntry.paths[0]} (+${top.fileEntry.paths.length - 1} duplicate copy/copies)`;
      matchScore = top.score.toFixed(3);
      matchReason = top.reasons.join('|');
      summary.exactExisting += 1;
    } else if (ambiguous) {
      status = 'ambiguous_existing';
      matchedFile = scored
        .slice(0, 3)
        .map((entry) => {
          const label =
            entry.fileEntry.paths.length === 1
              ? entry.fileEntry.paths[0]
              : `${entry.fileEntry.paths[0]} (+${entry.fileEntry.paths.length - 1} duplicate copy/copies)`;
          return `${label} (${entry.score.toFixed(3)})`;
        })
        .join(' ; ');
      matchScore = top.score.toFixed(3);
      matchReason = top.reasons.join('|');
      summary.ambiguousExisting += 1;
    } else {
      summary.missing += 1;
    }

    rows.push({
      covidence_number: reference.covidenceNumber,
      study: reference.studyLabel,
      year: reference.year,
      doi: reference.doi,
      title: reference.title,
      status,
      matched_file: matchedFile,
      match_score: matchScore,
      match_reason: matchReason,
    });
  }

  return { rows, summary };
}

function defaultDownloadsDir() {
  return path.join(os.homedir(), 'Downloads');
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getPdfSnapshot(downloadsDir) {
  const entries = [];
  for (const entry of fs.readdirSync(downloadsDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith('.') || !entry.name.toLowerCase().endsWith('.pdf')) {
      continue;
    }
    const fullPath = path.join(downloadsDir, entry.name);
    const stats = fs.statSync(fullPath);
    entries.push({
      name: entry.name,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    });
  }
  return entries;
}

function prepareSession({ referencesPath, existingDir, outputDir, downloadsDir }) {
  if (!fileExists(referencesPath)) {
    throw new Error(`Reference CSV not found: ${referencesPath}`);
  }
  if (!fileExists(existingDir)) {
    throw new Error(`Existing PDF folder not found: ${existingDir}`);
  }
  if (!fileExists(downloadsDir)) {
    throw new Error(`Downloads folder not found: ${downloadsDir}`);
  }

  ensureDir(outputDir);

  const csvRows = parseCsv(readText(referencesPath));
  const referenceRows = buildReferenceRows(csvRows);
  const pdfFiles = listPdfFiles(existingDir);
  const { rows, summary } = reconcileReferences(referenceRows, pdfFiles);

  const nowIso = new Date().toISOString();
  const snapshot = getPdfSnapshot(downloadsDir);
  const session = {
    createdAt: nowIso,
    referencesPath: path.resolve(referencesPath),
    existingDir: path.resolve(existingDir),
    downloadsDir: path.resolve(downloadsDir),
    outputDir: path.resolve(outputDir),
    preExistingDownloads: snapshot,
    summary,
  };

  const reconciliationPath = path.join(outputDir, 'reconciliation.csv');
  const missingPath = path.join(outputDir, 'missing-papers.csv');
  const sessionPath = path.join(outputDir, 'session.json');
  const summaryPath = path.join(outputDir, 'summary.json');

  writeCsv(reconciliationPath, rows, [
    'covidence_number',
    'study',
    'year',
    'doi',
    'title',
    'status',
    'matched_file',
    'match_score',
    'match_reason',
  ]);

  writeCsv(
    missingPath,
    rows.filter((row) => row.status === 'missing'),
    ['covidence_number', 'study', 'year', 'doi', 'title'],
  );

  writeJson(sessionPath, session);
  writeJson(summaryPath, summary);

  console.log(`Prepared output in ${outputDir}`);
  console.log(`References scanned: ${summary.totalReferences}`);
  console.log(`Existing PDFs matched: ${summary.exactExisting}`);
  console.log(`Ambiguous matches to review: ${summary.ambiguousExisting}`);
  console.log(`Missing PDFs queued: ${summary.missing}`);
  console.log(`Session file: ${sessionPath}`);
  console.log(`Missing queue: ${missingPath}`);
}

function collectDownloads({ outputDir, downloadsDir }) {
  const sessionPath = path.join(outputDir, 'session.json');
  const reconciliationPath = path.join(outputDir, 'reconciliation.csv');
  const downloadsLogPath = path.join(outputDir, 'downloaded-files.csv');

  if (!fileExists(sessionPath)) {
    throw new Error(`No session file found at ${sessionPath}. Run prepare first.`);
  }

  const session = JSON.parse(readText(sessionPath));
  const sourceDownloadsDir = downloadsDir ? path.resolve(downloadsDir) : session.downloadsDir;
  if (!fileExists(sourceDownloadsDir)) {
    throw new Error(`Downloads folder not found: ${sourceDownloadsDir}`);
  }

  ensureDir(outputDir);
  const seen = new Set(
    (session.preExistingDownloads ?? []).map((entry) => `${entry.name}::${entry.size}::${entry.mtimeMs}`),
  );

  const current = getPdfSnapshot(sourceDownloadsDir);
  const sessionStartMs = Date.parse(session.createdAt);
  const candidates = current.filter((entry) => {
    const fingerprint = `${entry.name}::${entry.size}::${entry.mtimeMs}`;
    return !seen.has(fingerprint) && entry.mtimeMs >= sessionStartMs;
  });

  const moved = [];
  for (const entry of candidates) {
    const sourcePath = path.join(sourceDownloadsDir, entry.name);
    const targetPath = uniqueTargetPath(outputDir, entry.name);
    fs.renameSync(sourcePath, targetPath);
    moved.push({
      original_name: entry.name,
      saved_name: path.basename(targetPath),
      saved_path: targetPath,
      size: entry.size,
      modified_at: new Date(entry.mtimeMs).toISOString(),
    });
  }

  writeCsv(downloadsLogPath, moved, ['original_name', 'saved_name', 'saved_path', 'size', 'modified_at']);

  const updatedSession = {
    ...session,
    collectedAt: new Date().toISOString(),
    downloadsDir: sourceDownloadsDir,
    collectedCount: moved.length,
    downloadsLogPath,
    reconciliationPath: fileExists(reconciliationPath) ? reconciliationPath : null,
  };
  writeJson(sessionPath, updatedSession);

  console.log(`Collected ${moved.length} PDFs into ${outputDir}`);
  console.log(`Download log: ${downloadsLogPath}`);
}

function uniqueTargetPath(outputDir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(outputDir, fileName);
  let index = 1;

  while (fileExists(candidate)) {
    candidate = path.join(outputDir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }

  return candidate;
}

function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (!command || args.help) {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  try {
    if (command === 'prepare') {
      if (!args.references || !args.existing || !args.output) {
        throw new Error('prepare requires --references, --existing, and --output');
      }
      prepareSession({
        referencesPath: args.references,
        existingDir: args.existing,
        outputDir: args.output,
        downloadsDir: args.downloads || defaultDownloadsDir(),
      });
      return;
    }

    if (command === 'collect') {
      if (!args.output) {
        throw new Error('collect requires --output');
      }
      collectDownloads({
        outputDir: path.resolve(args.output),
        downloadsDir: args.downloads ? path.resolve(args.downloads) : undefined,
      });
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
