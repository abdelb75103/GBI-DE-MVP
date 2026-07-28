'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { Button, Field, Textarea } from '@/components/ui';

type NoteComposerProps = {
  paperId: string;
};

export function NoteComposer({ paperId }: NoteComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const saveNote = () => {
    if (!body.trim()) {
      return;
    }

    startTransition(async () => {
      setError(null);
      setSuccessMessage(null);

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
        setSuccessMessage('Note saved');
        setTimeout(() => setSuccessMessage(null), 2000);
        router.refresh();
      } catch (err) {
        setError('Failed to save note. Please try again.');
        console.error('Note save error:', err);
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError('Note cannot be empty');
      return;
    }
    saveNote();
  };

  const handleBlur = () => {
    if (body.trim()) {
      saveNote();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Add note" error={error} help="Auto-saves when you click outside.">
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="note"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className="h-28"
            placeholder="Capture extraction decisions or follow-ups..."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onBlur={handleBlur}
            disabled={isPending}
          />
        )}
      </Field>
      {successMessage ? (
        <p role="status" className="text-xs font-medium text-positive-ink">
          {successMessage}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isPending}>
          Save note
        </Button>
      </div>
    </form>
  );
}
