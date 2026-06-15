import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDefaultTitleAbstractDecisionAction,
  getTitleAbstractResolution,
  getTitleAbstractWorkStatus,
} from '../src/lib/screening/title-abstract-decisions.ts';

const recordWithDecisions = (decisions, overrides = {}) => ({
  aiStatus: 'not_run',
  aiSuggestedDecision: null,
  ...overrides,
  metadata: {
    ...(overrides.metadata ?? {}),
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

test('matching AI and human include resolves as ready for full text', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: 'include',
  });

  assert.equal(getTitleAbstractResolution(record), 'ready_for_full_text');
  assert.equal(getTitleAbstractWorkStatus(record, 'reviewer-2'), 'ready_for_full_text');
});

test('matching AI and human exclude resolves as excluded', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'exclude'),
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: 'exclude',
  });

  assert.equal(getTitleAbstractResolution(record), 'excluded');
});

test('opposing AI and human decisions resolve as conflict', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: 'exclude',
  });

  assert.equal(getTitleAbstractResolution(record), 'needs_resolver');
});

test('human vote without decisive AI stays pending awaiting AI', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: null,
  });

  assert.equal(getTitleAbstractResolution(record), 'pending');
  assert.equal(getTitleAbstractWorkStatus(record, 'reviewer-1'), 'awaiting_ai_recommendation');
});

test('resolver decision still overrides AI and human conflict', () => {
  const resolverDecision = {
    reviewerProfileId: 'resolver-1',
    decision: 'include',
    decidedAt: '2026-05-29T00:01:00.000Z',
    action: 'resolver_decision',
  };
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
    resolverDecision,
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: 'exclude',
  });

  assert.equal(getTitleAbstractResolution(record), 'ready_for_full_text');
});

test('a third reviewer defaults to resolver mode for an AI-human conflict', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: 'exclude',
  });

  assert.equal(getDefaultTitleAbstractDecisionAction(record, 'reviewer-2'), 'resolver_decision');
});

test('the original human reviewer defaults to their own vote for a conflict', () => {
  const record = recordWithDecisions([
    reviewerVote('reviewer-1', 'include'),
  ], {
    aiStatus: 'completed',
    aiSuggestedDecision: 'exclude',
  });

  assert.equal(getDefaultTitleAbstractDecisionAction(record, 'reviewer-1'), 'reviewer_vote');
});

test('a reviewer defaults to their own vote outside conflict resolution', () => {
  const record = recordWithDecisions([]);

  assert.equal(getDefaultTitleAbstractDecisionAction(record, 'reviewer-2'), 'reviewer_vote');
});
