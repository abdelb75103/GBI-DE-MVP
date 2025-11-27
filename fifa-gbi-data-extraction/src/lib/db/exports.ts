import crypto from 'node:crypto';

import { mapExportRow } from '@/lib/db/mappers';
import { supabaseClient } from '@/lib/db/shared';
import type { ExportJob } from '@/lib/types';
import type { ExportJobRow } from '@/lib/db/types';
import type { ExportKind as SupabaseExportKind } from '@/lib/supabase/types';

export const listExports = async (): Promise<ExportJob[]> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('export_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list export jobs: ${error.message}`);
  }

  const rows = (data ?? []) as ExportJobRow[];
  return rows.map(mapExportRow);
};

export const createExport = async (kind: SupabaseExportKind, paperIds: string[]): Promise<ExportJob> => {
  const supabase = supabaseClient();
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const payload = {
    id,
    kind,
    paper_ids: paperIds,
    status: 'ready' as const,
    created_at: createdAt,
    checksum_sha256: crypto.createHash('sha256').update(JSON.stringify({ kind, paperIds, createdAt })).digest('hex'),
  };

  const { data, error } = await supabase.from('export_jobs').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to create export job: ${error?.message ?? 'Unknown error'}`);
  }

  return mapExportRow(data as ExportJobRow);
};

export const getExport = async (id: string): Promise<ExportJob | undefined> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase.from('export_jobs').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load export job ${id}: ${error.message}`);
  }

  return data ? mapExportRow(data as ExportJobRow) : undefined;
};
