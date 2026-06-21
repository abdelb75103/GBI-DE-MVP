import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const criteriaSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/lib/screening/criteria.ts'),
  'utf8',
);

test('full-text AI criteria keep prospectively collected surveillance eligible when administered through registry or insurance reporting', () => {
  assert.match(
    criteriaSource,
    /do not exclude solely because .*registry.*insurance.*reporting/i,
  );
  assert.match(
    criteriaSource,
    /prospectively collected current-participant surveillance/i,
  );
  assert.match(
    criteriaSource,
    /team medical staff|clubs?|physicians?/i,
  );
});

test('full-text AI criteria keep direct quantitative football mental-health outcome studies eligible', () => {
  assert.match(
    criteriaSource,
    /mental-health|psychological-health/i,
  );
  assert.match(
    criteriaSource,
    /cross-sectional.*eligible|eligible.*cross-sectional/i,
  );
  assert.match(
    criteriaSource,
    /prevalence|validated symptom scale|counts|rates|participant-health outcome/i,
  );
});

test('full-text AI criteria treat season-long club medical records without exposure as a denominator failure, not a retrospective shortcut', () => {
  assert.match(
    criteriaSource,
    /season-long club|team medical|dental|biomarker|monitoring records/i,
  );
  assert.match(
    criteriaSource,
    /counts, percentages, correlations, or associations/i,
  );
  assert.match(
    criteriaSource,
    /no usable denominator rather than .*retrospective\/cross-sectional/i,
  );
});
