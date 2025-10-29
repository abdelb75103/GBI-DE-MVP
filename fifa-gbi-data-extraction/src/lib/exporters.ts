import { extractionFieldDefinitions, extractionTabMeta } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import type { ExtractionResult, Paper } from '@/lib/types';

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

const baseColumns = [
  { header: 'Paper ID', access: (paper: Paper) => paper.assignedStudyId ?? paper.id },
  { header: 'Paper Title', access: (paper: Paper) => paper.title ?? '' },
  { header: 'Status', access: (paper: Paper) => paper.status },
] as const;

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

export function buildJsonExport(paperIds: string[]) {
  const papers = paperIds
    .map((id) => mockDb.getPaper(id))
    .filter(Boolean) as Paper[];

  const records = papers.map((paper) => {
    const file = paper.fileId ? mockDb.getFile(paper.fileId) : undefined;
    const notes = mockDb.listNotes(paper.id);
    const extractions = mockDb.listExtractions(paper.id);
    return {
      paper,
      file: file
        ? {
            id: file.id,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt,
            publicPath: file.publicPath,
          }
        : undefined,
      notes,
      extractions: extractions.map<ExportExtraction>((extraction) => ({
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
      })),
    };
  });

  const missingPaperIds = paperIds.filter((id) => !records.some((r) => r.paper.id === id));

  return {
    generatedAt: new Date().toISOString(),
    paperCount: records.length,
    missingPaperIds,
    papers: records,
  };
}

export function buildCsvExport(paperIds: string[]): string {
  const headers = [
    ...baseColumns.map((column) => column.header),
    ...valueColumns.map((column) => column.label),
  ];

  const lines = paperIds.map((paperId) => {
    const paper = mockDb.getPaper(paperId);
    if (!paper) {
      return headers.map(() => escapeCsv(''));
    }

    const extractionByTab = new Map(
      mockDb
        .listExtractions(paper.id)
        .map((extraction) => [extraction.tab, extraction] as const),
    );

    const cells: string[] = [];
    baseColumns.forEach((column) => {
      cells.push(escapeCsv(column.access(paper)));
    });

    valueColumns.forEach((column) => {
      const extraction = extractionByTab.get(column.tab);
      const field = extraction?.fields.find((item) => item.fieldId === column.id);
      cells.push(escapeCsv(field?.value ?? ''));
    });

    return cells;
  });

  const headerLine = headers.map(escapeCsv).join(',');
  const rowLines = lines.map((row) => row.join(','));
  return [headerLine, ...rowLines].join('\n');
}

export function buildPaperCsv(paperId: string): string {
  return buildCsvExport([paperId]);
}
