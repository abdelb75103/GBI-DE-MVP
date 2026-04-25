#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/package.json'));
const { createClient } = require('@supabase/supabase-js');

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
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before exporting records.');
}

const outputPath = path.resolve(String(args.get('output') || '/tmp/title-abstract-records.json'));
const limit = Number(args.get('limit') || 500);
const includeCompleted = Boolean(args.get('include-completed'));

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
let query = supabase
  .from('screening_records')
  .select('id, assigned_study_id, title, abstract, lead_author, journal, year, doi, source_label, source_record_id, ai_status, ai_suggested_decision, metadata, created_at, updated_at')
  .eq('stage', 'title_abstract')
  .order('created_at', { ascending: false })
  .limit(limit);

if (!includeCompleted) {
  query = query.or('ai_status.is.null,ai_status.neq.completed');
}

const { data, error } = await query;
if (error) {
  throw new Error(`Failed to export title/abstract records: ${error.message}`);
}

const records = (data ?? []).map((record) => ({
  recordId: record.id,
  studyId: record.assigned_study_id,
  title: record.title,
  abstract: record.abstract,
  leadAuthor: record.lead_author,
  journal: record.journal,
  year: record.year,
  doi: record.doi,
  sourceLabel: record.source_label,
  sourceRecordId: record.source_record_id,
  aiStatus: record.ai_status,
  aiSuggestedDecision: record.ai_suggested_decision,
  metadata: record.metadata,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
}));

await writeFile(outputPath, `${JSON.stringify({
  exportedAt: new Date().toISOString(),
  criteriaVersion: 'fifa-gbi-title-abstract-v1-2026-04-25',
  records,
}, null, 2)}\n`);

console.log(`Exported ${records.length} title/abstract records to ${outputPath}`);
