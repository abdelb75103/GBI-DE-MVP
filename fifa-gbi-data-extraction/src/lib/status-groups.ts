import type { PaperStatus } from '@/lib/types';

export const TAGGED_AUTO_COMPLETE_STATUSES: PaperStatus[] = [
  'mental_health',
  'uefa',
  'no_exposure',
  'fifa_data',
  'aspetar_asprev',
  'american_data',
  'systematic_review',
  'referee',
];

export const ACTIVE_STATUSES: PaperStatus[] = ['uploaded', 'processing', 'flagged'];

export const COMPLETED_STATUSES: PaperStatus[] = ['extracted'];

const PROGRESS_COMPLETE_STATUSES: PaperStatus[] = [
  ...COMPLETED_STATUSES,
  ...TAGGED_AUTO_COMPLETE_STATUSES,
  'flagged',
];

export const isActiveStatus = (status: PaperStatus) => ACTIVE_STATUSES.includes(status);
export const isCompletedStatus = (status: PaperStatus) => COMPLETED_STATUSES.includes(status);
export const isTaggedAutoCompleteStatus = (status: PaperStatus) =>
  TAGGED_AUTO_COMPLETE_STATUSES.includes(status);
export const isProgressCompletedStatus = (status: PaperStatus) =>
  PROGRESS_COMPLETE_STATUSES.includes(status);
