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
        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          isFlagged
            ? 'border-rose-200/80 bg-rose-50/80 text-rose-600 hover:bg-rose-100'
            : 'border-slate-200/70 bg-white/70 text-slate-600 hover:border-slate-300 hover:text-slate-900'
        }`}
        onClick={handleClick}
        disabled={isPending}
      >
        {isFlagged ? 'Clear Flag' : 'Flag'}
      </button>
      {error ? <span className="text-xs font-medium text-rose-500">{error}</span> : null}
    </div>
  );
}
