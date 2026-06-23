import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const criteriaSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/lib/screening/criteria.ts'),
  'utf8',
);

const liveExtractionSkillSource = readFileSync(
  path.resolve(import.meta.dirname, '../../skills/gbi-live-extraction/SKILL.md'),
  'utf8',
);

test('full-text AI criteria exclude direct football injury case cohorts without usable denominator at full-text screening', () => {
  assert.match(
    criteriaSource,
    /case-only|injury-specific|illness-specific/i,
  );
  assert.match(
    criteriaSource,
    /usable at-risk denominator/i,
  );
  assert.match(
    criteriaSource,
    /do not keep them in stream for later no_exposure handling/i,
  );
});

test('gbi live extraction skill excludes specific injury cohorts without denominator instead of moving them to later no-exposure handling', () => {
  assert.match(
    liveExtractionSkillSource,
    /full-text screening/i,
  );
  assert.match(
    liveExtractionSkillSource,
    /specific injury|specific illness|case-only/i,
  );
  assert.match(
    liveExtractionSkillSource,
    /exclude .* no usable denominator|denominator failure/i,
  );
  assert.match(
    liveExtractionSkillSource,
    /do not keep .*screening stream.*no usable denominator|exclude it at full text for no usable denominator/i,
  );
});
