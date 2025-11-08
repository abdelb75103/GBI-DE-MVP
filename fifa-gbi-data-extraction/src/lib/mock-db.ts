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
  PaperSession,
  PopulationGroup,
  PopulationValue,
  StoredFile,
} from '@/lib/types';
import { derivePopulationGroups, type ParsedPopulationGroup } from '@/lib/extraction/populations';

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

type CreatePaperInput = {
  title: string;
  leadAuthor?: string | null;
  year?: string | null;
  journal?: string | null;
  doi?: string | null;
  status?: PaperStatus;
  metadata?: Record<string, unknown>;
  uploadedBy?: string | null;
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
  body: string;
};

type PaperSessionInput = {
  profileId: string;
  fullName: string;
  isAdmin?: boolean;
};

type UpdateExtractionFieldOptions = {
  value?: string | null;
  status?: SupabaseFieldStatus;
  confidence?: number | null;
  sourceQuote?: string | null;
  pageHint?: string | null;
  metric?: SupabaseExtractionMetric | null;
  updatedBy?: string | null;
};

type ActiveSessionMetadata = {
  profileId: string;
  fullName?: string;
  startedAt: string;
  lastHeartbeatAt?: string;
};

const normalizeRowMetadata = (metadata: PaperRow['metadata']): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
};

const normalizePaperMetadata = (metadata: Paper['metadata']): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
};

// Session info is now stored only in metadata (not in assigned_to column)
// This avoids race conditions from dual tracking
const parseActiveSession = (metadata: Record<string, unknown>, paperId: string): PaperSession | null => {
  const raw = metadata.activeSession;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const session = raw as Partial<ActiveSessionMetadata>;

  if (!session.profileId || !session.startedAt) {
    return null;
  }

  return {
    paperId,
    profileId: session.profileId,
    fullName: session.fullName ?? '',
    startedAt: session.startedAt,
    lastHeartbeatAt: session.lastHeartbeatAt ?? session.startedAt,
  };
};

const setActiveSessionMetadata = (
  metadata: Record<string, unknown>,
  session: PaperSession | null,
): Record<string, unknown> => {
  const nextMetadata = { ...metadata };
  if (session) {
    nextMetadata.activeSession = {
      profileId: session.profileId,
      fullName: session.fullName,
      startedAt: session.startedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
    };
  } else {
    delete nextMetadata.activeSession;
  }
  return nextMetadata;
};

export class PaperSessionConflictError extends Error {
  current: PaperSession;

  constructor(current: PaperSession, message = 'Another teammate is currently editing this paper.') {
    super(message);
    this.name = 'PaperSessionConflictError';
    this.current = current;
  }
}

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
  const metadata = normalizeRowMetadata(row.metadata);
  const activeSession = parseActiveSession(metadata, row.id);

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
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    noteCount,
    assignedTo: row.assigned_to ?? null,
    activeSession,
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
  body: row.body,
  createdAt: row.created_at,
});

const mapExportRow = (row: ExportJobRow): ExportJob => ({
  id: row.id,
  kind: row.kind,
  paperIds: row.paper_ids ?? [],
  status: row.status,
  createdAt: row.created_at,
  downloadUrl: row.download_path ?? `/api/exports/${row.id}/download`,
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
  metric: row.metric ?? undefined,
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
    metric: updates.metric ?? null,
    status: updates.status ?? 'not_reported',
    updated_at: new Date().toISOString(),
    updated_by: updates.updatedBy ?? null,
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

  if (existing) {
    return existing as ExtractionRow;
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

  const createdRow = created as ExtractionRow;

  // Auto-populate studyId field when creating studyDetails extraction
  if (tab === 'studyDetails') {
    const { data: paper } = await supabase
      .from('papers')
      .select('assigned_study_id')
      .eq('id', paperId)
      .single();

    if (paper?.assigned_study_id) {
      await upsertExtractionFieldRow(createdRow.id, 'studyId', {
        value: paper.assigned_study_id,
        status: 'reported',
        updatedBy: null,
      });
    }
  }

  return createdRow;
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

// Fields that define or contain population-specific data
const POPULATION_RELATED_FIELDS = new Set([
  // Population-defining fields
  'ageCategory',
  'sex',
  // Fields that can have multi-line population-specific values
  'meanAge',
  'sampleSizePlayers',
  'numberOfTeams',
  'studyPeriodYears',
  'observationDuration',
  'seasonLength',
  'numberOfSeasons',
  'totalExposure',
  'matchExposure',
  'trainingExposure',
]);

const shouldSyncPopulations = (fieldId: string): boolean => {
  // Sync if it's a population-defining field OR if it's a metric-based field (contains population data)
  return POPULATION_RELATED_FIELDS.has(fieldId) || fieldId.includes('_prevalence') || 
    fieldId.includes('_incidence') || fieldId.includes('_burden') || 
    fieldId.includes('_severityMeanDays') || fieldId.includes('_severityTotalDays');
};

const createPopulationSignature = (groups: ParsedPopulationGroup[]): string | null => {
  if (!groups.length) {
    return null;
  }
  const normalised = groups
    .map((group) => ({
      position: group.position,
      label: group.label,
      values: Object.keys(group.values)
        .sort()
        .reduce<Record<string, string | null>>((acc, key) => {
          acc[key] = group.values[key] ?? null;
          return acc;
        }, {}),
    }))
    .sort((a, b) => a.position - b.position);
  return JSON.stringify(normalised);
};

const syncPopulationSlices = async (paperId: string) => {
  try {
    const supabase = supabaseClient();

    const { data: paperRow } = await supabase
      .from('papers')
      .select('metadata')
      .eq('id', paperId)
      .maybeSingle();
    const metadata = normalizeRowMetadata(paperRow?.metadata ?? {});
    const previousSignature = typeof metadata.populationHash === 'string' ? metadata.populationHash : null;

    const { data, error } = await supabase
      .from('extractions')
      .select('id, paper_id, tab, model, created_at, updated_at, extraction_fields(*)')
      .eq('paper_id', paperId);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const allFields: ExtractionFieldResult[] = [];
    if (data) {
      data.forEach((extraction) => {
        const mapped = mapExtractionRow(extraction as ExtractionRow & { extraction_fields: ExtractionFieldRow[] });
        allFields.push(...mapped.fields);
      });
    }

    const groups: ParsedPopulationGroup[] = derivePopulationGroups(allFields);
    const groupsByPosition = new Map<number, ParsedPopulationGroup>();
    groups.forEach((group) => groupsByPosition.set(group.position, group));

    const nextSignature = createPopulationSignature(groups);
    if (nextSignature && nextSignature === previousSignature) {
      return;
    }

    await supabase.from('population_values').delete().eq('paper_id', paperId);
    await supabase.from('population_groups').delete().eq('paper_id', paperId);

    if (groups.length === 0) {
      if (previousSignature) {
        const nextMetadata = { ...metadata };
        delete nextMetadata.populationHash;
        await supabase
          .from('papers')
          .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
          .eq('id', paperId);
      }
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
    const insertedGroupRows = (insertedGroups ?? []) as PopulationGroupRow[];
    const fieldMetricMap = new Map<string, ExtractionFieldMetric | null>();
    allFields.forEach((field) => {
      if (field.metric) {
        fieldMetricMap.set(field.fieldId, field.metric);
      }
    });

    insertedGroupRows.forEach((groupRow) => {
      const parsed = groupsByPosition.get(groupRow.position);
      if (!parsed) {
        return;
      }
      Object.entries(parsed.values).forEach(([fieldId, value]) => {
        const isPrevalenceField = fieldId.endsWith('_prevalence') ||
          ['injuryTotalCount', 'illnessTotalCount'].includes(fieldId);

        if (isPrevalenceField && value && value.trim() === groupRow.label.trim()) {
          const hasNumericData = /\d/.test(value);
          if (!hasNumericData) {
            return;
          }
        }

        const metric = fieldMetricMap.get(fieldId) ?? null;
        valueRows.push({
          id: crypto.randomUUID(),
          population_group_id: groupRow.id,
          paper_id: paperId,
          field_id: fieldId,
          source_field_id: fieldId,
          value: value ?? null,
          metric,
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

    const nextMetadata = { ...metadata };
    nextMetadata.populationHash = nextSignature;
    await supabase
      .from('papers')
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq('id', paperId);
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

    const rows = (paperRows ?? []) as PaperRow[];
    const ids = rows.map((row) => row.id);
    const noteCounts = new Map<string, number>();
    const assigneeNames = new Map<string, string>();

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

      // Fetch assignee profiles for assigned papers
      const assignedToIds = rows.map((row) => row.assigned_to).filter((id): id is string => id !== null);
      if (assignedToIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', assignedToIds);

        if (!profilesError && profiles) {
          profiles.forEach((profile) => {
            assigneeNames.set(profile.id, profile.full_name);
          });
        }
      }
    }

    return rows.map((row) => {
      const paper = mapPaperRow(row, noteCounts.get(row.id) ?? 0);
      // Attach assignee name if available
      if (row.assigned_to && assigneeNames.has(row.assigned_to)) {
        paper.assigneeName = assigneeNames.get(row.assigned_to);
      }
      return paper;
    });
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

    const row = data as PaperRow;
    const paper = mapPaperRow(row, noteCount);

    // Fetch assignee name if paper is assigned
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

    return this.getPaper(id);
  },

  async deletePaper(id: string): Promise<void> {
    const supabase = supabaseClient();
    
    // Get extraction IDs first
    const { data: extractions, error: extractionsError } = await supabase
      .from('extractions')
      .select('id')
      .eq('paper_id', id);
    
    if (extractionsError) {
      throw new Error(`Failed to fetch extractions for deletion: ${extractionsError.message}`);
    }
    
    const extractionIds = (extractions ?? []).map((e) => e.id);
    
    // Delete associated data first (cascade delete)
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
    
    // Finally delete the paper
    const { error } = await supabase.from('papers').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete paper: ${error.message}`);
    }
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

    return (data ?? []).map((row) => mapNoteRow(row as NoteRow));
  },

  async addNote(input: CreateNoteInput): Promise<PaperNote> {
    const supabase = supabaseClient();
    const payload: NoteInsert = {
      id: crypto.randomUUID(),
      paper_id: input.paperId,
      body: input.body,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('paper_notes').insert(payload).select('*').single();

    if (error || !data) {
      throw new Error(`Failed to create note: ${error?.message ?? 'Unknown error'}`);
    }

    return mapNoteRow(data as NoteRow);
  },

  async deleteNote(noteId: string): Promise<void> {
    const supabase = supabaseClient();
    const { error } = await supabase.from('paper_notes').delete().eq('id', noteId);

    if (error) {
      throw new Error(`Failed to delete note: ${error.message}`);
    }
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

    const rows = (data ?? []) as ExportJobRow[];
    return rows.map(mapExportRow);
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

  async startPaperSession(paperId: string, input: PaperSessionInput): Promise<PaperSession> {
    const paper = await this.getPaper(paperId);

    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    const isAdmin = input.isAdmin ?? false;
    const assignedTo = paper.assignedTo;
    const isAssignedToOther = Boolean(assignedTo && assignedTo !== input.profileId);

    // Check if paper is assigned to someone else using ONLY assigned_to column (single source of truth)
    if (isAssignedToOther && !isAdmin && assignedTo) {
      // Fetch the assignee's profile info for better error message
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
        `This paper is currently assigned to ${assigneeProfile?.full_name ?? 'another user'}. Please choose a different paper.`
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
    
    // If admin is viewing someone else's paper, don't update assignment
    if (isAssignedToOther && isAdmin) {
      // Just update metadata for session tracking, but don't change assignment
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

    // Normal flow: assign or update assignment
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
      const latest = await this.getPaper(paperId);
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
  },

  async heartbeatPaperSession(paperId: string, profileId: string): Promise<PaperSession> {
    const paper = await this.getPaper(paperId);

    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    // Check assigned_to column (single source of truth)
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
      .eq('assigned_to', profileId); // Ensure ownership hasn't changed

    if (error) {
      throw new Error(`Failed to extend paper session: ${error.message}`);
    }

    return session;
  },

  async endPaperSession(paperId: string, profileId: string): Promise<void> {
    const paper = await this.getPaper(paperId);

    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    // Only clear if currently assigned to this profile (single source of truth check)
    if (!paper.assignedTo || paper.assignedTo !== profileId) {
      // Not assigned to this user, nothing to do
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
      .eq('assigned_to', profileId); // Ensure we only clear if still assigned to this user

    if (error) {
      throw new Error(`Failed to end paper session: ${error.message}`);
    }
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
      updatedBy?: string | null;
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
      metric: updates.metric ?? null,
      updatedBy: updates.updatedBy ?? null,
    });

    if (fieldId === 'title' && updates.value) {
      await this.updatePaper(paperId, { title: updates.value });
    }

    // Only sync population slices if this field affects populations
    if (shouldSyncPopulations(fieldId)) {
      await syncPopulationSlices(paperId);
    }

    return fetchExtractionById(extractionRow.id);
  },

  async saveExtractionFields(
    paperId: string,
    tab: ExtractionTab,
    fields: Array<{ fieldId: string; value: string | null; metric?: ExtractionFieldMetric | null }>,
    options: { updatedBy: string },
  ): Promise<void> {
    const extractionRow = await ensureExtractionRow(paperId, tab, 'human-input');
    const supabase = supabaseClient();
    const now = new Date().toISOString();
    
    // Batch all field upserts into a single operation for atomicity
    const fieldPayloads: ExtractionFieldInsert[] = fields.map((field) => {
      const status: SupabaseFieldStatus = field.value ? 'reported' : 'not_reported';
      return {
        id: crypto.randomUUID(),
        extraction_id: extractionRow.id,
        field_id: field.fieldId,
        value: field.value,
        confidence: null,
        source_quote: null,
        page_hint: null,
        metric: field.metric ?? null,
        status,
        updated_at: now,
        updated_by: options.updatedBy, // Profile ID of user making the change
      };
    });

    // Execute as a single batch upsert (more atomic than sequential operations)
    const { error: fieldError } = await supabase
      .from('extraction_fields')
      .upsert(fieldPayloads, { onConflict: 'extraction_id,field_id' });
    
    if (fieldError) {
      throw new Error(`Failed to save extraction fields: ${fieldError.message}`);
    }

    // Update extraction timestamp
    const { error: updateError } = await supabase
      .from('extractions')
      .update({
        model: 'human-input',
        updated_at: now,
      })
      .eq('id', extractionRow.id);

    if (updateError) {
      throw new Error(`Failed to update extraction timestamp: ${updateError.message}`);
    }

    // Check if title needs updating
    const titleField = fields.find((f) => f.fieldId === 'title');
    if (titleField?.value) {
      await this.updatePaper(paperId, { title: titleField.value });
    }

    // Only sync if any of the saved fields affect populations
    const needsSync = fields.some((field) => shouldSyncPopulations(field.fieldId));
    if (needsSync) {
      await syncPopulationSlices(paperId);
    }
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

    const rows = (data ?? []) as PopulationGroupRow[];
    return rows.map(mapPopulationGroupRow);
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

    const rows = (data ?? []) as PopulationValueRow[];
    return rows.map(mapPopulationValueRow);
  },

  async getProfileGeminiKey(profileId: string): Promise<string | null> {
    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load Gemini API key: ${error.message}`);
    }

    return (data as { gemini_api_key: string | null } | null)?.gemini_api_key ?? null;
  },

  async setProfileGeminiKey(profileId: string, apiKey: string): Promise<void> {
    const supabase = supabaseClient();
    const { error } = await supabase
      .from('profiles')
      .update({ gemini_api_key: apiKey.trim(), updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) {
      throw new Error(`Failed to save Gemini API key: ${error.message}`);
    }
  },

  async clearProfileGeminiKey(profileId: string): Promise<void> {
    const supabase = supabaseClient();
    const { error } = await supabase
      .from('profiles')
      .update({ gemini_api_key: null, updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) {
      throw new Error(`Failed to clear Gemini API key: ${error.message}`);
    }
  },

  async hasProfileGeminiKey(profileId: string): Promise<boolean> {
    const key = await this.getProfileGeminiKey(profileId);
    return Boolean(key);
  },
};
