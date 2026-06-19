#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const DEFAULT_CACHE_DIR = path.join(
  os.homedir(),
  'Library/Caches/Codex/Default/Partitions/codex-browser-app/Cache/Cache_Data',
);
const DEFAULT_OUT_DIR = path.join(
  ROOT,
  'tmp/second-updated-search-ucd-full-text-pdf-retrieval-2026-06-18',
);
const AWAITING_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');

const args = process.argv.slice(2);
const SHOULD_UPLOAD = args.includes('--upload');
const valueArg = (name, fallback) => {
  const arg = args.find((item) => item.startsWith(`${name}=`));
  return arg ? path.resolve(arg.slice(name.length + 1)) : fallback;
};
const CACHE_DIR = valueArg('--cache-dir', DEFAULT_CACHE_DIR);
const PDF_DIR = valueArg('--pdf-dir', null);
const OUT_DIR = valueArg('--out-dir', DEFAULT_OUT_DIR);
const FILES_DIR = path.join(OUT_DIR, 'files');
const SOURCE_LABEL = PDF_DIR ? 'zotero-local-pdf' : 'ucd-browser-cache';
const SOURCE_REPORT_SLUG = SOURCE_LABEL.replace(/-pdf$/, '');

const loadEnv = (filePath) => {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
  return env;
};

const env = loadEnv(ENV_PATH);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compact = (value) => normalize(value).replace(/\s+/g, '');
const safeName = (value) => normalize(value).replace(/\s+/g, '-').slice(0, 110) || 'full-text';

const listAwaitingRecords = async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id,assigned_study_id,title,lead_author,year,doi,storage_object_path,data_base64,file_sha256,metadata')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows.filter((record) =>
    record.metadata?.titleAbstractRecordId
    && (record.metadata?.awaitingFullTextPdf === true
      || (!record.storage_object_path && record.data_base64 === AWAITING_SENTINEL)),
  );
};

const listExistingHashes = async () => {
  const hashes = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('file_sha256')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) if (row.file_sha256) hashes.add(row.file_sha256);
    if (!data || data.length < 1000) break;
  }
  const { data: papers, error } = await supabase.from('papers').select('primary_file_sha256');
  if (error) throw error;
  for (const row of papers ?? []) if (row.primary_file_sha256) hashes.add(row.primary_file_sha256);
  return hashes;
};

const cachedPdfs = () => {
  const seen = new Set();
  const results = [];
  for (const name of fs.readdirSync(CACHE_DIR)) {
    const cachePath = path.join(CACHE_DIR, name);
    let stat;
    try { stat = fs.statSync(cachePath); } catch { continue; }
    if (!stat.isFile() || stat.size < 1024) continue;
    const cache = fs.readFileSync(cachePath);
    const start = cache.indexOf(Buffer.from('%PDF-'));
    const eof = cache.lastIndexOf(Buffer.from('%%EOF'));
    if (start < 0 || eof < start) continue;
    const buffer = cache.subarray(start, eof + 5);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (seen.has(sha256)) continue;
    seen.add(sha256);
    const header = cache.subarray(0, start).toString('latin1');
    const urls = header.match(/https?:\/\/[^\x00-\x20]+/g) ?? [];
    results.push({ cachePath, buffer, sha256, sourceUrl: urls.at(-1) ?? null });
  }
  return results;
};

const localPdfs = () => {
  const paths = [];
  const walk = (directory) => {
    for (const name of fs.readdirSync(directory)) {
      const filePath = path.join(directory, name);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) walk(filePath);
      else if (stat.isFile() && name.toLowerCase().endsWith('.pdf')) paths.push(filePath);
    }
  };
  walk(PDF_DIR);
  return paths.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    return {
      cachePath: filePath,
      buffer,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      sourceUrl: `local-zotero-import:${path.relative(PDF_DIR, filePath)}`,
    };
  });
};

const pdfText = (buffer, sha256) => {
  const tempPath = path.join(OUT_DIR, `.cache-${sha256}.pdf`);
  fs.writeFileSync(tempPath, buffer);
  const result = spawnSync('pdftotext', ['-f', '1', '-l', '3', '-layout', tempPath, '-'], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 1_000_000,
  });
  fs.rmSync(tempPath, { force: true });
  return result.status === 0 ? result.stdout : '';
};

const chooseRecord = (records, text) => {
  const compactText = compact(text);
  const doiMatches = records.filter((record) => record.doi && compactText.includes(compact(record.doi)));
  if (doiMatches.length === 1) return { record: doiMatches[0], method: 'doi', coverage: 1 };
  const normalizedText = normalize(text);
  const exactTitleMatches = records.filter((record) => {
    const title = normalize(record.title);
    return title.length >= 24 && normalizedText.includes(title);
  });
  if (exactTitleMatches.length === 1) {
    return { record: exactTitleMatches[0], method: 'exact_title', coverage: 1 };
  }
  return null;
};

const uploadPdf = async (record, buffer, fileName, sha256, sourceUrl) => {
  const fileId = crypto.randomUUID();
  const objectPath = `${fileId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const { error: uploadError } = await supabase.storage.from('papers').upload(objectPath, buffer, {
    contentType: 'application/pdf', upsert: false,
  });
  if (uploadError) throw uploadError;
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('screening_records')
    .update({
      storage_bucket: 'papers', storage_object_path: objectPath, data_base64: null,
      file_name: fileName, original_file_name: fileName, mime_type: 'application/pdf',
      size: buffer.length, file_sha256: sha256,
      metadata: {
        ...(record.metadata ?? {}), awaitingFullTextPdf: false,
        fullTextPdfAttachedAt: now,
        fullTextPdfAttachedBy: `script:import-ucd-browser-cache-pdfs:${SOURCE_LABEL}`,
        fullTextPdfSourceUrl: sourceUrl,
      },
      updated_at: now,
    })
    .eq('id', record.id);
  if (updateError) throw updateError;
  return objectPath;
};

fs.mkdirSync(FILES_DIR, { recursive: true });
const records = await listAwaitingRecords();
const existingHashes = await listExistingHashes();
const report = [];
for (const item of (PDF_DIR ? localPdfs() : cachedPdfs())) {
  const text = pdfText(item.buffer, item.sha256);
  const match = chooseRecord(records, text);
  if (!match) continue;
  const { record, method, coverage } = match;
  const fileName = `${record.assigned_study_id}-${safeName(record.title)}.pdf`;
  const localPath = path.join(FILES_DIR, fileName);
  fs.writeFileSync(localPath, item.buffer);
  const entry = {
    studyId: record.assigned_study_id, recordId: record.id, title: record.title, doi: record.doi,
    status: existingHashes.has(item.sha256) ? 'duplicate_hash' : (SHOULD_UPLOAD ? 'uploaded' : 'ready'),
    matchMethod: method, titleTokenCoverage: coverage, sha256: item.sha256,
    size: item.buffer.length, sourceUrl: item.sourceUrl, localPath,
  };
  if (entry.status === 'uploaded') {
    entry.storageObjectPath = await uploadPdf(record, item.buffer, fileName, item.sha256, item.sourceUrl);
    existingHashes.add(item.sha256);
  }
  report.push(entry);
}

const reportPath = path.join(
  OUT_DIR,
  SHOULD_UPLOAD
    ? `second-updated-search-${SOURCE_REPORT_SLUG}-pdf-upload-log-2026-06-19.json`
    : `second-updated-search-${SOURCE_REPORT_SLUG}-pdf-dry-run-2026-06-19.json`,
);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const counts = report.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ upload: SHOULD_UPLOAD, awaitingRecords: records.length, counts, reportPath, filesDir: FILES_DIR }, null, 2));
