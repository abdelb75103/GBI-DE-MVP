'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTimeUTC } from '@/lib/format';
import type { PaperNote } from '@/lib/types';

type NoteListProps = {
  initialNotes: PaperNote[];
  paperId: string;
};

export function NoteList({ initialNotes, paperId }: NoteListProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<PaperNote[]>(initialNotes);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleDelete = (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    setDeletingId(noteId);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/papers/${paperId}/notes/${noteId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          alert(payload.error ?? 'Failed to delete note');
          return;
        }

        router.refresh();
      } catch (err) {
        console.error('Note delete error:', err);
        alert('Failed to delete note. Please try again.');
      } finally {
        setDeletingId(null);
      }
    });
  };

  if (notes.length === 0) {
    return <p className="text-sm text-slate-500">No notes yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="group relative rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60 backdrop-blur hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <time dateTime={note.createdAt}>{formatDateTimeUTC(note.createdAt)}</time>
            <button
              type="button"
              onClick={() => handleDelete(note.id)}
              disabled={isPending && deletingId === note.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
              aria-label="Delete note"
            >
              {deletingId === note.id ? (
                'Deleting...'
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
