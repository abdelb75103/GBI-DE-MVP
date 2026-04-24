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

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export type FullTextReviewerDecision = {
  reviewerProfileId: string;
  reviewerName?: string | null;
  decision: ScreeningDecision;
  reason?: string | null;
  decidedAt: string;
};

export type ScreeningResolution =
  | 'pending'
  | 'ready_for_extraction'
  | 'excluded'
  | 'conflict'
  | 'promoted';

type ScreeningMetadata = {
  fullTextDecisions?: FullTextReviewerDecision[];
  fullTextResolution?: ScreeningResolution;
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

  if (decisions.length > 0) {
    return decisions;
  }

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

export const getScreeningResolution = (record: ScreeningRecord): ScreeningResolution => {
  if (record.promotedPaperId) {
    return 'promoted';
  }

  const metadata = record.metadata as ScreeningMetadata;
  if (
    metadata.fullTextResolution === 'ready_for_extraction' ||
    metadata.fullTextResolution === 'excluded' ||
    metadata.fullTextResolution === 'conflict'
  ) {
    return metadata.fullTextResolution;
  }

  const decisions = getReviewerDecisions(record);
  if (decisions.length < 2) {
    return 'pending';
  }

  const firstTwo = decisions.slice(0, 2);
  const includes = firstTwo.filter((decision) => decision.decision === 'include').length;
  const excludes = firstTwo.filter((decision) => decision.decision === 'exclude').length;

  if (includes === 2) return 'ready_for_extraction';
  if (excludes === 2) return 'excluded';
  return 'conflict';
};

export const getDecisionProgressLabel = (record: ScreeningRecord) => {
  const decisions = getReviewerDecisions(record);
  return `${Math.min(decisions.length, 2)}/2`;
};

export const summarizeExclusionReasons = (record: ScreeningRecord) => {
  const reasons = getReviewerDecisions(record)
    .filter((decision) => decision.decision === 'exclude')
    .map((decision) => decision.reason?.trim())
    .filter((reason): reason is string => Boolean(reason));

  return Array.from(new Set(reasons)).join(' / ');
};
