export type DataExtractionBatchFilter = 'total' | 'first' | 'second';

type DataExtractionPaper = {
  metadata?: Record<string, unknown> | null;
};

export const getDataExtractionBatchFilter = (value: unknown): DataExtractionBatchFilter => {
  const filter = Array.isArray(value) ? value[0] : value;
  return filter === 'first' || filter === 'second' ? filter : 'total';
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
