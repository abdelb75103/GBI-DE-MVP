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

// Fields from participantCharacteristics tab that define population anchors
const PARTICIPANT_CHAR_FIELDS: string[] = [
  'ageCategory',
  'sex',
  'meanAge',
  'sampleSizePlayers',
  'numberOfTeams',
  'studyPeriodYears',
  'observationDuration',
];

// We no longer maintain a hardcoded list - instead, we parse ANY field
// that contains multi-line data (detected by newlines or label — value pattern)

const normalizeLabel = (label: string) => label.trim().toLowerCase();

const splitEntries = (raw: string): string[] => {
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(/;/))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const parseEntry = (fieldId: string, raw: string): ParsedEntry => {
  // Population-defining fields (ageCategory, sex) are just identifiers
  if (fieldId === 'ageCategory' || fieldId === 'sex') {
    return { label: raw.trim(), value: raw.trim() };
  }

  // For all other fields, check if it has "label — value" format (legacy support)
  const match = raw.match(/^(.+?)\s*[:\-–—]\s*(.+)$/);
  if (match) {
    return { label: match[1].trim(), value: match[2].trim() };
  }

  // Default: just a value, no label (new simpler format)
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
    // Split on newlines WITHOUT filtering out blanks to preserve row alignment
    // This matches the processing logic for all other fields
    ageField.value.split(/\r?\n/).map((line) => line.trim()).forEach((segment, index) => {
      // Parse the entry (even if blank) to maintain position alignment
      const entry = parseEntry('ageCategory', segment);
      
      // Always ensure the group exists at this position
      const label = entry.label ?? entry.value ?? `Population ${index + 1}`;
      const group = ensureGroup(groups, labelLookup, index, label);
      
      // Only store value and label if segment is not blank
      if (segment !== '') {
        group.values.ageCategory = entry.value;
        if (!group.label) {
          group.label = label;
          labelLookup.set(normalizeLabel(label), group);
        }
      }
      // If segment is blank, group is still created to preserve position
    });
  }

  // Process ALL other fields - if they contain multi-line data, parse them into populations
  fields.forEach((field) => {
    if (field.fieldId === 'ageCategory' || !field.value) {
      return; // Skip ageCategory (already processed) and empty fields
    }

    // Check if this field has multi-line data
    const hasMultipleLines = field.value.includes('\n');
    if (!hasMultipleLines) {
      return; // Skip single-line fields - they're not population-specific
    }

    // Split on newlines WITHOUT filtering out blanks to preserve row alignment
    // (The table editor intentionally saves blank rows as empty strings between \n)
    const segments = field.value.split(/\r?\n/).map((line) => line.trim());
    
    // Only process if we have multiple segments or if it's a known participant field
    if (segments.length === 1 && !PARTICIPANT_CHAR_FIELDS.includes(field.fieldId)) {
      return;
    }

    segments.forEach((segment, index) => {
      // Parse the entry (even if blank) to maintain position alignment
      const entry = parseEntry(field.fieldId, segment);
      
      // Always resolve the group to ensure it exists at this position
      // This is critical for maintaining alignment across fields with different blank rows
      const group = resolveGroupForEntry(groups, labelLookup, entry, index);
      
      // Only store a value if the segment is not blank
      if (segment !== '') {
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

        group.values[field.fieldId] = entry.value ?? null;
      }
      // If segment is blank, group is created/resolved but no value is stored
      // This maintains position alignment: blank at index 1 ensures all fields
      // treat index 1 as the same population, even if some fields have no data for it
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
