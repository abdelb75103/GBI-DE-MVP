#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

const batchPrefix = args.get('batch-prefix');
const recommendationsPrefix = args.get('recommendations-prefix');
const outputPath = args.get('output');
const count = Number(args.get('count') || 0);
if (!batchPrefix || !recommendationsPrefix || !outputPath || !Number.isInteger(count) || count < 1) {
  throw new Error('Usage: node merge_chat_screening_recommendations.mjs --batch-prefix /tmp/wave-batch --recommendations-prefix /tmp/wave-recommendations --count 4 --output /tmp/wave-merged.json');
}

const failures = [];
const expectedRecords = [];
const recommendations = [];

const validateRecommendation = (item) => {
  if (!item?.recordId) return 'Missing recordId.';
  if (!['include', 'exclude', 'undecided'].includes(item.decision)) return `${item.studyId ?? item.recordId}: invalid decision.`;
  if (!item.reason || typeof item.reason !== 'string') return `${item.studyId ?? item.recordId}: missing reason.`;
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) return `${item.studyId ?? item.recordId}: invalid confidence.`;
  if (item.targetTag && item.targetTag !== 'systematic_review') return `${item.studyId ?? item.recordId}: invalid targetTag.`;
  if (item.decision !== 'exclude' && (item.exclusionReason || item.sourceQuote || item.sourceLocation)) {
    return `${item.studyId ?? item.recordId}: non-exclude decisions must not include exclusion quote fields.`;
  }
  if (item.decision === 'exclude' && !item.exclusionReason) return `${item.studyId ?? item.recordId}: exclude requires exclusionReason.`;
  return null;
};

for (let index = 1; index <= count; index += 1) {
  const batchPath = `${batchPrefix}-${index}.json`;
  const recommendationsPath = `${recommendationsPrefix}-${index}.json`;
  const batch = JSON.parse(readFileSync(path.resolve(batchPath), 'utf8'));
  const output = JSON.parse(readFileSync(path.resolve(recommendationsPath), 'utf8'));
  const batchRecords = Array.isArray(batch.records) ? batch.records : [];
  const batchRecommendations = Array.isArray(output.recommendations) ? output.recommendations : [];
  expectedRecords.push(...batchRecords);
  recommendations.push(...batchRecommendations);

  const expectedIds = new Set(batchRecords.map((record) => record.recordId));
  const seenIds = new Set();
  for (const item of batchRecommendations) {
    const schemaFailure = validateRecommendation(item);
    if (schemaFailure) failures.push(schemaFailure);
    if (!expectedIds.has(item.recordId)) failures.push(`${item.studyId ?? item.recordId}: unexpected recordId in batch ${index}.`);
    if (seenIds.has(item.recordId)) failures.push(`${item.studyId ?? item.recordId}: duplicate recordId in batch ${index}.`);
    seenIds.add(item.recordId);
  }
  for (const id of expectedIds) {
    if (!seenIds.has(id)) failures.push(`${id}: missing recommendation in batch ${index}.`);
  }
}

const allExpectedIds = new Set(expectedRecords.map((record) => record.recordId));
const allSeenIds = new Set();
for (const item of recommendations) {
  if (allSeenIds.has(item.recordId)) failures.push(`${item.studyId ?? item.recordId}: duplicate recordId across merged recommendations.`);
  allSeenIds.add(item.recordId);
}
for (const id of allExpectedIds) {
  if (!allSeenIds.has(id)) failures.push(`${id}: missing recommendation from merged output.`);
}

const counts = {};
for (const item of recommendations) counts[item.decision] = (counts[item.decision] || 0) + 1;
const systematicIds = recommendations
  .filter((item) => item.targetTag === 'systematic_review')
  .map((item) => item.studyId)
  .filter(Boolean);

console.log(`merged\t${recommendations.length}\t${JSON.stringify(counts)}\tsystematic=${systematicIds.length}`);
if (systematicIds.length > 0) console.log(`systematicIds\t${systematicIds.join(',')}`);

if (failures.length > 0) {
  throw new Error(`Invalid merged recommendations:\n${failures.slice(0, 80).join('\n')}`);
}

writeFileSync(path.resolve(String(outputPath)), `${JSON.stringify({
  batchLabel: 'Second search - Ishanka - 2026-05-26',
  generatedAt: new Date().toISOString(),
  recommendations,
}, null, 2)}\n`);
console.log(`Wrote ${recommendations.length} recommendation(s) to ${outputPath}.`);
