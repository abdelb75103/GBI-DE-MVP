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
import type { ScreeningRecordInsert, ScreeningRecordRow, ScreeningRecordUpdate } from '@/lib/db/types';
import type { Paper, ScreeningDecision, ScreeningRecord, ScreeningStage } from '@/lib/types';
import {
  applyTitleAbstractDecision,
  getTitleAbstractMetadata,
  type TitleAbstractDecision,
  type TitleAbstractDecisionAction,
} from '@/lib/screening/title-abstract-decisions';

const AWAITING_FULL_TEXT_PDF_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');

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

export type CreateScreeningRecordInput = {
  stage?: ScreeningStage;
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
  const { data, error } = await supabaseClient()
    .from('screening_records')
    .select('*')
    .eq('stage', stage)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list screening records. Apply the screening migration first: ${error.message}`);
  }

  return mapRows((data ?? []) as ScreeningRecordRow[]);
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
  const assignedStudyId = await generateAssignedStudyId();
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

  const [record] = await mapRows([data as ScreeningRecordRow]);
  return record;
};

export const updateScreeningRecordMetadata = async (
  id: string,
  metadata: Record<string, unknown>,
  updates: Partial<Pick<ScreeningRecordUpdate, 'manual_decision' | 'manual_reason' | 'manual_decided_by' | 'manual_decided_at' | 'promoted_paper_id' | 'promoted_by' | 'promoted_at'>> = {},
): Promise<ScreeningRecord> => {
  const { data, error } = await supabaseClient()
    .from('screening_records')
    .update({
      ...updates,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update screening record: ${error?.message ?? 'Unknown error'}`);
  }

  const [record] = await mapRows([data as ScreeningRecordRow]);
  return record;
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
): Promise<{ record: ScreeningRecord; duplicateWarnings: PromotionDuplicateWarning[] }> => {
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

  const [record] = await mapRows([data as ScreeningRecordRow]);
  const duplicateWarnings = getScreeningResolution(record) === 'ready_for_extraction'
    ? await findExtractionPromotionWarnings(record)
    : [];
  return { record, duplicateWarnings };
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

  const next = applyTitleAbstractDecision(record, {
    reviewerProfileId: input.reviewerProfileId,
    reviewerName: input.reviewerName,
    decision: input.decision,
    action: input.decisionAction,
    note: input.note,
  });

  const manualDecision = next.resolution === 'ready_for_full_text'
    ? 'include'
    : next.resolution === 'excluded'
      ? 'exclude'
      : null;
  const exclusionNotes = next.decisions
    .filter((decision) => decision.decision === 'exclude')
    .map((decision) => decision.note?.trim())
    .filter((note): note is string => Boolean(note));

  const updated = await updateScreeningRecordMetadata(
    id,
    {
      ...getTitleAbstractMetadata(record),
      titleAbstractDecisions: next.decisions,
      titleAbstractResolution: next.resolution,
    },
    {
      manual_decision: manualDecision,
      manual_reason: manualDecision === 'exclude' ? Array.from(new Set(exclusionNotes)).join(' / ') || 'Excluded at title/abstract screening' : null,
      manual_decided_by: input.reviewerProfileId,
      manual_decided_at: next.updatedAt,
    },
  );

  if (next.resolution === 'ready_for_full_text') {
    const promoted = await promoteTitleAbstractRecord(updated.id, input.reviewerProfileId);
    return {
      record: promoted.record,
      duplicateWarnings: promoted.duplicateWarnings,
    };
  }

  return { record: updated, duplicateWarnings: [] };
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

  const { data: existingPaper, error: existingPaperError } = await supabaseClient()
    .from('papers')
    .select('id')
    .eq('assigned_study_id', record.assignedStudyId)
    .maybeSingle();

  if (existingPaperError) {
    throw new Error(`Failed to check existing promoted paper: ${existingPaperError.message}`);
  }

  const paper = existingPaper
    ? { id: existingPaper.id }
    : await createPaper({
    title: record.title,
    extractedTitle: record.title,
    leadAuthor: record.leadAuthor ?? undefined,
    year: record.year ?? undefined,
    journal: record.journal ?? undefined,
    doi: record.doi ?? undefined,
    normalizedDoi: record.normalizedDoi ?? undefined,
    status: 'uploaded',
    primaryFileSha256: record.fileSha256 ?? undefined,
    originalFileName: record.originalFileName ?? record.fileName ?? undefined,
    uploadedBy: record.createdBy ?? profileId,
    assignedStudyId: record.assignedStudyId,
    metadata: {
      ...(record.metadata ?? {}),
      screeningRecordId: record.id,
      screeningStage: record.stage,
      screeningDecision: record.manualDecision,
      screeningDecisionReason: record.manualReason,
      screeningPromotedAt: new Date().toISOString(),
    },
  });

  if (!existingPaper && record.fileName && record.size && record.mimeType) {
    const storedFile = await attachFile({
      paperId: paper.id,
      name: record.fileName,
      originalFileName: record.originalFileName ?? record.fileName,
      size: record.size,
      mimeType: record.mimeType,
      dataBase64: record.dataBase64,
      storageBucket: record.storageBucket,
      storageObjectPath: record.storageObjectPath,
      fileSha256: record.fileSha256 ?? undefined,
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
