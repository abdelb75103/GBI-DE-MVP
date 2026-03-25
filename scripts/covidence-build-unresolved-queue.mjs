#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log(`Usage:
  node scripts/covidence-build-unresolved-queue.mjs \
    --references <csv> \
    --manifest <file> [--manifest <file> ...] \
    --output <file>
`);
}

function parseArgs(argv) {
  const args = { manifest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    if (key === 'manifest') {
      args.manifest.push(next);
    } else {
      args[key] = next;
    }
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

function writeCsv(filePath, rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.references || !args.output || args.manifest.length === 0) {
    usage();
    process.exit(1);
  }

  const referenceRows = parseCsv(fs.readFileSync(path.resolve(args.references), 'utf8'));
  const referencesByNumber = new Map();
  for (const row of referenceRows) {
    referencesByNumber.set(row['Covidence #'], row);
  }

  const unresolvedStatuses = new Set(['no_button', 'search_not_found', 'study_page_mismatch']);
  const unresolvedRows = [];
  const seen = new Set();

  for (const manifestPath of args.manifest.map((value) => path.resolve(value))) {
    const manifestRows = parseCsv(fs.readFileSync(manifestPath, 'utf8'));
    for (const row of manifestRows) {
      if (!unresolvedStatuses.has(row.status)) {
        continue;
      }
      if (seen.has(row.covidence_number)) {
        continue;
      }
      seen.add(row.covidence_number);
      const reference = referencesByNumber.get(row.covidence_number);
      unresolvedRows.push({
        covidence_number: row.covidence_number,
        study: reference?.Study || row.study || '',
        title: reference?.Title || row.title || '',
        year: reference?.['Published Year'] || '',
        source_status: row.status,
        source_manifest: manifestPath,
      });
    }
  }

  unresolvedRows.sort((left, right) => {
    const leftNumber = Number((left.covidence_number.match(/\d+/) || ['0'])[0]);
    const rightNumber = Number((right.covidence_number.match(/\d+/) || ['0'])[0]);
    return leftNumber - rightNumber;
  });

  writeCsv(path.resolve(args.output), unresolvedRows, [
    'covidence_number',
    'study',
    'title',
    'year',
    'source_status',
    'source_manifest',
  ]);

  console.log(`Wrote ${unresolvedRows.length} unresolved rows to ${path.resolve(args.output)}`);
}

main();
