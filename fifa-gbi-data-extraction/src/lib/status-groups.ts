import type { PaperStatus } from '@/lib/types';

export const ACTIVE_STATUSES: PaperStatus[] = [
  'uploaded',
  'processing',
  'flagged',
  'qa_review',
  'mental_health',
  'uefa',
  'american_data',
];

export const COMPLETED_STATUSES: PaperStatus[] = ['extracted', 'archived'];

export const isActiveStatus = (status: PaperStatus) => ACTIVE_STATUSES.includes(status);
export const isCompletedStatus = (status: PaperStatus) => COMPLETED_STATUSES.includes(status);
