import crypto from 'node:crypto';

import { mapNoteRow } from '@/lib/db/mappers';
import { supabaseClient } from '@/lib/db/shared';
import type { PaperNote } from '@/lib/types';
import type { NoteInsert, NoteRow } from '@/lib/db/types';

export const listNotes = async (paperId: string): Promise<PaperNote[]> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('paper_notes')
    .select('*')
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list notes: ${error.message}`);
  }

  return (data ?? []).map((row) => mapNoteRow(row as NoteRow));
};

export const addNote = async (input: { paperId: string; body: string }): Promise<PaperNote> => {
  const supabase = supabaseClient();
  const payload: NoteInsert = {
    id: crypto.randomUUID(),
    paper_id: input.paperId,
    body: input.body,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('paper_notes').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to create note: ${error?.message ?? 'Unknown error'}`);
  }

  return mapNoteRow(data as NoteRow);
};

export const deleteNote = async (noteId: string): Promise<void> => {
  const supabase = supabaseClient();
  const { error } = await supabase.from('paper_notes').delete().eq('id', noteId);

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }
};
