import crypto from 'node:crypto';

import { derivePopulationGroups, type ParsedPopulationGroup } from '@/lib/extraction/populations';
import { mapExtractionRow } from '@/lib/db/mappers';
import { normalizeRowMetadata, supabaseClient } from '@/lib/db/shared';
import type { ExtractionFieldMetric, ExtractionFieldResult } from '@/lib/types';
import type { ExtractionFieldRow, ExtractionRow, PopulationGroupRow, PopulationValueRow } from '@/lib/db/types';

// Fields that define or contain population-specific data
const POPULATION_RELATED_FIELDS = new Set([
  // Population-defining fields
  'ageCategory',
  'sex',
  // Fields that can have multi-line population-specific values
  'meanAge',
  'sampleSizePlayers',
  'numberOfTeams',
  'observationDuration',
  'seasonLength',
  'numberOfSeasons',
  'totalExposure',
  'matchExposure',
  'trainingExposure',
]);

export const shouldSyncPopulations = (fieldId: string): boolean => {
  // Explicit population fields (age/sex/exposure) or metric-based tables
  if (
    POPULATION_RELATED_FIELDS.has(fieldId) ||
    fieldId.includes('_prevalence') ||
    fieldId.includes('_incidence') ||
    fieldId.includes('_burden') ||
    fieldId.includes('_severityMeanDays') ||
    fieldId.includes('_severityTotalDays')
  ) {
    return true;
  }

  // Injury/illness outcome fields often store one entry per line; treat each newline as a population row
  if (fieldId.startsWith('injury') || fieldId.startsWith('illness')) {
    return true;
  }

  return false;
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

export const syncPopulationSlices = async (paperId: string) => {
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
