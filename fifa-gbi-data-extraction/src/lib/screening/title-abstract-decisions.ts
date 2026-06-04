import type { ScreeningRecord } from '@/lib/types';

export type TitleAbstractDecision = 'include' | 'exclude' | 'flag';
export type TitleAbstractDecisionAction = 'reviewer_vote' | 'resolver_decision';
export type TitleAbstractResolution =
  | 'pending'
  | 'flagged'
  | 'ready_for_full_text'
  | 'excluded'
  | 'needs_resolver'
  | 'promoted_to_full_text';
export type TitleAbstractWorkStatus =
  | 'needs_your_vote'
  | 'awaiting_ai_recommendation'
  | 'awaiting_other_reviewer'
  | 'flagged'
  | 'ready_for_full_text'
  | 'excluded'
  | 'needs_resolver'
  | 'promoted_to_full_text';

export type TitleAbstractReviewerDecision = {
  reviewerProfileId: string;
  reviewerName?: string | null;
  decision: TitleAbstractDecision;
  note?: string | null;
  decidedAt: string;
  action?: TitleAbstractDecisionAction;
};

export type TitleAbstractQueueCountsSnapshot = {
  all: number;
  myVotes: number;
  needsYourVote: number;
  awaitingOther: number;
  resolver: number;
  ready: number;
  excluded: number;
  promoted: number;
  missingAbstract: number;
  flagged: number;
  aiInclude: number;
  aiExclude: number;
  aiNotRun: number;
  reservedOffline: number;
};

type TitleAbstractMetadata = {
  titleAbstractDecisions?: TitleAbstractReviewerDecision[];
  titleAbstractResolution?: TitleAbstractResolution;
  titleAbstractPromotedRecordId?: string;
  [key: string]: unknown;
};

const isDecision = (value: unknown): value is TitleAbstractDecision =>
  value === 'include' || value === 'exclude' || value === 'flag';

const isReviewerDecision = (value: unknown): value is TitleAbstractReviewerDecision => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TitleAbstractReviewerDecision>;
  return Boolean(candidate.reviewerProfileId) && isDecision(candidate.decision) && Boolean(candidate.decidedAt);
};

const getDecisiveAiDecision = (record: ScreeningRecord): 'include' | 'exclude' | null =>
  record.aiStatus === 'completed' && (record.aiSuggestedDecision === 'include' || record.aiSuggestedDecision === 'exclude')
    ? record.aiSuggestedDecision
    : null;

export const getTitleAbstractMetadata = (record: ScreeningRecord): TitleAbstractMetadata =>
  record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
    ? record.metadata as TitleAbstractMetadata
    : {};

export const getTitleAbstractDecisions = (record: ScreeningRecord): TitleAbstractReviewerDecision[] => {
  const metadata = getTitleAbstractMetadata(record);
  return Array.isArray(metadata.titleAbstractDecisions)
    ? metadata.titleAbstractDecisions.filter(isReviewerDecision).slice(0, 3)
    : [];
};

export const getTitleAbstractResolution = (record: ScreeningRecord): TitleAbstractResolution => {
  const metadata = getTitleAbstractMetadata(record);
  if (metadata.titleAbstractPromotedRecordId) {
    return 'promoted_to_full_text';
  }

  const decisions = getTitleAbstractDecisions(record);
  const resolverDecision = decisions.find((decision) => decision.action === 'resolver_decision') ?? decisions[2];
  if (resolverDecision?.decision === 'flag') {
    return 'flagged';
  }
  if (resolverDecision) {
    return resolverDecision.decision === 'include' ? 'ready_for_full_text' : 'excluded';
  }

  const reviewerVotes = decisions.filter((decision) => decision.action !== 'resolver_decision');
  if (reviewerVotes.some((decision) => decision.decision === 'flag')) {
    return 'flagged';
  }
  const humanDecision = reviewerVotes.find((decision) => decision.decision === 'include' || decision.decision === 'exclude');
  if (!humanDecision) {
    return 'pending';
  }
  const aiDecision = getDecisiveAiDecision(record);
  if (!aiDecision) {
    return 'pending';
  }
  if (humanDecision.decision === aiDecision) {
    return aiDecision === 'include' ? 'ready_for_full_text' : 'excluded';
  }
  return 'needs_resolver';
};

export const hasTitleAbstractReviewerVoted = (record: ScreeningRecord, reviewerProfileId: string) =>
  getTitleAbstractDecisions(record)
    .filter((decision) => decision.action !== 'resolver_decision')
    .some((decision) => decision.reviewerProfileId === reviewerProfileId);

export const getTitleAbstractWorkStatus = (
  record: ScreeningRecord,
  reviewerProfileId: string,
): TitleAbstractWorkStatus => {
  const resolution = getTitleAbstractResolution(record);
  if (resolution !== 'pending') return resolution;
  return hasTitleAbstractReviewerVoted(record, reviewerProfileId) ? 'awaiting_ai_recommendation' : 'needs_your_vote';
};

const TITLE_ABSTRACT_STATUS_COUNT_KEYS: Record<TitleAbstractWorkStatus, keyof TitleAbstractQueueCountsSnapshot> = {
  needs_your_vote: 'needsYourVote',
  awaiting_ai_recommendation: 'awaitingOther',
  awaiting_other_reviewer: 'awaitingOther',
  flagged: 'flagged',
  ready_for_full_text: 'ready',
  excluded: 'excluded',
  needs_resolver: 'resolver',
  promoted_to_full_text: 'promoted',
};

const clampTitleAbstractCount = (value: number) => Math.max(0, value);

const hasFlaggedTitleAbstractVote = (record: ScreeningRecord) =>
  getTitleAbstractDecisions(record).some((decision) => decision.decision === 'flag');

export const adjustTitleAbstractQueueCountsAfterDecision = <TCounts extends TitleAbstractQueueCountsSnapshot>(
  counts: TCounts,
  beforeRecord: ScreeningRecord,
  afterRecord: ScreeningRecord,
  reviewerProfileId: string,
): TCounts => {
  const next = { ...counts };
  const beforeStatus = getTitleAbstractWorkStatus(beforeRecord, reviewerProfileId);
  const afterStatus = getTitleAbstractWorkStatus(afterRecord, reviewerProfileId);

  if (beforeStatus !== afterStatus) {
    const beforeKey = TITLE_ABSTRACT_STATUS_COUNT_KEYS[beforeStatus];
    const afterKey = TITLE_ABSTRACT_STATUS_COUNT_KEYS[afterStatus];
    next[beforeKey] = clampTitleAbstractCount(next[beforeKey] - 1) as TCounts[typeof beforeKey];
    next[afterKey] = clampTitleAbstractCount(next[afterKey] + 1) as TCounts[typeof afterKey];
  }

  const beforeMyVote = hasTitleAbstractReviewerVoted(beforeRecord, reviewerProfileId);
  const afterMyVote = hasTitleAbstractReviewerVoted(afterRecord, reviewerProfileId);
  if (beforeMyVote !== afterMyVote) {
    next.myVotes = clampTitleAbstractCount(next.myVotes + (afterMyVote ? 1 : -1)) as TCounts['myVotes'];
  }

  const beforeFlagged = hasFlaggedTitleAbstractVote(beforeRecord);
  const afterFlagged = hasFlaggedTitleAbstractVote(afterRecord);
  if (beforeFlagged !== afterFlagged && beforeStatus !== 'flagged' && afterStatus !== 'flagged') {
    next.flagged = clampTitleAbstractCount(next.flagged + (afterFlagged ? 1 : -1)) as TCounts['flagged'];
  }

  return next;
};

export const applyTitleAbstractDecision = (
  record: ScreeningRecord,
  input: {
    reviewerProfileId: string;
    reviewerName?: string | null;
    decision: TitleAbstractDecision;
    action?: TitleAbstractDecisionAction;
    note?: string | null;
  },
) => {
  const now = new Date().toISOString();
  const action = input.action ?? 'reviewer_vote';
  const existing = getTitleAbstractDecisions(record);
  const nextDecision: TitleAbstractReviewerDecision = {
    reviewerProfileId: input.reviewerProfileId,
    reviewerName: input.reviewerName ?? null,
    decision: input.decision,
    note: input.note?.trim() || null,
    decidedAt: now,
    action,
  };

  let decisions: TitleAbstractReviewerDecision[];
  if (action === 'resolver_decision') {
    decisions = existing.filter((decision) => decision.action !== 'resolver_decision').slice(0, 2);
    decisions.push(nextDecision);
  } else {
    const reviewerVotes = existing.filter((decision) => decision.action !== 'resolver_decision').slice(0, 2);
    const existingIndex = reviewerVotes.findIndex(
      (decision) => decision.action !== 'resolver_decision' && decision.reviewerProfileId === input.reviewerProfileId,
    );
    if (existingIndex >= 0) {
      decisions = reviewerVotes.map((decision, index) => (index === existingIndex ? nextDecision : decision));
    } else if (reviewerVotes.length < 1) {
      decisions = [...reviewerVotes, nextDecision];
    } else {
      throw new Error('This record already has a human reviewer vote. Use resolver mode for flagged or conflicting records.');
    }
  }

  const shadowRecord: ScreeningRecord = {
    ...record,
    metadata: {
      ...getTitleAbstractMetadata(record),
      titleAbstractDecisions: decisions,
    },
  };
  const resolution = getTitleAbstractResolution(shadowRecord);
  return {
    decisions,
    resolution,
    updatedAt: now,
  };
};
