import {
  getScreeningResolution,
  getScreeningWorkStatus,
  isAwaitingFullTextPdf,
} from '@/lib/screening/reviewer-decisions';
import {
  getTitleAbstractDecisions,
  getTitleAbstractResolution,
  getTitleAbstractWorkStatus,
} from '@/lib/screening/title-abstract-decisions';
import { isProgressCompletedStatus } from '@/lib/status-groups';
import type { Paper, ScreeningRecord } from '@/lib/types';

export type WorkflowStageMetrics = {
  total: number;
  completed: number;
  remaining: number;
  progress: number;
  primaryCount: number;
  primaryLabel: string;
  secondaryCount: number;
  secondaryLabel: string;
  tertiaryCount: number;
  tertiaryLabel: string;
};

const percentage = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

export const getTitleAbstractMetrics = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
): WorkflowStageMetrics => {
  const completed = records.filter((record) => {
    const resolution = getTitleAbstractResolution(record);
    return (
      resolution === 'ready_for_full_text' ||
      resolution === 'excluded' ||
      resolution === 'promoted_to_full_text'
    );
  }).length;
  const needsVote = records.filter(
    (record) => getTitleAbstractWorkStatus(record, reviewerProfileId) === 'needs_your_vote',
  ).length;
  const conflicts = records.filter(
    (record) => getTitleAbstractResolution(record) === 'needs_resolver',
  ).length;
  const promoted = records.filter(
    (record) => getTitleAbstractResolution(record) === 'promoted_to_full_text',
  ).length;

  return {
    total: records.length,
    completed,
    remaining: Math.max(0, records.length - completed),
    progress: percentage(completed, records.length),
    primaryCount: needsVote,
    primaryLabel: 'Need your vote',
    secondaryCount: conflicts,
    secondaryLabel: 'Conflicts',
    tertiaryCount: promoted,
    tertiaryLabel: 'Moved forward',
  };
};

export const getFullTextMetrics = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
): WorkflowStageMetrics => {
  const completed = records.filter((record) => {
    const resolution = getScreeningResolution(record);
    return resolution === 'ready_for_extraction' || resolution === 'excluded' || resolution === 'promoted';
  }).length;
  const needsVote = records.filter(
    (record) => getScreeningWorkStatus(record, reviewerProfileId) === 'needs_your_vote',
  ).length;
  const awaitingPdf = records.filter(isAwaitingFullTextPdf).length;
  const readyForExtraction = records.filter(
    (record) => getScreeningResolution(record) === 'ready_for_extraction',
  ).length;

  return {
    total: records.length,
    completed,
    remaining: Math.max(0, records.length - completed),
    progress: percentage(completed, records.length),
    primaryCount: needsVote,
    primaryLabel: 'Need your vote',
    secondaryCount: awaitingPdf,
    secondaryLabel: 'Need PDF',
    tertiaryCount: readyForExtraction,
    tertiaryLabel: 'Ready for extraction',
  };
};

export const getExtractionMetrics = (papers: Paper[]): WorkflowStageMetrics => {
  const visiblePapers = papers.filter((paper) => paper.status !== 'archived');
  const completed = visiblePapers.filter((paper) => isProgressCompletedStatus(paper.status)).length;
  const active = visiblePapers.filter((paper) => paper.assignedTo && !isProgressCompletedStatus(paper.status)).length;
  const flagged = visiblePapers.filter((paper) => Boolean(paper.flagReason)).length;
  const available = visiblePapers.filter((paper) => !paper.assignedTo).length;

  return {
    total: visiblePapers.length,
    completed,
    remaining: Math.max(0, visiblePapers.length - completed),
    progress: percentage(completed, visiblePapers.length),
    primaryCount: active,
    primaryLabel: 'In progress',
    secondaryCount: flagged,
    secondaryLabel: 'Flagged',
    tertiaryCount: available,
    tertiaryLabel: 'Available',
  };
};

export const getTitleAbstractProgressCounts = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
) => {
  const metrics = getTitleAbstractMetrics(records, reviewerProfileId);
  return {
    ...metrics,
    awaitingOther: records.filter(
      (record) => getTitleAbstractWorkStatus(record, reviewerProfileId) === 'awaiting_other_reviewer',
    ).length,
    voted: records.filter((record) => getTitleAbstractDecisions(record).length > 0).length,
  };
};

export const getFullTextProgressCounts = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
) => {
  const metrics = getFullTextMetrics(records, reviewerProfileId);
  return {
    ...metrics,
    awaitingOther: records.filter(
      (record) => getScreeningWorkStatus(record, reviewerProfileId) === 'awaiting_other_reviewer',
    ).length,
    conflicts: records.filter((record) => getScreeningResolution(record) === 'conflict').length,
  };
};
