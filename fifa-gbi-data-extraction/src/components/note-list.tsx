'use client';

import { useEffect, useState } from 'react';
import { formatDateTimeUTC } from '@/lib/format';
import type { PaperNote } from '@/lib/types';

type NoteListProps = {
  initialNotes: PaperNote[];
};

export function NoteList({ initialNotes }: NoteListProps) {
  const [notes, setNotes] = useState<PaperNote[]>(initialNotes);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  if (notes.length === 0) {
    return <p className="text-sm text-slate-500">No notes yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60 backdrop-blur"
        >
          <div className="flex items-center justify-end text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <time dateTime={note.createdAt}>{formatDateTimeUTC(note.createdAt)}</time>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
