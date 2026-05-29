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

const inputPath = args.get('input');
const outputPrefix = args.get('output-prefix');
if (!inputPath || !outputPrefix) {
  throw new Error('Usage: node split_chat_screening_batch.mjs --input exported-batch.json --output-prefix /tmp/title-abstract-waveN-batch --size 75');
}

const size = Math.max(1, Number(args.get('size') || 75));
const payload = JSON.parse(readFileSync(path.resolve(String(inputPath)), 'utf8'));
const records = Array.isArray(payload.records) ? payload.records : [];
const prefix = String(outputPrefix);
const count = Math.ceil(records.length / size);

for (let index = 0; index < count; index += 1) {
  const chunk = records.slice(index * size, (index + 1) * size);
  const outputPath = `${prefix}-${index + 1}.json`;
  writeFileSync(outputPath, `${JSON.stringify({
    batchLabel: payload.searchBatchLabel || payload.batchLabel,
    sourceBatchPath: path.resolve(String(inputPath)),
    batchIndex: index + 1,
    records: chunk,
  }, null, 2)}\n`);
  const missing = chunk.filter((record) => record.abstractMissing || !record.abstract).length;
  console.log(`batch${index + 1}\t${chunk.length}\t${chunk[0]?.studyId ?? ''}\t${chunk.at(-1)?.studyId ?? ''}\tmissing=${missing}\t${outputPath}`);
}

console.log(`Split ${records.length} record(s) into ${count} file(s).`);
