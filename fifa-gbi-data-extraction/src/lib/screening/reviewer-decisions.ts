import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

export const EXCLUSION_REASONS = [
  'Wrong sport',
  'Non-competitive or recreational-only context',
  'No football-specific subgroup data',
  'No usable denominator',
  'Public-source-only dataset',
  'Biomechanical, performance, or intervention focus',
  'Ineligible retrospective or cross-sectional design',
  'Review article for reference checking only',
  'Full text unavailable',
  'Non-English full text pending translation',
  'Other',
] as const;

export const MAX_EXCLUSION_REASON_CHARS = 500;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export type FullTextReviewerDecision = {
  reviewerProfileId: string;
  reviewerName?: string | null;
  decision: ScreeningDecision;
  reason?: string | null;
  decidedAt: string;
};

export type FullTextDecisionAction = 'reviewer_vote' | 'consensus_resolution';

export type FullTextDecisionAuditEntry = FullTextReviewerDecision & {
  action: 'initial_vote' | 'updated_vote' | 'consensus_resolution' | 'updated_consensus_resolution';
  resolutionBefore: ScreeningResolution;
};

export type ScreeningResolution =
  | 'pending'
  | 'awaiting_pdf'
  | 'ready_for_extraction'
  | 'excluded'
  | 'conflict'
  | 'promoted';

export type ScreeningWorkStatus =
  | 'awaiting_pdf'
  | 'needs_your_vote'
  | 'awaiting_other_reviewer'
  | 'ready_for_extraction'
  | 'excluded'
  | 'conflict'
  | 'promoted';

type ScreeningMetadata = {
  fullTextDecisions?: FullTextReviewerDecision[];
  fullTextDecisionAudit?: FullTextDecisionAuditEntry[];
  fullTextResolution?: ScreeningResolution;
  awaitingFullTextPdf?: boolean;
  [key: string]: unknown;
};

const isDecision = (value: unknown): value is ScreeningDecision => value === 'include' || value === 'exclude';

const isReviewerDecision = (value: unknown): value is FullTextReviewerDecision => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FullTextReviewerDecision>;
  return Boolean(candidate.reviewerProfileId) && isDecision(candidate.decision) && Boolean(candidate.decidedAt);
};

export const getReviewerDecisions = (record: ScreeningRecord): FullTextReviewerDecision[] => {
  const metadata = record.metadata as ScreeningMetadata;
  const decisions = Array.isArray(metadata.fullTextDecisions)
    ? metadata.fullTextDecisions.filter(isReviewerDecision)
    : [];

  if (decisions.length > 0) return decisions.slice(0, 3);

  if (!record.manualDecision || !record.manualDecidedBy || !record.manualDecidedAt) {
    return [];
  }

  return [{
    reviewerProfileId: record.manualDecidedBy,
    reviewerName: record.manualDecidedByName ?? null,
    decision: record.manualDecision,
    reason: record.manualReason,
    decidedAt: record.manualDecidedAt,
  }];
};

export const isAwaitingFullTextPdf = (record: ScreeningRecord): boolean => {
  if (record.stage !== 'full_text') return false;
  const metadata = record.metadata as ScreeningMetadata;
  return metadata.awaitingFullTextPdf === true && !record.storageObjectPath;
};

export const getScreeningResolution = (record: ScreeningRecord): ScreeningResolution => {
  if (record.promotedPaperId) {
    return 'promoted';
  }
  if (isAwaitingFullTextPdf(record)) {
    return 'awaiting_pdf';
  }

  const decisions = getReviewerDecisions(record);
  if (decisions.length < 2) {
    return 'pending';
  }

  const firstTwo = decisions.slice(0, 2);
  if (decisions.length >= 3 && firstTwo[0]?.decision !== firstTwo[1]?.decision) {
    return decisions[2].decision === 'include' ? 'ready_for_extraction' : 'excluded';
  }

  const includes = firstTwo.filter((decision) => decision.decision === 'include').length;
  const excludes = firstTwo.filter((decision) => decision.decision === 'exclude').length;

  if (includes === 2) return 'ready_for_extraction';
  if (excludes === 2) return 'excluded';
  return 'conflict';
};

export const getDecisionProgressLabel = (record: ScreeningRecord) => {
  const decisions = getReviewerDecisions(record);
  if (decisions.length >= 3) {
    return 'Resolved';
  }
  return `${Math.min(decisions.length, 2)}/2`;
};

export const hasReviewerVoted = (record: ScreeningRecord, reviewerProfileId: string) =>
  getReviewerDecisions(record).some((decision) => decision.reviewerProfileId === reviewerProfileId);

export const getScreeningWorkStatus = (
  record: ScreeningRecord,
  reviewerProfileId: string,
): ScreeningWorkStatus => {
  const resolution = getScreeningResolution(record);
  if (resolution !== 'pending') {
    return resolution;
  }
  return hasReviewerVoted(record, reviewerProfileId) ? 'awaiting_other_reviewer' : 'needs_your_vote';
};

export const getScreeningStatusLabel = (
  record: ScreeningRecord,
  reviewerProfileId: string,
) => {
  const status = getScreeningWorkStatus(record, reviewerProfileId);
  const decisions = getReviewerDecisions(record);
  if (status === 'needs_your_vote') {
    return decisions.length === 0 ? 'No votes' : 'One vote';
  }
  if (status === 'awaiting_other_reviewer') return 'Awaiting other reviewer';
  if (status === 'awaiting_pdf') return 'Upload full text';
  if (status === 'ready_for_extraction') return 'Ready for extraction';
  if (status === 'excluded') return 'Excluded';
  if (status === 'conflict') return 'Conflict';
  return 'Promoted';
};

export const summarizeExclusionReasons = (record: ScreeningRecord) => {
  const reasons = getReviewerDecisions(record)
    .filter((decision) => decision.decision === 'exclude')
    .map((decision) => decision.reason?.trim())
    .filter((reason): reason is string => Boolean(reason));

  return Array.from(new Set(reasons)).join(' / ');
};
