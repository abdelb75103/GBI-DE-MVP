import type { PaperStatus } from '@/lib/types';

export type DataExtractionBatchFilter = 'total' | 'first' | 'second';

export type DataExtractionPaperSummary = {
  id: string;
  assignedStudyId: string;
  title: string;
  status: PaperStatus;
  leadAuthor: string | null;
  journal: string | null;
  year: string | null;
  doi: string | null;
  flagReason: string | null;
  noteCount: number;
  assignedTo: string | null;
  assigneeName?: string;
  downloadUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type DataExtractionPaperRow = {
  id: string;
  assigned_study_id: string;
  title: string;
  status: PaperStatus;
  lead_author: string | null;
  journal: string | null;
  year: string | null;
  doi: string | null;
  flag_reason: string | null;
  assigned_to: string | null;
  search_batch: string | null;
  search_batch_label: string | null;
  paper_notes: Array<{ count?: number | null }> | null;
};

type DataExtractionPaper = {
  metadata?: Record<string, unknown> | null;
};

export const getDataExtractionBatchFilter = (value: unknown): DataExtractionBatchFilter => {
  const filter = Array.isArray(value) ? value[0] : value;
  return filter === 'first' || filter === 'second' ? filter : 'total';
};

export const getDataExtractionBatchHref = (
  filter: DataExtractionBatchFilter,
  searchParams = new URLSearchParams(),
): string => {
  const params = new URLSearchParams(searchParams);
  if (filter === 'total') params.delete('batch');
  else params.set('batch', filter);
  const query = params.toString();
  return `/data-extraction${query ? `?${query}` : ''}`;
};

export const isSecondSearchPaper = (paper: DataExtractionPaper): boolean => {
  const metadata = paper.metadata ?? {};
  return metadata.searchBatch === 'second' || (
    typeof metadata.searchBatchLabel === 'string' && metadata.searchBatchLabel.includes('Second search')
  );
};

export const filterDataExtractionPapers = <T extends DataExtractionPaper>(
  papers: T[],
  filter: DataExtractionBatchFilter
): T[] => {
  if (filter === 'total') return papers;
  return papers.filter((paper) => isSecondSearchPaper(paper) === (filter === 'second'));
};

export const mapDataExtractionPaperRow = (
  row: DataExtractionPaperRow,
  assigneeNames: Map<string, string>,
): DataExtractionPaperSummary => {
  const metadata = {
    ...(row.search_batch !== null ? { searchBatch: row.search_batch } : {}),
    ...(row.search_batch_label !== null ? { searchBatchLabel: row.search_batch_label } : {}),
  };
  const assigneeName = row.assigned_to === null ? undefined : assigneeNames.get(row.assigned_to);

  return {
    id: row.id,
    assignedStudyId: row.assigned_study_id,
    title: row.title,
    status: row.status,
    leadAuthor: row.lead_author,
    journal: row.journal,
    year: row.year,
    doi: row.doi,
    flagReason: row.flag_reason,
    noteCount: Array.isArray(row.paper_notes) ? (row.paper_notes[0]?.count ?? 0) : 0,
    assignedTo: row.assigned_to,
    ...(assigneeName !== undefined ? { assigneeName } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
};
