#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function usage() {
  console.log(`Usage:
  node scripts/covidence-query.mjs ingest-export --csv <file> [--out-dir <dir>] [--label <name>]
  node scripts/covidence-query.mjs snapshot-browser [--out-dir <dir>] [--label <name>]
  node scripts/covidence-query.mjs query [--source <file-or-dir>] [--status <value>] [--tag <value>] [--study <value>] [--text <value>] [--limit <n>] [--format json|table]
  node scripts/covidence-query.mjs diff --left <file-or-dir> --right <file-or-dir> [--format json|table]

Commands:
  ingest-export     Normalize a Covidence CSV export into a local JSON snapshot.
  snapshot-browser  Read the active signed-in Covidence Chrome tab and capture a live snapshot.
  query             Filter a snapshot for common question types.
  diff              Compare two snapshots and report added/removed/changed records.
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return { command, args };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/https?:\/\/(dx\.)?doi\.org\//g, '')
      .replace(/[^a-z0-9\s#-]/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'snapshot';
}

function detectKey(record) {
  if (record.covidenceNumber) {
    return record.covidenceNumber;
  }
  if (record.href) {
    return record.href;
  }
  return `${record.study || ''}::${record.title || ''}`.trim();
}

function detectStatus(text, explicit) {
  const source = normalizeText(`${explicit || ''} ${text || ''}`);
  if (!source) {
    return '';
  }

  const rules = [
    ['included', /\bincluded\b/],
    ['excluded', /\bexcluded\b/],
    ['unresolved', /\bunresolved\b/],
    ['awaiting-review', /\bawaiting review\b/],
    ['conflict', /\bconflict\b/],
    ['duplicate', /\bduplicate\b/],
    ['full-text-review', /\bfull text review\b/],
    ['title-abstract-screening', /\btitle abstract screening\b/],
    ['extraction', /\bextraction\b/],
    ['completed', /\bcomplete(d)?\b/],
  ];

  for (const [value, pattern] of rules) {
    if (pattern.test(source)) {
      return value;
    }
  }

  return '';
}

function parseTags(value) {
  return normalizeWhitespace(value)
    .split(/[;|,]/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function extractTagsFromNotes(notes) {
  const text = String(notes ?? '');
  const matches = Array.from(text.matchAll(/Tag:\s*([^;]+)\s*;?/gi));
  return matches
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean);
}

function buildExportRecord(row) {
  const title = normalizeWhitespace(row.Title);
  const study = normalizeWhitespace(row.Study);
  const notes = normalizeWhitespace(row.Notes);
  const tags = Array.from(new Set([...parseTags(row.Tags), ...extractTagsFromNotes(notes)]));
  return {
    key: normalizeWhitespace(row['Covidence #']) || `${study}::${title}`,
    covidenceNumber: normalizeWhitespace(row['Covidence #']),
    title,
    study,
    authors: normalizeWhitespace(row.Authors),
    year: normalizeWhitespace(row['Published Year']),
    doi: normalizeWhitespace(row.DOI),
    ref: normalizeWhitespace(row.Ref),
    journal: normalizeWhitespace(row.Journal),
    notes,
    tags,
    status: detectStatus(`${notes} ${tags.join(' ')}`),
    href: '',
    rawText: [title, study, notes, tags.join(' ')].filter(Boolean).join(' | '),
  };
}

function chromeActiveTabUrl() {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'url'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function runChromeEval(script) {
  return execFileSync('node', ['scripts/chrome-active-tab.mjs', 'eval', '--script', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function browserSnapshotScript() {
  return `
(() => {
  const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
  const normalizeLoose = (value) => normalize(value).toLowerCase();
  const unique = (items) => Array.from(new Set(items.filter(Boolean)));

  function candidateRow(node) {
    let current = node;
    while (current && current !== document.body) {
      const text = normalize(current.innerText || current.textContent || '');
      if (text.length >= 8) {
        const hasStudyLink = current.querySelector?.('a[href*="/review_studies/"], a[href*="/extraction/study/"]');
        const isLikelyRow = current.matches?.('tr, li, article, section, div');
        if (hasStudyLink && isLikelyRow) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return node;
  }

  const rawLinks = Array.from(document.querySelectorAll('a[href*="/review_studies/"], a[href*="/extraction/study/"]'));
  const records = [];
  const seen = new Set();

  for (const link of rawLinks) {
    const href = link.href || '';
    if (!href || seen.has(href)) {
      continue;
    }
    seen.add(href);

    const row = candidateRow(link);
    const rowText = normalize(row?.innerText || row?.textContent || link.innerText || link.textContent || '');
    const linkText = normalize(link.innerText || link.textContent || '');
    const covidenceMatch = rowText.match(/#\\s*\\d+/);
    const tags = unique(
      rowText
        .split(/\\||\\n|,/)
        .map((part) => normalize(part))
        .filter((part) => part.length > 0 && part.length <= 60)
        .filter((part) => /tag|included|excluded|unresolved|conflict|duplicate|screen|review|extract/i.test(part)),
    );

    records.push({
      href,
      linkText,
      rowText,
      covidenceNumber: covidenceMatch ? covidenceMatch[0] : '',
      status: /included/i.test(rowText)
        ? 'included'
        : /excluded/i.test(rowText)
          ? 'excluded'
          : /unresolved/i.test(rowText)
            ? 'unresolved'
            : /conflict/i.test(rowText)
              ? 'conflict'
              : '',
      tags,
    });
  }

  const heading = normalize(document.querySelector('h1, h2')?.innerText || '');
  const title = document.title || '';
  const bodyText = normalize(document.body.innerText || '');
  const pageTokens = unique(
    bodyText
      .split(/\\||\\n/)
      .map((item) => normalize(item))
      .filter((item) => item.length > 0 && item.length <= 80)
      .filter((item) => /included|excluded|unresolved|conflict|duplicate|screen|review|extract|tag/i.test(item)),
  ).slice(0, 40);

  return JSON.stringify({
    title,
    heading,
    url: window.location.href,
    capturedAt: new Date().toISOString(),
    pageTokens,
    records,
    bodyTextPreview: bodyText.slice(0, 4000),
  });
})()
`.trim();
}

function buildBrowserRecord(raw) {
  const rowText = normalizeWhitespace(raw.rowText);
  const tags = parseTags(raw.tags.join(','));
  const title = raw.linkText || rowText;
  return {
    key: raw.covidenceNumber || raw.href || title,
    covidenceNumber: normalizeWhitespace(raw.covidenceNumber),
    title,
    study: '',
    authors: '',
    year: '',
    doi: '',
    ref: '',
    journal: '',
    notes: '',
    tags,
    status: detectStatus(rowText, raw.status),
    href: normalizeWhitespace(raw.href),
    rawText: rowText,
  };
}

function writeSnapshot(filePath, snapshot) {
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function listSnapshotFiles(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dirPath, name));
}

function resolveSnapshotPath(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Snapshot path not found: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const files = listSnapshotFiles(resolved);
    if (files.length === 0) {
      throw new Error(`No snapshot JSON files found in: ${resolved}`);
    }
    return files.at(-1);
  }
  return resolved;
}

function loadSnapshot(inputPath) {
  const filePath = resolveSnapshotPath(inputPath);
  return {
    filePath,
    snapshot: JSON.parse(fs.readFileSync(filePath, 'utf8')),
  };
}

function defaultSnapshotDir() {
  return path.resolve('tmp', 'covidence-query');
}

function saveAndReportSnapshot(snapshot, outDir, label) {
  ensureDir(outDir);
  const baseName = `${nowStamp()}-${slugify(label || snapshot.source.kind)}`;
  const filePath = path.join(outDir, `${baseName}.json`);
  writeSnapshot(filePath, snapshot);
  console.log(filePath);
}

function printTable(records) {
  const headers = ['key', 'status', 'covidenceNumber', 'study', 'title', 'tags'];
  const widths = new Map(headers.map((header) => [header, header.length]));
  const rows = records.map((record) => ({
    key: record.key,
    status: record.status,
    covidenceNumber: record.covidenceNumber,
    study: record.study,
    title: record.title,
    tags: record.tags.join('; '),
  }));

  for (const row of rows) {
    for (const header of headers) {
      widths.set(header, Math.min(60, Math.max(widths.get(header), String(row[header] ?? '').length)));
    }
  }

  const formatCell = (header, value) => {
    const raw = String(value ?? '');
    const shortened = raw.length > widths.get(header) ? `${raw.slice(0, widths.get(header) - 1)}…` : raw;
    return shortened.padEnd(widths.get(header), ' ');
  };

  console.log(headers.map((header) => formatCell(header, header)).join(' | '));
  console.log(headers.map((header) => '-'.repeat(widths.get(header))).join('-|-'));
  for (const row of rows) {
    console.log(headers.map((header) => formatCell(header, row[header])).join(' | '));
  }
}

function queryRecords(records, args) {
  let next = [...records];
  if (args.status) {
    const wanted = normalizeText(args.status);
    next = next.filter((record) => normalizeText(record.status) === wanted);
  }
  if (args.tag) {
    const wanted = normalizeText(args.tag);
    next = next.filter((record) => record.tags.some((tag) => normalizeText(tag).includes(wanted)));
  }
  if (args.study) {
    const wanted = normalizeText(args.study);
    next = next.filter((record) => normalizeText(record.study).includes(wanted));
  }
  if (args.text) {
    const wanted = normalizeText(args.text);
    next = next.filter((record) =>
      [record.title, record.study, record.notes, record.rawText, record.covidenceNumber, record.tags.join(' ')]
        .map((value) => normalizeText(value))
        .some((value) => value.includes(wanted)),
    );
  }
  if (args.limit) {
    next = next.slice(0, Number(args.limit));
  }
  return next;
}

function createDiff(leftRecords, rightRecords) {
  const leftByKey = new Map(leftRecords.map((record) => [detectKey(record), record]));
  const rightByKey = new Map(rightRecords.map((record) => [detectKey(record), record]));
  const keys = Array.from(new Set([...leftByKey.keys(), ...rightByKey.keys()])).sort();

  const added = [];
  const removed = [];
  const changed = [];

  for (const key of keys) {
    const left = leftByKey.get(key);
    const right = rightByKey.get(key);
    if (!left && right) {
      added.push(right);
      continue;
    }
    if (left && !right) {
      removed.push(left);
      continue;
    }

    const leftSignature = JSON.stringify({
      status: left.status,
      tags: [...left.tags].sort(),
      title: left.title,
      study: left.study,
      rawText: left.rawText,
    });
    const rightSignature = JSON.stringify({
      status: right.status,
      tags: [...right.tags].sort(),
      title: right.title,
      study: right.study,
      rawText: right.rawText,
    });
    if (leftSignature !== rightSignature) {
      changed.push({
        key,
        before: left,
        after: right,
      });
    }
  }

  return { added, removed, changed };
}

function handleIngestExport(args) {
  if (!args.csv) {
    throw new Error('ingest-export requires --csv');
  }

  const csvPath = path.resolve(args.csv);
  const outDir = path.resolve(args['out-dir'] || defaultSnapshotDir());
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const records = rows.map(buildExportRecord);
  const snapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    source: {
      kind: 'covidence-export',
      csvPath,
      rowCount: rows.length,
      label: args.label || path.basename(csvPath),
    },
    summary: {
      total: records.length,
      statuses: countBy(records, (record) => record.status || '(blank)'),
      tags: countBy(
        records.flatMap((record) => record.tags),
        (tag) => tag,
      ),
    },
    records,
  };
  saveAndReportSnapshot(snapshot, outDir, args.label || path.basename(csvPath, path.extname(csvPath)));
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function handleSnapshotBrowser(args) {
  const currentUrl = chromeActiveTabUrl();
  if (!/covidence\.org/.test(currentUrl)) {
    throw new Error(`Active Chrome tab is not Covidence: ${currentUrl}`);
  }

  const raw = JSON.parse(runChromeEval(browserSnapshotScript()));
  const records = raw.records.map(buildBrowserRecord);
  const snapshot = {
    schemaVersion: 1,
    capturedAt: raw.capturedAt,
    source: {
      kind: 'covidence-browser',
      label: args.label || raw.heading || raw.title || 'covidence-browser',
      url: raw.url,
      title: raw.title,
      heading: raw.heading,
      pageTokens: raw.pageTokens,
    },
    summary: {
      total: records.length,
      statuses: countBy(records, (record) => record.status || '(blank)'),
      tags: countBy(
        records.flatMap((record) => record.tags),
        (tag) => tag,
      ),
    },
    records,
    bodyTextPreview: raw.bodyTextPreview,
  };

  const outDir = path.resolve(args['out-dir'] || defaultSnapshotDir());
  saveAndReportSnapshot(snapshot, outDir, args.label || raw.heading || raw.title);
}

function handleQuery(args) {
  const source = args.source ? path.resolve(args.source) : defaultSnapshotDir();
  const { snapshot } = loadSnapshot(source);
  const records = queryRecords(snapshot.records, args);

  if ((args.format || 'table') === 'json') {
    console.log(JSON.stringify({ source: snapshot.source, count: records.length, records }, null, 2));
    return;
  }

  console.log(`source: ${snapshot.source.kind}`);
  console.log(`capturedAt: ${snapshot.capturedAt}`);
  console.log(`summary.total: ${snapshot.summary?.total ?? snapshot.records.length}`);
  console.log(`summary.statuses: ${JSON.stringify(snapshot.summary?.statuses || {})}`);
  console.log(`count: ${records.length}`);
  if (records.length > 0) {
    printTable(records);
  }
}

function handleDiff(args) {
  if (!args.left || !args.right) {
    throw new Error('diff requires --left and --right');
  }

  const left = loadSnapshot(args.left);
  const right = loadSnapshot(args.right);
  const diff = createDiff(left.snapshot.records, right.snapshot.records);

  if ((args.format || 'table') === 'json') {
    console.log(
      JSON.stringify(
        {
          left: { file: left.filePath, source: left.snapshot.source, capturedAt: left.snapshot.capturedAt },
          right: { file: right.filePath, source: right.snapshot.source, capturedAt: right.snapshot.capturedAt },
          summary: {
            added: diff.added.length,
            removed: diff.removed.length,
            changed: diff.changed.length,
          },
          diff,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`left: ${left.filePath}`);
  console.log(`right: ${right.filePath}`);
  console.log(`added: ${diff.added.length}`);
  console.log(`removed: ${diff.removed.length}`);
  console.log(`changed: ${diff.changed.length}`);

  if (diff.added.length) {
    console.log('\n[added]');
    printTable(diff.added.slice(0, 20));
  }
  if (diff.removed.length) {
    console.log('\n[removed]');
    printTable(diff.removed.slice(0, 20));
  }
  if (diff.changed.length) {
    console.log('\n[changed]');
    printTable(diff.changed.slice(0, 20).map((entry) => entry.after));
  }
}

function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (!command || args.help) {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (command === 'ingest-export') {
    handleIngestExport(args);
    return;
  }

  if (command === 'snapshot-browser') {
    handleSnapshotBrowser(args);
    return;
  }

  if (command === 'query') {
    handleQuery(args);
    return;
  }

  if (command === 'diff') {
    handleDiff(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
