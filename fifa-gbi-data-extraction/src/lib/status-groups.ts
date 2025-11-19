import type { PaperStatus } from '@/lib/types';

export const TAGGED_AUTO_COMPLETE_STATUSES: PaperStatus[] = [
  'mental_health',
  'uefa',
  'american_data',
  'systematic_review',
  'referee',
];

export const ACTIVE_STATUSES: PaperStatus[] = ['uploaded', 'processing', 'flagged', 'qa_review'];

export const COMPLETED_STATUSES: PaperStatus[] = ['extracted', 'archived'];

const PROGRESS_COMPLETE_STATUSES: PaperStatus[] = [...COMPLETED_STATUSES, ...TAGGED_AUTO_COMPLETE_STATUSES];

export const isActiveStatus = (status: PaperStatus) => ACTIVE_STATUSES.includes(status);
export const isCompletedStatus = (status: PaperStatus) => COMPLETED_STATUSES.includes(status);
export const isTaggedAutoCompleteStatus = (status: PaperStatus) =>
  TAGGED_AUTO_COMPLETE_STATUSES.includes(status);
export const isProgressCompletedStatus = (status: PaperStatus) =>
  PROGRESS_COMPLETE_STATUSES.includes(status);
