import crypto from 'node:crypto';

import { mapScreeningRecordRow } from '@/lib/db/mappers';
import { generateAssignedStudyId } from '@/lib/db/study-ids';
import { supabaseClient } from '@/lib/db/shared';
import { createPaper, updatePaper } from '@/lib/db/papers';
import { attachFile } from '@/lib/db/files';
import { generateDuplicateKeyV2, generateTitleFingerprint, normalizeDoi } from '@/lib/dedupe';
import { getReviewerDecisions, getScreeningResolution } from '@/lib/screening/reviewer-decisions';
import type { ScreeningRecordInsert, ScreeningRecordRow, ScreeningRecordUpdate } from '@/lib/db/types';
import type { ScreeningDecision, ScreeningRecord, ScreeningStage } from '@/lib/types';

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
  input: { decision: ScreeningDecision; reason?: string | null; reviewerProfileId: string; reviewerName?: string | null },
): Promise<ScreeningRecord> => {
  if (input.decision === 'exclude' && !input.reason?.trim()) {
    throw new Error('A reason is required for excluded full-text records.');
  }

  const existingRecord = await getScreeningRecord(id);
  if (!existingRecord) {
    throw new Error('Screening record not found');
  }

  const decidedAt = new Date().toISOString();
  const existingDecisions = getReviewerDecisions(existingRecord);
  const firstTwo = existingDecisions.slice(0, 2);
  const hasConflict =
    firstTwo.length === 2 &&
    firstTwo[0]?.decision !== firstTwo[1]?.decision;
  const thirdDecision = existingDecisions[2];

  const nextDecision = {
    reviewerProfileId: input.reviewerProfileId,
    reviewerName: input.reviewerName ?? null,
    decision: input.decision,
    reason: input.reason?.trim() || null,
    decidedAt,
  };

  const isFirstTwoReviewer = firstTwo.some((decision) => decision.reviewerProfileId === input.reviewerProfileId);
  const isConsensusReviewer = thirdDecision?.reviewerProfileId === input.reviewerProfileId;

  let decisions = firstTwo;
  if (hasConflict && !thirdDecision) {
    decisions = [...firstTwo, nextDecision];
  } else if (hasConflict && thirdDecision && isConsensusReviewer) {
    decisions = [...firstTwo, nextDecision];
  } else if (isFirstTwoReviewer) {
    const updatedFirstTwo = firstTwo.map((decision) =>
      decision.reviewerProfileId === input.reviewerProfileId ? nextDecision : decision,
    );
    const stillConflicted = updatedFirstTwo.length === 2 && updatedFirstTwo[0]?.decision !== updatedFirstTwo[1]?.decision;
    decisions = stillConflicted && thirdDecision ? [...updatedFirstTwo, thirdDecision] : updatedFirstTwo;
  } else if (firstTwo.length < 2) {
    decisions = [...firstTwo, nextDecision];
  } else {
    throw new Error('This record already has two reviewer decisions. Update an existing decision or resolve a conflict.');
  }

  const metadataBefore = existingRecord.metadata as Record<string, unknown> | null;
  const previousAudit = Array.isArray(metadataBefore?.fullTextDecisionAudit)
    ? metadataBefore.fullTextDecisionAudit
    : [];
  const resolutionBefore = getScreeningResolution(existingRecord);
  const isConsensusDecision = hasConflict && (!thirdDecision || isConsensusReviewer);
  const action = isConsensusDecision
    ? thirdDecision
      ? 'updated_consensus_resolution'
      : 'consensus_resolution'
    : isFirstTwoReviewer
      ? 'updated_vote'
      : 'initial_vote';

  const metadata: Record<string, unknown> = {
    ...(existingRecord.metadata ?? {}),
    fullTextDecisions: decisions,
    fullTextDecisionAudit: [
      ...previousAudit,
      {
        ...nextDecision,
        action,
        resolutionBefore,
      },
    ],
  };
  const statusRecord = { ...existingRecord, metadata } satisfies ScreeningRecord;
  const resolution = getScreeningResolution(statusRecord);
  metadata.fullTextResolution = resolution;

  const concordantExcludeReasons = decisions
    .filter((decision) => decision.decision === 'exclude')
    .map((decision) => decision.reason?.trim())
    .filter((reason): reason is string => Boolean(reason));

  const manualDecision =
    resolution === 'ready_for_extraction'
      ? 'include'
      : resolution === 'excluded'
        ? 'exclude'
        : null;

  const { data, error } = await supabaseClient()
    .from('screening_records')
    .update({
      manual_decision: manualDecision,
      manual_reason: resolution === 'excluded' ? Array.from(new Set(concordantExcludeReasons)).join(' / ') : null,
      manual_decided_by: input.reviewerProfileId,
      manual_decided_at: decidedAt,
      metadata,
      updated_at: decidedAt,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to save screening decision: ${error?.message ?? 'Unknown error'}`);
  }

  const [record] = await mapRows([data as ScreeningRecordRow]);
  return record;
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
