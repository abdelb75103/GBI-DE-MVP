'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

type NoteComposerProps = {
  paperId: string;
};

export function NoteComposer({ paperId }: NoteComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError('Note cannot be empty');
      return;
    }

    startTransition(async () => {
      setError(null);
      
      try {
        const response = await fetch(`/api/papers/${paperId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body.trim() }),
        });

        if (!response.ok) {
          let errorMessage = 'Unable to save note';
          try {
            const payload = await response.json();
            errorMessage = payload.error ?? errorMessage;
          } catch {
            // Response has no JSON body, use status text
            errorMessage = response.statusText || `Error: ${response.status}`;
          }
          setError(errorMessage);
          return;
        }

        setBody('');
        router.refresh();
      } catch (err) {
        setError('Failed to save note. Please try again.');
        console.error('Note save error:', err);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500" htmlFor="note">
        Add note
      </label>
      <textarea
        id="note"
        name="note"
        className="h-28 w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder="Capture extraction decisions or follow-ups..."
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={isPending}
      />
      {error ? <p className="text-xs font-medium text-rose-500">{error}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500 disabled:opacity-60"
          disabled={isPending}
        >
          Save note
        </button>
      </div>
    </form>
  );
}
