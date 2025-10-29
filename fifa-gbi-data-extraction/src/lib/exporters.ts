import { extractionFieldDefinitions, extractionTabMeta } from '@/lib/extraction/schema';
import type { ExtractionTab, Paper } from '@/lib/types';
import { mockDb } from '@/lib/mock-db';

type CsvRow = [
  string, // paper_id
  string, // paper_title
  string, // paper_status
  ExtractionTab, // tab
  string, // tab_label
  string, // field_id
  string, // field_label
  string, // value
  string, // status
  string, // metric
  string, // confidence
  string, // source_quote
  string, // page_hint
  string, // updated_at
  string, // updated_by
  string, // extraction_model
];

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

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
      extractions,
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
  // Fixed header columns for tidy long CSV
  const headers = [
    'paper_id',
    'paper_title',
    'paper_status',
    'tab',
    'tab_label',
    'field_id',
    'field_label',
    'value',
    'status',
    'metric',
    'confidence',
    'source_quote',
    'page_hint',
    'updated_at',
    'updated_by',
    'extraction_model',
  ];

  const rows: CsvRow[] = [];

  paperIds.forEach((paperId) => {
    const paper = mockDb.getPaper(paperId);
    if (!paper) return;

    const extractionByTab = new Map(
      mockDb
        .listExtractions(paper.id)
        .map((e) => [e.tab, e] as const),
    );

    // For comparability: include ALL defined fields even if missing in extraction
    extractionFieldDefinitions.forEach((def) => {
      const extraction = extractionByTab.get(def.tab);
      const field = extraction?.fields.find((f) => f.fieldId === def.id);
      const tabLabel = extractionTabMeta[def.tab]?.title ?? def.tab;

      rows.push([
        paper.id,
        paper.title ?? '',
        paper.status,
        def.tab,
        tabLabel,
        def.id,
        def.label,
        field?.value ?? '',
        field?.status ?? 'not_reported',
        (field?.metric ?? def.metric ?? '') as string,
        field?.confidence != null ? String(field.confidence) : '',
        field?.sourceQuote ?? '',
        field?.pageHint ?? '',
        field?.updatedAt ?? '',
        field?.updatedBy ?? '',
        extraction?.model ?? '',
      ]);
    });
  });

  const headerLine = headers.map(escapeCsv).join(',');
  const rowLines = rows.map((row) => row.map((v) => escapeCsv(v ?? '')).join(','));
  return [headerLine, ...rowLines].join('\n');
}

export function buildPaperCsv(paperId: string): string {
  return buildCsvExport([paperId]);
}

