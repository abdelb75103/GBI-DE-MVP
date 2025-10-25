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
      const response = await fetch(`/api/papers/${paperId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: 'dev-user', body: body.trim() }),
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? 'Unable to save note');
        return;
      }

      setBody('');
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700" htmlFor="note">
        Add note
      </label>
      <textarea
        id="note"
        name="note"
        className="h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        placeholder="Capture extraction decisions or follow-ups..."
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={isPending}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          disabled={isPending}
        >
          Save note
        </button>
      </div>
    </form>
  );
}
