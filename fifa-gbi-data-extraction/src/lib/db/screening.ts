import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

import { mapScreeningRecordRow } from '@/lib/db/mappers';
import { generateAssignedStudyId } from '@/lib/db/study-ids';
import { supabaseClient } from '@/lib/db/shared';
import { createPaper, updatePaper } from '@/lib/db/papers';
import { attachFile } from '@/lib/db/files';
import { generateDuplicateKeyV2, generateTitleFingerprint, normalizeDoi } from '@/lib/dedupe';
import { MAX_EXCLUSION_REASON_CHARS, type FullTextDecisionAction } from '@/lib/screening/reviewer-decisions';
import type { ScreeningRecordInsert, ScreeningRecordRow, ScreeningRecordUpdate } from '@/lib/db/types';
import type { ScreeningDecision, ScreeningRecord, ScreeningStage } from '@/lib/types';
import {
  applyTitleAbstractDecision,
  getTitleAbstractMetadata,
  type TitleAbstractDecision,
  type TitleAbstractDecisionAction,
} from '@/lib/screening/title-abstract-decisions';

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
): Promise<ScreeningRecord> => {
  if (input.decision === 'exclude' && !input.reason?.trim()) {
    throw new Error('A reason is required for excluded full-text records.');
  }

  const trimmedReason = input.reason?.trim() || null;
  if (trimmedReason && trimmedReason.length > MAX_EXCLUSION_REASON_CHARS) {
    throw new Error(`Exclusion reason must be ${MAX_EXCLUSION_REASON_CHARS} characters or fewer.`);
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
  return record;
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
): Promise<ScreeningRecord> => {
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

  return updateScreeningRecordMetadata(
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
};

export const promoteTitleAbstractRecord = async (
  id: string,
  profileId: string,
): Promise<{ record: ScreeningRecord; fullTextRecordId: string }> => {
  const record = await getScreeningRecord(id);
  if (!record) {
    throw new Error('Screening record not found');
  }
  if (record.stage !== 'title_abstract') {
    throw new Error('Only title/abstract records can be promoted to full-text screening.');
  }
  const metadata = getTitleAbstractMetadata(record);
  if (metadata.titleAbstractPromotedRecordId && typeof metadata.titleAbstractPromotedRecordId === 'string') {
    return { record, fullTextRecordId: metadata.titleAbstractPromotedRecordId };
  }
  if (metadata.titleAbstractResolution !== 'ready_for_full_text' && record.manualDecision !== 'include') {
    throw new Error('Only included title/abstract records can be promoted.');
  }

  const placeholderPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  ).toString('base64');
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
    dataBase64: placeholderPdf,
    fileName: `${record.assignedStudyId}-awaiting-full-text.pdf`,
    originalFileName: null,
    mimeType: 'application/pdf',
    size: 0,
    createdBy: profileId,
    metadata: {
      ...record.metadata,
      titleAbstractRecordId: record.id,
      titleAbstractStudyId: record.assignedStudyId,
      awaitingFullTextPdf: true,
    },
  });

  const updated = await updateScreeningRecordMetadata(record.id, {
    ...metadata,
    titleAbstractPromotedRecordId: fullTextRecord.id,
    titleAbstractPromotedAt: new Date().toISOString(),
    titleAbstractPromotedBy: profileId,
  });

  return { record: updated, fullTextRecordId: fullTextRecord.id };
};

export const promoteScreeningRecord = async (
  id: string,
  profileId: string,
): Promise<{ record: ScreeningRecord; paperId: string }> => {
  const record = await getScreeningRecord(id);
  if (!record) {
    throw new Error('Screening record not found');
  }
  if (record.manualDecision !== 'include') {
    throw new Error('Only manually included screening records can be promoted.');
  }
  if (record.promotedPaperId) {
    return { record, paperId: record.promotedPaperId };
  }

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
  return { record: updatedRecord, paperId: paper.id };
};
