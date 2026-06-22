import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const criteriaSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/lib/screening/criteria.ts'),
  'utf8',
);

const aiReviewSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/lib/screening/ai-review.ts'),
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

test('full-text AI criteria keep direct football mental-health handling papers out of the denominator gate', () => {
  assert.match(
    criteriaSource,
    /coping\/help-seeking|repeated well-being|interview-based|service-use focused/i,
  );
  assert.match(
    criteriaSource,
    /responding football cohort|repeated questionnaire frame|interview sample/i,
  );
  assert.match(
    criteriaSource,
    /do not exclude these direct mental-health papers merely for lacking exposure hours/i,
  );
  assert.match(
    criteriaSource,
    /perfectionism|talent-pathway|broad wellness\/load-monitoring/i,
  );
  assert.match(
    aiReviewSource,
    /do not require exposure hours or athlete-exposures/i,
  );
});

test('full-text AI criteria keep separable football subgroup mental-health comparisons eligible', () => {
  assert.match(
    criteriaSource,
    /footballers compared with non-football or non-athlete controls remain eligible/i,
  );
  assert.match(
    criteriaSource,
    /football subgroup is clearly separable/i,
  );
  assert.match(
    criteriaSource,
    /validated symptom or psychological scale results/i,
  );
});

test('full-text AI criteria treat season-long club medical records without exposure as a denominator failure, not a retrospective shortcut', () => {
  assert.match(
    criteriaSource,
    /season-long club|team medical|dental|biomarker|monitoring records/i,
  );
  assert.match(
    criteriaSource,
    /player counts|injury counts|sample counts|percentages|correlations|associations/i,
  );
  assert.match(
    criteriaSource,
    /exclude it for no usable denominator rather than .*retrospective\/cross-sectional/i,
  );
  assert.match(
    criteriaSource,
    /season labels|selected analytic subsets/i,
  );
});

test('full-text AI criteria do not let cited review language turn a primary study into a review', () => {
  assert.match(
    criteriaSource,
    /cited reviews?, meta-analyses?, or review language/i,
  );
  assert.match(
    criteriaSource,
    /do not make the current paper a review/i,
  );
  assert.match(
    criteriaSource,
    /title, abstract, and methods/i,
  );
});
