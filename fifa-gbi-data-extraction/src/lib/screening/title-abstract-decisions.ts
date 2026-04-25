import type { ScreeningRecord } from '@/lib/types';

export type TitleAbstractDecision = 'include' | 'exclude' | 'flag';
export type TitleAbstractDecisionAction = 'reviewer_vote' | 'resolver_decision';
export type TitleAbstractResolution =
  | 'pending'
  | 'ready_for_full_text'
  | 'excluded'
  | 'needs_resolver'
  | 'promoted_to_full_text';
export type TitleAbstractWorkStatus =
  | 'needs_your_vote'
  | 'awaiting_other_reviewer'
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
  if (resolverDecision && resolverDecision.decision !== 'flag') {
    return resolverDecision.decision === 'include' ? 'ready_for_full_text' : 'excluded';
  }

  const reviewerVotes = decisions.filter((decision) => decision.action !== 'resolver_decision').slice(0, 2);
  if (reviewerVotes.some((decision) => decision.decision === 'flag')) {
    return 'needs_resolver';
  }
  if (reviewerVotes.length < 2) {
    return 'pending';
  }
  const includes = reviewerVotes.filter((decision) => decision.decision === 'include').length;
  const excludes = reviewerVotes.filter((decision) => decision.decision === 'exclude').length;
  if (includes === 2) return 'ready_for_full_text';
  if (excludes === 2) return 'excluded';
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
  return hasTitleAbstractReviewerVoted(record, reviewerProfileId) ? 'awaiting_other_reviewer' : 'needs_your_vote';
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
    const existingIndex = existing.findIndex(
      (decision) => decision.action !== 'resolver_decision' && decision.reviewerProfileId === input.reviewerProfileId,
    );
    const reviewerVotes = existing.filter((decision) => decision.action !== 'resolver_decision').slice(0, 2);
    if (existingIndex >= 0) {
      decisions = existing.map((decision, index) => (index === existingIndex ? nextDecision : decision)).slice(0, 3);
    } else if (reviewerVotes.length < 2) {
      decisions = [...reviewerVotes, nextDecision];
    } else {
      throw new Error('This record already has two reviewer votes. Use resolver mode for flagged or conflicting records.');
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
