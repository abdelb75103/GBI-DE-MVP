export function formatDateTimeUTC(input: string | number | Date): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { timeZone: 'UTC', hour12: false });
}

