'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type FlagToggleButtonProps = {
  paperId: string;
  isFlagged: boolean;
};

export function FlagToggleButton({ paperId, isFlagged }: FlagToggleButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (isFlagged) {
      startTransition(async () => {
        setError(null);
        const response = await fetch(`/api/papers/${paperId}/flag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Cleared by dev user' }),
        });

        if (!response.ok) {
          const payload = await response.json();
          setError(payload.error ?? 'Unable to clear flag');
          return;
        }

        router.refresh();
      });
      return;
    }

    const reason = window.prompt('Flag reason');
    if (!reason) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/papers/${paperId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? 'Unable to flag paper');
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className={`rounded border px-3 py-1 text-sm font-medium transition ${
          isFlagged
            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
        }`}
        onClick={handleClick}
        disabled={isPending}
      >
        {isFlagged ? 'Clear Flag' : 'Flag'}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}
