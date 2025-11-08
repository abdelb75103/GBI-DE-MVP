import { extractionFieldDefinitions, extractionTabMeta } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import type {
  ExtractionFieldResult,
  ExtractionResult,
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
      values: (bucket.get(group.id) ?? []).map((entry) => {
        let value = entry.value ?? null;
        
        // Safety: Strip any "label: " or "label - " prefix that might have leaked through (backward compatibility)
        if (value && typeof value === 'string') {
          const labelMatch = value.match(/^.+?\s*[:\-–-]\s*(.+)$/);
          if (labelMatch) {
            value = labelMatch[1].trim();
          }
        }
        
        return {
          fieldId: entry.fieldId,
          value,
          metric: entry.metric ?? null,
          unit: entry.unit ?? null,
        };
      }),
    }))
    .sort((a, b) => a.position - b.position);
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

      return {
        paper,
        file: mapFile(file),
        notes,
        extractions: extractions.map(mapExtraction),
        populations: mapPopulationGroups(populationGroups, populationValues),
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

    const fieldMap = buildFieldValueMap(extractions);

    const valuesByGroup = new Map<string, Map<string, string | null>>();
    populationValues.forEach((value) => {
      const groupValues = valuesByGroup.get(value.populationGroupId) ?? new Map<string, string | null>();
      groupValues.set(value.fieldId, value.value ?? null);
      valuesByGroup.set(value.populationGroupId, groupValues);
    });

    // If no population groups, create a single default group with a meaningful label
    const groups =
      populationGroups.length > 0
        ? [...populationGroups]
        : [{ 
            id: '__default__', 
            paperId: paper.id, 
            tab: 'participantCharacteristics' as const, 
            label: 'All participants', // More descriptive than empty string
            position: 0, 
            createdAt: '', 
            updatedAt: '' 
          }];
    const sortedGroups = groups.sort((a, b) => a.position - b.position);

    // Determine which fields have population-specific data
    const fieldsWithPopulationData = new Set<string>();
    populationValues.forEach((pv) => {
      if (pv.value) {
        fieldsWithPopulationData.add(pv.fieldId);
      }
    });

    sortedGroups.forEach((group) => {
      const baseCells = [
        escapeCsv(paper.assignedStudyId || paper.id),
        escapeCsv(paper.title ?? ''),
        escapeCsv(paper.status),
      ];

      const groupValues = valuesByGroup.get(group.id);
      const isDefaultGroup = group.id === '__default__';

      valueColumns.forEach((column) => {
        let value: string | null | undefined = groupValues?.get(column.id) ?? null;

        // Only fall back to extraction field if:
        // 1. We're in the default group (no populations), OR
        // 2. This field has NO population-specific data at all
        if (value == null && (isDefaultGroup || !fieldsWithPopulationData.has(column.id))) {
          const field = fieldMap.get(column.id);
          value = field?.value ?? null;
        }

        // Safety: Strip any "label: " or "label - " prefix that might have leaked through (backward compatibility)
        if (value && typeof value === 'string') {
          const labelMatch = value.match(/^.+?\s*[:\-–-]\s*(.+)$/);
          if (labelMatch) {
            value = labelMatch[1].trim();
          }
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
