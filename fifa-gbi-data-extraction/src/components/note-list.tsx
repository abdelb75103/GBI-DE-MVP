'use client';

import { useEffect, useState } from 'react';

import type { Note } from '@/lib/types';

type NoteListProps = {
  initialNotes: Note[];
};

export function NoteList({ initialNotes }: NoteListProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  if (notes.length === 0) {
    return <p className="text-sm text-slate-500">No notes yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{note.author}</span>
            <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
          </div>
          <p className="mt-2 text-sm text-slate-700">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
