'use client';

import { Trash } from '@phosphor-icons/react';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, t } from '@/components/ui';
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
    return <p className={t.caption}>No notes yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id}>
          <Card className="group relative p-4">
            <div className="flex items-center justify-between gap-2">
              <time dateTime={note.createdAt} className={t.label}>
                {formatDateTimeUTC(note.createdAt)}
              </time>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Delete note"
                icon={<Trash />}
                onClick={() => handleDelete(note.id)}
                loading={isPending && deletingId === note.id}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-body">{note.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
