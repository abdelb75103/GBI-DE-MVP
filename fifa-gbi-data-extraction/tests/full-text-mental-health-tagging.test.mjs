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
  assert.match(mentalHealthHelperSource, /mental health|psychological|depress|anx|burnout|eating disorder/i);
  assert.match(mentalHealthHelperSource, /tags,\s*\n\s*}/);
});

test('full-text promotion stamps mental-health papers into extraction metadata and status', () => {
  assert.match(screeningDbSource, /status: shouldTagMentalHealth \? 'mental_health' : 'uploaded'/);
  assert.match(screeningDbSource, /const nextStatus = shouldTagMentalHealth \? MENTAL_HEALTH_TAG : existingPaper\.status/);
  assert.match(screeningDbSource, /metadata: screeningMetadata/);
});
