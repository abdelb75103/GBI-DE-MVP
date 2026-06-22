import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const mentalHealthHelperSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/lib/screening/mental-health.ts'),
  'utf8',
);

const screeningDbSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/lib/db/screening.ts'),
  'utf8',
);

test('mental-health helper recognizes direct psychological outcome signals and persists a metadata tag', () => {
  assert.match(mentalHealthHelperSource, /MENTAL_HEALTH_TAG = 'mental_health'/);
  const regexSource = mentalHealthHelperSource.match(/const MENTAL_HEALTH_SIGNAL_PATTERN =\s*\/(.+)\/i;/s)?.[1];
  assert.ok(regexSource, 'expected mental-health regex source');
  const mentalHealthPattern = new RegExp(regexSource, 'i');
  assert.equal(mentalHealthPattern.test('psychological variables during preseason screening'), false);
  assert.equal(mentalHealthPattern.test('Symptoms of common mental disorders in professional footballers'), true);
  assert.equal(mentalHealthPattern.test('validated psychological distress outcomes in football players'), true);
  assert.match(mentalHealthHelperSource, /tags,\s*\n\s*}/);
});

test('full-text promotion stamps mental-health papers into extraction metadata and status', () => {
  assert.match(screeningDbSource, /status: shouldTagMentalHealth \? 'mental_health' : 'uploaded'/);
  assert.match(screeningDbSource, /const nextStatus = shouldTagMentalHealth \? MENTAL_HEALTH_TAG : existingPaper\.status/);
  assert.match(screeningDbSource, /metadata: screeningMetadata/);
});
