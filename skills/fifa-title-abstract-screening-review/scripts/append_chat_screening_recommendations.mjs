#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CRITERIA_VERSION = 'fifa-gbi-title-abstract-v1-2026-05-27';
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

const inputPath = args.get('input');
if (!inputPath) {
  throw new Error('Usage: node append_chat_screening_recommendations.mjs --input batch-recommendations.json [--recommendations output.json]');
}

const recommendationsPath = path.resolve(String(args.get('recommendations') || DEFAULT_RECOMMENDATIONS_PATH));
const incoming = JSON.parse(readFileSync(path.resolve(String(inputPath)), 'utf8'));
const incomingRecommendations = Array.isArray(incoming.recommendations) ? incoming.recommendations : [];

const validate = (item) => {
  if (!item?.recordId) return 'Missing recordId.';
  if (!['include', 'exclude', 'undecided'].includes(item.decision)) return `${item.recordId}: invalid decision.`;
  if (!item.reason || typeof item.reason !== 'string') return `${item.recordId}: missing reason.`;
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) return `${item.recordId}: invalid confidence.`;
  if (item.targetTag && item.targetTag !== 'systematic_review') return `${item.recordId}: targetTag must be systematic_review or null.`;
  if (item.decision !== 'exclude' && (item.exclusionReason || item.sourceQuote || item.sourceLocation)) {
    return `${item.recordId}: non-exclude decisions must not have exclusion quote fields.`;
  }
  if (item.decision === 'exclude' && !item.exclusionReason) return `${item.recordId}: exclude requires exclusionReason.`;
  return null;
};

const failures = incomingRecommendations.map(validate).filter(Boolean);
if (failures.length > 0) {
  throw new Error(`Invalid recommendations:\n${failures.join('\n')}`);
}

let output = {
  searchBatchLabel: 'Second search - Ishanka - 2026-05-26',
  criteriaVersion: CRITERIA_VERSION,
  generatedAt: new Date().toISOString(),
  model: 'gpt-5.5',
  reasoning: 'medium',
  recommendations: [],
};
if (existsSync(recommendationsPath)) {
  output = JSON.parse(readFileSync(recommendationsPath, 'utf8'));
}

const byId = new Map((output.recommendations ?? []).map((item) => [item.recordId, item]));
for (const item of incomingRecommendations) {
  byId.set(item.recordId, item);
}

output.criteriaVersion = output.criteriaVersion || CRITERIA_VERSION;
output.generatedAt = new Date().toISOString();
output.model = String(args.get('model') || output.model || 'gpt-5.5');
output.reasoning = String(args.get('reasoning') || output.reasoning || 'medium');
output.recommendations = Array.from(byId.values());

writeFileSync(recommendationsPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${incomingRecommendations.length} incoming recommendation(s); ${output.recommendations.length} total in ${recommendationsPath}.`);
