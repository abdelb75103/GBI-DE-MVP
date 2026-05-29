export const getNextTitleAbstractRecordId = (
  records: Array<{ id: string }>,
  currentRecordId: string,
) => {
  const currentIndex = records.findIndex((record) => record.id === currentRecordId);
  if (currentIndex === -1) return records[0]?.id ?? '';
  return records[currentIndex + 1]?.id ?? '';
};
