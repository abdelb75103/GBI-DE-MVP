import { supabaseClient } from '@/lib/db/shared';
import type { UploadQueueInsert, UploadQueueRow } from '@/lib/db/types';
import type { UploadQueueItem } from '@/lib/types';
import type { UploadQueueStatus } from '@/lib/supabase/types';

const mapQueueRow = (row: UploadQueueRow, profileNames: Map<string, string>): UploadQueueItem => {
  const createdByName = row.created_by ? profileNames.get(row.created_by) : undefined;
  const approvedByName = row.approved_by ? profileNames.get(row.approved_by) : undefined;

  return {
    id: row.id,
    status: row.status as UploadQueueStatus,
    title: row.title,
    extractedTitle: row.extracted_title ?? null,
    leadAuthor: row.lead_author ?? null,
    year: row.year ?? null,
    journal: row.journal ?? null,
    doi: row.doi ?? null,
    normalizedDoi: row.normalized_doi ?? null,
    duplicateKeyV2: row.duplicate_key_v2 ?? null,
    titleFingerprint: row.title_fingerprint ?? null,
    metadata: row.metadata ?? {},
    fileName: row.file_name,
    originalFileName: row.original_file_name ?? null,
    mimeType: row.mime_type,
    size: Number(row.size ?? 0),
    fileSha256: row.file_sha256 ?? null,
    storageBucket: row.storage_bucket ?? null,
    storageObjectPath: row.storage_object_path ?? null,
    dataBase64: row.data_base64 ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    createdByName,
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? null,
    approvedByName,
    paperId: row.paper_id ?? null,
  };
};

const loadProfileNames = async (ids: string[]): Promise<Map<string, string>> => {
  if (ids.length === 0) {
    return new Map();
  }

  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to load profile names: ${error.message}`);
  }

  const map = new Map<string, string>();
  (data ?? []).forEach((profile) => {
    if (profile.id && profile.full_name) {
      map.set(profile.id, profile.full_name);
    }
  });

  return map;
};

export type QueueUploadInput = {
  title: string;
  extractedTitle?: string | null;
  leadAuthor?: string | null;
  year?: string | null;
  journal?: string | null;
  doi?: string | null;
  normalizedDoi?: string | null;
  duplicateKeyV2?: string | null;
  titleFingerprint?: string | null;
  metadata?: Record<string, unknown>;
  storageBucket?: string | null;
  storageObjectPath?: string | null;
  dataBase64?: string | null;
  fileName: string;
  originalFileName?: string | null;
  mimeType: string;
  size: number;
  fileSha256?: string | null;
  createdBy?: string | null;
};

export const queueUpload = async (input: QueueUploadInput): Promise<UploadQueueItem> => {
  const supabase = supabaseClient();
  const payload: UploadQueueInsert = {
    title: input.title,
    extracted_title: input.extractedTitle ?? input.title,
    lead_author: input.leadAuthor ?? null,
    journal: input.journal ?? null,
    year: input.year ?? null,
    doi: input.doi ?? null,
    normalized_doi: input.normalizedDoi ?? null,
    duplicate_key_v2: input.duplicateKeyV2 ?? null,
    title_fingerprint: input.titleFingerprint ?? null,
    metadata: input.metadata ?? {},
    storage_bucket: input.storageBucket ?? null,
    storage_object_path: input.storageObjectPath ?? null,
    data_base64: input.dataBase64 ?? null,
    file_name: input.fileName,
    original_file_name: input.originalFileName ?? input.fileName,
    mime_type: input.mimeType,
    size: input.size,
    file_sha256: input.fileSha256 ?? null,
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await supabase.from('paper_upload_queue').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to queue upload: ${error?.message ?? 'Unknown error'}`);
  }

  const profileNames = await loadProfileNames([payload.created_by ?? ''].filter(Boolean));
  return mapQueueRow(data as UploadQueueRow, profileNames);
};

export const listUploadQueueEntries = async (
  status: UploadQueueStatus = 'pending',
): Promise<UploadQueueItem[]> => {
  const supabase = supabaseClient();
  const query = supabase.from('paper_upload_queue').select('*').order('created_at', { ascending: true });
  if (status) {
    query.eq('status', status);
  }
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list upload queue entries: ${error.message}`);
  }

  const rows = (data ?? []) as UploadQueueRow[];
  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.created_by, row.approved_by])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const profileNames = await loadProfileNames(profileIds);

  return rows.map((row) => mapQueueRow(row, profileNames));
};

export const getUploadQueueEntries = async (ids: string[]): Promise<UploadQueueItem[]> => {
  if (ids.length === 0) {
    return [];
  }

  const supabase = supabaseClient();
  const { data, error } = await supabase.from('paper_upload_queue').select('*').in('id', ids);

  if (error) {
    throw new Error(`Failed to load upload queue entries: ${error.message}`);
  }

  const rows = (data ?? []) as UploadQueueRow[];
  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.created_by, row.approved_by])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const profileNames = await loadProfileNames(profileIds);
  return rows.map((row) => mapQueueRow(row, profileNames));
};

export const markUploadQueueApproved = async (id: string, approverId: string, paperId: string) => {
  const supabase = supabaseClient();
  const { error } = await supabase
    .from('paper_upload_queue')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      paper_id: paperId,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to mark upload ${id} as approved: ${error.message}`);
  }
};

export const markUploadQueueRejected = async (ids: string[], approverId: string) => {
  if (ids.length === 0) {
    return;
  }
  const supabase = supabaseClient();
  const { error } = await supabase
    .from('paper_upload_queue')
    .update({
      status: 'rejected',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to reject uploads: ${error.message}`);
  }
};

export const countPendingUploadQueueEntries = async (): Promise<number> => {
  const supabase = supabaseClient();
  const { count, error } = await supabase
    .from('paper_upload_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    throw new Error(`Failed to count pending uploads: ${error.message}`);
  }

  return count ?? 0;
};
