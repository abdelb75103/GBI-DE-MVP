import assert from 'node:assert/strict';
import test from 'node:test';

import { createPopulationSignature, derivePopulationGroups } from '../src/lib/extraction/populations.ts';

test('population values preserve meaningful punctuation', () => {
  const groups = derivePopulationGroups([
    { fieldId: 'meanAge', value: '18-31' },
    { fieldId: 'injuryDefinition', value: 'time-loss' },
    { fieldId: 'injuryIncidenceOverall', value: '0.12 (95% CI 0.09-0.14)' },
    { fieldId: 'observationDuration', value: 'control period: 2016/17-2017/18 seasons' },
  ]);

  assert.deepEqual(groups, [{
    label: 'Row 1',
    position: 0,
    values: {
      meanAge: '18-31',
      injuryDefinition: 'time-loss',
      injuryIncidenceOverall: '0.12 (95% CI 0.09-0.14)',
      observationDuration: 'control period: 2016/17-2017/18 seasons',
    },
  }]);
});

test('population signatures include source-specific labels', () => {
  const groups = derivePopulationGroups([
    { fieldId: 'sex', value: 'male\nfemale' },
  ]);
  groups[0].label = 'Male';
  groups[1].label = 'Female';

  const signature = createPopulationSignature(groups);

  assert.match(signature, /"label":"Male"/);
  assert.match(signature, /"label":"Female"/);
});
