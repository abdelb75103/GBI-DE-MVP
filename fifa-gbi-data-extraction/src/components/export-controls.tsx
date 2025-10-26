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
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Exports</p>
          <p className="text-xs text-slate-500">Launch a fresh dataset to share progress with downstream tools.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500 disabled:opacity-60"
            onClick={() => triggerExport('csv')}
            disabled={isPending}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
            onClick={() => triggerExport('json')}
            disabled={isPending}
          >
            Export JSON
          </button>
          {message ? <span className="text-xs font-medium text-emerald-600">{message}</span> : null}
          {error ? <span className="text-xs font-medium text-rose-500">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
