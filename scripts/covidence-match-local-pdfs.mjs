#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log(`Usage:
  node scripts/covidence-match-local-pdfs.mjs \
    --references <csv> \
    --pdf-dir <dir> \
    --output <dir>
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function writeCsv(filePath, rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase(),
  )
    .replace(/https?:\/\/(dx\.)?doi\.org\//g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(value) {
  const cleaned = String(value ?? '')
    .replace(/PT\s*-\s*Article/gi, ' ')
    .replace(/https?:\/\/(dx\.)?doi\.org\//gi, '')
    .trim();
  const match = cleaned.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match ? match[0].toLowerCase() : '';
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 4);
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
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results.sort();
}

function parseCleanupMarkdown(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = [];

  for (const line of text.split('\n')) {
    if (!line.startsWith('| #')) {
      continue;
    }
    const protectedLine = line.replaceAll('\\|', '__PIPE__');
    const cells = protectedLine
      .split('|')
      .map((cell) => cell.replaceAll('__PIPE__', '|').trim())
      .filter(Boolean);
    const covidenceNumber = cells.find((cell) => /^#\d+$/.test(cell)) || '';
    const descriptor = [...cells].reverse().find((cell) => /\b(19|20)\d{2}\b/.test(cell) && cell.length > 40) || '';
    if (!covidenceNumber || !descriptor) {
      continue;
    }
    const studyMatch = descriptor.match(/^([^\s]+)\s+((?:19|20)\d{2})\s+/);
    rows.push({
      covidenceNumber,
      title: descriptor,
      titleNorm: normalizeText(descriptor),
      titleTokens: tokenize(descriptor),
      doi: normalizeDoi(descriptor),
      study: studyMatch ? studyMatch[1] : '',
      studyNorm: normalizeText(studyMatch ? studyMatch[1] : ''),
      year: studyMatch ? studyMatch[2] : '',
      raw: { source: 'cleanup_markdown', descriptor },
    });
  }

  return rows;
}

function readPdfText(filePath, firstPage, lastPage) {
  try {
    return execFileSync('pdftotext', ['-f', String(firstPage), '-l', String(lastPage), filePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function extractInterestingText(filePath) {
  const pageWindow = readPdfText(filePath, 1, 5);
  const normalizedWindow = normalizeWhitespace(pageWindow);
  const doi = normalizeDoi(pageWindow);
  const yearLineMatch = pageWindow.match(/(?:^|\n)\s*YEAR:\s*((?:19|20)\d{2}(?:-[0-9]{2}-[0-9]{2})?)\s*(?:\n|$)/i);
  const extractedYear = yearLineMatch
    ? yearLineMatch[1].slice(0, 4)
    : (pageWindow.match(/\b(19|20)\d{2}\b/) || [''])[0];

  const articleTitleMatch = pageWindow.match(/(?:ARTICLE TITLE:|Article Title:)\s*([\s\S]{0,500}?)(?:ARTICLE AUTHOR:|Article Author:|VOLUME:|ISSUE:|MONTH:|YEAR:|\n\s*\n)/);
  const articleTitle = articleTitleMatch ? normalizeWhitespace(articleTitleMatch[1]) : '';

  const lines = pageWindow
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const candidateLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (lower.startsWith('rapid #:') || lower.startsWith('cross ref id:') || lower.startsWith('borrower:')) return false;
    if (lower.startsWith('journal title:') || lower.startsWith('user journal title:')) return false;
    if (lower.startsWith('article title:') || lower.startsWith('article author:')) return false;
    if (lower.startsWith('doi:')) return false;
    if (lower.includes('copyright') && line.length > 40) return false;
    if (lower.includes('this document is protected by international copyright laws')) return false;
    if (line.length < 15 || line.length > 220) return false;
    return /[A-Za-z]/.test(line);
  });

  let headlineTitle = '';
  for (let index = 0; index < candidateLines.length; index += 1) {
    const line = candidateLines[index];
    if (/^[A-Z][A-Za-z].*[.:?)]?$/.test(line) || /^[A-Z][A-Za-z]/.test(line)) {
      const next = candidateLines[index + 1] || '';
      if (next && next.length <= 120 && /^[a-z]/.test(next)) {
        headlineTitle = `${line} ${next}`;
      } else {
        headlineTitle = line;
      }
      break;
    }
  }

  const filenameTitle = path.basename(filePath, '.pdf').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    doi,
    extractedYear,
    articleTitle,
    headlineTitle: normalizeWhitespace(headlineTitle),
    filenameTitle,
    pageWindow: normalizedWindow.slice(0, 4000),
  };
}

function buildReferences(rows) {
  return rows.map((row) => {
    const title = normalizeWhitespace(row.Title || '');
    const study = normalizeWhitespace(row.Study || '');
    const year = normalizeWhitespace(row['Published Year'] || '');
    return {
      covidenceNumber: normalizeWhitespace(row['Covidence #'] || ''),
      title,
      titleNorm: normalizeText(title),
      titleTokens: tokenize(title),
      doi: normalizeDoi(row.DOI || ''),
      study,
      studyNorm: normalizeText(study),
      year,
      raw: row,
    };
  });
}

function scoreAgainstReference(reference, extracted) {
  let bestSignal = '';
  let score = 0;

  if (extracted.doi && reference.doi && extracted.doi === reference.doi) {
    return { score: 1, reason: 'doi_exact' };
  }

  const titleCandidates = [extracted.articleTitle, extracted.headlineTitle, extracted.filenameTitle]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const candidate of titleCandidates) {
    if (candidate === reference.titleNorm) {
      return { score: 0.99, reason: 'title_exact' };
    }

    const candidateTokens = candidate.split(' ').filter((token) => token.length >= 4);
    if (candidateTokens.length === 0 || reference.titleTokens.length === 0) {
      continue;
    }

    const overlap = reference.titleTokens.filter((token) => candidateTokens.includes(token)).length;
    const coverage = overlap / reference.titleTokens.length;
    const reverseCoverage = overlap / candidateTokens.length;
    const containment = candidate.includes(reference.titleNorm) || reference.titleNorm.includes(candidate) ? 0.1 : 0;
    const studyBoost = reference.studyNorm && candidate.includes(reference.studyNorm) ? 0.06 : 0;
    const yearBoost = reference.year && extracted.extractedYear && reference.year === extracted.extractedYear ? 0.08 : 0;
    const yearPenalty = reference.year && extracted.extractedYear && reference.year !== extracted.extractedYear ? 0.2 : 0;
    const candidateScore = Math.min(
      0.97,
      Math.max(0, coverage * 0.75 + reverseCoverage * 0.12 + containment + studyBoost + yearBoost - yearPenalty),
    );

    if (candidateScore > score) {
      score = candidateScore;
      bestSignal = `title_overlap:${overlap}/${reference.titleTokens.length}`;
    }
  }

  return { score, reason: bestSignal };
}

function classifyMatch(scored) {
  const top = scored[0];
  const second = scored[1];
  if (!top || top.score < 0.75) {
    return 'unmatched';
  }
  if (top.score >= 0.98) {
    return 'ready';
  }
  if (top.score >= 0.9 && (!second || second.score <= 0.78 || top.score - second.score >= 0.08)) {
    return 'ready';
  }
  if (top.score >= 0.84 && (!second || top.score - second.score >= 0.12)) {
    return 'ready';
  }
  return 'ambiguous';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.references || !args['pdf-dir'] || !args.output) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const csvReferences = buildReferences(parseCsv(fs.readFileSync(path.resolve(args.references), 'utf8')));
  const cleanupPath = path.resolve('docs/covidence-cleanup.md');
  const cleanupReferences = fs.existsSync(cleanupPath) ? parseCleanupMarkdown(cleanupPath) : [];
  const knownCovidenceNumbers = new Set(csvReferences.map((row) => row.covidenceNumber));
  const references = [
    ...csvReferences,
    ...cleanupReferences.filter((row) => !knownCovidenceNumbers.has(row.covidenceNumber)),
  ];
  const pdfPaths = listPdfFiles(path.resolve(args['pdf-dir']));
  const outputDir = path.resolve(args.output);
  ensureDir(outputDir);

  const rows = [];
  const summary = { totalPdfs: pdfPaths.length, ready: 0, ambiguous: 0, unmatched: 0 };

  for (const pdfPath of pdfPaths) {
    const extracted = extractInterestingText(pdfPath);
    const scored = references
      .map((reference) => ({ reference, ...scoreAgainstReference(reference, extracted) }))
      .filter((row) => row.score >= 0.55)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    const status = classifyMatch(scored);
    summary[status] += 1;

    const top = scored[0];
    const second = scored[1];
    rows.push({
      pdf_path: pdfPath,
      pdf_name: path.basename(pdfPath),
      extracted_title: extracted.articleTitle || extracted.headlineTitle || extracted.filenameTitle,
      extracted_doi: extracted.doi,
      extracted_year: extracted.extractedYear,
      status,
      covidence_number: top?.reference.covidenceNumber || '',
      matched_study: top?.reference.study || '',
      matched_title: top?.reference.title || '',
      matched_year: top?.reference.year || '',
      matched_doi: top?.reference.doi || '',
      match_score: top ? top.score.toFixed(3) : '',
      match_reason: top?.reason || '',
      second_candidate: second ? `${second.reference.covidenceNumber} ${second.reference.study} (${second.score.toFixed(3)})` : '',
      text_preview: extracted.pageWindow.slice(0, 500),
    });
  }

  const readyRows = rows.filter((row) => row.status === 'ready');
  const ambiguousRows = rows.filter((row) => row.status === 'ambiguous');
  const unmatchedRows = rows.filter((row) => row.status === 'unmatched');

  writeCsv(path.resolve(outputDir, 'pdf-match-results.csv'), rows, [
    'pdf_path',
    'pdf_name',
    'extracted_title',
    'extracted_doi',
    'extracted_year',
    'status',
    'covidence_number',
    'matched_study',
    'matched_title',
    'matched_year',
    'matched_doi',
    'match_score',
    'match_reason',
    'second_candidate',
    'text_preview',
  ]);
  writeCsv(path.resolve(outputDir, 'ready-to-upload.csv'), readyRows, [
    'covidence_number',
    'matched_study',
    'matched_title',
    'pdf_path',
    'pdf_name',
    'match_score',
    'match_reason',
  ]);
  writeCsv(path.resolve(outputDir, 'ambiguous-to-review.csv'), ambiguousRows, [
    'pdf_path',
    'pdf_name',
    'extracted_title',
    'extracted_year',
    'covidence_number',
    'matched_study',
    'matched_title',
    'match_score',
    'second_candidate',
    'text_preview',
  ]);
  writeCsv(path.resolve(outputDir, 'unmatched-pdfs.csv'), unmatchedRows, [
    'pdf_path',
    'pdf_name',
    'extracted_title',
    'extracted_doi',
    'extracted_year',
    'text_preview',
  ]);
  writeJson(path.resolve(outputDir, 'summary.json'), summary);

  console.log(`Scanned PDFs: ${summary.totalPdfs}`);
  console.log(`Ready matches: ${summary.ready}`);
  console.log(`Ambiguous matches: ${summary.ambiguous}`);
  console.log(`Unmatched PDFs: ${summary.unmatched}`);
  console.log(`Results: ${path.resolve(outputDir, 'pdf-match-results.csv')}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
