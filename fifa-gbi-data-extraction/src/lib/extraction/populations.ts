import type { ExtractionFieldResult } from '@/lib/types';

export type ParsedPopulationGroup = {
  label: string;
  position: number;
  values: Record<string, string | null>;
};

type ParsedEntry = {
  label: string | null;
  value: string;
};

type GroupBuilder = {
  position: number;
  label: string | null;
  values: Record<string, string | null>;
};

const POPULATION_FIELDS: string[] = [
  'ageCategory',
  'sex',
  'meanAge',
  'sampleSizePlayers',
  'numberOfTeams',
  'studyPeriodYears',
  'numberOfSeasons',
  'observationDuration',
];

const normalizeLabel = (label: string) => label.trim().toLowerCase();

const splitEntries = (raw: string): string[] => {
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(/;/))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const parseEntry = (fieldId: string, raw: string): ParsedEntry => {
  if (fieldId === 'ageCategory') {
    return { label: raw, value: raw };
  }

  const match = raw.match(/^(.+?)\s*[:\-–—]\s*(.+)$/);
  if (match) {
    return { label: match[1].trim(), value: match[2].trim() };
  }

  return { label: null, value: raw.trim() };
};

const ensureGroup = (
  groups: GroupBuilder[],
  labelLookup: Map<string, GroupBuilder>,
  index: number,
  labelHint?: string | null,
): GroupBuilder => {
  if (groups[index]) {
    if (labelHint && !groups[index].label) {
      groups[index].label = labelHint.trim();
      labelLookup.set(normalizeLabel(labelHint), groups[index]);
    }
    return groups[index];
  }

  const group: GroupBuilder = {
    position: index,
    label: labelHint ? labelHint.trim() : null,
    values: {},
  };

  groups[index] = group;

  if (labelHint) {
    labelLookup.set(normalizeLabel(labelHint), group);
  }

  return group;
};

const resolveGroupForEntry = (
  groups: GroupBuilder[],
  labelLookup: Map<string, GroupBuilder>,
  entry: ParsedEntry,
  index: number,
): GroupBuilder => {
  if (entry.label) {
    const normalized = normalizeLabel(entry.label);
    const byLabel = labelLookup.get(normalized);
    if (byLabel) {
      if (!byLabel.label) {
        byLabel.label = entry.label.trim();
      }
      return byLabel;
    }
    return ensureGroup(groups, labelLookup, index, entry.label);
  }

  if (groups[index]) {
    return groups[index];
  }

  return ensureGroup(groups, labelLookup, index, null);
};

export function derivePopulationGroups(fields: ExtractionFieldResult[]): ParsedPopulationGroup[] {
  if (!fields || fields.length === 0) {
    return [];
  }

  const fieldMap = new Map(fields.map((field) => [field.fieldId, field]));
  const groups: GroupBuilder[] = [];
  const labelLookup = new Map<string, GroupBuilder>();

  const ageField = fieldMap.get('ageCategory');

  if (ageField?.value) {
    splitEntries(ageField.value).forEach((segment, index) => {
      const entry = parseEntry('ageCategory', segment);
      const label = entry.label ?? entry.value ?? `Population ${index + 1}`;
      const group = ensureGroup(groups, labelLookup, index, label);
      group.values.ageCategory = entry.value;
      if (!group.label) {
        group.label = label;
        labelLookup.set(normalizeLabel(label), group);
      }
    });
  }

  POPULATION_FIELDS.filter((fieldId) => fieldId !== 'ageCategory').forEach((fieldId) => {
    const field = fieldMap.get(fieldId);
    if (!field?.value) {
      return;
    }

    const segments = splitEntries(field.value);

    segments.forEach((segment, index) => {
      const entry = parseEntry(fieldId, segment);
      const group = resolveGroupForEntry(groups, labelLookup, entry, index);
      const fallbackLabel =
        entry.label ??
        group.label ??
        (groups.find((candidate) => candidate === group)?.position !== undefined
          ? `Population ${group.position + 1}`
          : `Population ${index + 1}`);

      if (!group.label && fallbackLabel) {
        group.label = fallbackLabel;
        labelLookup.set(normalizeLabel(fallbackLabel), group);
      }

      group.values[fieldId] = entry.value ?? null;
    });
  });

  const result = groups
    .map<ParsedPopulationGroup>((group, index) => ({
      label: (group.label ?? `Population ${index + 1}`).trim(),
      position: group.position ?? index,
      values: group.values,
    }))
    .filter((group) =>
      Object.values(group.values).some((value) => typeof value === 'string' && value.trim().length > 0),
    );

  return result;
}
