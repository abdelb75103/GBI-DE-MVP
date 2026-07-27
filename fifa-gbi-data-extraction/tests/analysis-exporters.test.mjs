import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, {
  alias: {
    '@': new URL('../src', import.meta.url).pathname,
  },
});
const { buildCsvExport, buildJsonExport } = await jiti.import('../src/lib/exporters.ts');
const { mockDb } = await jiti.import('../src/lib/mock-db.ts');

const paper = {
  id: 'paper-ledger',
  assignedStudyId: 'S-LEDGER',
  title: 'Three tournament ledger',
  status: 'extracted',
  analysisRole: 'multi_tournament_ledger',
  includeInAnalysisExport: true,
  primaryFileId: null,
  metadata: {
    analysisSourceTreatment: {
      version: 'test',
      role: 'multi_tournament_ledger',
      includeInAnalysisExport: true,
      sourceLinks: [],
      populationExclusions: [{
        populationPosition: 1,
        expectedLabel: 'Row 2',
        anchorStudyId: 'S-ANCHOR',
        tournamentKey: 'Tournament 2',
        notes: 'Counted in the stronger anchor.',
      }],
      requireCompletePopulationMap: true,
      populationTreatments: [
        { populationPosition: 0, expectedLabel: 'Row 1', tournamentKey: 'Tournament 1', includeInAnalysisExport: true, expectedValues: { matchExposure: '100' } },
        { populationPosition: 1, expectedLabel: 'Row 2', tournamentKey: 'Tournament 2', includeInAnalysisExport: false, expectedValues: { matchExposure: '200' } },
        { populationPosition: 2, expectedLabel: 'Row 3', tournamentKey: 'Tournament 3', includeInAnalysisExport: true, expectedValues: { matchExposure: '300' } },
      ],
    },
  },
};

const groups = [
  { id: 'group-1', paperId: paper.id, tab: 'exposure', label: 'Row 1', position: 0 },
  { id: 'group-2', paperId: paper.id, tab: 'exposure', label: 'Row 2', position: 1 },
  { id: 'group-3', paperId: paper.id, tab: 'exposure', label: 'Row 3', position: 2 },
];

const values = groups.map((group, index) => ({
  id: `value-${index}`,
  populationGroupId: group.id,
  paperId: paper.id,
  fieldId: 'matchExposure',
  value: String((index + 1) * 100),
  metric: 'n',
  unit: 'player-hours',
  sourceFieldId: 'matchExposure',
}));

const extractions = [{
  id: 'extraction-1',
  paperId: paper.id,
  tab: 'exposure',
  model: 'manual',
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
  fields: [{
    fieldId: 'matchExposure',
    value: '100\n200\n300',
    confidence: 1,
    status: 'reported',
    updatedAt: '2026-07-27T00:00:00.000Z',
    updatedBy: null,
  }],
}];

mockDb.getPaper = async (paperId) => paperId === paper.id ? paper : undefined;
mockDb.getFile = async () => undefined;
mockDb.listNotes = async () => [];
mockDb.listExtractions = async () => extractions;
mockDb.listPopulationGroups = async () => groups;
mockDb.listPopulationValues = async () => values;

test('analysis CSV identifies tournament rows and excludes the overlapping denominator', async () => {
  const csv = await buildCsvExport([paper.id]);

  assert.match(csv, /"Population Position","Population Label","Tournament \/ Series"/);
  assert.match(csv, /"Tournament 1"/);
  assert.match(csv, /"Tournament 3"/);
  assert.doesNotMatch(csv, /"Tournament 2"/);
});

test('analysis JSON exposes only denominator-ready populations and no raw excluded lines', async () => {
  const payload = await buildJsonExport([paper.id]);
  const record = payload.papers[0];

  assert.deepEqual(record.populations.map((group) => group.tournamentKey), [
    'Tournament 1',
    'Tournament 3',
  ]);
  assert.equal(record.rawExtractionsOmittedForOverlap, true);
  assert.deepEqual(record.extractions, []);
});

test('source JSON retains every row and the raw source extraction', async () => {
  const payload = await buildJsonExport([paper.id], { scope: 'source' });
  const record = payload.papers[0];

  assert.deepEqual(record.populations.map((group) => group.tournamentKey), [
    'Tournament 1',
    'Tournament 2',
    'Tournament 3',
  ]);
  assert.equal(record.rawExtractionsOmittedForOverlap, false);
  assert.equal(record.extractions.length, 1);
});
