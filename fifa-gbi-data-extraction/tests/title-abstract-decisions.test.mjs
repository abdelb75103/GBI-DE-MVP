import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTitleAbstractResolution,
  getTitleAbstractWorkStatus,
} from '../src/lib/screening/title-abstract-decisions.ts';

const recordWithDecisions = (decisions) => ({
  metadata: {
    titleAbstractDecisions: decisions,
  },
});

const reviewerVote = (reviewerProfileId, decision) => ({
  reviewerProfileId,
  decision,
  decidedAt: '2026-05-29T00:00:00.000Z',
  action: 'reviewer_vote',
});

test('flagged title/abstract records resolve as flagged, not conflict', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'flag'),
  ]);

  assert.equal(getTitleAbstractResolution(record), 'flagged');
  assert.equal(getTitleAbstractWorkStatus(record, 'reviewer-2'), 'flagged');
});

test('only opposing include and exclude votes resolve as conflict', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
    reviewerVote('reviewer-2', 'exclude'),
  ]);

  assert.equal(getTitleAbstractResolution(record), 'needs_resolver');
});
