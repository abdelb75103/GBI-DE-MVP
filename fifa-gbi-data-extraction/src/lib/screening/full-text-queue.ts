import {
  getReviewerDecisions,
  getScreeningResolution,
  getScreeningWorkStatus,
  isAwaitingFullTextPdf,
} from './reviewer-decisions.ts';
import type { ScreeningRecord } from '../types.ts';

export const FULL_TEXT_QUEUE_PAGE_SIZE = 20;
export const FULL_TEXT_SCREENING_REVIEW_TOTAL = 386;

export const FULL_TEXT_QUEUE_FILTERS = [
  'all',
  'awaiting_pdf',
  'needs_your_vote',
  'awaiting_other_reviewer',
  'ready_for_extraction',
  'excluded',
  'conflict',
  'promoted',
] as const;

export type FullTextQueueFilter = (typeof FULL_TEXT_QUEUE_FILTERS)[number];
export type FullTextQueueNotice = 'filter_empty';

export type FullTextQueueContext = {
  filter: FullTextQueueFilter;
  search: string;
  page: number;
  notice: FullTextQueueNotice | null;
};

export type FullTextQueueCounts = {
  all: number;
  awaitingPdf: number;
  needsYourVote: number;
  awaitingOther: number;
  complete: number;
  conflicts: number;
  noVotes: number;
  oneVote: number;
};

export type FullTextQueuePage = {
  records: ScreeningRecord[];
  counts: FullTextQueueCounts;
  filteredTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

export type FullTextQueueAdjacentRecord = {
  record: ScreeningRecord;
  page: number;
  position: number;
};

export type FullTextQueueAdjacentRecords = {
  previous: FullTextQueueAdjacentRecord | null;
  next: FullTextQueueAdjacentRecord | null;
};

export type FullTextReviewerProgress = {
  completed: number;
  total: number;
  percent: number;
};

const FILTER_LABELS: Record<FullTextQueueFilter, string> = {
  all: 'All records',
  awaiting_pdf: 'Upload full text',
  needs_your_vote: 'Needs my vote',
  awaiting_other_reviewer: 'Awaiting other reviewer',
  ready_for_extraction: 'Included',
  excluded: 'Excluded',
  conflict: 'Conflicts',
  promoted: 'Promoted to extraction',
};

type SearchParamValue = string | string[] | undefined;
type SearchParamInput = URLSearchParams | Record<string, SearchParamValue>;

const readSearchParam = (input: SearchParamInput, key: string): string => {
  if (input instanceof URLSearchParams) return input.get(key) ?? '';
  const value = input[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
};

const parsePositiveInteger = (value: string, fallback: number): number => {
  if (!/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const parseFullTextQueueContext = (input: SearchParamInput): FullTextQueueContext => {
  const rawFilter = readSearchParam(input, 'filter');
  const filter = FULL_TEXT_QUEUE_FILTERS.includes(rawFilter as FullTextQueueFilter)
    ? rawFilter as FullTextQueueFilter
    : 'all';
  const rawNotice = readSearchParam(input, 'notice');

  return {
    filter,
    search: readSearchParam(input, 'search').trim().slice(0, 200),
    page: parsePositiveInteger(readSearchParam(input, 'page'), 1),
    notice: rawNotice === 'filter_empty' ? 'filter_empty' : null,
  };
};

export const parseFullTextReaderPosition = (input: SearchParamInput): number => {
  const value = readSearchParam(input, 'position');
  if (!/^\d+$/.test(value)) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed < FULL_TEXT_QUEUE_PAGE_SIZE ? parsed : 0;
};

export const getFullTextFilterLabel = (filter: FullTextQueueFilter): string => FILTER_LABELS[filter];

const appendQueueContext = (params: URLSearchParams, context: FullTextQueueContext) => {
  params.set('filter', context.filter);
  if (context.search) params.set('search', context.search);
  params.set('page', String(context.page));
};

export const buildFullTextQueueUrl = (context: FullTextQueueContext): string => {
  const params = new URLSearchParams();
  appendQueueContext(params, context);
  if (context.notice) params.set('notice', context.notice);
  return `/full-text-screening?${params.toString()}`;
};

export const buildFullTextReaderUrl = (
  recordId: string,
  context: FullTextQueueContext,
  position: number,
): string => {
  const params = new URLSearchParams();
  appendQueueContext(params, context);
  params.set('position', String(Math.max(0, Math.min(FULL_TEXT_QUEUE_PAGE_SIZE - 1, Math.trunc(position)))));
  return `/full-text-screening/${encodeURIComponent(recordId)}?${params.toString()}`;
};

const matchesFullTextSearch = (record: ScreeningRecord, search: string): boolean => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    record.assignedStudyId,
    record.title,
    record.leadAuthor,
    record.year,
    record.journal,
    record.doi,
    record.originalFileName,
    record.aiReason,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
};

const matchesFullTextFilter = (
  record: ScreeningRecord,
  filter: FullTextQueueFilter,
  reviewerProfileId: string,
): boolean => filter === 'all' || getScreeningWorkStatus(record, reviewerProfileId) === filter;

export const filterFullTextQueueRecords = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
  context: Pick<FullTextQueueContext, 'filter' | 'search'>,
): ScreeningRecord[] => records.filter((record) =>
  matchesFullTextFilter(record, context.filter, reviewerProfileId) &&
  matchesFullTextSearch(record, context.search)
);

const getFullTextQueueCounts = (records: ScreeningRecord[], reviewerProfileId: string): FullTextQueueCounts => {
  const statuses = records.map((record) => getScreeningWorkStatus(record, reviewerProfileId));
  const decisions = records.map(getReviewerDecisions);
  return {
    all: records.length,
    awaitingPdf: records.filter(isAwaitingFullTextPdf).length,
    needsYourVote: statuses.filter((status) => status === 'needs_your_vote').length,
    awaitingOther: statuses.filter((status) => status === 'awaiting_other_reviewer').length,
    complete: records.filter((record) => {
      const resolution = getScreeningResolution(record);
      return resolution === 'ready_for_extraction' || resolution === 'excluded' || resolution === 'promoted';
    }).length,
    conflicts: statuses.filter((status) => status === 'conflict').length,
    noVotes: decisions.filter((items) => items.length === 0).length,
    oneVote: decisions.filter((items) => items.length === 1).length,
  };
};

export const getFullTextReviewerProgress = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
): FullTextReviewerProgress => {
  const completed = records.filter((record) =>
    getReviewerDecisions(record).some((decision) => decision.reviewerProfileId === reviewerProfileId)
  ).length;
  const total = FULL_TEXT_SCREENING_REVIEW_TOTAL;

  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
};

export const buildFullTextQueuePage = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
  context: FullTextQueueContext,
): FullTextQueuePage => {
  const filtered = filterFullTextQueueRecords(records, reviewerProfileId, context);
  const totalPages = Math.max(1, Math.ceil(filtered.length / FULL_TEXT_QUEUE_PAGE_SIZE));
  const page = Math.min(Math.max(1, context.page), totalPages);
  const offset = (page - 1) * FULL_TEXT_QUEUE_PAGE_SIZE;
  const pageRecords = filtered.slice(offset, offset + FULL_TEXT_QUEUE_PAGE_SIZE);

  return {
    records: pageRecords,
    counts: getFullTextQueueCounts(records, reviewerProfileId),
    filteredTotal: filtered.length,
    page,
    pageSize: FULL_TEXT_QUEUE_PAGE_SIZE,
    totalPages,
    rangeStart: pageRecords.length > 0 ? offset + 1 : 0,
    rangeEnd: offset + pageRecords.length,
  };
};

export const findAdjacentFullTextQueueRecords = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
  context: FullTextQueueContext,
  currentRecordId: string,
  fallbackPosition: number,
): FullTextQueueAdjacentRecords => {
  const filtered = filterFullTextQueueRecords(records, reviewerProfileId, context);
  const fallbackIndex = (Math.max(1, context.page) - 1) * FULL_TEXT_QUEUE_PAGE_SIZE
    + Math.max(0, Math.min(FULL_TEXT_QUEUE_PAGE_SIZE - 1, Math.trunc(fallbackPosition)));
  const matchedIndex = filtered.findIndex((record) => record.id === currentRecordId);
  const currentIndex = matchedIndex >= 0 ? matchedIndex : fallbackIndex;
  const toAdjacentRecord = (index: number): FullTextQueueAdjacentRecord | null => {
    const record = filtered[index];
    if (!record) return null;
    return {
      record,
      page: Math.floor(index / FULL_TEXT_QUEUE_PAGE_SIZE) + 1,
      position: index % FULL_TEXT_QUEUE_PAGE_SIZE,
    };
  };

  return {
    previous: toAdjacentRecord(currentIndex - 1),
    next: toAdjacentRecord(currentIndex + 1),
  };
};

export const findNextFullTextQueueRecord = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
  context: FullTextQueueContext,
  completedRecordId: string,
  position: number,
): ScreeningRecord | null => {
  const remaining = filterFullTextQueueRecords(records, reviewerProfileId, context)
    .filter((record) => record.id !== completedRecordId);
  if (remaining.length === 0) return null;

  const targetIndex = (Math.max(1, context.page) - 1) * FULL_TEXT_QUEUE_PAGE_SIZE
    + Math.max(0, Math.min(FULL_TEXT_QUEUE_PAGE_SIZE - 1, Math.trunc(position)));
  return remaining[targetIndex] ?? remaining[0] ?? null;
};
