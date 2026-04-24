import { supabaseClient } from '@/lib/db/shared';

const parseStudySequence = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const match = /^S(\d+)$/i.exec(value.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
};

export const generateAssignedStudyId = async (): Promise<string> => {
  const supabase = supabaseClient();

  const { data: paperRows, error: paperError } = await supabase
    .from('papers')
    .select('assigned_study_id')
    .order('assigned_study_id', { ascending: false })
    .limit(1000);

  if (paperError) {
    throw new Error(`Failed to load paper study IDs: ${paperError.message}`);
  }

  const { data: screeningRows, error: screeningError } = await supabase
    .from('screening_records')
    .select('assigned_study_id')
    .order('assigned_study_id', { ascending: false })
    .limit(1000);

  const screeningTableMissing =
    screeningError?.code === '42P01' ||
    screeningError?.message?.toLowerCase().includes('screening_records');

  if (screeningError && !screeningTableMissing) {
    throw new Error(`Failed to load screening study IDs. Apply the screening migration first: ${screeningError.message}`);
  }

  const maxSequence = [...(paperRows ?? []), ...(screeningRows ?? [])].reduce((max, row) => {
    const seq = parseStudySequence(row.assigned_study_id);
    return seq > max ? seq : max;
  }, 0);

  return `S${String(maxSequence + 1).padStart(3, '0')}`;
};
