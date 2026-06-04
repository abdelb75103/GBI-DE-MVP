import assert from 'node:assert/strict';
import test from 'node:test';

import { adjustTitleAbstractQueueCountsAfterDecision } from '../src/lib/screening/title-abstract-decisions.ts';

const baseCounts = {
  all: 10,
  myVotes: 0,
  needsYourVote: 10,
  awaitingOther: 0,
  resolver: 0,
  ready: 0,
  excluded: 0,
  promoted: 0,
  missingAbstract: 0,
  flagged: 0,
  aiInclude: 0,
  aiExclude: 0,
  aiSystematicReview: 0,
  aiNotRun: 0,
  reservedOffline: 0,
};

const recordWithDecisions = (decisions, metadata = {}) => ({
  id: 'record-1',
  aiStatus: 'not_run',
  aiSuggestedDecision: null,
  metadata: {
    ...metadata,
    titleAbstractDecisions: decisions,
  },
});

const recordWithAi = (decisions, aiSuggestedDecision) => ({
  ...recordWithDecisions(decisions),
  aiStatus: 'completed',
  aiSuggestedDecision,
});

const reviewerVote = (reviewerProfileId, decision) => ({
  reviewerProfileId,
  decision,
  decidedAt: '2026-05-29T00:00:00.000Z',
  action: 'reviewer_vote',
});

test('moves the current reviewer from needs vote to awaiting AI after first vote without AI', () => {
  const before = recordWithDecisions([]);
  const after = recordWithDecisions([reviewerVote('reviewer-1', 'include')]);

  const counts = adjustTitleAbstractQueueCountsAfterDecision(baseCounts, before, after, 'reviewer-1');

  assert.equal(counts.myVotes, 1);
  assert.equal(counts.needsYourVote, 9);
  assert.equal(counts.awaitingOther, 1);
});

test('moves matching AI and human include into ready counts', () => {
  const before = recordWithAi([], 'include');
  const after = recordWithAi([reviewerVote('reviewer-1', 'include')], 'include');

  const counts = adjustTitleAbstractQueueCountsAfterDecision(baseCounts, before, after, 'reviewer-1');

  assert.equal(counts.myVotes, 1);
  assert.equal(counts.needsYourVote, 9);
  assert.equal(counts.ready, 1);
  assert.equal(counts.awaitingOther, 0);
});

test('moves opposing AI and human decisions into conflict counts', () => {
  const before = recordWithAi([], 'exclude');
  const after = recordWithAi([reviewerVote('reviewer-1', 'include')], 'exclude');

  const counts = adjustTitleAbstractQueueCountsAfterDecision(baseCounts, before, after, 'reviewer-1');

  assert.equal(counts.myVotes, 1);
  assert.equal(counts.needsYourVote, 9);
  assert.equal(counts.resolver, 1);
});

test('moves flagged votes into flagged counts instead of conflicts', () => {
  const before = recordWithDecisions([]);
  const after = recordWithDecisions([reviewerVote('reviewer-1', 'flag')]);

  const counts = adjustTitleAbstractQueueCountsAfterDecision(baseCounts, before, after, 'reviewer-1');

  assert.equal(counts.flagged, 1);
  assert.equal(counts.resolver, 0);
  assert.equal(counts.needsYourVote, 9);
});
