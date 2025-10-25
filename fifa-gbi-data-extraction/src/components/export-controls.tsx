'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type ExportControlsProps = {
  paperIds: string[];
};

export function ExportControls({ paperIds }: ExportControlsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const triggerExport = (kind: 'csv' | 'json') => {
    if (paperIds.length === 0) {
      setError('No papers available to export');
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const response = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, paperIds }),
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? 'Unable to start export');
        return;
      }

      setMessage(kind.toUpperCase() + ' export ready');
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-slate-700">Exports</p>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          onClick={() => triggerExport('csv')}
          disabled={isPending}
        >
          Export CSV
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          onClick={() => triggerExport('json')}
          disabled={isPending}
        >
          Export JSON
        </button>
        {message ? <span className="text-xs text-emerald-600">{message}</span> : null}
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
    </div>
  );
}
