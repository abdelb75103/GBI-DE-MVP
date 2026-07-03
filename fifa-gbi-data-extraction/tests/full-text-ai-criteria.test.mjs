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

test('full-text AI criteria retain relevant systematic reviews for reference checking only', () => {
  assert.match(
    criteriaSource,
    /retain relevant football-specific systematic reviews/i,
  );
  assert.match(
    criteriaSource,
    /not primary extraction studies/i,
  );
  assert.match(
    criteriaSource,
    /exclude .*reviews limited to prevention exercises, rehabilitation, return-to-play, performance tests, mechanisms, imaging, or proxy outcomes/i,
  );
});

test('full-text AI criteria allow only bounded paper-derivable denominators', () => {
  assert.match(
    criteriaSource,
    /complete at-risk frame/i,
  );
  assert.match(
    criteriaSource,
    /fully specified activity schedule/i,
  );
  assert.match(
    criteriaSource,
    /cohort mean exposure value multiplied by explicit participant count/i,
  );
  assert.match(
    criteriaSource,
    /do not calculate exposure during screening/i,
  );
});

test('full-text AI criteria do not infer athlete-exposures from ambiguous session or row counts', () => {
  assert.match(
    criteriaSource,
    /training sessions, matches, dataset rows, samples, or observations/i,
  );
  assert.match(
    criteriaSource,
    /each count is one athlete participating in one session or match/i,
  );
  assert.match(
    criteriaSource,
    /ambiguous session count, or conflicting row totals is not an athlete-exposure/i,
  );
});

test('full-text AI criteria do not accept player-seasons or cumulative proportions as injury exposure', () => {
  assert.match(
    criteriaSource,
    /player-seasons, athlete headcounts, follow-up seasons, and cumulative injury proportions do not replace exposure hours/i,
  );
  assert.match(
    criteriaSource,
    /precise exposure time was unavailable.*exclude for no usable denominator/is,
  );
});
