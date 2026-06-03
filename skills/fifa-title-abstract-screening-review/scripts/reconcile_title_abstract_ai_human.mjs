#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import {
  finalizeTitleAbstractRecommendation,
  getTitleAbstractSupabaseDecisions,
  getTitleAbstractSupabaseResolution,
} from './title_abstract_supabase_finalize.mjs';

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

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const decisiveHumanVote = (record) =>
  getTitleAbstractSupabaseDecisions(record)
    .filter((decision) => decision.action !== 'resolver_decision')
    .find((decision) => decision.decision === 'include' || decision.decision === 'exclude') ?? null;

const getMetadata = (record) =>
  record?.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
    ? record.metadata
    : {};

const shouldFinalize = (record, resolution) => {
  const metadata = getMetadata(record);
  if (resolution === 'promoted_to_full_text') return false;
  if (resolution === 'ready_for_full_text') return typeof metadata.titleAbstractPromotedRecordId !== 'string';
  if (resolution === 'excluded') return record.manual_decision !== 'exclude' || metadata.titleAbstractResolution !== 'excluded';
  if (resolution === 'needs_resolver') return metadata.titleAbstractResolution !== 'needs_resolver';
  if (resolution === 'flagged') return metadata.titleAbstractResolution !== 'flagged';
  return false;
};

const increment = (object, key) => {
  object[key] = (object[key] ?? 0) + 1;
};

const loadCandidateRows = async (supabase) => {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('*')
      .eq('stage', 'title_abstract')
      .eq('ai_status', 'completed')
      .in('ai_suggested_decision', ['include', 'exclude'])
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load title/abstract records: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before reconciling title/abstract decisions.');
}

const apply = Boolean(args.get('apply'));
const quiet = Boolean(args.get('quiet'));
const limit = toPositiveInteger(args.get('limit'), Number.POSITIVE_INFINITY);
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const rows = await loadCandidateRows(supabase);

const summary = {
  scanned: rows.length,
  eligible: 0,
  skipped: {},
  planned: {},
  applied: {},
  examples: {},
};

const planned = [];
for (const record of rows) {
  const humanVote = decisiveHumanVote(record);
  if (!humanVote) {
    increment(summary.skipped, 'no_human_include_exclude_vote');
    continue;
  }

  const resolution = getTitleAbstractSupabaseResolution(record);
  if (resolution === 'pending') {
    increment(summary.skipped, 'pending_resolution');
    continue;
  }

  summary.eligible += 1;
  if (!shouldFinalize(record, resolution)) {
    increment(summary.skipped, `already_${resolution}`);
    continue;
  }

  increment(summary.planned, resolution);
  summary.examples[resolution] ??= record.assigned_study_id;
  planned.push({ record, resolution });
}

const limited = planned.slice(0, limit);
if (apply) {
  for (const { record } of limited) {
    const result = await finalizeTitleAbstractRecommendation(supabase, record.id, { quiet: true });
    increment(summary.applied, result.resolution);
    if (!quiet) {
      console.log(`${record.assigned_study_id}: ${result.resolution}${result.fullTextRecordId ? ` -> ${result.fullTextRecordId}` : ''}`);
    }
  }
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  limit: Number.isFinite(limit) ? limit : null,
  ...summary,
}, null, 2));
