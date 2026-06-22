import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

import { mapScreeningRecordRow } from '@/lib/db/mappers';
import { generateAssignedStudyId } from '@/lib/db/study-ids';
import { supabaseClient } from '@/lib/db/shared';
import { createPaper, listPapers, updatePaper } from '@/lib/db/papers';
import { attachFile, uploadFileToStorage } from '@/lib/db/files';
import {
  calculateFuzzyTitleScore,
  categorizeDuplicate,
  computeFileSha256,
  doiMatches,
  generateDuplicateKeyV2,
  generateTitleFingerprint,
  normalizeDoi,
} from '@/lib/dedupe';
import {
  MAX_EXCLUSION_REASON_CHARS,
  getScreeningResolution,
  isAwaitingFullTextPdf,
  type FullTextDecisionAction,
} from '@/lib/screening/reviewer-decisions';
import {
  MENTAL_HEALTH_TAG,
  addMentalHealthTag,
  hasMentalHealthTag,
  isMentalHealthScreeningRecord,
} from '@/lib/screening/mental-health';
import type { ScreeningRecordInsert, ScreeningRecordRow, ScreeningRecordUpdate } from '@/lib/db/types';
import type { Paper, ScreeningDecision, ScreeningRecord, ScreeningStage } from '@/lib/types';
import {
  applyTitleAbstractDecision,
  getTitleAbstractDecisions,
  getTitleAbstractMetadata,
  getTitleAbstractResolution,
  getTitleAbstractWorkStatus,
  type TitleAbstractDecision,
  type TitleAbstractDecisionAction,
  type TitleAbstractResolution,
} from '@/lib/screening/title-abstract-decisions';
import {
  hasActiveTitleAbstractOfflineReservation,
  shouldHideFromNormalTitleAbstractQueue,
} from '@/lib/screening/title-abstract-offline';
import {
  buildFullTextQueuePage,
  findAdjacentFullTextQueueRecords,
  findNextFullTextQueueRecord,
  type FullTextQueueAdjacentRecords,
  type FullTextQueueContext,
  type FullTextQueuePage,
} from '@/lib/screening/full-text-queue';

const AWAITING_FULL_TEXT_PDF_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');
export const TITLE_ABSTRACT_QUEUE_PAGE_SIZE = 50;
const TITLE_ABSTRACT_QUEUE_CACHE_MS = 30_000;
const TITLE_ABSTRACT_QUEUE_SELECT = [
  'id',
  'stage',
  'assigned_study_id',
  'title',
  'abstract',
  'lead_author',
  'journal',
  'year',
  'doi',
  'normalized_doi',
  'source_label',
  'source_record_id',
  'storage_bucket',
  'storage_object_path',
  'file_name',
  'original_file_name',
  'mime_type',
  'size',
  'file_sha256',
  'ai_status',
  'ai_suggested_decision',
  'ai_reason',
  'ai_evidence_quote',
  'ai_source_location',
  'ai_confidence',
  'ai_model',
  'ai_criteria_version',
  'ai_raw_response',
  'ai_error',
  'ai_reviewed_at',
  'manual_decision',
  'manual_reason',
  'manual_decided_by',
  'manual_decided_at',
  'promoted_paper_id',
  'promoted_by',
  'promoted_at',
  'created_by',
  'created_at',
  'updated_at',
  'metadata',
  'notes',
].join(',');

export type TitleAbstractQueueFilter =
  | 'all'
  | 'needs_your_vote'
  | 'awaiting_ai_recommendation'
  | 'awaiting_other_reviewer'
  | 'needs_resolver'
  | 'included'
  | 'ready_for_full_text'
  | 'excluded'
  | 'promoted_to_full_text'
  | 'missing_abstract'
  | 'flagged'
  | 'ai_include'
  | 'ai_exclude'
  | 'ai_systematic_review'
  | 'ai_not_run'
  | 'reserved_offline';

export type TitleAbstractQueueCounts = {
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
  aiSystematicReview: number;
  aiNotRun: number;
  reservedOffline: number;
};

export type TitleAbstractQueuePage = {
  records: ScreeningRecord[];
  counts: TitleAbstractQueueCounts;
  filteredTotal: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type PromotionDuplicateWarning = {
  target: 'full_text' | 'extraction';
  matchedId: string;
  matchedStudyId: string | null;
  matchedTitle: string;
  reason: 'doi' | 'title_author_year' | 'fuzzy_title';
  score: number;
};

type DuplicateCandidate = {
  id: string;
  assignedStudyId?: string | null;
  title: string;
  leadAuthor: string | null;
  year: string | null;
  doi: string | null;
  normalizedDoi?: string | null;
};

const findPromotionDuplicateWarnings = (
  source: Pick<ScreeningRecord, 'title' | 'leadAuthor' | 'year' | 'doi' | 'normalizedDoi'>,
  candidates: DuplicateCandidate[],
  target: PromotionDuplicateWarning['target'],
): PromotionDuplicateWarning[] => {
  const sourceDoi = normalizeDoi(source.normalizedDoi ?? source.doi);
  const sourceKey = generateDuplicateKeyV2(source.title, source.leadAuthor, source.year);

  return candidates.flatMap((candidate) => {
    const candidateDoi = normalizeDoi(candidate.normalizedDoi ?? candidate.doi);
    const candidateKey = generateDuplicateKeyV2(candidate.title, candidate.leadAuthor, candidate.year);
    const fuzzyScore = calculateFuzzyTitleScore(source.title, candidate.title);

    let reason: PromotionDuplicateWarning['reason'] | null = null;
    let score = 0;
    if (sourceDoi && doiMatches(sourceDoi, candidateDoi)) {
      reason = 'doi';
      score = 100;
    } else if (sourceKey === candidateKey) {
      reason = 'title_author_year';
      score = 100;
    } else if (categorizeDuplicate(fuzzyScore) === 'duplicate') {
      reason = 'fuzzy_title';
      score = fuzzyScore;
    }

    if (!reason) {
      return [];
    }

    return [{
      target,
      matchedId: candidate.id,
      matchedStudyId: candidate.assignedStudyId ?? null,
      matchedTitle: candidate.title,
      reason,
      score,
    }];
  });
};

const findFullTextPromotionWarnings = async (record: ScreeningRecord): Promise<PromotionDuplicateWarning[]> => {
  const fullTextRecords = await listScreeningRecords('full_text');
  return findPromotionDuplicateWarnings(
    record,
    fullTextRecords
      .filter((candidate) => candidate.id !== record.id)
      .map((candidate) => ({
        id: candidate.id,
        assignedStudyId: candidate.assignedStudyId,
        title: candidate.title,
        leadAuthor: candidate.leadAuthor,
        year: candidate.year,
        doi: candidate.doi,
        normalizedDoi: candidate.normalizedDoi,
      })),
    'full_text',
  );
};

const findExtractionPromotionWarnings = async (record: ScreeningRecord): Promise<PromotionDuplicateWarning[]> => {
  const papers = await listPapers();
  return findPromotionDuplicateWarnings(
    record,
    papers.map((paper: Paper) => ({
      id: paper.id,
      assignedStudyId: paper.assignedStudyId,
      title: paper.extractedTitle ?? paper.title,
      leadAuthor: paper.leadAuthor,
      year: paper.year,
      doi: paper.doi,
      normalizedDoi: paper.normalizedDoi,
    })),
    'extraction',
  );
};

const loadProfileNames = async (ids: Array<string | null | undefined>): Promise<Map<string, string>> => {
  const profileIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (profileIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseClient()
    .from('profiles')
    .select('id, full_name')
    .in('id', profileIds);

  if (error) {
    throw new Error(`Failed to load profile names: ${error.message}`);
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile.full_name]));
};

const mapRows = async (rows: ScreeningRecordRow[]): Promise<ScreeningRecord[]> => {
  const names = await loadProfileNames(
    rows.flatMap((row) => [row.created_by, row.manual_decided_by, row.promoted_by]),
  );
  return rows.map((row) => mapScreeningRecordRow(row, names));
};

const maybePersistMentalHealthTag = async (record: ScreeningRecord): Promise<ScreeningRecord> => {
  if (record.stage !== 'full_text') {
    return record;
  }
  if (hasMentalHealthTag(record.metadata) || !isMentalHealthScreeningRecord(record)) {
    return record;
  }

  return updateScreeningRecordMetadata(
    record.id,
    addMentalHealthTag(record.metadata),
    {},
    record.updatedAt,
  );
};

let titleAbstractQueueCache: { expiresAt: number; records: ScreeningRecord[] } | null = null;

// Sidebar/dashboard counts are a full-table aggregate (~2s) and only change on
// writes, so cache them per reviewer with a short TTL. Cleared on every write.
const TITLE_ABSTRACT_COUNTS_CACHE_MS = 30_000;
const titleAbstractCountsCache = new Map<string, { expiresAt: number; counts: TitleAbstractQueueCounts }>();

const invalidateTitleAbstractQueueCache = () => {
  titleAbstractQueueCache = null;
  titleAbstractCountsCache.clear();
};

export type CreateScreeningRecordInput = {
  stage?: ScreeningStage;
  assignedStudyId?: string | null;
  title: string;
  abstract?: string | null;
  leadAuthor?: string | null;
  journal?: string | null;
  year?: string | null;
  doi?: string | null;
  sourceLabel?: string | null;
  sourceRecordId?: string | null;
  storageBucket?: string | null;
  storageObjectPath?: string | null;
  dataBase64?: string | null;
  fileName?: string | null;
  originalFileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  fileSha256?: string | null;
  metadata?: Record<string, unknown>;
  notes?: string | null;
  createdBy?: string | null;
};

export const listScreeningRecords = async (stage: ScreeningStage = 'full_text'): Promise<ScreeningRecord[]> => {
  const supabase = supabaseClient();
  const rows: ScreeningRecordRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('*')
      .eq('stage', stage)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list screening records. Apply the screening migration first: ${error.message}`);
    }

    rows.push(...((data ?? []) as unknown as ScreeningRecordRow[]));
    if (!data || data.length < pageSize) break;
  }

  return mapRows(rows);
};

export const listFullTextQueuePage = async ({
  reviewerProfileId,
  context,
}: {
  reviewerProfileId: string;
  context: FullTextQueueContext;
}): Promise<FullTextQueuePage> => {
  const records = await listScreeningRecords('full_text');
  return buildFullTextQueuePage(records, reviewerProfileId, context);
};

export const findAdjacentFullTextQueueRecordsForReviewer = async ({
  reviewerProfileId,
  context,
  currentRecordId,
  position,
}: {
  reviewerProfileId: string;
  context: FullTextQueueContext;
  currentRecordId: string;
  position: number;
}): Promise<FullTextQueueAdjacentRecords> => {
  const records = await listScreeningRecords('full_text');
  return findAdjacentFullTextQueueRecords(records, reviewerProfileId, context, currentRecordId, position);
};

export const findNextFullTextQueueRecordForReviewer = async ({
  reviewerProfileId,
  context,
  completedRecordId,
  position,
}: {
  reviewerProfileId: string;
  context: FullTextQueueContext;
  completedRecordId: string;
  position: number;
}): Promise<ScreeningRecord | null> => {
  const records = await listScreeningRecords('full_text');
  return findNextFullTextQueueRecord(records, reviewerProfileId, context, completedRecordId, position);
};

const listTitleAbstractQueueRecords = async (): Promise<ScreeningRecord[]> => {
  const now = Date.now();
  if (titleAbstractQueueCache && titleAbstractQueueCache.expiresAt > now) {
    return titleAbstractQueueCache.records;
  }

  const supabase = supabaseClient();
  const rows: ScreeningRecordRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select(TITLE_ABSTRACT_QUEUE_SELECT)
      .eq('stage', 'title_abstract')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list title/abstract records: ${error.message}`);
    }

    rows.push(...((data ?? []) as unknown as ScreeningRecordRow[]));
    if (!data || data.length < pageSize) break;
  }

  const records = await mapRows(rows);
  titleAbstractQueueCache = {
    expiresAt: now + TITLE_ABSTRACT_QUEUE_CACHE_MS,
    records,
  };
  return records;
};

const matchesTitleAbstractSearch = (record: ScreeningRecord, query: string) => {
  if (!query) return true;
  return [
    record.assignedStudyId,
    record.title,
    record.abstract,
    record.leadAuthor,
    record.year,
    record.journal,
    record.doi,
    record.sourceRecordId,
    record.sourceLabel,
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
};

const matchesTitleAbstractFilter = (
  record: ScreeningRecord,
  filter: TitleAbstractQueueFilter,
  reviewerProfileId: string,
) => {
  const reservedForReviewer = shouldHideFromNormalTitleAbstractQueue(record, reviewerProfileId);
  if (filter === 'reserved_offline') return reservedForReviewer;
  if (reservedForReviewer) return false;
  if (filter === 'all') return true;
  const status = getTitleAbstractWorkStatus(record, reviewerProfileId);
  const decisions = getTitleAbstractDecisions(record);
  if (filter === 'missing_abstract') return !record.abstract?.trim();
  if (filter === 'flagged') return decisions.some((item) => item.decision === 'flag');
  if (filter === 'ai_include') return record.aiSuggestedDecision === 'include';
  if (filter === 'ai_exclude') return record.aiSuggestedDecision === 'exclude';
  if (filter === 'ai_systematic_review') return record.aiTargetTag === 'systematic_review';
  if (filter === 'ai_not_run') return record.aiStatus !== 'completed';
  if (filter === 'awaiting_other_reviewer') return status === 'awaiting_ai_recommendation';
  if (filter === 'included') return status === 'ready_for_full_text' || status === 'promoted_to_full_text';
  return status === filter;
};

const getTitleAbstractQueueCounts = (
  records: ScreeningRecord[],
  reviewerProfileId: string,
): TitleAbstractQueueCounts => {
  const reservedOffline = records.filter((record) => shouldHideFromNormalTitleAbstractQueue(record, reviewerProfileId)).length;
  const normalRecords = records.filter((record) => !shouldHideFromNormalTitleAbstractQueue(record, reviewerProfileId));
  const statuses = normalRecords.map((record) => getTitleAbstractWorkStatus(record, reviewerProfileId));
  return {
    all: normalRecords.length,
    myVotes: normalRecords.filter((record) =>
      getTitleAbstractDecisions(record).some(
        (decision) => decision.action !== 'resolver_decision' && decision.reviewerProfileId === reviewerProfileId,
      )
    ).length,
    needsYourVote: statuses.filter((status) => status === 'needs_your_vote').length,
    awaitingOther: statuses.filter((status) => status === 'awaiting_ai_recommendation' || status === 'awaiting_other_reviewer').length,
    resolver: statuses.filter((status) => status === 'needs_resolver').length,
    ready: statuses.filter((status) => status === 'ready_for_full_text').length,
    excluded: statuses.filter((status) => status === 'excluded').length,
    promoted: statuses.filter((status) => status === 'promoted_to_full_text').length,
    missingAbstract: normalRecords.filter((record) => !record.abstract?.trim()).length,
    flagged: normalRecords.filter((record) => getTitleAbstractDecisions(record).some((item) => item.decision === 'flag')).length,
    aiInclude: normalRecords.filter((record) => record.aiSuggestedDecision === 'include').length,
    aiExclude: normalRecords.filter((record) => record.aiSuggestedDecision === 'exclude').length,
    aiSystematicReview: normalRecords.filter((record) => record.aiTargetTag === 'systematic_review').length,
    aiNotRun: normalRecords.filter((record) => record.aiStatus !== 'completed').length,
    reservedOffline,
  };
};

type TitleAbstractQueueCountsRow = {
  all_count: number | string | null;
  my_votes: number | string | null;
  needs_your_vote: number | string | null;
  awaiting_other: number | string | null;
  resolver: number | string | null;
  ready: number | string | null;
  excluded_count: number | string | null;
  promoted: number | string | null;
  missing_abstract: number | string | null;
  flagged: number | string | null;
  ai_include: number | string | null;
  ai_exclude: number | string | null;
  ai_systematic_review: number | string | null;
  ai_not_run: number | string | null;
  reserved_offline: number | string | null;
};

const toCount = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapTitleAbstractQueueCounts = (row?: TitleAbstractQueueCountsRow): TitleAbstractQueueCounts => ({
  all: toCount(row?.all_count),
  myVotes: toCount(row?.my_votes),
  needsYourVote: toCount(row?.needs_your_vote),
  awaitingOther: toCount(row?.awaiting_other),
  resolver: toCount(row?.resolver),
  ready: toCount(row?.ready),
  excluded: toCount(row?.excluded_count),
  promoted: toCount(row?.promoted),
  missingAbstract: toCount(row?.missing_abstract),
  flagged: toCount(row?.flagged),
  aiInclude: toCount(row?.ai_include),
  aiExclude: toCount(row?.ai_exclude),
  aiSystematicReview: toCount(row?.ai_systematic_review),
  aiNotRun: toCount(row?.ai_not_run),
  reservedOffline: toCount(row?.reserved_offline),
});

// Postgres reports a missing RPC (migration not yet applied) with PGRST202 or a
// 42883 "function does not exist" error. Detect it so we can fall back safely.
const isMissingQueueFunction = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return /Could not find the function|function .* does not exist/i.test(error.message ?? '');
};

// In-memory fallback used only when the DB-side queue functions are absent.
const listTitleAbstractQueuePageInMemory = async ({
  reviewerProfileId,
  filter,
  search,
  offset,
  limit,
}: {
  reviewerProfileId: string;
  filter: TitleAbstractQueueFilter;
  search: string;
  offset: number;
  limit: number;
}): Promise<TitleAbstractQueuePage> => {
  const records = await listTitleAbstractQueueRecords();
  const counts = getTitleAbstractQueueCounts(records, reviewerProfileId);
  const query = search.trim().toLowerCase();
  const filtered = records.filter((record) =>
    matchesTitleAbstractFilter(record, filter, reviewerProfileId) &&
    matchesTitleAbstractSearch(record, query)
  );

  return {
    records: filtered.slice(offset, offset + limit),
    counts,
    filteredTotal: filtered.length,
    offset,
    limit,
    hasMore: offset + limit < filtered.length,
  };
};

export const listTitleAbstractQueuePage = async ({
  reviewerProfileId,
  filter = 'all',
  search = '',
  offset = 0,
  limit = TITLE_ABSTRACT_QUEUE_PAGE_SIZE,
}: {
  reviewerProfileId: string;
  filter?: TitleAbstractQueueFilter;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<TitleAbstractQueuePage> => {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(150, Math.max(1, limit));
  const trimmedSearch = (search ?? '').trim();

  if (filter === 'included') {
    return listTitleAbstractQueuePageInMemory({
      reviewerProfileId,
      filter,
      search: trimmedSearch,
      offset: safeOffset,
      limit: safeLimit,
    });
  }

  const rpcFilter = filter === 'awaiting_ai_recommendation' ? 'awaiting_other_reviewer' : filter;
  const supabase = supabaseClient();

  // Fast path: pagination + search run in Postgres; counts come from the cache.
  const [listResult, totalResult] = await Promise.all([
    supabase.rpc('list_title_abstract_queue', {
      p_reviewer: reviewerProfileId,
      p_filter: rpcFilter,
      p_search: trimmedSearch,
      p_offset: safeOffset,
      p_limit: safeLimit,
    }),
    supabase.rpc('count_title_abstract_queue', {
      p_reviewer: reviewerProfileId,
      p_filter: rpcFilter,
      p_search: trimmedSearch,
    }),
  ]);

  if (isMissingQueueFunction(listResult.error) || isMissingQueueFunction(totalResult.error)) {
    return listTitleAbstractQueuePageInMemory({
      reviewerProfileId,
      filter,
      search: trimmedSearch,
      offset: safeOffset,
      limit: safeLimit,
    });
  }

  if (listResult.error) {
    throw new Error(`Failed to list title/abstract records: ${listResult.error.message}`);
  }
  if (totalResult.error) {
    throw new Error(`Failed to count title/abstract records: ${totalResult.error.message}`);
  }

  const rows = (listResult.data ?? []) as ScreeningRecordRow[];
  const records = await mapRows(rows);
  const filteredTotal = toCount(totalResult.data as number | string | null);
  const counts = await getTitleAbstractQueueCountsForReviewer(reviewerProfileId);

  return {
    records,
    counts,
    filteredTotal,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + records.length < filteredTotal,
  };
};

// Cached per-reviewer sidebar/dashboard counts. Falls back to the in-memory
// computation when the DB function is absent (migration not yet applied).
export const getTitleAbstractQueueCountsForReviewer = async (
  reviewerProfileId: string,
): Promise<TitleAbstractQueueCounts> => {
  const now = Date.now();
  const cached = titleAbstractCountsCache.get(reviewerProfileId);
  if (cached && cached.expiresAt > now) {
    return cached.counts;
  }

  const { data, error } = await supabaseClient().rpc('get_title_abstract_queue_counts', {
    p_reviewer: reviewerProfileId,
  });

  let counts: TitleAbstractQueueCounts;
  if (isMissingQueueFunction(error)) {
    const records = await listTitleAbstractQueueRecords();
    counts = getTitleAbstractQueueCounts(records, reviewerProfileId);
  } else if (error) {
    throw new Error(`Failed to load title/abstract counts: ${error.message}`);
  } else {
    const row = (Array.isArray(data) ? data[0] : data) as TitleAbstractQueueCountsRow | undefined;
    counts = mapTitleAbstractQueueCounts(row);
  }

  titleAbstractCountsCache.set(reviewerProfileId, {
    expiresAt: now + TITLE_ABSTRACT_COUNTS_CACHE_MS,
    counts,
  });
  return counts;
};

export const getScreeningRecord = async (id: string): Promise<ScreeningRecord | undefined> => {
  const { data, error } = await supabaseClient()
    .from('screening_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load screening record ${id}: ${error.message}`);
  }
  if (!data) {
    return undefined;
  }

  const [record] = await mapRows([data as ScreeningRecordRow]);
  return record;
};

export const createScreeningRecord = async (input: CreateScreeningRecordInput): Promise<ScreeningRecord> => {
  const assignedStudyId = input.assignedStudyId?.trim() || await generateAssignedStudyId();
  const normalizedDoi = normalizeDoi(input.doi);
  const title = input.title.trim() || input.originalFileName || input.fileName || 'Untitled screening record';
  const extractedTitle = title;
  const payload: ScreeningRecordInsert = {
    id: crypto.randomUUID(),
    stage: input.stage ?? 'full_text',
    assigned_study_id: assignedStudyId,
    title,
    abstract: input.abstract ?? null,
    lead_author: input.leadAuthor ?? null,
    journal: input.journal ?? null,
    year: input.year ?? null,
    doi: input.doi ?? null,
    normalized_doi: normalizedDoi || null,
    source_label: input.sourceLabel ?? null,
    source_record_id: input.sourceRecordId ?? null,
    storage_bucket: input.storageBucket ?? null,
    storage_object_path: input.storageObjectPath ?? null,
    data_base64: input.dataBase64 ?? null,
    file_name: input.fileName ?? null,
    original_file_name: input.originalFileName ?? input.fileName ?? null,
    mime_type: input.mimeType ?? null,
    size: input.size ?? null,
    file_sha256: input.fileSha256 ?? null,
    created_by: input.createdBy ?? null,
    metadata: {
      duplicateKeyV2: generateDuplicateKeyV2(extractedTitle, input.leadAuthor, input.year),
      titleFingerprint: generateTitleFingerprint(extractedTitle),
      ...(input.metadata ?? {}),
    },
    notes: input.notes ?? null,
  };

  const { data, error } = await supabaseClient()
    .from('screening_records')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create screening record: ${error?.message ?? 'Unknown error'}`);
  }

  if (payload.stage === 'title_abstract') {
    invalidateTitleAbstractQueueCache();
  }

  const [record] = await mapRows([data as ScreeningRecordRow]);
  return record;
};

export const updateScreeningAiSuggestion = async (
  id: string,
  update: {
    status: 'completed' | 'failed';
    suggestedDecision?: ScreeningDecision | null;
    reason?: string | null;
    evidenceQuote?: string | null;
    sourceLocation?: string | null;
    confidence?: number | null;
    model?: string | null;
    criteriaVersion?: string | null;
    rawResponse?: unknown;
    error?: string | null;
  },
): Promise<ScreeningRecord> => {
  const payload: ScreeningRecordUpdate = {
    ai_status: update.status,
    ai_suggested_decision: update.suggestedDecision ?? null,
    ai_reason: update.reason ?? null,
    ai_evidence_quote: update.evidenceQuote ?? null,
    ai_source_location: update.sourceLocation ?? null,
    ai_confidence: update.confidence ?? null,
    ai_model: update.model ?? null,
    ai_criteria_version: update.criteriaVersion ?? null,
    ai_raw_response: update.rawResponse ?? null,
    ai_error: update.error ?? null,
    ai_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient()
    .from('screening_records')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update AI screening suggestion: ${error?.message ?? 'Unknown error'}`);
  }

  if ((data as ScreeningRecordRow).stage === 'title_abstract') {
    invalidateTitleAbstractQueueCache();
  }

  let [record] = await mapRows([data as ScreeningRecordRow]);
  record = await maybePersistMentalHealthTag(record);
  if (record.stage === 'title_abstract' && update.status === 'completed' && getTitleAbstractDecisions(record).length > 0) {
    const finalized = await finalizeTitleAbstractRecord(record, getTitleAbstractResolution(record), payload.ai_reviewed_at ?? undefined);
    return finalized.record;
  }
  return record;
};

export const updateScreeningRecordMetadata = async (
  id: string,
  metadata: Record<string, unknown>,
  updates: Partial<Pick<ScreeningRecordUpdate, 'manual_decision' | 'manual_reason' | 'manual_decided_by' | 'manual_decided_at' | 'promoted_paper_id' | 'promoted_by' | 'promoted_at' | 'notes'>> = {},
  expectedUpdatedAt?: string | null,
): Promise<ScreeningRecord> => {
  let query = supabaseClient()
    .from('screening_records')
    .update({
      ...updates,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (expectedUpdatedAt) {
    query = query.eq('updated_at', expectedUpdatedAt);
  }

  const { data, error } = await query
    .select('*')
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      expectedUpdatedAt && !data
        ? 'Screening record changed before the decision could be saved. Reload and try again.'
        : `Failed to update screening record: ${error?.message ?? 'Unknown error'}`,
    );
  }

  if ((data as ScreeningRecordRow).stage === 'title_abstract') {
    invalidateTitleAbstractQueueCache();
  }

  const [record] = await mapRows([data as ScreeningRecordRow]);
  return record;
};

const getTitleAbstractFinalDecisionEntry = (
  record: ScreeningRecord,
  resolution: TitleAbstractResolution,
) => {
  const decisions = getTitleAbstractDecisions(record);
  const resolverDecision = decisions.find((decision) => decision.action === 'resolver_decision');
  if (resolverDecision && resolution !== 'pending') return resolverDecision;
  return decisions.find((decision) => decision.action !== 'resolver_decision');
};

const getTitleAbstractManualDecision = (resolution: TitleAbstractResolution): ScreeningDecision | null =>
  resolution === 'ready_for_full_text'
    ? 'include'
    : resolution === 'excluded'
      ? 'exclude'
      : null;

const getTitleAbstractExclusionReason = (record: ScreeningRecord) => {
  const exclusionNotes = getTitleAbstractDecisions(record)
    .filter((decision) => decision.decision === 'exclude')
    .map((decision) => decision.note?.trim())
    .filter((note): note is string => Boolean(note));

  return Array.from(new Set(exclusionNotes)).join(' / ') || 'Excluded at title/abstract screening';
};

const finalizeTitleAbstractRecord = async (
  record: ScreeningRecord,
  resolution: TitleAbstractResolution = getTitleAbstractResolution(record),
  decidedAt: string = new Date().toISOString(),
): Promise<{ record: ScreeningRecord; duplicateWarnings: PromotionDuplicateWarning[] }> => {
  const finalDecisionEntry = getTitleAbstractFinalDecisionEntry(record, resolution);
  const manualDecision = getTitleAbstractManualDecision(resolution);
  const finalProfileId = finalDecisionEntry?.reviewerProfileId ?? record.manualDecidedBy ?? record.createdBy ?? null;

  const updated = await updateScreeningRecordMetadata(
    record.id,
    {
      ...getTitleAbstractMetadata(record),
      titleAbstractResolution: resolution,
    },
    {
      manual_decision: manualDecision,
      manual_reason: manualDecision === 'exclude' ? getTitleAbstractExclusionReason(record) : null,
      manual_decided_by: finalProfileId,
      manual_decided_at: finalDecisionEntry ? decidedAt : null,
    },
    record.updatedAt,
  );

  if (resolution === 'ready_for_full_text' && finalProfileId) {
    const promoted = await promoteTitleAbstractRecord(updated.id, finalProfileId);
    return {
      record: promoted.record,
      duplicateWarnings: promoted.duplicateWarnings,
    };
  }

  return { record: updated, duplicateWarnings: [] };
};

export const markScreeningAiRunning = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  const { error } = await supabaseClient()
    .from('screening_records')
    .update({ ai_status: 'running', ai_error: null, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to mark screening records as running: ${error.message}`);
  }
  invalidateTitleAbstractQueueCache();
};

export const saveScreeningDecision = async (
  id: string,
  input: {
    decision: ScreeningDecision;
    decisionAction?: FullTextDecisionAction;
    reason?: string | null;
    reviewerProfileId: string;
    reviewerName?: string | null;
  },
): Promise<{
  record: ScreeningRecord;
  duplicateWarnings: PromotionDuplicateWarning[];
  promotedPaperId?: string;
  promotionError?: string;
}> => {
  if (input.decision === 'exclude' && !input.reason?.trim()) {
    throw new Error('A reason is required for excluded full-text records.');
  }

  const trimmedReason = input.reason?.trim() || null;
  if (trimmedReason && trimmedReason.length > MAX_EXCLUSION_REASON_CHARS) {
    throw new Error(`Exclusion reason must be ${MAX_EXCLUSION_REASON_CHARS} characters or fewer.`);
  }

  const existingRecord = await getScreeningRecord(id);
  if (!existingRecord) {
    throw new Error('Screening record not found.');
  }
  if (existingRecord.stage !== 'full_text') {
    throw new Error('This decision endpoint is only available for full-text records.');
  }
  if (isAwaitingFullTextPdf(existingRecord)) {
    throw new Error('Attach the full-text PDF before recording full-text screening decisions.');
  }

  const { data, error } = await supabaseClient().rpc('save_screening_vote', {
    p_record_id: id,
    p_reviewer_profile_id: input.reviewerProfileId,
    p_reviewer_name: input.reviewerName ?? null,
    p_decision: input.decision,
    p_decision_action: input.decisionAction ?? 'reviewer_vote',
    p_reason: trimmedReason,
  });

  if (error || !data) {
    throw new Error(`Failed to save screening decision: ${error?.message ?? 'Unknown error'}`);
  }

  let [record] = await mapRows([data as ScreeningRecordRow]);
  record = await maybePersistMentalHealthTag(record);
  if (getScreeningResolution(record) !== 'ready_for_extraction') {
    return { record, duplicateWarnings: [] };
  }

  try {
    const promoted = await promoteScreeningRecord(record.id, input.reviewerProfileId);
    return {
      record: promoted.record,
      duplicateWarnings: promoted.duplicateWarnings,
      promotedPaperId: promoted.paperId,
    };
  } catch (error) {
    return {
      record,
      duplicateWarnings: await findExtractionPromotionWarnings(record),
      promotionError: error instanceof Error ? error.message : 'Automatic promotion failed.',
    };
  }
};

export const saveTitleAbstractDecision = async (
  id: string,
  input: {
    decision: TitleAbstractDecision;
    decisionAction?: TitleAbstractDecisionAction;
    note?: string | null;
    reviewerProfileId: string;
    reviewerName?: string | null;
  },
): Promise<{ record: ScreeningRecord; duplicateWarnings: PromotionDuplicateWarning[] }> => {
  if (input.decision === 'flag' && !input.note?.trim()) {
    throw new Error('A note is required when flagging a title/abstract record.');
  }
  if (input.note && input.note.trim().length > MAX_EXCLUSION_REASON_CHARS) {
    throw new Error(`Decision note must be ${MAX_EXCLUSION_REASON_CHARS} characters or fewer.`);
  }

  const record = await getScreeningRecord(id);
  if (!record) {
    throw new Error('Screening record not found.');
  }
  if (record.stage !== 'title_abstract') {
    throw new Error('This decision endpoint is only available for title/abstract records.');
  }
  if (getTitleAbstractMetadata(record).titleAbstractPromotedRecordId) {
    throw new Error('This title/abstract record has already moved to full-text screening.');
  }
  if (hasActiveTitleAbstractOfflineReservation(record)) {
    throw new Error('This title/abstract record is reserved for offline screening. Import or release the offline pack before recording an online decision.');
  }

  const next = applyTitleAbstractDecision(record, {
    reviewerProfileId: input.reviewerProfileId,
    reviewerName: input.reviewerName,
    decision: input.decision,
    action: input.decisionAction,
    note: input.note,
  });

  const shadowRecord: ScreeningRecord = {
    ...record,
    metadata: {
      ...getTitleAbstractMetadata(record),
      titleAbstractDecisions: next.decisions,
    },
  };
  return finalizeTitleAbstractRecord(shadowRecord, next.resolution, next.updatedAt);
};

export const promoteTitleAbstractRecord = async (
  id: string,
  profileId: string,
): Promise<{ record: ScreeningRecord; fullTextRecordId: string; duplicateWarnings: PromotionDuplicateWarning[] }> => {
  const record = await getScreeningRecord(id);
  if (!record) {
    throw new Error('Screening record not found');
  }
  if (record.stage !== 'title_abstract') {
    throw new Error('Only title/abstract records can be promoted to full-text screening.');
  }
  const metadata = getTitleAbstractMetadata(record);
  if (metadata.titleAbstractPromotedRecordId && typeof metadata.titleAbstractPromotedRecordId === 'string') {
    return { record, fullTextRecordId: metadata.titleAbstractPromotedRecordId, duplicateWarnings: [] };
  }
  if (metadata.titleAbstractResolution !== 'ready_for_full_text' && record.manualDecision !== 'include') {
    throw new Error('Only included title/abstract records can be promoted.');
  }

  const duplicateWarnings = await findFullTextPromotionWarnings(record);
  const fullTextRecord = await createScreeningRecord({
    stage: 'full_text',
    assignedStudyId: record.assignedStudyId,
    title: record.title,
    abstract: record.abstract,
    leadAuthor: record.leadAuthor,
    journal: record.journal,
    year: record.year,
    doi: record.doi,
    sourceLabel: record.sourceLabel ?? 'title-abstract-screening',
    sourceRecordId: record.sourceRecordId,
    dataBase64: AWAITING_FULL_TEXT_PDF_SENTINEL,
    fileName: null,
    originalFileName: null,
    mimeType: null,
    size: null,
    createdBy: profileId,
    metadata: {
      ...record.metadata,
      titleAbstractRecordId: record.id,
      titleAbstractStudyId: record.assignedStudyId,
      titleAbstractPromotedAt: new Date().toISOString(),
      titleAbstractPromotedBy: profileId,
      awaitingFullTextPdf: true,
    },
  });

  const updated = await updateScreeningRecordMetadata(record.id, {
    ...metadata,
    titleAbstractPromotedRecordId: fullTextRecord.id,
    titleAbstractPromotedAt: new Date().toISOString(),
    titleAbstractPromotedBy: profileId,
  });

  return { record: updated, fullTextRecordId: fullTextRecord.id, duplicateWarnings };
};

export const attachFullTextPdfToScreeningRecord = async (
  id: string,
  input: {
    buffer: Buffer;
    fileName: string;
    mimeType?: string | null;
    size: number;
    profileId: string;
  },
): Promise<ScreeningRecord> => {
  const record = await getScreeningRecord(id);
  if (!record) {
    throw new Error('Screening record not found');
  }
  if (record.stage !== 'full_text') {
    throw new Error('PDF files can only be attached to full-text screening records.');
  }
  const metadata = record.metadata ?? {};
  if (metadata.awaitingFullTextPdf !== true && (record.storageObjectPath || record.dataBase64)) {
    throw new Error('This full-text screening record already has a PDF.');
  }

  const fileSha256 = computeFileSha256(input.buffer);
  const [existingScreening, existingPapers] = await Promise.all([
    listScreeningRecords('full_text'),
    supabaseClient().from('papers').select('id, assigned_study_id, title, primary_file_sha256'),
  ]);

  const existingScreeningMatch = existingScreening.find((candidate) => candidate.id !== id && candidate.fileSha256 === fileSha256);
  if (existingScreeningMatch) {
    throw new Error(`Duplicate screening PDF detected in ${existingScreeningMatch.assignedStudyId}.`);
  }
  if (existingPapers.error) {
    throw new Error(`Failed to check extraction duplicates: ${existingPapers.error.message}`);
  }
  const existingPaperMatch = (existingPapers.data ?? []).find((paper) => paper.primary_file_sha256 === fileSha256);
  if (existingPaperMatch) {
    throw new Error(`PDF already exists in extraction as ${existingPaperMatch.assigned_study_id}.`);
  }

  const storageInfo = await uploadFileToStorage(input.buffer, input.fileName, 'papers');
  const now = new Date().toISOString();
  const { data, error } = await supabaseClient()
    .from('screening_records')
    .update({
      storage_bucket: storageInfo.storageBucket,
      storage_object_path: storageInfo.storageObjectPath,
      data_base64: null,
      file_name: input.fileName,
      original_file_name: input.fileName,
      mime_type: input.mimeType || 'application/pdf',
      size: input.size,
      file_sha256: fileSha256,
      metadata: {
        ...metadata,
        awaitingFullTextPdf: false,
        fullTextPdfAttachedAt: now,
        fullTextPdfAttachedBy: input.profileId,
      },
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to attach full-text PDF: ${error?.message ?? 'Unknown error'}`);
  }

  const [updated] = await mapRows([data as ScreeningRecordRow]);
  return updated;
};

export const promoteScreeningRecord = async (
  id: string,
  profileId: string,
): Promise<{ record: ScreeningRecord; paperId: string; duplicateWarnings: PromotionDuplicateWarning[] }> => {
  const record = await getScreeningRecord(id);
  if (!record) {
    throw new Error('Screening record not found');
  }
  if (record.manualDecision !== 'include') {
    throw new Error('Only manually included screening records can be promoted.');
  }
  if (isAwaitingFullTextPdf(record) || (!record.storageObjectPath && !record.dataBase64)) {
    throw new Error('Attach the full-text PDF before promoting this record to extraction.');
  }
  if (record.promotedPaperId) {
    return { record, paperId: record.promotedPaperId, duplicateWarnings: [] };
  }

  const duplicateWarnings = await findExtractionPromotionWarnings(record);
  const mentalHealthRecord = await maybePersistMentalHealthTag(record);
  const shouldTagMentalHealth = isMentalHealthScreeningRecord(mentalHealthRecord);
  const screeningMetadata = shouldTagMentalHealth
    ? addMentalHealthTag(mentalHealthRecord.metadata)
    : mentalHealthRecord.metadata;

  const { data: existingPaper, error: existingPaperError } = await supabaseClient()
    .from('papers')
    .select('id, status, metadata')
    .eq('assigned_study_id', mentalHealthRecord.assignedStudyId)
    .maybeSingle();

  if (existingPaperError) {
    throw new Error(`Failed to check existing promoted paper: ${existingPaperError.message}`);
  }

  const paper = existingPaper
    ? { id: existingPaper.id }
    : await createPaper({
        title: mentalHealthRecord.title,
        extractedTitle: mentalHealthRecord.title,
        leadAuthor: mentalHealthRecord.leadAuthor ?? undefined,
        year: mentalHealthRecord.year ?? undefined,
        journal: mentalHealthRecord.journal ?? undefined,
        doi: mentalHealthRecord.doi ?? undefined,
        normalizedDoi: mentalHealthRecord.normalizedDoi ?? undefined,
        status: shouldTagMentalHealth ? 'mental_health' : 'uploaded',
        primaryFileSha256: mentalHealthRecord.fileSha256 ?? undefined,
        originalFileName: mentalHealthRecord.originalFileName ?? mentalHealthRecord.fileName ?? undefined,
        uploadedBy: mentalHealthRecord.createdBy ?? profileId,
        assignedStudyId: mentalHealthRecord.assignedStudyId,
        metadata: {
          ...screeningMetadata,
          screeningRecordId: mentalHealthRecord.id,
          screeningStage: mentalHealthRecord.stage,
          screeningDecision: mentalHealthRecord.manualDecision,
          screeningDecisionReason: mentalHealthRecord.manualReason,
          screeningPromotedAt: new Date().toISOString(),
        },
      });

  if (existingPaper) {
    const nextMetadata = shouldTagMentalHealth
      ? addMentalHealthTag((existingPaper.metadata as Record<string, unknown> | null | undefined) ?? {})
      : ((existingPaper.metadata as Record<string, unknown> | null | undefined) ?? {});
    const nextStatus = shouldTagMentalHealth ? MENTAL_HEALTH_TAG : existingPaper.status;
    await updatePaper(existingPaper.id, {
      status: nextStatus,
      metadata: {
        ...nextMetadata,
        screeningRecordId: mentalHealthRecord.id,
        screeningStage: mentalHealthRecord.stage,
        screeningDecision: mentalHealthRecord.manualDecision,
        screeningDecisionReason: mentalHealthRecord.manualReason,
        screeningPromotedAt: new Date().toISOString(),
      },
    });
  }

  if (!existingPaper && mentalHealthRecord.fileName && mentalHealthRecord.size && mentalHealthRecord.mimeType) {
    const storedFile = await attachFile({
      paperId: paper.id,
      name: mentalHealthRecord.fileName,
      originalFileName: mentalHealthRecord.originalFileName ?? mentalHealthRecord.fileName,
      size: mentalHealthRecord.size,
      mimeType: mentalHealthRecord.mimeType,
      dataBase64: mentalHealthRecord.dataBase64,
      storageBucket: mentalHealthRecord.storageBucket,
      storageObjectPath: mentalHealthRecord.storageObjectPath,
      fileSha256: mentalHealthRecord.fileSha256 ?? undefined,
    });

    await updatePaper(paper.id, {
      primaryFileId: storedFile.id,
      storageBucket: storedFile.storageBucket,
      storageObjectPath: storedFile.storageObjectPath,
    });
  }

  const { data, error } = await supabaseClient()
    .from('screening_records')
    .update({
      metadata: screeningMetadata,
      promoted_paper_id: paper.id,
      promoted_by: profileId,
      promoted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Paper was created, but screening promotion audit update failed: ${error?.message ?? 'Unknown error'}`);
  }

  const [updatedRecord] = await mapRows([data as ScreeningRecordRow]);
  return { record: updatedRecord, paperId: paper.id, duplicateWarnings };
};
