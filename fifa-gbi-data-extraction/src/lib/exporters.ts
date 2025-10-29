import { extractionFieldDefinitions, extractionTabMeta } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import type { ExtractionFieldResult, ExtractionResult, Paper } from '@/lib/types';

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const valueColumns = extractionFieldDefinitions.map((definition) => ({
  id: definition.id,
  tab: definition.tab,
  label: definition.label,
  columnKey: `${definition.tab}.${definition.id}`,
  tabLabel: extractionTabMeta[definition.tab]?.title ?? definition.tab,
}));

const baseHeaders = [
  'paper_id',
  'paper_title',
  'paper_status',
  'paper_lead_author',
  'paper_year',
  'paper_journal',
  'paper_doi',
  'paper_flagged',
] as const;

type ExportExtractionField = ExtractionFieldResult & {
  label: string;
  tabLabel: string;
};

type ExportExtraction = ExtractionResult & {
  tabLabel: string;
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
        ...extraction,
        tabLabel: extractionTabMeta[extraction.tab]?.title ?? extraction.tab,
        fields: extraction.fields.map<ExportExtractionField>((field) => ({
          ...field,
          label: extractionFieldDefinitions.find((definition) => definition.id === field.fieldId)?.label ?? field.fieldId,
          tabLabel: extractionTabMeta[extraction.tab]?.title ?? extraction.tab,
        })),
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
    ...baseHeaders,
    ...valueColumns.map((column) => column.columnKey),
  ];

  const lines = paperIds.map((paperId) => {
    const paper = mockDb.getPaper(paperId);
    if (!paper) return headers.map(() => '');

    const extractionByTab = new Map(
      mockDb
        .listExtractions(paper.id)
        .map((extraction) => [extraction.tab, extraction] as const),
    );

    const row: Record<(typeof headers)[number], string> = {
      paper_id: paper.id,
      paper_title: paper.title ?? '',
      paper_status: paper.status,
      paper_lead_author: paper.leadAuthor ?? '',
      paper_year: paper.year ?? '',
      paper_journal: paper.journal ?? '',
      paper_doi: paper.doi ?? '',
      paper_flagged: paper.flagId ? 'true' : 'false',
    };

    valueColumns.forEach((column) => {
      const extraction = extractionByTab.get(column.tab);
      const field = extraction?.fields.find((item) => item.fieldId === column.id);
      const value = field?.value ?? '';
      row[column.columnKey] = value;
    });

    return headers.map((header) => escapeCsv(row[header] ?? ''));
  });

  const headerLine = headers.map(escapeCsv).join(',');
  return [headerLine, ...lines.map((columns) => columns.join(','))].join('\n');
}

export function buildPaperCsv(paperId: string): string {
  return buildCsvExport([paperId]);
}
