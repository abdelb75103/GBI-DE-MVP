#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/package.json'));
const { createClient } = require('@supabase/supabase-js');

const SEARCH_BATCH_LABEL = 'Second search - Ishanka - 2026-05-26';
const DEFAULT_RECOMMENDATIONS_PATH = '/tmp/second-search-title-abstract-ai-codex.json';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith('--')) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const recommendationsPath = path.resolve(String(args.get('recommendations') || DEFAULT_RECOMMENDATIONS_PATH));
const outputPath = path.resolve(String(args.get('output') || '/tmp/title-abstract-chat-batch.json'));
const limit = Math.max(1, Math.min(300, Number(args.get('limit') || 80)));
const compactAbstractChars = Math.max(800, Math.min(6000, Number(args.get('abstract-chars') || 2200)));

const completedIds = new Set();
if (existsSync(recommendationsPath)) {
  const payload = JSON.parse(readFileSync(recommendationsPath, 'utf8'));
  for (const item of payload.recommendations ?? []) {
    if (item?.recordId) completedIds.add(item.recordId);
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const rows = [];
const pageSize = 1000;
for (let from = 0; rows.length < limit; from += pageSize) {
  const { data, error } = await supabase
    .from('screening_records')
    .select('id, assigned_study_id, title, abstract, lead_author, journal, year, doi, source_label, source_record_id, ai_status, metadata, created_at')
    .eq('stage', 'title_abstract')
    .eq('metadata->>searchBatchLabel', SEARCH_BATCH_LABEL)
    .or('ai_status.is.null,ai_status.neq.completed')
    .order('assigned_study_id', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Failed to fetch records: ${error.message}`);
  if (!data || data.length === 0) break;
  for (const record of data) {
    if (completedIds.has(record.id)) continue;
    rows.push(record);
    if (rows.length >= limit) break;
  }
  if (data.length < pageSize) break;
}

const compact = (value, max) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const records = rows.map((record) => ({
  recordId: record.id,
  studyId: record.assigned_study_id,
  title: record.title,
  abstract: compact(record.abstract, compactAbstractChars),
  abstractMissing: !record.abstract?.trim(),
  leadAuthor: record.lead_author,
  journal: record.journal,
  year: record.year,
  doi: record.doi,
  sourceLabel: record.source_label,
  sourceRecordId: record.source_record_id,
}));

writeFileSync(outputPath, `${JSON.stringify({
  searchBatchLabel: SEARCH_BATCH_LABEL,
  exportedAt: new Date().toISOString(),
  recommendationsPath,
  alreadyRecommended: completedIds.size,
  count: records.length,
  records,
}, null, 2)}\n`);

console.log(`Exported ${records.length} record(s) to ${outputPath}; ${completedIds.size} already recommended.`);
