import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAnalysisPaperRoleLabel,
  parseAnalysisSourceTreatment,
  partitionAnalysisExportPapers,
  selectAnalysisPopulationGroups,
} from '../src/lib/analysis-source-policy.ts';

const paper = (
  id: string,
  analysisRole: 'standalone' | 'anchor' | 'supplement',
  includeInAnalysisExport: boolean,
) => ({
  id,
  analysisRole,
  includeInAnalysisExport,
});

test('analysis export retains standalone and anchor papers but excludes supplements', () => {
  const result = partitionAnalysisExportPapers([
    paper('standalone', 'standalone', true),
    paper('anchor', 'anchor', true),
    paper('supplement', 'supplement', false),
  ]);

  assert.deepEqual(result.included.map((entry) => entry.id), ['standalone', 'anchor']);
  assert.deepEqual(result.excluded.map((entry) => entry.id), ['supplement']);
});

test('source export retains every requested paper', () => {
  const papers = [
    paper('anchor', 'anchor', true),
    paper('supplement', 'supplement', false),
  ];

  const result = partitionAnalysisExportPapers(papers, 'source');

  assert.deepEqual(result.included.map((entry) => entry.id), ['anchor', 'supplement']);
  assert.deepEqual(result.excluded, []);
});

test('analysis export omits only population positions registered as overlaps', () => {
  const groups = [
    { id: 'group-1', position: 0, label: 'Row 1' },
    { id: 'group-2', position: 1, label: 'Row 2' },
    { id: 'group-3', position: 2, label: 'Row 3' },
  ];
  const values = [
    { populationGroupId: 'group-1', fieldId: 'matchExposure', value: '100' },
    { populationGroupId: 'group-2', fieldId: 'matchExposure', value: '200' },
    { populationGroupId: 'group-3', fieldId: 'matchExposure', value: '300' },
  ];
  const treatment = {
    requireCompletePopulationMap: true,
    populationExclusions: [{
      populationPosition: 1,
      expectedLabel: 'Row 2',
      anchorStudyId: 'S002',
      tournamentKey: 'Tournament 2',
      notes: 'Counted elsewhere.',
    }],
    populationTreatments: [
      { populationPosition: 0, expectedLabel: 'Row 1', tournamentKey: 'Tournament 1', includeInAnalysisExport: true, expectedValues: { matchExposure: '100' } },
      { populationPosition: 1, expectedLabel: 'Row 2', tournamentKey: 'Tournament 2', includeInAnalysisExport: false, expectedValues: { matchExposure: '200' } },
      { populationPosition: 2, expectedLabel: 'Row 3', tournamentKey: 'Tournament 3', includeInAnalysisExport: true, expectedValues: { matchExposure: '300' } },
    ],
  };

  assert.deepEqual(
    selectAnalysisPopulationGroups(groups, values, treatment).map((group) => group.id),
    ['group-1', 'group-3'],
  );
  assert.deepEqual(
    selectAnalysisPopulationGroups(groups, values, treatment, 'source').map((group) => group.id),
    ['group-1', 'group-2', 'group-3'],
  );
});

test('analysis export fails closed when a row identity value has changed', () => {
  assert.throws(
    () => selectAnalysisPopulationGroups(
      [{ id: 'group-1', position: 0, label: 'Row 1' }],
      [{ populationGroupId: 'group-1', fieldId: 'matchExposure', value: '999' }],
      {
        requireCompletePopulationMap: true,
        populationExclusions: [],
        populationTreatments: [{
          populationPosition: 0,
          expectedLabel: 'Row 1',
          tournamentKey: 'Tournament 1',
          includeInAnalysisExport: true,
          expectedValues: { matchExposure: '100' },
        }],
      },
    ),
    /matchExposure=100/,
  );
});

test('role labels explain how records are treated', () => {
  assert.equal(getAnalysisPaperRoleLabel('anchor'), 'Tournament anchor');
  assert.equal(getAnalysisPaperRoleLabel('supplement'), 'Supplementary source');
});

test('metadata parser defaults unlabelled papers to standalone analysis records', () => {
  assert.deepEqual(parseAnalysisSourceTreatment({ unrelated: true }), {
    version: '',
    role: 'standalone',
    includeInAnalysisExport: true,
    sourceLinks: [],
    populationExclusions: [],
    requireCompletePopulationMap: false,
    populationTreatments: [],
  });
});

test('metadata parser retains validated source links and population exclusions', () => {
  const treatment = parseAnalysisSourceTreatment({
    analysisSourceTreatment: {
      version: '2026-07-27',
      role: 'cross_tournament_supplement',
      includeInAnalysisExport: false,
      sourceLinks: [{
        anchorStudyId: 'S277',
        relationship: 'pooled_across',
        tournamentKey: 'FIFA World Cup 2002',
        notes: 'No independent denominator.',
      }],
      populationExclusions: [{
        populationPosition: 1,
        expectedLabel: 'Row 2',
        anchorStudyId: 'S277',
        tournamentKey: 'FIFA World Cup 2002',
        notes: 'Counted in S277.',
      }],
      requireCompletePopulationMap: true,
      populationTreatments: [{
        populationPosition: 1,
        expectedLabel: 'Row 2',
        tournamentKey: 'FIFA World Cup 2002',
        includeInAnalysisExport: false,
        expectedValues: { matchExposure: '2046' },
      }],
    },
  });

  assert.equal(treatment.role, 'cross_tournament_supplement');
  assert.equal(treatment.includeInAnalysisExport, false);
  assert.equal(treatment.sourceLinks[0]?.anchorStudyId, 'S277');
  assert.equal(treatment.populationExclusions[0]?.populationPosition, 1);
  assert.equal(treatment.populationTreatments[0]?.expectedValues.matchExposure, '2046');
});
