#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import { finalizeTitleAbstractRecommendation } from './title_abstract_supabase_finalize.mjs';

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

const inputPath = args.get('input');
if (!inputPath) {
  throw new Error('Usage: node apply_recommendations_to_supabase.mjs --input recommendations.json [--apply] [--force]');
}

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before applying recommendations.');
}

const payload = JSON.parse(readFileSync(path.resolve(String(inputPath)), 'utf8'));
const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
const criteriaVersion = payload.criteriaVersion || 'fifa-gbi-title-abstract-v1-2026-04-25';
const modelName = payload.model
  ? `${payload.model}${payload.reasoning ? ` (${payload.reasoning})` : ''} via local codex exec`
  : 'codex-local-title-abstract-screening-skill';
const apply = Boolean(args.get('apply'));
const force = Boolean(args.get('force'));
const noFinalize = Boolean(args.get('no-finalize'));
const quiet = Boolean(args.get('quiet'));

const validate = (item) => {
  if (!item || typeof item !== 'object') return 'Recommendation must be an object.';
  if (!item.recordId) return 'Missing recordId.';
  if (item.decision !== 'include' && item.decision !== 'exclude' && item.decision !== 'undecided') {
    return `${item.recordId}: decision must be include, exclude, or undecided.`;
  }
  if (!item.reason || typeof item.reason !== 'string') return `${item.recordId}: reason is required.`;
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) return `${item.recordId}: confidence must be 0-1.`;
  if (item.targetTag && item.targetTag !== 'systematic_review') return `${item.recordId}: targetTag must be systematic_review or null.`;
  if (item.decision === 'include' && (item.exclusionReason || item.sourceQuote || item.sourceLocation)) {
    return `${item.recordId}: include recommendations must not include exclusion quote/source fields.`;
  }
  if (item.decision === 'undecided' && (item.exclusionReason || item.sourceQuote || item.sourceLocation)) {
    return `${item.recordId}: undecided recommendations must not include exclusion quote/source fields.`;
  }
  if (item.decision === 'exclude' && !item.exclusionReason) return `${item.recordId}: exclude recommendations require exclusionReason.`;
  return null;
};

const failures = recommendations.map(validate).filter(Boolean);
if (failures.length > 0) {
  throw new Error(`Invalid recommendations:\n${failures.join('\n')}`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const existingRows = [];
const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

for (const ids of chunk(recommendations.map((item) => item.recordId), 100)) {
  const { data, error: existingError } = await supabase
    .from('screening_records')
    .select('id, stage, ai_status')
    .in('id', ids);

  if (existingError) {
    throw new Error(`Failed to validate existing records: ${existingError.message}`);
  }
  existingRows.push(...(data ?? []));
}

const existingById = new Map(existingRows.map((row) => [row.id, row]));
let appliedCount = 0;
let skippedCount = 0;

for (const item of recommendations) {
  const existing = existingById.get(item.recordId);
  if (!existing) {
    if (!quiet) console.log(`skip ${item.recordId}: record not found`);
    skippedCount += 1;
    continue;
  }
  if (existing.stage !== 'title_abstract') {
    if (!quiet) console.log(`skip ${item.recordId}: not a title/abstract record`);
    skippedCount += 1;
    continue;
  }
  if (!force && existing.ai_status === 'completed') {
    if (!quiet) console.log(`skip ${item.recordId}: AI already completed`);
    skippedCount += 1;
    continue;
  }

  const update = {
    ai_status: 'completed',
    ai_suggested_decision: item.decision === 'undecided' ? null : item.decision,
    ai_reason: item.reason,
    ai_evidence_quote: null,
    ai_source_location: null,
    ai_confidence: item.confidence,
    ai_model: modelName,
    ai_criteria_version: criteriaVersion,
    ai_raw_response: item,
    ai_error: null,
    ai_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!apply) {
    if (!quiet) console.log(`dry-run ${item.recordId}: ${item.decision} (${item.confidence})`);
    appliedCount += 1;
    continue;
  }

  const { error } = await supabase
    .from('screening_records')
    .update(update)
    .eq('id', item.recordId);

  if (error) {
    throw new Error(`Failed to update ${item.recordId}: ${error.message}`);
  }
  if (!noFinalize) await finalizeTitleAbstractRecommendation(supabase, item.recordId, { quiet });
  if (!quiet) console.log(`updated ${item.recordId}: ${item.decision}`);
  appliedCount += 1;
}

console.log(`${apply ? 'Applied' : 'Dry-run'} ${appliedCount} recommendation(s); skipped ${skippedCount}.`);
