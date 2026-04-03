import crypto from 'node:crypto';

import { mapExtractionRow, mapPopulationGroupRow, mapPopulationValueRow } from '@/lib/db/mappers';
import { supabaseClient } from '@/lib/db/shared';
import { shouldSyncPopulations, syncPopulationSlices } from '@/lib/db/population-sync';
import { normalizeGlobalFieldValue } from '@/lib/extraction/normalize';
import type {
  ExtractionFieldMetric,
  ExtractionFieldResult,
  ExtractionResult,
  ExtractionTab,
  PopulationGroup,
  PopulationValue,
} from '@/lib/types';
import type {
  ExtractionFieldRow,
  ExtractionFieldInsert,
  ExtractionInsert,
  ExtractionRow,
  PopulationGroupRow,
  PopulationValueRow,
} from '@/lib/db/types';
import type { ExtractionFieldStatus as SupabaseFieldStatus } from '@/lib/supabase/types';
import { updatePaper } from '@/lib/db/papers';

const upsertExtractionFieldRow = async (
  extractionId: string,
  fieldId: string,
  updates: {
    value?: string | null;
    status?: SupabaseFieldStatus;
    confidence?: number | null;
    sourceQuote?: string | null;
    pageHint?: string | null;
    metric?: ExtractionFieldMetric | null;
    updatedBy?: string | null;
  },
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

  const insertPayload: ExtractionInsert = {
    id: crypto.randomUUID(),
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

export const listExtractions = async (paperId: string): Promise<ExtractionResult[]> => {
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
};

export const getExtraction = async (
  paperId: string,
  tab: ExtractionTab,
): Promise<ExtractionResult | undefined> => {
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
};

export const updateExtractionField = async (
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
): Promise<ExtractionResult> => {
  const normalizedValue = normalizeGlobalFieldValue(fieldId, updates.value);
  const status = updates.status ?? (normalizedValue ? 'reported' : 'not_reported');
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
    value: normalizedValue,
    status,
    confidence: normalizedConfidence,
    sourceQuote: updates.sourceQuote ?? null,
    pageHint: updates.pageHint ?? null,
    metric: updates.metric ?? null,
    updatedBy: updates.updatedBy ?? null,
  });

  if (fieldId === 'title' && normalizedValue) {
    await updatePaper(paperId, { title: normalizedValue });
  }

  if (shouldSyncPopulations(fieldId)) {
    await syncPopulationSlices(paperId);
  }

  return fetchExtractionById(extractionRow.id);
};

export const saveExtractionFields = async (
  paperId: string,
  tab: ExtractionTab,
  fields: Array<{ fieldId: string; value: string | null; metric?: ExtractionFieldMetric | null }>,
  options: { updatedBy: string },
): Promise<void> => {
  const extractionRow = await ensureExtractionRow(paperId, tab, 'human-input');
  const supabase = supabaseClient();
  const now = new Date().toISOString();

  const normalizedFields = fields.map((field) => {
    const value = normalizeGlobalFieldValue(field.fieldId, field.value);
    return {
      ...field,
      value,
    };
  });

  const fieldPayloads: ExtractionFieldInsert[] = normalizedFields.map((field) => {
    const fieldStatus: SupabaseFieldStatus = field.value ? 'reported' : 'not_reported';
    return {
      id: crypto.randomUUID(),
      extraction_id: extractionRow.id,
      field_id: field.fieldId,
      value: field.value,
      confidence: null,
      source_quote: null,
      page_hint: null,
      metric: field.metric ?? null,
      status: fieldStatus,
      updated_at: now,
      updated_by: options.updatedBy,
    };
  });

  const { error: fieldError } = await supabase
    .from('extraction_fields')
    .upsert(fieldPayloads, { onConflict: 'extraction_id,field_id' });

  if (fieldError) {
    throw new Error(`Failed to save extraction fields: ${fieldError.message}`);
  }

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

  const titleField = normalizedFields.find((f) => f.fieldId === 'title');
  if (titleField?.value) {
    await updatePaper(paperId, { title: titleField.value });
  }

  const needsSync = normalizedFields.some((field) => shouldSyncPopulations(field.fieldId));
  if (needsSync) {
    await syncPopulationSlices(paperId);
  }
};

export const listPopulationGroups = async (paperId: string): Promise<PopulationGroup[]> => {
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
};

export const listPopulationValues = async (paperId: string): Promise<PopulationValue[]> => {
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
};
