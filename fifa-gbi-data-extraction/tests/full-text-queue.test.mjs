import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FULL_TEXT_QUEUE_PAGE_SIZE,
  buildFullTextQueuePage,
  buildFullTextQueueUrl,
  buildFullTextReaderUrl,
  findAdjacentFullTextQueueRecords,
  findNextFullTextQueueRecord,
  getFullTextFilterLabel,
  parseFullTextQueueContext,
} from '../src/lib/screening/full-text-queue.ts';

const reviewerId = 'reviewer-1';

const makeRecord = (index, overrides = {}) => ({
  id: `record-${index}`,
  stage: 'full_text',
  assignedStudyId: `S${String(index).padStart(3, '0')}`,
  title: `Paper ${index}`,
  abstract: null,
  leadAuthor: `Author ${index}`,
  journal: 'Journal',
  year: '2026',
  doi: `10.1000/${index}`,
  normalizedDoi: `10.1000/${index}`,
  sourceLabel: null,
  sourceRecordId: null,
  storageBucket: 'papers',
  storageObjectPath: `record-${index}.pdf`,
  fileName: `record-${index}.pdf`,
  originalFileName: `record-${index}.pdf`,
  mimeType: 'application/pdf',
  size: 100,
  fileSha256: null,
  aiStatus: 'not_run',
  aiSuggestedDecision: null,
  aiReason: null,
  aiEvidenceQuote: null,
  aiSourceLocation: null,
  aiConfidence: null,
  aiModel: null,
  aiCriteriaVersion: null,
  aiTargetTag: null,
  aiError: null,
  aiReviewedAt: null,
  manualDecision: null,
  manualReason: null,
  manualDecidedBy: null,
  manualDecidedAt: null,
  promotedPaperId: null,
  promotedBy: null,
  promotedAt: null,
  createdBy: null,
  createdAt: new Date(2026, 0, index).toISOString(),
  updatedAt: new Date(2026, 0, index).toISOString(),
  metadata: {},
  notes: null,
  ...overrides,
});

test('normalizes invalid queue URL values and allowlists notices', () => {
  assert.deepEqual(parseFullTextQueueContext({ filter: 'invalid', search: '  Paper  ', page: '-2', notice: 'anything' }), {
    filter: 'all',
    search: 'Paper',
    page: 1,
    notice: null,
  });
  assert.equal(parseFullTextQueueContext({ notice: 'filter_empty' }).notice, 'filter_empty');
});

test('uses fixed filter labels and a 20-record page size', () => {
  assert.equal(FULL_TEXT_QUEUE_PAGE_SIZE, 20);
  assert.equal(getFullTextFilterLabel('needs_your_vote'), 'Needs my vote');
  assert.equal(getFullTextFilterLabel('all'), 'All records');
});

test('serializes queue context and omits an empty search', () => {
  assert.equal(
    buildFullTextQueueUrl({ filter: 'conflict', search: 'hamstring', page: 3, notice: null }),
    '/full-text-screening?filter=conflict&search=hamstring&page=3',
  );
  assert.equal(
    buildFullTextQueueUrl({ filter: 'all', search: '', page: 1, notice: 'filter_empty' }),
    '/full-text-screening?filter=all&page=1&notice=filter_empty',
  );
});

test('serializes reader context and direct-reader context falls back to all page 1', () => {
  assert.equal(
    buildFullTextReaderUrl('record-7', { filter: 'needs_your_vote', search: 'injury', page: 2, notice: null }, 6),
    '/full-text-screening/record-7?filter=needs_your_vote&search=injury&page=2&position=6',
  );
  assert.deepEqual(parseFullTextQueueContext({}), { filter: 'all', search: '', page: 1, notice: null });
});

test('returns fixed server-backed pages with filtered totals and clamped pages', () => {
  const records = Array.from({ length: 45 }, (_, index) => makeRecord(index + 1));

  const page = buildFullTextQueuePage(records, reviewerId, {
    filter: 'all', search: '', page: 99, notice: null,
  });

  assert.equal(page.page, 3);
  assert.equal(page.totalPages, 3);
  assert.equal(page.filteredTotal, 45);
  assert.equal(page.records.length, 5);
  assert.equal(page.rangeStart, 41);
  assert.equal(page.rangeEnd, 45);
});

test('finds previous and next records in the active filtered queue across page boundaries', () => {
  const records = Array.from({ length: 25 }, (_, index) => makeRecord(index + 1));

  const adjacent = findAdjacentFullTextQueueRecords(records, reviewerId, {
    filter: 'all', search: '', page: 2, notice: null,
  }, 'record-21', 0);

  assert.equal(adjacent.previous?.record.id, 'record-20');
  assert.equal(adjacent.previous?.page, 1);
  assert.equal(adjacent.previous?.position, 19);
  assert.equal(adjacent.next?.record.id, 'record-22');
  assert.equal(adjacent.next?.page, 2);
  assert.equal(adjacent.next?.position, 1);
});

test('disables adjacent navigation at filtered queue boundaries', () => {
  const records = [
    makeRecord(1, { title: 'Hamstring one' }),
    makeRecord(2, { title: 'Ankle paper' }),
    makeRecord(3, { title: 'Hamstring two' }),
  ];
  const context = { filter: 'all', search: 'hamstring', page: 1, notice: null };

  const first = findAdjacentFullTextQueueRecords(records, reviewerId, context, 'record-1', 0);
  const last = findAdjacentFullTextQueueRecords(records, reviewerId, context, 'record-3', 1);

  assert.equal(first.previous, null);
  assert.equal(first.next?.record.id, 'record-3');
  assert.equal(last.previous?.record.id, 'record-1');
  assert.equal(last.next, null);
});

test('filters and searches before calculating the paged total', () => {
  const voted = {
    fullTextDecisions: [{ reviewerProfileId: reviewerId, reviewerName: 'Reviewer', decision: 'include', decidedAt: '2026-06-19T00:00:00Z' }],
  };
  const records = [
    makeRecord(1, { title: 'Hamstring cohort' }),
    makeRecord(2, { title: 'Hamstring surveillance', metadata: voted }),
    makeRecord(3, { title: 'Ankle cohort' }),
  ];

  const page = buildFullTextQueuePage(records, reviewerId, {
    filter: 'needs_your_vote', search: ' hamstring ', page: 1, notice: null,
  });

  assert.equal(page.filteredTotal, 1);
  assert.deepEqual(page.records.map((record) => record.id), ['record-1']);
});

test('advances from a completed row position to the next matching record', () => {
  const records = Array.from({ length: 25 }, (_, index) => makeRecord(index + 1));

  const next = findNextFullTextQueueRecord(records, reviewerId, {
    filter: 'all', search: '', page: 1, notice: null,
  }, 'record-20', 19);

  assert.equal(next?.id, 'record-21');
});

test('uses the shifted row at the same position when a completed record leaves the filter', () => {
  const records = Array.from({ length: 22 }, (_, index) => makeRecord(index + 1));
  records[5] = makeRecord(6, {
    metadata: {
      fullTextDecisions: [{ reviewerProfileId: reviewerId, decision: 'include', decidedAt: '2026-06-19T00:00:00Z' }],
    },
  });

  const next = findNextFullTextQueueRecord(records, reviewerId, {
    filter: 'needs_your_vote', search: '', page: 1, notice: null,
  }, 'record-6', 5);

  assert.equal(next?.id, 'record-7');
});

test('wraps to the first remaining match, and returns null only when none remain', () => {
  const records = [makeRecord(1), makeRecord(2)];
  const context = { filter: 'all', search: '', page: 1, notice: null };

  assert.equal(findNextFullTextQueueRecord(records, reviewerId, context, 'record-2', 1)?.id, 'record-1');
  assert.equal(findNextFullTextQueueRecord([makeRecord(1)], reviewerId, context, 'record-1', 0), null);
});
