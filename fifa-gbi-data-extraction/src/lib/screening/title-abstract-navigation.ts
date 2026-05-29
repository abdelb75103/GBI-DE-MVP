export const getNextTitleAbstractRecordId = (
  records: Array<{ id: string }>,
  currentRecordId: string,
) => {
  const currentIndex = records.findIndex((record) => record.id === currentRecordId);
  if (currentIndex === -1) return records[0]?.id ?? '';
  return records[currentIndex + 1]?.id ?? '';
};

export const removeCompletedTitleAbstractRecord = <T extends { id: string }>(
  records: T[],
  completedRecordId: string,
): { records: T[]; selectedId: string } => {
  const completedIndex = records.findIndex((record) => record.id === completedRecordId);
  if (completedIndex === -1) {
    return { records, selectedId: records[0]?.id ?? '' };
  }

  const remaining = records.filter((record) => record.id !== completedRecordId);
  const nextSelectedId = records[completedIndex + 1]?.id ?? remaining[0]?.id ?? '';
  const nextSelected = remaining.find((record) => record.id === nextSelectedId);
  if (!nextSelected) {
    return { records: remaining, selectedId: '' };
  }

  return {
    records: [
      nextSelected,
      ...remaining.filter((record) => record.id !== nextSelectedId),
    ],
    selectedId: nextSelectedId,
  };
};
