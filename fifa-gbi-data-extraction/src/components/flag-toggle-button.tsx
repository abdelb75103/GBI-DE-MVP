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
          body: JSON.stringify({ reason: null }),
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
            ? 'border-rose-700/80 bg-rose-900/80 text-rose-200 hover:bg-rose-800'
            : 'border-slate-700/70 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:text-slate-100'
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
