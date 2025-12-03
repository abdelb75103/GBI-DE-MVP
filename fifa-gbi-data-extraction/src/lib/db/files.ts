import crypto from 'node:crypto';

import { mapFileRow } from '@/lib/db/mappers';
import { supabaseClient } from '@/lib/db/shared';
import type { StoredFile } from '@/lib/types';
import type { FileInsert, FileRow } from '@/lib/db/types';

export const getFile = async (id: string): Promise<StoredFile | undefined> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase.from('paper_files').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load file ${id}: ${error.message}`);
  }

  return data ? mapFileRow(data as FileRow) : undefined;
};

export const uploadFileToStorage = async (
  buffer: Buffer,
  fileName: string,
  bucket: string = 'papers',
): Promise<{ storageBucket: string; storageObjectPath: string }> => {
  const supabase = supabaseClient();

  const fileId = crypto.randomUUID();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const storageObjectPath = `${fileId}/${timestamp}-${sanitizedFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storageObjectPath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  return {
    storageBucket: bucket,
    storageObjectPath,
  };
};

export const getStorageSignedUrl = async (bucket: string, path: string): Promise<string | null> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data) {
    console.error(`Failed to create signed URL for ${bucket}/${path}:`, error);
    return null;
  }

  return data.signedUrl;
};

export const attachFile = async (input: {
  paperId: string;
  name: string;
  originalFileName?: string | null;
  size: number;
  mimeType: string;
  dataBase64?: string | null;
  storageBucket?: string | null;
  storageObjectPath?: string | null;
  publicUrl?: string | null;
  fileSha256?: string | null;
}): Promise<StoredFile> => {
  const supabase = supabaseClient();
  const payload: FileInsert = {
    id: crypto.randomUUID(),
    paper_id: input.paperId,
    name: input.name,
    original_file_name: input.originalFileName ?? input.name,
    size: input.size,
    mime_type: input.mimeType,
    uploaded_at: new Date().toISOString(),
    data_base64: input.dataBase64 ?? null,
    storage_bucket: input.storageBucket ?? 'papers',
    storage_object_path: input.storageObjectPath ?? null,
    public_url: input.publicUrl ?? null,
    file_sha256: input.fileSha256 ?? null,
  };

  const { data, error } = await supabase.from('paper_files').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to attach file: ${error?.message ?? 'Unknown error'}`);
  }

  const fileRow = data as FileRow;

  await supabase
    .from('papers')
    .update({
      primary_file_id: fileRow.id,
      primary_file_sha256: input.fileSha256 ?? null,
      original_file_name: input.originalFileName ?? input.name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.paperId);

  return mapFileRow(fileRow);
};
