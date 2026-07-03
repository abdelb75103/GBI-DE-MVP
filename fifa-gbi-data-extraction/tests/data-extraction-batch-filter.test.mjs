import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterDataExtractionPapers,
  getDataExtractionBatchFilter,
  isSecondSearchPaper,
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
