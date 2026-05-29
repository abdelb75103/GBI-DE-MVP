#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

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
const label = String(args.get('batch-label') || SEARCH_BATCH_LABEL);
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const base = () =>
  supabase
    .from('screening_records')
    .select('id', { count: 'exact', head: true })
    .eq('stage', 'title_abstract')
    .eq('metadata->>searchBatchLabel', label);

const count = async (name, query) => {
  const { count: value, error } = await query;
  if (error) throw new Error(`${name}: ${error.message}`);
  return [name, value ?? 0];
};

const rows = await Promise.all([
  count('total', base()),
  count('completed', base().eq('ai_status', 'completed')),
  count('include', base().eq('ai_status', 'completed').eq('ai_suggested_decision', 'include')),
  count('exclude', base().eq('ai_status', 'completed').eq('ai_suggested_decision', 'exclude')),
  count('undecided', base().eq('ai_status', 'completed').is('ai_suggested_decision', null)),
  count('notCompleted', base().or('ai_status.is.null,ai_status.neq.completed')),
  count(
    'systematic',
    base()
      .eq('ai_status', 'completed')
      .eq('ai_suggested_decision', 'include')
      .contains('ai_raw_response', { targetTag: 'systematic_review' }),
  ),
]);

const report = Object.fromEntries(rows);

if (existsSync(recommendationsPath)) {
  const payload = JSON.parse(readFileSync(recommendationsPath, 'utf8'));
  const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  const ids = recommendations.map((item) => item.recordId).filter(Boolean);
  report.localTotal = recommendations.length;
  report.localDuplicates = ids.length - new Set(ids).size;
  report.localSystematic = recommendations.filter((item) => item.targetTag === 'systematic_review').length;
  report.localCounts = recommendations.reduce((accumulator, item) => {
    accumulator[item.decision] = (accumulator[item.decision] || 0) + 1;
    return accumulator;
  }, {});
}

console.log(JSON.stringify(report, null, 2));
