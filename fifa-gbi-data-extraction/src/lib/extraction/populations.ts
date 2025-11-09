import type { ExtractionFieldResult } from '@/lib/types';

export type ParsedPopulationGroup = {
  label: string;
  position: number;
  values: Record<string, string | null>;
};

const POPULATION_FIELD_IDS = new Set([
  'ageCategory',
  'sex',
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

const isMetricField = (fieldId: string) =>
  fieldId.includes('_prevalence') ||
  fieldId.includes('_incidence') ||
  fieldId.includes('_burden') ||
  fieldId.includes('_severityMeanDays') ||
  fieldId.includes('_severityTotalDays');

const isInjuryOrIllnessField = (fieldId: string) =>
  fieldId.startsWith('injury') || fieldId.startsWith('illness');

const shouldIncludeField = (fieldId: string) =>
  POPULATION_FIELD_IDS.has(fieldId) || isMetricField(fieldId) || isInjuryOrIllnessField(fieldId);

const sanitizeValue = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const legacyMatch = trimmed.match(/^(.+?)\s*[:\-–-]\s*(.+)$/);
  if (legacyMatch) {
    return legacyMatch[2].trim();
  }
  return trimmed;
};

export function derivePopulationGroups(fields: ExtractionFieldResult[]): ParsedPopulationGroup[] {
  if (!fields || fields.length === 0) {
    return [];
  }

  const groups = new Map<number, ParsedPopulationGroup>();

  const ensureGroup = (index: number): ParsedPopulationGroup => {
    const existing = groups.get(index);
    if (existing) {
      return existing;
    }
    const next: ParsedPopulationGroup = {
      label: `Row ${index + 1}`,
      position: index,
      values: {},
    };
    groups.set(index, next);
    return next;
  };

  fields.forEach((field) => {
    if (!field.value || !shouldIncludeField(field.fieldId)) {
      return;
    }
    const lines = field.value.split(/\r?\n/);
    lines.forEach((line, index) => {
      const cleaned = sanitizeValue(line);
      if (!cleaned) {
        return;
      }
      const group = ensureGroup(index);
      group.values[field.fieldId] = cleaned;
    });
  });

  return Array.from(groups.values())
    .filter((group) => Object.values(group.values).some((value) => value && value.trim().length > 0))
    .sort((a, b) => a.position - b.position);
}
