import { extractionFieldDefinitions, extractionTabMeta } from '@/lib/extraction/schema';
import { derivePopulationGroups } from '@/lib/extraction/populations';
import { mockDb } from '@/lib/mock-db';
import type {
  ExtractionFieldResult,
  ExtractionResult,
  ExtractionTab,
  Paper,
  PopulationGroup,
  PopulationValue,
  StoredFile,
} from '@/lib/types';

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const valueColumns = extractionFieldDefinitions.map((definition) => ({
  id: definition.id,
  tab: definition.tab,
  label: toTitleCase(definition.label),
  tabLabel: extractionTabMeta[definition.tab]?.title ?? definition.tab,
}));

const fieldMetricLookup = new Map(
  extractionFieldDefinitions.map((definition) => [definition.id, definition.metric ?? null]),
);

const baseHeaders = ['Paper ID', 'Paper Title', 'Status'] as const;

type ExportExtractionField = {
  fieldId: string;
  value: string | null;
  label: string;
  tab: string;
};

type ExportExtraction = {
  tab: ExtractionResult['tab'];
  tabLabel: string;
  model: ExtractionResult['model'];
  updatedAt: string;
  fields: ExportExtractionField[];
};

type ExportPopulationValue = {
  fieldId: string;
  value: string | null;
  metric: string | null;
  unit: string | null;
};

type ExportPopulationGroup = {
  id: string;
  label: string;
  position: number;
  values: ExportPopulationValue[];
};

const GLOBAL_TABS = new Set(['studyDetails', 'participantCharacteristics', 'definitions', 'exposure']);

// Tabs that use the table editor - these should NEVER autocomplete from extraction fields
// Blank cells must stay blank - strict 1:1 row mapping
const TABLE_EDITOR_TABS = new Set(['injuryTissueType', 'injuryLocation', 'illnessRegion', 'illnessEtiology']);

const sanitizeLegacyValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const match = value.match(/^.+?\s*[:\-–-]\s*(.+)$/);
  return match ? match[1].trim() : value;
};

const splitIntoLines = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value.split(/\r?\n/);
};

const mapFile = (file: StoredFile | null | undefined) =>
  file
    ? {
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: file.uploadedAt,
        storageBucket: file.storageBucket,
        storageObjectPath: file.storageObjectPath,
        publicUrl: file.publicUrl,
      }
    : undefined;

const mapExtraction = (extraction: ExtractionResult): ExportExtraction => ({
  tab: extraction.tab,
  tabLabel: extractionTabMeta[extraction.tab]?.title ?? extraction.tab,
  model: extraction.model,
  updatedAt: extraction.updatedAt,
  fields: extraction.fields.map((field) => {
    const rawLabel =
      extractionFieldDefinitions.find((definition) => definition.id === field.fieldId)?.label ?? field.fieldId;
    return {
      fieldId: field.fieldId,
      value: field.value ?? null,
      label: toTitleCase(rawLabel),
      tab: extractionTabMeta[extraction.tab]?.title ?? extraction.tab,
    };
  }),
});

const mapPopulationGroups = (
  groups: PopulationGroup[],
  values: PopulationValue[],
): ExportPopulationGroup[] => {
  const bucket = new Map<string, PopulationValue[]>();

  values.forEach((value) => {
    const collection = bucket.get(value.populationGroupId) ?? [];
    collection.push(value);
    bucket.set(value.populationGroupId, collection);
  });

  return groups
    .map<ExportPopulationGroup>((group) => ({
      id: group.id,
      label: group.label,
      position: group.position,
      values: (bucket.get(group.id) ?? []).map((entry) => ({
        fieldId: entry.fieldId,
        value: sanitizeLegacyValue(entry.value ?? null),
        metric: entry.metric ?? null,
        unit: entry.unit ?? null,
      })),
    }))
    .sort((a, b) => a.position - b.position);
};

const deriveExportPopulationGroups = (
  extractions: ExtractionResult[],
  paperId: string,
): ExportPopulationGroup[] => {
  const derived = derivePopulationGroups(
    extractions.flatMap((extraction) => extraction.fields),
  );
  return derived.map<ExportPopulationGroup>((group, index) => ({
    id: `derived-${paperId}-${index}`,
    label: group.label,
    position: group.position,
    values: Object.entries(group.values).map(([fieldId, value]) => ({
      fieldId,
      value,
      metric: fieldMetricLookup.get(fieldId) ?? null,
      unit: null,
    })),
  }));
};

const resolvePopulationGroups = (
  groups: PopulationGroup[],
  values: PopulationValue[],
  extractions: ExtractionResult[],
  paperId: string,
): ExportPopulationGroup[] => {
  if (groups.length > 0 && values.length > 0) {
    const mapped = mapPopulationGroups(groups, values);
    const hasMultiline = mapped.some((group) =>
      group.values.some((entry) => typeof entry.value === 'string' && entry.value.includes('\n')),
    );
    if (!hasMultiline) {
      return mapped;
    }
  }
  return deriveExportPopulationGroups(extractions, paperId);
};

const buildFieldValueMap = (extractions: ExtractionResult[]): Map<string, ExtractionFieldResult> => {
  const map = new Map<string, ExtractionFieldResult>();
  extractions.forEach((extraction) => {
    extraction.fields.forEach((field) => {
      map.set(field.fieldId, field);
    });
  });
  return map;
};

const normalizePopulations = (
  groups: ExportPopulationGroup[],
  extractions: ExtractionResult[],
): ExportPopulationGroup[] => {
  if (groups.length === 0) {
    return groups;
  }

  const fieldMap = buildFieldValueMap(extractions);
  const fieldLineCache = new Map<string, string[]>();
  const getGlobalLines = (fieldId: string): string[] => {
    if (!fieldLineCache.has(fieldId)) {
      const field = fieldMap.get(fieldId);
      fieldLineCache.set(fieldId, splitIntoLines(field?.value ?? null));
    }
    return fieldLineCache.get(fieldId) ?? [];
  };

  // Build a map of fieldId -> tab for quick lookup
  const fieldTabMap = new Map<string, string>();
  extractionFieldDefinitions.forEach((def) => {
    fieldTabMap.set(def.id, def.tab);
  });

  // First pass: normalize non-global fields by splitting multiline values
  // CRITICAL: For table editor tabs, values must ONLY appear in the group/row they belong to
  const normalizedGroups = groups.map((group) => {
    const normalizedValues: ExportPopulationValue[] = [];

    // Process each value entry
    group.values.forEach((entry) => {
      const tab = fieldTabMap.get(entry.fieldId);
      const isGlobal = tab ? GLOBAL_TABS.has(tab as ExtractionTab) : false;
      const isTableEditorTab = tab ? TABLE_EDITOR_TABS.has(tab as ExtractionTab) : false;

      if (!isGlobal && entry.value && typeof entry.value === 'string' && entry.value.includes('\n')) {
        // Non-global field with multiline value: split and assign to position
        const lines = splitIntoLines(entry.value);
        const lineValue = lines[group.position] ?? '';
        // For table editor tabs, only include if the line at this position has actual content
        // This prevents blank cells from being included
        if (isTableEditorTab) {
          if (lineValue && lineValue.trim().length > 0) {
            normalizedValues.push({
              ...entry,
              value: lineValue.trim(),
            });
          }
          // If blank, don't add to normalizedValues - it will be set to null in second pass
        } else {
          normalizedValues.push({
            ...entry,
            value: lineValue || null,
          });
        }
      } else if (!isGlobal && !isTableEditorTab) {
        // Non-global, non-table-editor field without multiline: keep as-is
        // (Global fields handled in second pass)
        normalizedValues.push(entry);
      } else if (!isGlobal && isTableEditorTab && entry.value) {
        // Table editor tab with single value (no newlines)
        // CRITICAL: Check if the extraction field has multiline data
        // If so, we need to parse it correctly to get the value for this specific group/row
        const field = fieldMap.get(entry.fieldId);
        if (field?.value && typeof field.value === 'string' && field.value.includes('\n')) {
          // Extraction field has multiline data - parse it correctly
          const lines = splitIntoLines(field.value);
          const lineValue = lines[group.position] ?? '';
          if (lineValue && lineValue.trim().length > 0) {
            normalizedValues.push({
              ...entry,
              value: lineValue.trim(),
            });
          }
          // If blank at this position, don't add - will be null in second pass
        } else {
          // Single value stored directly for this group - include it
          // This happens when data comes from population_values table
          normalizedValues.push(entry);
        }
      } else {
        // Global field: handled in second pass
        // Don't add here, will be processed in second pass
      }
    });

    return {
      ...group,
      values: normalizedValues,
    };
  });

  // Second pass: handle global fields and ensure table editor tabs don't autocomplete
  return normalizedGroups.map((group) => {
    const valueMap = new Map<string, string | null>();
    
    // Start with existing normalized values from first pass
    // For table editor tabs, these are ONLY values that belong to this specific group/row
    group.values.forEach((entry) => {
      valueMap.set(entry.fieldId, entry.value);
    });

    // Process all value columns to ensure global fields are handled
    valueColumns.forEach((column) => {
      const tab = fieldTabMap.get(column.id);
      const isGlobal = tab ? GLOBAL_TABS.has(tab as ExtractionTab) : false;
      const isTableEditorTab = tab ? TABLE_EDITOR_TABS.has(tab as ExtractionTab) : false;

      if (isGlobal) {
        const lines = getGlobalLines(column.id);
        if (lines.length > 1) {
          // Multi-line: use line at group position
          valueMap.set(column.id, lines[group.position] ?? '');
        } else if (lines.length === 1) {
          // Single-line: repeat on all rows
          valueMap.set(column.id, lines[0]);
        } else if (!valueMap.has(column.id)) {
          // No lines: check if field exists in extraction
          const field = fieldMap.get(column.id);
          valueMap.set(column.id, field?.value ?? null);
        }
      } else {
        // Non-global field
        const currentValue = valueMap.get(column.id);
        
        if (isTableEditorTab) {
          // CRITICAL: Table editor tabs use strict 1:1 row mapping
          // Values MUST come from the group's own data - never from extraction fields
          // Never autocomplete or propagate values
          
          if (currentValue && typeof currentValue === 'string' && currentValue.includes('\n')) {
            // Safety: split and take line at group position
            const lines = splitIntoLines(currentValue);
            const lineValue = lines[group.position] ?? '';
            if (lineValue && lineValue.trim().length > 0) {
              valueMap.set(column.id, lineValue.trim());
            } else {
              valueMap.set(column.id, null);
            }
          } else if (!valueMap.has(column.id)) {
            // Field doesn't have population data for this row
            // MUST stay blank - never autocomplete
            valueMap.set(column.id, null);
          } else if (currentValue) {
            // We have a value - make sure it's not empty
            if (typeof currentValue === 'string' && currentValue.trim().length === 0) {
              valueMap.set(column.id, null);
            }
          }
        } else {
          // Non-table-editor tab: normal processing
          if (currentValue && typeof currentValue === 'string' && currentValue.includes('\n')) {
            // Safety: split and take line at group position
            const lines = splitIntoLines(currentValue);
            valueMap.set(column.id, lines[group.position] ?? '');
          } else if (!valueMap.has(column.id)) {
            // Field doesn't have population data for this row
            // For non-table-editor tabs, check extraction field value
            // But only use it if it's a single value (not multiline)
            const field = fieldMap.get(column.id);
            const fieldValue = field?.value ?? null;
            if (fieldValue && typeof fieldValue === 'string' && !fieldValue.includes('\n')) {
              valueMap.set(column.id, fieldValue);
            } else {
              valueMap.set(column.id, null);
            }
          }
        }
      }
    });

    return {
      ...group,
      values: Array.from(valueMap.entries()).map(([fieldId, value]) => {
        // Find original entry to preserve metric and unit
        const originalEntry = group.values.find((e) => e.fieldId === fieldId);
        return {
          fieldId,
          value: value || null,
          metric: originalEntry?.metric ?? fieldMetricLookup.get(fieldId) ?? null,
          unit: originalEntry?.unit ?? null,
        };
      }),
    };
  });
};

export async function buildJsonExport(paperIds: string[]) {
  const papers = await Promise.all(paperIds.map((id) => mockDb.getPaper(id)));
  const existingPapers = papers.filter(Boolean) as Paper[];

  const records = await Promise.all(
    existingPapers.map(async (paper) => {
      const file = paper.primaryFileId ? await mockDb.getFile(paper.primaryFileId) : undefined;
      const notes = await mockDb.listNotes(paper.id);
      const extractions = await mockDb.listExtractions(paper.id);
      const populationGroups = await mockDb.listPopulationGroups(paper.id);
      const populationValues = await mockDb.listPopulationValues(paper.id);

      const populations = resolvePopulationGroups(populationGroups, populationValues, extractions, paper.id);
      const normalizedPopulations = normalizePopulations(populations, extractions);

      return {
        paper,
        file: mapFile(file),
        notes,
        extractions: extractions.map(mapExtraction),
        populations: normalizedPopulations,
      };
    }),
  );

  const existingIds = new Set(existingPapers.map((paper) => paper.id));
  const missingPaperIds = paperIds.filter((id) => !existingIds.has(id));

  return {
    generatedAt: new Date().toISOString(),
    paperCount: records.length,
    missingPaperIds,
    papers: records,
  };
}

export async function buildCsvExport(paperIds: string[]): Promise<string> {
  const headers = [...baseHeaders, ...valueColumns.map((column) => column.label)];
  const rows: string[][] = [];

  for (const paperId of paperIds) {
    const paper = await mockDb.getPaper(paperId);

    if (!paper) {
      rows.push(headers.map(() => escapeCsv('')));
      continue;
    }

    const [extractions, populationGroups, populationValues] = await Promise.all([
      mockDb.listExtractions(paper.id),
      mockDb.listPopulationGroups(paper.id),
      mockDb.listPopulationValues(paper.id),
    ]);

    let exportGroups = resolvePopulationGroups(populationGroups, populationValues, extractions, paper.id);
    if (!exportGroups.length) {
      exportGroups = [
        {
          id: '__default__',
          label: 'All participants',
          position: 0,
          values: [],
        },
      ];
    }
    
    // Normalize populations to split multiline values and handle global fields
    const normalizedGroups = normalizePopulations(exportGroups, extractions);
    const sortedGroups = [...normalizedGroups].sort((a, b) => a.position - b.position);

    // Build value map for quick lookup
    const valuesByGroup = new Map<string, Map<string, string | null>>();
    sortedGroups.forEach((group) => {
      const map = new Map<string, string | null>();
      group.values.forEach((entry) => {
        map.set(entry.fieldId, entry.value ?? null);
      });
      valuesByGroup.set(group.id, map);
    });

    sortedGroups.forEach((group) => {
      const baseCells = [
        escapeCsv(paper.assignedStudyId || paper.id),
        escapeCsv(paper.title ?? ''),
        escapeCsv(paper.status),
      ];

      const groupValues = valuesByGroup.get(group.id);

      valueColumns.forEach((column) => {
        let value: string | null | undefined = groupValues?.get(column.id) ?? null;

        // Values are already normalized by normalizePopulations, but apply legacy sanitization
        value = sanitizeLegacyValue(value);
        
        // Final safety check: remove any remaining newlines
        if (value && typeof value === 'string') {
          value = value.replace(/\r?\n/g, ' ');
        }
        
        baseCells.push(escapeCsv(value ?? ''));
      });

      rows.push(baseCells);
    });
  }

  const headerLine = headers.map(escapeCsv).join(',');
  const dataLines = rows.map((row) => row.join(','));
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

export async function buildPaperCsv(paperId: string): Promise<string> {
  return buildCsvExport([paperId]);
}
