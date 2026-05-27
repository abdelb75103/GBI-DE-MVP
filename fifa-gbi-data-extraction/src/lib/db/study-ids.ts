import { supabaseClient } from '@/lib/db/shared';

const parseStudySequence = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const match = /^S(\d+)$/i.exec(value.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
};

const fetchStudyIdSequences = async (
  table: 'papers' | 'screening_records',
): Promise<number[]> => {
  const supabase = supabaseClient();
  const sequences: number[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('assigned_study_id')
      .range(from, from + pageSize - 1);

    const screeningTableMissing =
      table === 'screening_records' && (
        error?.code === '42P01' ||
        error?.message?.toLowerCase().includes('screening_records')
      );

    if (error && !screeningTableMissing) {
      throw new Error(`Failed to load ${table} study IDs: ${error.message}`);
    }
    if (screeningTableMissing) {
      return sequences;
    }

    sequences.push(...(data ?? []).map((row) => parseStudySequence(row.assigned_study_id)));
    if (!data || data.length < pageSize) break;
  }

  return sequences;
};

export const generateAssignedStudyId = async (): Promise<string> => {
  const [paperSequences, screeningSequences] = await Promise.all([
    fetchStudyIdSequences('papers'),
    fetchStudyIdSequences('screening_records'),
  ]);
  const maxSequence = Math.max(0, ...paperSequences, ...screeningSequences);

  return `S${String(maxSequence + 1).padStart(3, '0')}`;
};
