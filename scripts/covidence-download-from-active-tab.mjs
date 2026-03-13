#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log(`Usage:
  node scripts/covidence-download-from-active-tab.mjs \
    --missing-csv <file> \
    --output <dir> \
    [--manifest <file>]
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
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
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

function runChromeEval(script) {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'eval', '--script', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function runChromeEvalJson(script, retries = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const output = runChromeEval(script);
      if (!output || output === 'missing value') {
        throw new Error(output || 'empty response');
      }
      return JSON.parse(output);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        sleep(750 * attempt);
      }
    }
  }
  throw lastError;
}

function runChromeUrl() {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'url'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function runCurl(url, outputPath) {
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '-o', outputPath, url], {
    encoding: 'utf8',
  });
}

function jsString(value) {
  return JSON.stringify(value);
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function navigateTo(url) {
  const script = `
(() => {
  window.location.href = ${jsString(url)};
  return 'OK';
})()
`;

  runChromeEval(script);
}

function parseReviewId() {
  const url = runChromeUrl();
  const match = url.match(/reviews\/(\d+)/);
  if (!match) {
    throw new Error(`Could not parse review ID from active tab URL: ${url}`);
  }
  return match[1];
}

function openSearchResults(reviewId, term) {
  const targetUrl = `https://app.covidence.org/reviews/${reviewId}/review_studies/search?utf8=%E2%9C%93&search%5Bterm%5D=${encodeURIComponent(term)}`;
  navigateTo(targetUrl);
  sleep(1200);
}

function openStudyFromSearch({ covidenceNumber, study, title }) {
  const script = `
(() => {
  const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
  const normalizeLoose = (text) => normalize(text).toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
  const targetNumber = ${jsString(normalizeText((covidenceNumber || '').replace('–', '-')))};
  const targetStudy = ${jsString(normalizeText(study || ''))};
  const targetTitle = ${jsString(normalizeText(title || ''))};
  const titleTokens = targetTitle.split(' ').filter((token) => token.length >= 4);
  const links = Array.from(document.querySelectorAll('a[href*="/review_studies/"]'));
  const scored = links.map((link) => {
    const text = normalizeLoose(link.innerText);
    let score = 0;
    if (targetNumber && text.includes(targetNumber)) score += 1;
    if (targetStudy && text.includes(targetStudy)) score += 1;
    if (targetTitle && text.includes(targetTitle)) score += 4;
    const prefix = targetTitle.slice(0, 80);
    if (prefix && text.includes(prefix)) score += 3;
    const overlap = titleTokens.filter((token) => text.includes(token)).length;
    if (titleTokens.length) score += overlap / titleTokens.length;
    return { href: link.href, text, score };
  }).sort((a, b) => b.score - a.score);
  const match = scored[0];
  if (!match || match.score < 3) {
    return JSON.stringify({ status: 'not_found', pageText: normalize(document.body.innerText).slice(0, 800) });
  }
  window.location.href = match.href;
  return JSON.stringify({ status: 'opened', href: match.href, matchScore: match.score, matchText: match.text.slice(0, 300) });
})()
`;

  return runChromeEvalJson(script);
}

function revealPdfOnStudyPage(expectedTitle) {
  const script = `
(() => {
  const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
  const normalizeLoose = (text) => normalize(text).toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
  const text = normalize(document.body.innerText);
  const textLoose = normalizeLoose(document.body.innerText);
  const expectedTitle = ${jsString(normalizeText(expectedTitle || ''))};
  const expectedPrefix = expectedTitle.slice(0, 80);
  if (expectedPrefix && !textLoose.includes(expectedPrefix)) {
    return JSON.stringify({ status: 'study_page_mismatch', pageText: text.slice(0, 800) });
  }
  const pdfLink = document.querySelector('a[href*="response-content-type=application%2Fpdf"], a[href$=".pdf"], a[href*=".pdf?"]');
  if (pdfLink) {
    return JSON.stringify({
      status: 'ready',
      pdfUrl: pdfLink.href,
      pdfName: normalize(pdfLink.textContent),
      pageText: text.slice(0, 800)
    });
  }
  const button = Array.from(document.querySelectorAll('button')).find((btn) => normalize(btn.innerText) === 'View full text');
  if (!button) {
    return JSON.stringify({ status: 'no_button', pageText: text.slice(0, 800) });
  }
  button.click();
  return JSON.stringify({ status: 'clicked', pageText: text.slice(0, 800) });
})()
`;

  return runChromeEvalJson(script);
}

function sanitizeFileName(value, fallback) {
  const cleaned = (value || fallback || 'download.pdf')
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.toLowerCase().endsWith('.pdf')) {
    return cleaned;
  }
  return `${cleaned}.pdf`;
}

function uniquePath(outputDir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(outputDir, fileName);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args['missing-csv'] || !args.output) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const missingCsv = path.resolve(args['missing-csv']);
  const outputDir = path.resolve(args.output);
  const manifestPath = path.resolve(args.manifest || path.join(outputDir, 'covidence-download-manifest.csv'));
  ensureDir(outputDir);

  const rows = parseCsv(fs.readFileSync(missingCsv, 'utf8'));
  const manifest = [];
  const reviewId = parseReviewId();
  const writeManifest = () =>
    writeCsv(manifestPath, manifest, [
      'covidence_number',
      'study',
      'title',
      'status',
      'file_name',
      'saved_path',
      'note',
    ]);

  for (const row of rows) {
    const covidenceNumber = row.covidence_number;
    const label = `${covidenceNumber || 'NO_ID'} ${row.study || row.title || ''}`.trim();
    if (!covidenceNumber) {
      console.log(`skip ${label} :: missing Covidence number`);
      manifest.push({
        covidence_number: '',
        study: row.study,
        title: row.title,
        status: 'skipped_no_covidence_number',
        file_name: '',
        saved_path: '',
        note: 'Missing Covidence number in missing-papers.csv',
      });
      writeManifest();
      continue;
    }

    const searchTerms = [row.title, `${row.study || ''} ${row.title || ''}`.trim(), row.study, covidenceNumber].filter(Boolean);
    let openResult = null;

    for (const term of searchTerms) {
      openSearchResults(reviewId, term);
      openResult = openStudyFromSearch({
        covidenceNumber,
        study: row.study,
        title: row.title,
      });
      if (openResult.status === 'opened') {
        break;
      }
    }

    if (!openResult || openResult.status !== 'opened') {
      console.log(`miss ${label} :: search_not_found`);
      manifest.push({
        covidence_number: covidenceNumber,
        study: row.study,
        title: row.title,
        status: 'search_not_found',
        file_name: '',
        saved_path: '',
        note: openResult?.pageText || '',
      });
      writeManifest();
      continue;
    }

    sleep(1200);

    let state = revealPdfOnStudyPage(row.title);
    if (state.status === 'clicked') {
      console.log(`open ${label}`);
      sleep(1200);
      state = revealPdfOnStudyPage(row.title);
    }

    if (state.status !== 'ready' || !state.pdfUrl) {
      console.log(`miss ${label} :: ${state.status}`);
      manifest.push({
        covidence_number: covidenceNumber,
        study: row.study,
        title: row.title,
        status: state.status,
        file_name: '',
        saved_path: '',
        note: state.pageText || state.rowText || '',
      });
      writeManifest();
      continue;
    }

    const targetName = sanitizeFileName(state.pdfName, `${row.study || covidenceNumber}.pdf`);
    const targetPath = uniquePath(outputDir, targetName);

    try {
      console.log(`download ${label} -> ${targetName}`);
      runCurl(state.pdfUrl, targetPath);
      manifest.push({
        covidence_number: covidenceNumber,
        study: row.study,
        title: row.title,
        status: 'downloaded',
        file_name: path.basename(targetPath),
        saved_path: targetPath,
        note: '',
      });
      writeManifest();
    } catch (error) {
      console.log(`fail ${label}`);
      manifest.push({
        covidence_number: covidenceNumber,
        study: row.study,
        title: row.title,
        status: 'download_failed',
        file_name: path.basename(targetPath),
        saved_path: '',
        note: error instanceof Error ? error.message : String(error),
      });
      writeManifest();
    }
  }

  writeManifest();

  console.log(`Manifest written to ${manifestPath}`);
  const totals = manifest.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify(totals, null, 2));
}

main();
