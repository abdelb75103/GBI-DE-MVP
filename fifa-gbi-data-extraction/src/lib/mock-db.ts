import crypto from 'node:crypto';

import {
  getAdminServiceClient,
  type Database,
  type ExtractionTab,
  type ExtractionMetric as SupabaseExtractionMetric,
  type ExtractionFieldStatus as SupabaseFieldStatus,
  type ExportKind as SupabaseExportKind,
} from '@/lib/supabase';
import type {
  ExportJob,
  ExtractionFieldMetric,
  ExtractionFieldResult,
  ExtractionResult,
  Paper,
  PaperNote,
  PaperStatus,
  PopulationGroup,
  PopulationValue,
  StoredFile,
} from '@/lib/types';
import { derivePopulationGroups, type ParsedPopulationGroup } from '@/lib/extraction/populations';
import type { PaperActiveSession } from '@/lib/types';

type PaperRow = Database['public']['Tables']['papers']['Row'];
type PaperInsert = Database['public']['Tables']['papers']['Insert'];
type PaperUpdate = Database['public']['Tables']['papers']['Update'];
type FileRow = Database['public']['Tables']['paper_files']['Row'];
type FileInsert = Database['public']['Tables']['paper_files']['Insert'];
type NoteRow = Database['public']['Tables']['paper_notes']['Row'];
type NoteInsert = Database['public']['Tables']['paper_notes']['Insert'];
type ExtractionRow = Database['public']['Tables']['extractions']['Row'];
type ExtractionFieldRow = Database['public']['Tables']['extraction_fields']['Row'];
type ExtractionFieldInsert = Database['public']['Tables']['extraction_fields']['Insert'];
type ExportJobRow = Database['public']['Tables']['export_jobs']['Row'];
type PopulationGroupRow = Database['public']['Tables']['population_groups']['Row'];
type PopulationValueRow = Database['public']['Tables']['population_values']['Row'];

type ActiveSessionMetadata = {
  profileId?: string;
  fullName?: string;
  startedAt?: string;
  heartbeatAt?: string;
};

const ACTIVE_SESSION_TIMEOUT_MS = 5 * 60 * 1000;

const nowIso = () => new Date().toISOString();

export class PaperSessionConflictError extends Error {
  current: PaperActiveSession;
  constructor(current: PaperActiveSession) {
    super(`Paper is currently being edited by ${current.fullName || current.profileId}`);
    this.name = 'PaperSessionConflictError';
    this.current = current;
  }
}

const parseActiveSessionMetadata = (
  metadata: Record<string, unknown> | undefined,
): PaperActiveSession | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const session = (metadata as { activeSession?: ActiveSessionMetadata }).activeSession;
  if (
    !session ||
    typeof session.profileId !== 'string' ||
    !session.profileId ||
    typeof session.fullName !== 'string' ||
    typeof session.startedAt !== 'string' ||
    typeof session.heartbeatAt !== 'string'
  ) {
    return null;
  }

  return {
    profileId: session.profileId,
    fullName: session.fullName,
    startedAt: session.startedAt,
    heartbeatAt: session.heartbeatAt,
  };
};

const isSessionExpired = (session: PaperActiveSession): boolean => {
  const heartbeat = new Date(session.heartbeatAt).getTime();
  if (Number.isNaN(heartbeat)) {
    return true;
  }
  return Date.now() - heartbeat > ACTIVE_SESSION_TIMEOUT_MS;
};

const withActiveSessionMetadata = (
  metadata: Record<string, unknown> | undefined,
  session: PaperActiveSession | null,
): Record<string, unknown> => {
  const base = { ...(metadata ?? {}) };
  if (session) {
    base.activeSession = session;
  } else {
    delete (base as ActiveSessionMetadata).activeSession;
  }
  return base;
};

type CreatePaperInput = {
  title: string;
  leadAuthor?: string | null;
  year?: string | null;
  journal?: string | null;
  doi?: string | null;
  status?: PaperStatus;
  metadata?: Record<string, unknown>;
};

type CreateFileInput = {
  paperId: string;
  name: string;
  size: number;
  mimeType: string;
  dataBase64?: string | null;
  storageBucket?: string | null;
  storageObjectPath?: string | null;
  publicUrl?: string | null;
};

type CreateNoteInput = {
  paperId: string;
  author: string;
  body: string;
};

type UpdateExtractionFieldOptions = {
  value?: string | null;
  status?: SupabaseFieldStatus;
  confidence?: number | null;
  sourceQuote?: string | null;
  pageHint?: string | null;
  metric?: SupabaseExtractionMetric | null;
};

const ensureSupabaseConfigured = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
};

const supabaseClient = () => {
  ensureSupabaseConfigured();
  return getAdminServiceClient();
};

const mapPaperRow = (row: PaperRow, noteCount = 0): Paper => {
  const metadata = row.metadata ?? undefined;
  const parsedSession = parseActiveSessionMetadata(metadata);
  const activeSession = parsedSession && !isSessionExpired(parsedSession) ? parsedSession : null;

  return {
    id: row.id,
    assignedStudyId: row.assigned_study_id ?? '',
    title: row.title,
    status: row.status,
    leadAuthor: row.lead_author,
    journal: row.journal,
    year: row.year,
    doi: row.doi,
    createdAt: row.uploaded_at,
    updatedAt: row.updated_at,
    storageBucket: row.storage_bucket ?? null,
    storageObjectPath: row.storage_object_path ?? null,
    primaryFileId: row.primary_file_id ?? null,
    flagReason: row.flag_reason ?? null,
    metadata,
    activeSession,
    noteCount,
  };
};

const mapFileRow = (row: FileRow): StoredFile => ({
  id: row.id,
  paperId: row.paper_id,
  name: row.name,
  size: row.size,
  mimeType: row.mime_type,
  uploadedAt: row.uploaded_at,
  storageBucket: row.storage_bucket ?? null,
  storageObjectPath: row.storage_object_path ?? null,
  publicUrl: row.public_url ?? null,
  dataBase64: row.data_base64 ?? null,
});

const mapNoteRow = (row: NoteRow): PaperNote => ({
  id: row.id,
  paperId: row.paper_id,
  author: row.author,
  body: row.body,
  createdAt: row.created_at,
});

const mapExportRow = (row: ExportJobRow): ExportJob => ({
  id: row.id,
  kind: row.kind,
  paperIds: row.paper_ids ?? [],
  status: row.status,
  createdAt: row.created_at,
  downloadUrl: row.download_path ?? null,
  checksumSha256: row.checksum_sha256 ?? null,
});

const mapPopulationGroupRow = (row: PopulationGroupRow): PopulationGroup => ({
  id: row.id,
  paperId: row.paper_id,
  tab: row.tab,
  label: row.label,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPopulationValueRow = (row: PopulationValueRow): PopulationValue => ({
  id: row.id,
  populationGroupId: row.population_group_id,
  paperId: row.paper_id,
  fieldId: row.field_id,
  value: row.value ?? null,
  metric: row.metric ?? null,
  unit: row.unit ?? null,
  sourceFieldId: row.source_field_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapExtractionFieldRow = (row: ExtractionFieldRow): ExtractionFieldResult => ({
  fieldId: row.field_id,
  value: row.value ?? null,
  confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
  sourceQuote: row.source_quote ?? null,
  pageHint: row.page_hint ?? null,
  metric: (row.metric ?? undefined) as ExtractionFieldMetric | undefined,
  status: row.status,
  updatedAt: row.updated_at,
  updatedBy: (row as { updated_by?: string | null }).updated_by ?? null,
});

const mapExtractionRow = (
  row: ExtractionRow & { extraction_fields?: ExtractionFieldRow[] | null },
): ExtractionResult => ({
  id: row.id,
  paperId: row.paper_id,
  tab: row.tab,
  model: row.model,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  fields: (row.extraction_fields ?? []).map(mapExtractionFieldRow),
  notes: null,
});

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

const upsertExtractionFieldRow = async (
  extractionId: string,
  fieldId: string,
  updates: UpdateExtractionFieldOptions,
): Promise<ExtractionFieldRow> => {
  const supabase = supabaseClient();
  const payload: ExtractionFieldInsert = {
    id: crypto.randomUUID(),
    extraction_id: extractionId,
    field_id: fieldId,
    value: updates.value ?? null,
    confidence: updates.confidence ?? null,
    source_quote: updates.sourceQuote ?? null,
    page_hint: updates.pageHint ?? null,
    metric: (updates.metric ?? null) as SupabaseExtractionMetric | null,
    status: updates.status ?? 'not_reported',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('extraction_fields')
    .upsert(payload, { onConflict: 'extraction_id,field_id' })
    .select('*')
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to persist extraction field ${fieldId}: ${error?.message ?? 'Unknown error'}`);
  }

  return data as ExtractionFieldRow;
};

const ensureExtractionRow = async (
  paperId: string,
  tab: ExtractionTab,
  model?: string,
): Promise<ExtractionRow> => {
  const supabase = supabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from('extractions')
    .select('*')
    .eq('paper_id', paperId)
    .eq('tab', tab)
    .maybeSingle();

  if (lookupError && lookupError.code !== 'PGRST116') {
    throw new Error(`Failed to load extraction: ${lookupError.message}`);
  }

  const existingRow = existing as ExtractionRow | null;

  if (existingRow) {
    return existingRow;
  }

  const insertPayload: Database['public']['Tables']['extractions']['Insert'] = {
    paper_id: paperId,
    tab,
    model: model ?? 'human-input',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error: insertError } = await supabase
    .from('extractions')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to create extraction: ${insertError?.message ?? 'Unknown error'}`);
  }

  return created as ExtractionRow;
};

const fetchExtractionById = async (id: string): Promise<ExtractionResult> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('extractions')
    .select('*, extraction_fields(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error(`Extraction not found: ${error?.message ?? 'Unknown error'}`);
  }

  return mapExtractionRow(data as ExtractionRow & { extraction_fields: ExtractionFieldRow[] });
};

const syncPopulationSlices = async (paperId: string) => {
  try {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('extractions')
      .select('id, paper_id, tab, model, created_at, updated_at, extraction_fields(*)')
      .eq('paper_id', paperId)
      .eq('tab', 'participantCharacteristics')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const extraction =
      data != null
        ? mapExtractionRow(data as ExtractionRow & { extraction_fields: ExtractionFieldRow[] })
        : null;

    const groups: ParsedPopulationGroup[] = derivePopulationGroups(extraction?.fields ?? []);

    await supabase.from('population_values').delete().eq('paper_id', paperId);
    await supabase.from('population_groups').delete().eq('paper_id', paperId);

    if (groups.length === 0) {
      return;
    }

    const groupRows: PopulationGroupRow[] = groups.map((group, index) => ({
      id: crypto.randomUUID(),
      paper_id: paperId,
      tab: 'participantCharacteristics',
      label: group.label,
      position: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: insertedGroups, error: insertGroupError } = await supabase
      .from('population_groups')
      .insert(groupRows)
      .select('*');

    if (insertGroupError) {
      throw insertGroupError;
    }

    const valueRows: PopulationValueRow[] = [];

    const insertedGroupRows = insertedGroups as PopulationGroupRow[] | null;

    insertedGroupRows?.forEach((groupRow) => {
      const parsed = groups.find((candidate) => candidate.position === groupRow.position);
      if (!parsed) {
        return;
      }
      Object.entries(parsed.values).forEach(([fieldId, value]) => {
        valueRows.push({
          id: crypto.randomUUID(),
          population_group_id: groupRow.id,
          paper_id: paperId,
          field_id: fieldId,
          source_field_id: fieldId,
          value: value ?? null,
          metric: null,
          unit: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    });

    if (valueRows.length > 0) {
      const { error: insertValuesError } = await supabase.from('population_values').insert(valueRows);
      if (insertValuesError) {
        throw insertValuesError;
      }
    }
  } catch (error) {
    console.error('[mockDb] Failed to sync population slices', error);
  }
};

export const mockDb = {
  async listPapers(): Promise<Paper[]> {
    const supabase = supabaseClient();
    const { data: paperRows, error } = await supabase.from('papers').select('*').order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list papers: ${error.message}`);
    }

    const paperRowList = (paperRows ?? []) as PaperRow[];
    const ids = paperRowList.map((row) => row.id);
    const noteCounts = new Map<string, number>();

    if (ids.length > 0) {
      const { data: noteRows, error: notesError } = await supabase
        .from('paper_notes')
        .select('paper_id')
        .in('paper_id', ids);

      if (notesError) {
        throw new Error(`Failed to load note counts: ${notesError.message}`);
      }

      (noteRows ?? []).forEach((row) => {
        const current = noteCounts.get(row.paper_id) ?? 0;
        noteCounts.set(row.paper_id, current + 1);
      });
    }

    return paperRowList.map((row) => mapPaperRow(row, noteCounts.get(row.id) ?? 0));
  },

  async getPaper(id: string): Promise<Paper | undefined> {
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

    return mapPaperRow(data as PaperRow, noteCount);
  },

  async createPaper(input: CreatePaperInput): Promise<Paper> {
    const supabase = supabaseClient();
    const assignedId = await generateAssignedStudyId();
    const payload: PaperInsert = {
      id: crypto.randomUUID(),
      assigned_study_id: assignedId,
      title: input.title,
      lead_author: input.leadAuthor ?? null,
      journal: input.journal ?? null,
      year: input.year ?? null,
      doi: input.doi ?? null,
      status: input.status ?? 'uploaded',
      storage_bucket: 'papers',
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };

    const { data, error } = await supabase.from('papers').insert(payload).select('*').single();

    if (error || !data) {
      throw new Error(`Failed to create paper: ${error?.message ?? 'Unknown error'}`);
    }

    return mapPaperRow(data as PaperRow);
  },

  async startPaperSession(
    paperId: string,
    session: { profileId: string; fullName: string },
  ): Promise<PaperActiveSession> {
    const paper = await this.getPaper(paperId);
    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    const existing = paper.activeSession && !isSessionExpired(paper.activeSession) ? paper.activeSession : null;
    if (existing && existing.profileId !== session.profileId) {
      throw new PaperSessionConflictError(existing);
    }

    const startedAt = existing?.startedAt ?? nowIso();
    const nextSession: PaperActiveSession = {
      profileId: session.profileId,
      fullName: session.fullName,
      startedAt,
      heartbeatAt: nowIso(),
    };

    await this.updatePaper(paperId, {
      metadata: withActiveSessionMetadata(paper.metadata as Record<string, unknown> | undefined, nextSession),
    });

    return nextSession;
  },

  async heartbeatPaperSession(paperId: string, profileId: string): Promise<PaperActiveSession | null> {
    const paper = await this.getPaper(paperId);
    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    const existing = paper.activeSession && !isSessionExpired(paper.activeSession) ? paper.activeSession : null;
    if (!existing || existing.profileId !== profileId) {
      if (existing && isSessionExpired(existing)) {
        await this.updatePaper(paperId, {
          metadata: withActiveSessionMetadata(paper.metadata as Record<string, unknown> | undefined, null),
        });
      }
      return null;
    }

    const nextSession: PaperActiveSession = {
      ...existing,
      heartbeatAt: nowIso(),
    };

    await this.updatePaper(paperId, {
      metadata: withActiveSessionMetadata(paper.metadata as Record<string, unknown> | undefined, nextSession),
    });

    return nextSession;
  },

  async endPaperSession(paperId: string, profileId: string): Promise<void> {
    const paper = await this.getPaper(paperId);
    if (!paper) {
      return;
    }

    const existing = paper.activeSession;
    if (existing && existing.profileId !== profileId && !isSessionExpired(existing)) {
      return;
    }

    await this.updatePaper(paperId, {
      metadata: withActiveSessionMetadata(paper.metadata as Record<string, unknown> | undefined, null),
    });
  },

  async updatePaper(
    id: string,
    updates: Partial<Omit<Paper, 'id' | 'assignedStudyId' | 'createdAt'>>,
  ): Promise<Paper | undefined> {
    const supabase = supabaseClient();
    const payload: PaperUpdate = {
      title: updates.title,
      lead_author: updates.leadAuthor,
      journal: updates.journal,
      year: updates.year,
      doi: updates.doi,
      status: updates.status as PaperStatus | undefined,
      storage_bucket: updates.storageBucket ?? undefined,
      storage_object_path: updates.storageObjectPath,
      primary_file_id: updates.primaryFileId,
      flag_reason: updates.flagReason,
      metadata: updates.metadata,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('papers').update(payload).eq('id', id);

    if (error) {
      throw new Error(`Failed to update paper: ${error.message}`);
    }

    return this.getPaper(id);
  },

  async getFile(id: string): Promise<StoredFile | undefined> {
    const supabase = supabaseClient();
    const { data, error } = await supabase.from('paper_files').select('*').eq('id', id).maybeSingle();

    if (error) {
      throw new Error(`Failed to load file ${id}: ${error.message}`);
    }

    return data ? mapFileRow(data as FileRow) : undefined;
  },

  async attachFile(input: CreateFileInput): Promise<StoredFile> {
    const supabase = supabaseClient();
    const payload: FileInsert = {
      id: crypto.randomUUID(),
      paper_id: input.paperId,
      name: input.name,
      size: input.size,
      mime_type: input.mimeType,
      uploaded_at: new Date().toISOString(),
      data_base64: input.dataBase64 ?? null,
      storage_bucket: input.storageBucket ?? 'papers',
      storage_object_path: input.storageObjectPath ?? null,
      public_url: input.publicUrl ?? null,
    };

    const { data, error } = await supabase.from('paper_files').insert(payload).select('*').single();

    if (error || !data) {
      throw new Error(`Failed to attach file: ${error?.message ?? 'Unknown error'}`);
    }

    const fileRow = data as FileRow;

    await supabase
      .from('papers')
      .update({ primary_file_id: fileRow.id, updated_at: new Date().toISOString() })
      .eq('id', input.paperId);

    return mapFileRow(fileRow);
  },

  async toggleFlag(paperId: string, reason: string | null) {
    const paper = await this.getPaper(paperId);
    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    const nextReason = paper.flagReason ? null : reason;
    const nextStatus: PaperStatus = nextReason ? 'flagged' : 'uploaded';

    await this.updatePaper(paperId, { flagReason: nextReason, status: nextStatus });
  },

  async listNotes(paperId: string): Promise<PaperNote[]> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('paper_notes')
      .select('*')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list notes: ${error.message}`);
    }

    const noteRowList = (data ?? []) as NoteRow[];
    return noteRowList.map(mapNoteRow);
  },

  async addNote(input: CreateNoteInput): Promise<PaperNote> {
    const supabase = supabaseClient();
    const payload: NoteInsert = {
      id: crypto.randomUUID(),
      paper_id: input.paperId,
      author: input.author,
      body: input.body,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('paper_notes').insert(payload).select('*').single();

    if (error || !data) {
      throw new Error(`Failed to create note: ${error?.message ?? 'Unknown error'}`);
    }

    return mapNoteRow(data as NoteRow);
  },

  async listExports(): Promise<ExportJob[]> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list export jobs: ${error.message}`);
    }

    const exportRows = (data ?? []) as ExportJobRow[];
    return exportRows.map(mapExportRow);
  },

  async createExport(kind: SupabaseExportKind, paperIds: string[]): Promise<ExportJob> {
    const supabase = supabaseClient();
    const createdAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const payload: Database['public']['Tables']['export_jobs']['Insert'] = {
      id,
      kind,
      paper_ids: paperIds,
      status: 'ready',
      created_at: createdAt,
      checksum_sha256: crypto.createHash('sha256').update(JSON.stringify({ kind, paperIds, createdAt })).digest('hex'),
      download_path: `/api/exports/${id}/download`,
    };

    const { data, error } = await supabase.from('export_jobs').insert(payload).select('*').single();

    if (error || !data) {
      throw new Error(`Failed to create export job: ${error?.message ?? 'Unknown error'}`);
    }

    return mapExportRow(data as ExportJobRow);
  },

  async getExport(id: string): Promise<ExportJob | undefined> {
    const supabase = supabaseClient();
    const { data, error } = await supabase.from('export_jobs').select('*').eq('id', id).maybeSingle();

    if (error) {
      throw new Error(`Failed to load export job ${id}: ${error.message}`);
    }

    return data ? mapExportRow(data as ExportJobRow) : undefined;
  },

  async listExtractions(paperId: string): Promise<ExtractionResult[]> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('extractions')
      .select('*, extraction_fields(*)')
      .eq('paper_id', paperId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list extractions: ${error.message}`);
    }

    return (data ?? []).map((row) => mapExtractionRow(row as ExtractionRow & { extraction_fields: ExtractionFieldRow[] }));
  },

  async getExtraction(paperId: string, tab: ExtractionTab): Promise<ExtractionResult | undefined> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('extractions')
      .select('*, extraction_fields(*)')
      .eq('paper_id', paperId)
      .eq('tab', tab)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to load extraction: ${error.message}`);
    }

    return data
      ? mapExtractionRow(data as ExtractionRow & { extraction_fields: ExtractionFieldRow[] })
      : undefined;
  },

  async updateExtractionField(
    paperId: string,
    tab: ExtractionTab,
    fieldId: string,
    updates: {
      value?: string | null;
      status?: ExtractionFieldResult['status'];
      confidence?: number | null;
      sourceQuote?: string | null;
      pageHint?: string | null;
      metric?: ExtractionFieldMetric | null;
      model?: string;
    },
  ): Promise<ExtractionResult> {
    const status = updates.status ?? (updates.value ? 'reported' : 'not_reported');
    const normalizedConfidence =
      typeof updates.confidence === 'number' && !Number.isNaN(updates.confidence)
        ? Math.min(Math.max(updates.confidence, 0), 1)
        : null;

    const extractionRow = await ensureExtractionRow(paperId, tab, updates.model);
    await supabaseClient()
      .from('extractions')
      .update({
        model: updates.model ?? extractionRow.model ?? 'human-input',
        updated_at: new Date().toISOString(),
      })
      .eq('id', extractionRow.id);

    await upsertExtractionFieldRow(extractionRow.id, fieldId, {
      value: updates.value ?? null,
      status,
      confidence: normalizedConfidence,
      sourceQuote: updates.sourceQuote ?? null,
      pageHint: updates.pageHint ?? null,
      metric: (updates.metric ?? null) as SupabaseExtractionMetric | null,
    });

    if (fieldId === 'title' && updates.value) {
      await this.updatePaper(paperId, { title: updates.value });
    }

    if (tab === 'participantCharacteristics') {
      await syncPopulationSlices(paperId);
    }

    return fetchExtractionById(extractionRow.id);
  },

  async listPopulationGroups(paperId: string): Promise<PopulationGroup[]> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('population_groups')
      .select('*')
      .eq('paper_id', paperId)
      .order('position', { ascending: true });

    if (error) {
      throw new Error(`Failed to list population groups: ${error.message}`);
    }

    const groupRows = (data ?? []) as PopulationGroupRow[];
    return groupRows.map(mapPopulationGroupRow);
  },

  async listPopulationValues(paperId: string): Promise<PopulationValue[]> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('population_values')
      .select('*')
      .eq('paper_id', paperId);

    if (error) {
      throw new Error(`Failed to list population values: ${error.message}`);
    }

    const valueRows = (data ?? []) as PopulationValueRow[];
    return valueRows.map(mapPopulationValueRow);
  },
};
