import type { PaperStatus } from '@/lib/types';

export const BULK_EXPORT_STATUSES: PaperStatus[] = [
  'extracted',
  'american_data',
  'referee',
  'mental_health',
  'aspetar_asprev',
  'flagged',
  'fifa_data',
  'uefa_master_extraction',
];

export const TAGGED_AUTO_COMPLETE_STATUSES: PaperStatus[] = [
  'mental_health',
  'uefa',
  'no_exposure',
  'fifa_data',
  'aspetar_asprev',
  'american_data',
  'systematic_review',
  'referee',
  'retrospective_substudy_analysis',
];

export const ACTIVE_STATUSES: PaperStatus[] = ['uploaded', 'processing', 'flagged'];

export const COMPLETED_STATUSES: PaperStatus[] = ['extracted'];

// Archived and no_exposure papers do not meet the inclusion criteria, so they must not count
// toward extraction totals or progress. They stay in the table as an audit trail.
export const DASHBOARD_COUNT_EXCLUDED_STATUSES: PaperStatus[] = [
  'archived',
  'no_exposure',
  'uefa_master_extraction',
];

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
export const isBulkExportStatus = (status: PaperStatus) => BULK_EXPORT_STATUSES.includes(status);
export const isDashboardCountExcludedStatus = (status: PaperStatus) =>
  DASHBOARD_COUNT_EXCLUDED_STATUSES.includes(status);
