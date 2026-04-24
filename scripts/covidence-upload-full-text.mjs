#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log(`Usage:
  node scripts/covidence-upload-full-text.mjs \
    --review-id <id> \
    --covidence-number <#123> \
    --expected-title <title> \
    --pdf <path>
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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runChromeEvalScript(script) {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'eval', '--script', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

function runChromeEvalFile(filePath) {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'eval', '--script-file', filePath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

function activeTabUrl() {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'url'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function bodyText(limit = 4000) {
  return runChromeEvalScript(`document.body ? document.body.innerText.slice(0, ${limit}) : ""`);
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openChromeUrl(url) {
  execFileSync('open', ['-a', 'Google Chrome', url], { encoding: 'utf8' });
}

function waitForMatch(expectedTitle, covidenceNumber, timeoutMs = 15000) {
  const started = Date.now();
  const expected = normalize(expectedTitle);
  const targetNumber = normalize(covidenceNumber);
  while (Date.now() - started < timeoutMs) {
    const text = bodyText(5000);
    const loose = normalize(text);
    if (loose.includes(expected) && loose.includes(targetNumber)) {
      return text;
    }
    sleep(1000);
  }
  throw new Error(`Timed out waiting for study page match: ${covidenceNumber} ${expectedTitle}`);
}

function openFullTextModal() {
  const result = runChromeEvalScript(`
(() => {
  const labels = ['Upload full text', 'Manage full text'];
  const el = [...document.querySelectorAll('a,button')].find((node) => {
    const text = (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
    return labels.includes(text);
  });
  if (!el) return 'NO_FULL_TEXT_BUTTON';
  el.click();
  return 'CLICKED';
})()
`);
  if (result !== 'CLICKED') {
    throw new Error(`Could not open full text modal: ${result}`);
  }
}

function writeUploadScript(pdfPath, outputPath) {
  const pdf = path.resolve(pdfPath);
  const b64 = fs.readFileSync(pdf).toString('base64');
  const script = `
(async () => {
  const input = document.querySelector('input[type=file][accept=".pdf"]');
  if (!input) return 'NO_FILE_INPUT';
  const b64 = ${JSON.stringify(b64)};
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], ${JSON.stringify(path.basename(pdf))}, { type: 'application/pdf' });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return JSON.stringify({ status: 'SET', name: file.name, size: file.size });
})()
`.trim();
  fs.writeFileSync(outputPath, script);
}

function waitForUploadedFile(fileName, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = bodyText(7000);
    if (text.includes(fileName) && /Full text uploaded by/.test(text)) {
      return text;
    }
    sleep(1000);
  }
  throw new Error(`Timed out waiting for upload confirmation for ${fileName}`);
}

function closeModalIfPresent() {
  runChromeEvalScript(`
(() => {
  const btn = [...document.querySelectorAll('button')].find((node) =>
    (node.innerText || node.textContent || '').trim() === 'Done'
  );
  if (btn) btn.click();
  return 'OK';
})()
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args['review-id'] || !args['covidence-number'] || !args['expected-title'] || !args.pdf) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const reviewId = args['review-id'];
  const covidenceNumber = args['covidence-number'];
  const expectedTitle = args['expected-title'];
  const pdfPath = path.resolve(args.pdf);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const targetUrl = `https://app.covidence.org/reviews/${reviewId}/review_studies/search?utf8=%E2%9C%93&search%5Bterm%5D=${encodeURIComponent(covidenceNumber)}`;
  openChromeUrl(targetUrl);
  sleep(1800);
  const currentUrl = activeTabUrl();
  if (!currentUrl.includes(`/reviews/${reviewId}/review_studies/`)) {
    throw new Error(`Unexpected active tab after navigation: ${currentUrl}`);
  }

  waitForMatch(expectedTitle, covidenceNumber);
  openFullTextModal();
  sleep(600);

  const tempScript = `/tmp/covidence-upload-${Date.now()}.js`;
  writeUploadScript(pdfPath, tempScript);
  runChromeEvalFile(tempScript);
  fs.unlinkSync(tempScript);

  waitForUploadedFile(path.basename(pdfPath));
  closeModalIfPresent();

  console.log(`Uploaded ${path.basename(pdfPath)} to ${covidenceNumber} (${expectedTitle})`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
