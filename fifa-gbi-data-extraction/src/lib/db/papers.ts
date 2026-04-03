import crypto from 'node:crypto';

import { mapPaperRow } from '@/lib/db/mappers';
import {
  PaperSessionConflictError,
  chunkValues,
  normalizePaperMetadata,
  setActiveSessionMetadata,
  supabaseClient,
} from '@/lib/db/shared';
import type { Paper, PaperSession, PaperStatus, DedupeReviewStatus } from '@/lib/types';
import type { PaperInsert, PaperRow, PaperUpdate } from '@/lib/db/types';
import { generateDuplicateKeyV2, generateTitleFingerprint, normalizeDoi } from '@/lib/dedupe';

const BATCHED_IN_QUERY_SIZE = 100;

const parseStudySequence = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const match = /^S(\d+)$/i.exec(value.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
};

const generateAssignedStudyId = async (): Promise<string> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('papers')
    .select('assigned_study_id')
    .order('assigned_study_id', { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to compute next Study ID: ${error.message}`);
  }

  const maxSequence = (data ?? []).reduce((max, row) => {
    const seq = parseStudySequence(row.assigned_study_id);
    return seq > max ? seq : max;
  }, 0);

  return `S${String(maxSequence + 1).padStart(3, '0')}`;
};

export const listPapers = async (): Promise<Paper[]> => {
  const supabase = supabaseClient();
  const { data: paperRows, error } = await supabase.from('papers').select('*').order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list papers: ${error.message}`);
  }

  const rows = (paperRows ?? []) as PaperRow[];
  const ids = rows.map((row) => row.id);
  const noteCounts = new Map<string, number>();
  const assigneeNames = new Map<string, string>();

  if (ids.length > 0) {
    for (const batchIds of chunkValues(ids, BATCHED_IN_QUERY_SIZE)) {
      const { data: noteRows, error: notesError } = await supabase
        .from('paper_notes')
        .select('paper_id')
        .in('paper_id', batchIds);

      if (notesError) {
        throw new Error(`Failed to load note counts: ${notesError.message}`);
      }

      (noteRows ?? []).forEach((row) => {
        const current = noteCounts.get(row.paper_id) ?? 0;
        noteCounts.set(row.paper_id, current + 1);
      });
    }

    const assignedToIds = Array.from(
      new Set(rows.map((row) => row.assigned_to).filter((id): id is string => id !== null)),
    );
    if (assignedToIds.length > 0) {
      for (const batchIds of chunkValues(assignedToIds, BATCHED_IN_QUERY_SIZE)) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', batchIds);

        if (!profilesError && profiles) {
          profiles.forEach((profile) => {
            assigneeNames.set(profile.id, profile.full_name);
          });
        }
      }
    }
  }

  return rows.map((row) => {
    const paper = mapPaperRow(row, noteCounts.get(row.id) ?? 0);
    if (row.assigned_to && assigneeNames.has(row.assigned_to)) {
      paper.assigneeName = assigneeNames.get(row.assigned_to);
    }
    return paper;
  });
};

export const getPaper = async (id: string): Promise<Paper | undefined> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase.from('papers').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load paper ${id}: ${error.message}`);
  }

  if (!data) {
    return undefined;
  }

  const { data: noteRows } = await supabase.from('paper_notes').select('paper_id').eq('paper_id', id);
  const noteCount = noteRows?.length ?? 0;

  const row = data as PaperRow;
  const paper = mapPaperRow(row, noteCount);

  if (row.assigned_to) {
    const { data: assigneeProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', row.assigned_to)
      .maybeSingle();

    if (assigneeProfile) {
      paper.assigneeName = assigneeProfile.full_name;
    }
  }

  return paper;
};

export const createPaper = async (input: {
  title: string;
  extractedTitle?: string | null;
  leadAuthor?: string | null;
  year?: string | null;
  journal?: string | null;
  doi?: string | null;
  normalizedDoi?: string | null;
  duplicateKeyV2?: string | null;
  titleFingerprint?: string | null;
  dedupeReviewStatus?: DedupeReviewStatus;
  primaryFileSha256?: string | null;
  originalFileName?: string | null;
  status?: PaperStatus;
  metadata?: Record<string, unknown>;
  uploadedBy?: string | null;
}): Promise<Paper> => {
  const extractedTitle = input.extractedTitle ?? input.title;
  const normalizedDoi = input.normalizedDoi ?? normalizeDoi(input.doi);
  const normalizedDoiValue = normalizedDoi && normalizedDoi.length > 0 ? normalizedDoi : null;
  const duplicateKeyV2 = input.duplicateKeyV2 ?? generateDuplicateKeyV2(extractedTitle, input.leadAuthor, input.year);
  const titleFingerprint = input.titleFingerprint ?? generateTitleFingerprint(extractedTitle);
  const dedupeReviewStatus: DedupeReviewStatus = input.dedupeReviewStatus ?? 'clean';

  const supabase = supabaseClient();
  const assignedId = await generateAssignedStudyId();
  const payload: PaperInsert = {
    id: crypto.randomUUID(),
    assigned_study_id: assignedId,
    title: input.title,
    extracted_title: extractedTitle,
    lead_author: input.leadAuthor ?? null,
    journal: input.journal ?? null,
    year: input.year ?? null,
    doi: input.doi ?? null,
    normalized_doi: normalizedDoiValue,
    duplicate_key_v2: duplicateKeyV2 ?? null,
    title_fingerprint: titleFingerprint ?? null,
    dedupe_review_status: dedupeReviewStatus,
    primary_file_sha256: input.primaryFileSha256 ?? null,
    original_file_name: input.originalFileName ?? null,
    status: input.status ?? 'uploaded',
    storage_bucket: 'papers',
    uploaded_by: input.uploadedBy ?? null,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase.from('papers').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to create paper: ${error?.message ?? 'Unknown error'}`);
  }

  return mapPaperRow(data as PaperRow);
};

export const updatePaper = async (
  id: string,
  updates: Partial<Omit<Paper, 'id' | 'assignedStudyId' | 'createdAt'>>,
): Promise<Paper | undefined> => {
  const existing = await getPaper(id);

  if (!existing) {
    return undefined;
  }

  const nextTitle = updates.title ?? existing.title;
  const nextExtractedTitle = updates.extractedTitle ?? existing.extractedTitle ?? nextTitle;
  const nextLeadAuthor = updates.leadAuthor ?? existing.leadAuthor ?? null;
  const nextYear = updates.year ?? existing.year ?? null;
  const nextDoi = updates.doi ?? existing.doi ?? null;
  const nextNormalizedDoi = updates.normalizedDoi ?? normalizeDoi(nextDoi);
  const nextNormalizedDoiValue = nextNormalizedDoi && nextNormalizedDoi.length > 0 ? nextNormalizedDoi : null;
  const nextDuplicateKeyV2 =
    updates.duplicateKeyV2 ??
    generateDuplicateKeyV2(
      nextExtractedTitle ?? nextTitle,
      nextLeadAuthor,
      nextYear,
    );
  const nextTitleFingerprint = updates.titleFingerprint ?? generateTitleFingerprint(nextExtractedTitle ?? nextTitle);
  const nextDedupeReviewStatus = updates.dedupeReviewStatus ?? existing.dedupeReviewStatus ?? 'clean';
  const nextPrimaryFileSha256 = updates.primaryFileSha256 ?? existing.primaryFileSha256 ?? null;
  const nextOriginalFileName = updates.originalFileName ?? existing.originalFileName ?? null;

  const supabase = supabaseClient();
  const payload: PaperUpdate = {
    title: nextTitle,
    extracted_title: nextExtractedTitle ?? null,
    lead_author: nextLeadAuthor,
    journal: updates.journal ?? existing.journal ?? null,
    year: nextYear,
    doi: nextDoi,
    normalized_doi: nextNormalizedDoiValue,
    duplicate_key_v2: nextDuplicateKeyV2,
    title_fingerprint: nextTitleFingerprint,
    dedupe_review_status: nextDedupeReviewStatus,
    primary_file_sha256: nextPrimaryFileSha256,
    original_file_name: nextOriginalFileName,
    status: updates.status as PaperStatus | undefined,
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.storageBucket === 'string') {
    payload.storage_bucket = updates.storageBucket;
  }
  if (updates.storageObjectPath !== undefined) {
    payload.storage_object_path = updates.storageObjectPath;
  }
  if (updates.primaryFileId !== undefined) {
    payload.primary_file_id = updates.primaryFileId;
  }
  if (updates.flagReason !== undefined) {
    payload.flag_reason = updates.flagReason;
  }
  if (updates.metadata !== undefined) {
    payload.metadata = updates.metadata;
  }

  const { error } = await supabase.from('papers').update(payload).eq('id', id);

  if (error) {
    throw new Error(`Failed to update paper: ${error.message}`);
  }

  return getPaper(id);
};

export const deletePaper = async (id: string): Promise<void> => {
  const supabase = supabaseClient();

  const { data: extractions, error: extractionsError } = await supabase
    .from('extractions')
    .select('id')
    .eq('paper_id', id);

  if (extractionsError) {
    throw new Error(`Failed to fetch extractions for deletion: ${extractionsError.message}`);
  }

  const extractionIds = (extractions ?? []).map((e) => e.id);

  if (extractionIds.length > 0) {
    const { error: fieldsError } = await supabase
      .from('extraction_fields')
      .delete()
      .in('extraction_id', extractionIds);
    if (fieldsError) {
      throw new Error(`Failed to delete extraction fields: ${fieldsError.message}`);
    }
  }

  const { error: extractionsDeleteError } = await supabase
    .from('extractions')
    .delete()
    .eq('paper_id', id);
  if (extractionsDeleteError) {
    throw new Error(`Failed to delete extractions: ${extractionsDeleteError.message}`);
  }

  const { error: popValuesError } = await supabase
    .from('population_values')
    .delete()
    .eq('paper_id', id);
  if (popValuesError) {
    throw new Error(`Failed to delete population values: ${popValuesError.message}`);
  }

  const { error: popGroupsError } = await supabase
    .from('population_groups')
    .delete()
    .eq('paper_id', id);
  if (popGroupsError) {
    throw new Error(`Failed to delete population groups: ${popGroupsError.message}`);
  }

  const { error: notesError } = await supabase
    .from('paper_notes')
    .delete()
    .eq('paper_id', id);
  if (notesError) {
    throw new Error(`Failed to delete paper notes: ${notesError.message}`);
  }

  const { error: filesError } = await supabase
    .from('paper_files')
    .delete()
    .eq('paper_id', id);
  if (filesError) {
    throw new Error(`Failed to delete paper files: ${filesError.message}`);
  }

  const { error } = await supabase.from('papers').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete paper: ${error.message}`);
  }
};

export const toggleFlag = async (paperId: string, reason: string | null) => {
  const paper = await getPaper(paperId);
  if (!paper) {
    throw new Error(`Paper ${paperId} not found`);
  }

  const nextReason = paper.flagReason ? null : reason;
  const nextStatus: PaperStatus = nextReason ? 'flagged' : 'uploaded';

  await updatePaper(paperId, { flagReason: nextReason, status: nextStatus });
};

export const startPaperSession = async (
  paperId: string,
  input: { profileId: string; fullName: string; isAdmin?: boolean },
): Promise<PaperSession> => {
  const paper = await getPaper(paperId);

  if (!paper) {
    throw new Error(`Paper ${paperId} not found`);
  }

  const isAdmin = input.isAdmin ?? false;
  const assignedTo = paper.assignedTo;
  const isAssignedToOther = Boolean(assignedTo && assignedTo !== input.profileId);

  if (isAssignedToOther && !isAdmin && assignedTo) {
    const supabase = supabaseClient();
    const { data: assigneeProfile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', assignedTo)
      .maybeSingle();

    const conflictSession: PaperSession = {
      paperId,
      profileId: assignedTo,
      fullName: assigneeProfile?.full_name ?? 'Another user',
      startedAt: paper.activeSession?.startedAt ?? paper.updatedAt,
      lastHeartbeatAt: paper.activeSession?.lastHeartbeatAt ?? paper.updatedAt,
    };

    throw new PaperSessionConflictError(
      conflictSession,
      `This paper is currently assigned to ${assigneeProfile?.full_name ?? 'another user'}. Please choose a different paper.`,
    );
  }

  const now = new Date().toISOString();
  const existing = paper.activeSession;
  const session: PaperSession = {
    paperId,
    profileId: input.profileId,
    fullName: input.fullName,
    startedAt: existing?.startedAt ?? now,
    lastHeartbeatAt: now,
  };

  const metadata = setActiveSessionMetadata(normalizePaperMetadata(paper.metadata), session);

  const supabase = supabaseClient();

  if (isAssignedToOther && isAdmin) {
    const { error } = await supabase
      .from('papers')
      .update({
        metadata,
        updated_at: now,
      })
      .eq('id', paperId);

    if (error) {
      throw new Error(`Failed to start paper session: ${error.message}`);
    }

    return session;
  }

  const updateQuery = supabase
    .from('papers')
    .update({
      assigned_to: input.profileId,
      metadata,
      updated_at: now,
    })
    .eq('id', paperId);

  if (paper.assignedTo) {
    updateQuery.eq('assigned_to', paper.assignedTo);
  } else {
    updateQuery.is('assigned_to', null);
  }

  const { data: updatedRow, error } = await updateQuery.select('assigned_to').maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to start paper session: ${error.message}`);
  }

  if (!updatedRow) {
    const latest = await getPaper(paperId);
    if (latest?.assignedTo && latest.assignedTo !== input.profileId) {
      const conflict: PaperSession = {
        paperId,
        profileId: latest.assignedTo,
        fullName: latest.assigneeName ?? 'Another user',
        startedAt: latest.activeSession?.startedAt ?? latest.updatedAt,
        lastHeartbeatAt: latest.activeSession?.lastHeartbeatAt ?? latest.updatedAt,
      };
      throw new PaperSessionConflictError(conflict, 'Another teammate claimed this paper moments ago.');
    }
    throw new Error('Failed to start paper session due to a concurrent update. Please retry.');
  }

  return session;
};

export const heartbeatPaperSession = async (paperId: string, profileId: string): Promise<PaperSession> => {
  const paper = await getPaper(paperId);

  if (!paper) {
    throw new Error(`Paper ${paperId} not found`);
  }

  if (!paper.assignedTo || paper.assignedTo !== profileId) {
    throw new Error(`No active session for paper ${paperId} or session belongs to different user`);
  }

  const existing = paper.activeSession;
  if (!existing) {
    throw new Error(`No active session metadata for paper ${paperId}`);
  }

  const now = new Date().toISOString();
  const session: PaperSession = {
    ...existing,
    lastHeartbeatAt: now,
  };

  const metadata = setActiveSessionMetadata(normalizePaperMetadata(paper.metadata), session);

  const supabase = supabaseClient();
  const { error } = await supabase
    .from('papers')
    .update({
      metadata,
      updated_at: now,
    })
    .eq('id', paperId)
    .eq('assigned_to', profileId);

  if (error) {
    throw new Error(`Failed to extend paper session: ${error.message}`);
  }

  return session;
};

export const endPaperSession = async (paperId: string, profileId: string): Promise<void> => {
  const paper = await getPaper(paperId);

  if (!paper) {
    throw new Error(`Paper ${paperId} not found`);
  }

  if (!paper.assignedTo || paper.assignedTo !== profileId) {
    return;
  }

  const metadata = setActiveSessionMetadata(normalizePaperMetadata(paper.metadata), null);

  const supabase = supabaseClient();
  const { error } = await supabase
    .from('papers')
    .update({
      assigned_to: null,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paperId)
    .eq('assigned_to', profileId);

  if (error) {
    throw new Error(`Failed to end paper session: ${error.message}`);
  }
};
