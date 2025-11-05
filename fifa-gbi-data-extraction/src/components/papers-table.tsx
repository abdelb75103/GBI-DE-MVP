'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { AssignmentBadge } from '@/components/assignment-badge';
import { FlagToggleButton } from '@/components/flag-toggle-button';
import { StatusPill } from '@/components/status-pill';
import { useActiveProfileState } from '@/hooks/use-active-profile';
import { formatDateTimeUTC } from '@/lib/format';
import type { Paper } from '@/lib/types';

type PapersTableProps = {
  papers: Paper[];
  canBulkExport?: boolean;
};

export function PapersTable({ papers, canBulkExport = true }: PapersTableProps) {
  const router = useRouter();
  const { profile } = useActiveProfileState();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadKind, setDownloadKind] = useState<'csv' | 'json' | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const menuRefs = useRef(new Map<string, HTMLDivElement>());

  const getAssignmentStatus = (paper: Paper) => {
    if (!paper.assignedTo) {
      return 'available' as const;
    }
    if (profile && paper.assignedTo === profile.id) {
      return 'mine' as const;
    }
    return 'assigned' as const;
  };

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

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuOpenFor) {
        return;
      }
      const menuNode = menuRefs.current.get(menuOpenFor);
      if (menuNode && !menuNode.contains(event.target as Node)) {
        setMenuOpenFor(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenFor]);

  return (
    <div className="overflow-x-auto">
      {/* Selection toolbar */}
      {canBulkExport ? (
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
      ) : null}

      <table className="min-w-full divide-y divide-slate-200/70 text-left text-sm text-slate-700">
        <thead className="bg-slate-900/5 text-xs uppercase tracking-[0.22em] text-slate-500">
          <tr>
            <th className="px-6 py-3">
              {canBulkExport ? (
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
              ) : null}
            </th>
            <th className="px-6 py-3 font-semibold">Title</th>
            <th className="px-6 py-3 text-center font-semibold">Assignment</th>
            <th className="px-6 py-3 text-center font-semibold">Status</th>
            <th className="px-6 py-3 text-center font-semibold">Uploaded</th>
            <th className="px-6 py-3 text-center font-semibold">Notes</th>
            <th className="px-6 py-3 text-center font-semibold">Flag</th>
            <th className="px-6 py-3 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/70 bg-white/80">
          {papers.length === 0 ? (
            <tr>
              <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={8}>
                No uploads yet. Start by adding a PDF.
              </td>
            </tr>
          ) : (
            papers.map((paper) => {
              const assignmentStatus = getAssignmentStatus(paper);
              const isAssignedToOther = assignmentStatus === 'assigned';
              const rowClassName = isAssignedToOther
                ? 'transition opacity-50 cursor-not-allowed'
                : assignmentStatus === 'mine'
                  ? 'transition hover:bg-indigo-50/40 bg-indigo-50/20 border-l-2 border-l-indigo-500'
                  : 'transition hover:bg-indigo-50/40';

              return (
                <tr key={paper.id} className={rowClassName}>
                  <td className="px-6 py-4">
                    {canBulkExport ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${paper.title}`}
                        checked={selected.has(paper.id)}
                        onChange={() => toggleOne(paper.id)}
                        disabled={isAssignedToOther}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          {paper.assignedStudyId}
                        </span>
                        {isAssignedToOther ? (
                          <span
                            className="font-semibold text-slate-600 cursor-not-allowed"
                            title={`This paper is assigned to ${paper.assigneeName || 'another user'}`}
                          >
                            {paper.title}
                          </span>
                        ) : (
                          <Link
                            href={`/paper/${paper.id}`}
                            className="font-semibold text-slate-900 transition hover:text-indigo-700"
                          >
                            {paper.title}
                          </Link>
                        )}
                      </div>
                      {paper.leadAuthor || paper.year ? (
                        <span className="text-xs text-slate-500">
                          {paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}
                          {paper.year ?? 'Year N/A'}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <AssignmentBadge status={assignmentStatus} assigneeName={paper.assigneeName} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusPill status={paper.status} />
                  </td>
                <td className="px-6 py-4 text-center text-sm text-slate-500">
                  <time dateTime={paper.createdAt}>{formatDateTimeUTC(paper.createdAt)}</time>
                </td>
                <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                  {paper.noteCount ?? 0}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                  </div>
                </td>
                  <td className="px-6 py-4 text-center">
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={menuOpenFor === paper.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuOpenFor((current) => (current === paper.id ? null : paper.id));
                        }}
                        className="inline-flex items-center justify-center text-slate-600 transition hover:text-indigo-700"
                      >
                        <span className="sr-only">Paper actions</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5"
                          aria-hidden
                        >
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                      {menuOpenFor === paper.id ? (
                        <div
                          ref={(node) => {
                            if (node) {
                              menuRefs.current.set(paper.id, node);
                            } else {
                              menuRefs.current.delete(paper.id);
                            }
                          }}
                          role="menu"
                          className="absolute right-0 top-0 z-20 w-44 rounded-xl border border-slate-200/80 bg-white/95 p-2 text-sm shadow-lg backdrop-blur transition"
                          style={{ transform: 'translateY(calc(-100% - 0.5rem))' }}
                        >
                          {isAssignedToOther ? (
                            <div className="rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed">
                              <div className="flex items-center justify-between">
                                Open workspace
                                <span aria-hidden>🔒</span>
                              </div>
                              <div className="text-[10px] mt-1">
                                Assigned to {paper.assigneeName || 'another user'}
                              </div>
                            </div>
                          ) : (
                            <Link
                              href={`/paper/${paper.id}`}
                              onClick={() => setMenuOpenFor(null)}
                              className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              Open workspace
                              <span aria-hidden>↗</span>
                            </Link>
                          )}
                          <a
                            href={`/api/papers/${paper.id}/export?format=json`}
                            download
                            onClick={() => setMenuOpenFor(null)}
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Download JSON
                          </a>
                          <a
                            href={`/api/papers/${paper.id}/export?format=csv`}
                            download
                            onClick={() => setMenuOpenFor(null)}
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Download CSV
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
