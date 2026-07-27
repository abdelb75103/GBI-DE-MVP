import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterDataExtractionPapers,
  getDataExtractionBatchFilter,
  getDataExtractionBatchHref,
  isSecondSearchPaper,
  mapDataExtractionPaperRow,
} from '../src/lib/data-extraction-batch-filter.ts';

const papers = [
  { id: 'first-empty', metadata: {} },
  { id: 'first-original', metadata: { searchBatch: 'original' } },
  { id: 'second-batch', metadata: { searchBatch: 'second' } },
  { id: 'second-label', metadata: { searchBatchLabel: 'Second search - Ishanka - 2026-05-26' } },
];

test('detects second-search papers from batch or label metadata', () => {
  assert.equal(isSecondSearchPaper(papers[0]), false);
  assert.equal(isSecondSearchPaper(papers[2]), true);
  assert.equal(isSecondSearchPaper(papers[3]), true);
});

test('filters data-extraction papers by total, first, and second batches', () => {
  assert.deepEqual(filterDataExtractionPapers(papers, 'total').map((paper) => paper.id), [
    'first-empty',
    'first-original',
    'second-batch',
    'second-label',
  ]);
  assert.deepEqual(filterDataExtractionPapers(papers, 'first').map((paper) => paper.id), [
    'first-empty',
    'first-original',
  ]);
  assert.deepEqual(filterDataExtractionPapers(papers, 'second').map((paper) => paper.id), [
    'second-batch',
    'second-label',
  ]);
});

test('normalizes unknown data-extraction batch filters to total', () => {
  assert.equal(getDataExtractionBatchFilter('first'), 'first');
  assert.equal(getDataExtractionBatchFilter(['second']), 'second');
  assert.equal(getDataExtractionBatchFilter('bad'), 'total');
});

test('maps a projected second-search row to the compact dashboard shape', () => {
  const row = {
    id: 'paper-1',
    assigned_study_id: 'GBI-001',
    title: 'Injury surveillance',
    status: 'extracted',
    lead_author: 'Smith',
    journal: 'Sports Medicine',
    year: '2025',
    doi: '10.1234/example',
    flag_reason: null,
    analysis_source_treatment: {
      role: 'anchor',
      includeInAnalysisExport: true,
    },
    assigned_to: 'profile-1',
    search_batch: 'second',
    search_batch_label: 'Second search - Ishanka - 2026-05-26',
    paper_notes: [],
    metadata: { unrelated: 'must not leak' },
  };

  assert.deepEqual(mapDataExtractionPaperRow(row, new Map([['profile-1', 'Abdel']])), {
    id: 'paper-1',
    assignedStudyId: 'GBI-001',
    title: 'Injury surveillance',
    status: 'extracted',
    leadAuthor: 'Smith',
    journal: 'Sports Medicine',
    year: '2025',
    doi: '10.1234/example',
    flagReason: null,
    analysisRole: 'anchor',
    includeInAnalysisExport: true,
    noteCount: 0,
    assignedTo: 'profile-1',
    assigneeName: 'Abdel',
    metadata: {
      searchBatch: 'second',
      searchBatchLabel: 'Second search - Ishanka - 2026-05-26',
    },
  });
});

test('keeps null projected search fields in the first-search batch', () => {
  const paper = mapDataExtractionPaperRow({
    id: 'paper-2',
    assigned_study_id: 'GBI-002',
    title: 'Original search paper',
    status: 'uploaded',
    lead_author: null,
    journal: null,
    year: null,
    doi: null,
    flag_reason: null,
    analysis_source_treatment: null,
    assigned_to: 'missing-profile',
    search_batch: null,
    search_batch_label: null,
    paper_notes: [{ count: 2 }],
  }, new Map());

  assert.equal(isSecondSearchPaper(paper), false);
  assert.equal(paper.noteCount, 2);
  assert.equal('metadata' in paper, false);
  assert.equal('assigneeName' in paper, false);
});

test('builds batch links without dropping unrelated query parameters', () => {
  const params = new URLSearchParams('view=mine&batch=second');

  assert.equal(getDataExtractionBatchHref('total', params), '/data-extraction?view=mine');
  assert.equal(getDataExtractionBatchHref('first', params), '/data-extraction?view=mine&batch=first');
  assert.equal(getDataExtractionBatchHref('second', params), '/data-extraction?view=mine&batch=second');
  assert.equal(getDataExtractionBatchHref('total', new URLSearchParams()), '/data-extraction');
});
