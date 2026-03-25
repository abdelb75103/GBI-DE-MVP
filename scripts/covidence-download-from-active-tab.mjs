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
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
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

function truncateSearchTerm(term, maxLength = 140) {
  const normalized = String(term ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength).trim();
}

function covidenceSearchTerm(covidenceNumber) {
  const match = String(covidenceNumber ?? '').match(/#?\s*(\d+)/);
  return match ? `#${match[1]}` : String(covidenceNumber ?? '').trim();
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

function buildSearchQueries(row) {
  const yearMatch = String(row.title || '').match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';
  const titleTokens = normalizeText(row.title || '')
    .split(' ')
    .filter((token) => token.length >= 4)
    .slice(0, 10)
    .join(' ');

  return Array.from(
    new Set(
      [
        covidenceSearchTerm(row.covidenceNumber),
        truncateSearchTerm(`${row.study || ''} ${year}`),
        truncateSearchTerm(`${row.study || ''} ${titleTokens}`),
        truncateSearchTerm(titleTokens),
        truncateSearchTerm(row.study || ''),
      ].filter(Boolean),
    ),
  );
}

function resolveStudyCandidate({ covidenceNumber, study, title }) {
  const script = `
(() => {
  const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
  const normalizeLoose = (text) => normalize(text).toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
  const numberMatch = (${jsString(covidenceNumber || '')}).match(/#?\\s*(\\d+)/);
  const targetNumber = numberMatch ? '#' + numberMatch[1] : '';
  const targetNumberLoose = normalizeLoose(targetNumber);
  const targetStudy = ${jsString(normalizeText(study || ''))};
  const targetTitle = ${jsString(normalizeText(title || ''))};
  const titleTokens = targetTitle.split(' ').filter((token) => token.length >= 4);
  const currentUrl = window.location.href;
  const bodyText = normalize(document.body.innerText);
  const bodyTextLoose = normalizeLoose(bodyText);

  if (currentUrl.includes('/extraction/study/') && (!targetNumberLoose || bodyTextLoose.includes(targetNumberLoose))) {
    return JSON.stringify({ status: 'opened', href: currentUrl, matchScore: 99, matchText: bodyText.slice(0, 300) });
  }

  const links = Array.from(document.querySelectorAll('a[href*="/review_studies/"], a[href*="/extraction/study/"]'));
  const exactNumberLink = links.find((link) => normalizeLoose(link.innerText).startsWith(targetNumberLoose + ' ')) || links.find((link) => normalizeLoose(link.innerText).startsWith(targetNumberLoose));
  if (exactNumberLink) {
    window.location.href = exactNumberLink.href.replace('/review_studies/', '/extraction/study/');
    return JSON.stringify({ status: 'opened', href: exactNumberLink.href, matchScore: 98, matchText: normalize(exactNumberLink.innerText).slice(0, 300) });
  }

  const scored = links.map((link) => {
    const text = normalizeLoose(link.innerText);
    let score = 0;
    if (targetNumberLoose && text.startsWith(targetNumberLoose)) score += 8;
    if (targetNumberLoose && text.includes(targetNumberLoose)) score += 4;
    if (targetStudy && text.includes(targetStudy)) score += 1;
    if (targetTitle && text.includes(targetTitle)) score += 4;
    const prefix = targetTitle.slice(0, 80);
    if (prefix && text.includes(prefix)) score += 3;
    const overlap = titleTokens.filter((token) => text.includes(token)).length;
    if (titleTokens.length) score += overlap / titleTokens.length;
    return { href: link.href, text, score };
  }).sort((a, b) => b.score - a.score);
  const match = scored[0];
  if (!match || match.score < 4) {
    return JSON.stringify({ status: 'not_found', pageText: bodyText.slice(0, 800) });
  }
  window.location.href = match.href.replace('/review_studies/', '/extraction/study/');
  return JSON.stringify({ status: 'opened', href: match.href, matchScore: match.score, matchText: match.text.slice(0, 300) });
})()
`;

  return runChromeEvalJson(script);
}

function inspectStudyPage({ covidenceNumber, study, title }) {
  const script = `
(() => {
  const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
  const normalizeLoose = (text) => normalize(text).toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
  const numberMatch = (${jsString(covidenceNumber || '')}).match(/#?\\s*(\\d+)/);
  const targetNumber = numberMatch ? '#' + numberMatch[1] : '';
  const targetNumberLoose = normalizeLoose(targetNumber);
  const targetStudy = ${jsString(normalizeText(study || ''))};
  const textLoose = normalizeLoose(document.body.innerText);
  const text = normalize(document.body.innerText);
  const targetTitle = ${jsString(normalizeText(title || ''))};
  const titleTokens = targetTitle.split(' ').filter((token) => token.length >= 4);
  const titleOverlap = titleTokens.length ? titleTokens.filter((token) => textLoose.includes(token)).length / titleTokens.length : 0;
  const currentUrl = window.location.href;
  const urlLooksRight = currentUrl.includes('/extraction/study/');
  const numberMatched = !targetNumberLoose || textLoose.includes(targetNumberLoose);
  const studyMatched = targetStudy ? textLoose.includes(targetStudy) : false;
  const titleMatched = targetTitle ? textLoose.includes(targetTitle) : false;
  const hydrated = urlLooksRight && numberMatched && (titleMatched || studyMatched || titleOverlap >= 0.45);

  if (!urlLooksRight || (textLoose.includes('loading studies') && !numberMatched)) {
    return JSON.stringify({ status: 'loading', pageText: text.slice(0, 800), currentUrl });
  }

  if (!hydrated && numberMatched) {
    return JSON.stringify({
      status: 'loading',
      pageText: text.slice(0, 800),
      currentUrl,
      titleOverlap,
      numberMatched,
      studyMatched,
      titleMatched
    });
  }

  if (!hydrated) {
    return JSON.stringify({ status: 'study_page_mismatch', pageText: text.slice(0, 800), currentUrl, titleOverlap, numberMatched, studyMatched, titleMatched });
  }

  const pdfLink = document.querySelector('a[href*="response-content-type=application%2Fpdf"], a[href$=".pdf"], a[href*=".pdf?"], iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]');
  if (pdfLink) {
    const href = pdfLink.href || pdfLink.src || pdfLink.data || '';
    return JSON.stringify({
      status: 'ready',
      pdfUrl: href,
      pdfName: normalize(pdfLink.textContent),
      pageText: text.slice(0, 800),
      currentUrl
    });
  }
  const buttons = Array.from(document.querySelectorAll('button'));
  const button = buttons.find((btn) => ['View full text', 'Show full text'].includes(normalize(btn.innerText)));
  if (!button) {
    const hideButton = buttons.find((btn) => normalize(btn.innerText) === 'Hide full text');
    if (hideButton) {
      return JSON.stringify({ status: 'waiting_for_pdf', pageText: text.slice(0, 800), currentUrl });
    }
    return JSON.stringify({ status: 'no_button', pageText: text.slice(0, 800), currentUrl });
  }
  button.click();
  return JSON.stringify({ status: 'clicked', pageText: text.slice(0, 800), currentUrl });
})()
`;

  return runChromeEvalJson(script);
}

function waitForStudyPage(row) {
  let lastState = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const state = inspectStudyPage(row);
    lastState = state;
    if (!['loading', 'clicked', 'waiting_for_pdf'].includes(state.status)) {
      return state;
    }
    sleep(900 * attempt);
  }
  return lastState || { status: 'study_page_mismatch', pageText: '' };
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

    const searchTerms = buildSearchQueries({
      covidenceNumber,
      study: row.study,
      title: row.title,
    });
    let openResult = null;

    for (const term of searchTerms) {
      openSearchResults(reviewId, term);
      openResult = resolveStudyCandidate({
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

    let state = waitForStudyPage({
      covidenceNumber,
      study: row.study,
      title: row.title,
    });

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
