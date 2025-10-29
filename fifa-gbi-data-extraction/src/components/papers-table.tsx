'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { StatusPill } from '@/components/status-pill';
import type { Paper } from '@/lib/types';

type PapersTableProps = {
  papers: Paper[];
};

export function PapersTable({ papers }: PapersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadKind, setDownloadKind] = useState<'csv' | 'json' | null>(null);

  const allIds = useMemo(() => papers.map((p) => p.id), [papers]);
  const allSelected = selected.size > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === allIds.length) {
        return new Set();
      }
      return new Set(allIds);
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exportSelected = (kind: 'csv' | 'json') => {
    if (selected.size === 0) {
      setError('No papers selected');
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);
      setDownloadUrl(null);
      setDownloadKind(null);

      const response = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, paperIds: Array.from(selected) }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        export?: { downloadUrl?: string };
      };

      if (!response.ok) {
        setError(payload.error ?? 'Unable to start export');
        return;
      }

      setMessage(kind.toUpperCase() + ' export ready');
      if (payload.export?.downloadUrl) {
        setDownloadUrl(payload.export.downloadUrl);
        setDownloadKind(kind);
      }
      router.refresh();
    });
  };

  return (
    <div className="overflow-x-auto">
      {/* Selection toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-3">
        <div className="text-xs text-slate-500">
          {selected.size === 0 ? 'No papers selected' : `${selected.size} selected`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportSelected('csv')}
            disabled={isPending || selected.size === 0}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500 disabled:opacity-60"
          >
            Export selected CSV
          </button>
          <button
            type="button"
            onClick={() => exportSelected('json')}
            disabled={isPending || selected.size === 0}
            className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
          >
            Export selected JSON
          </button>
          {message ? <span className="text-xs font-medium text-emerald-600">{message}</span> : null}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download
              className="text-xs font-semibold text-indigo-600 underline underline-offset-2"
            >
              Download {downloadKind?.toUpperCase()}
            </a>
          ) : null}
          {error ? <span className="text-xs font-medium text-rose-500">{error}</span> : null}
        </div>
      </div>

      <table className="min-w-full divide-y divide-slate-200/70 text-left text-sm text-slate-700">
        <thead className="bg-slate-900/5 text-xs uppercase tracking-[0.22em] text-slate-500">
          <tr>
            <th className="px-6 py-3">
              <input
                type="checkbox"
                aria-label="Select all papers"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </th>
            <th className="px-6 py-3 font-semibold">Title</th>
            <th className="px-6 py-3 font-semibold">Status</th>
            <th className="px-6 py-3 font-semibold">Uploaded</th>
            <th className="px-6 py-3 font-semibold">Notes</th>
            <th className="px-6 py-3 font-semibold">Flag</th>
            <th className="px-6 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/70 bg-white/80">
          {papers.length === 0 ? (
            <tr>
              <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={7}>
                No uploads yet. Start by adding a PDF.
              </td>
            </tr>
          ) : (
            papers.map((paper) => (
              <tr key={paper.id} className="transition hover:bg-indigo-50/40">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${paper.title}`}
                    checked={selected.has(paper.id)}
                    onChange={() => toggleOne(paper.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-900">{paper.title}</span>
                    <span className="text-xs text-slate-500">
                      {paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}
                      {paper.year ?? 'Year N/A'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusPill status={paper.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  <time dateTime={paper.createdAt}>{new Date(paper.createdAt).toLocaleString()}</time>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">{paper.noteIds.length}</td>
                <td className="px-6 py-4">
                  <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagId)} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/paper/${paper.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700"
                    >
                      Open workspace
                    </Link>
                    <a
                      href={`/api/papers/${paper.id}/export?format=json`}
                      download
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Download JSON
                    </a>
                    <a
                      href={`/api/papers/${paper.id}/export?format=csv`}
                      download
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Download CSV
                    </a>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

