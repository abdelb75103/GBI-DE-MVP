'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { AssignmentBadge } from '@/components/assignment-badge';
import { FlagToggleButton } from '@/components/flag-toggle-button';
import { StatusPill } from '@/components/status-pill';
import { useActiveProfileState } from '@/hooks/use-active-profile';
import type { Paper } from '@/lib/types';

type PapersTableProps = {
  papers: Paper[];
  canBulkExport?: boolean;
  isAdmin?: boolean;
};

const PAGE_SIZE = 20;

export function PapersTable({ papers, canBulkExport = true, isAdmin: _isAdmin = false }: PapersTableProps) {
  const router = useRouter();
  const { profile } = useActiveProfileState();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadKind, setDownloadKind] = useState<'csv' | 'json' | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const menuRefs = useRef(new Map<string, HTMLDivElement>());
  void _isAdmin;

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

  const totalPages = Math.max(1, Math.ceil(papers.length / PAGE_SIZE));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (currentPageSafe - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visiblePapers = papers.slice(startIndex, endIndex);
  const hasPreviousPage = currentPageSafe > 1;
  const hasNextPage = currentPageSafe < totalPages;

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
    <div className="space-y-4">
      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {canBulkExport ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm ring-1 ring-slate-200/60">
            <div className="text-xs text-slate-500">
              {selected.size === 0 ? 'No papers selected' : `${selected.size} selected`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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

        {papers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-center text-sm text-slate-500 shadow-sm">
            No uploads yet. Start by adding a PDF.
          </div>
        ) : (
          visiblePapers.map((paper) => {
            const assignmentStatus = getAssignmentStatus(paper);
            const isSelected = selected.has(paper.id);
            const notesLabel = paper.noteCount === 1 ? 'note' : 'notes';

            return (
              <div
                key={paper.id}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60"
              >
                <div className="flex items-start gap-3">
                  {canBulkExport ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${paper.title}`}
                      checked={isSelected}
                      onChange={() => toggleOne(paper.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  ) : null}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {paper.assignedStudyId}
                      </span>
                      <span className="text-[11px] text-slate-500">{paper.year}</span>
                    </div>
                    <Link
                      href={`/paper/${paper.id}`}
                      className="text-base font-semibold text-slate-900 underline-offset-2 hover:text-indigo-700 hover:underline"
                    >
                      {paper.title}
                    </Link>
                    <p className="text-xs text-slate-600">{paper.leadAuthor || 'Unknown author'}</p>
                  </div>
                  <StatusPill status={paper.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <AssignmentBadge status={assignmentStatus} assigneeName={paper.assigneeName} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    {paper.noteCount} {notesLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    {paper.flagReason ? 'Flagged' : 'Not flagged'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/paper/${paper.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Open paper
                  </Link>
                  <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                  {canBulkExport ? (
                    <button
                      type="button"
                      onClick={() => toggleOne(paper.id)}
                      className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                    >
                      {isSelected ? 'Deselect' : 'Select'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {papers.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200/60">
            <div>
              {startIndex + 1}–{Math.min(endIndex, papers.length)} of {papers.length}
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!hasPreviousPage}
                className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
              >
                Previous
              </button>
              <span>
                Page {currentPageSafe} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!hasNextPage}
                className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
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
              <th className="px-6 py-3 text-center font-semibold">Notes</th>
              <th className="px-6 py-3 text-center font-semibold">Flag</th>
              <th className="px-6 py-3 text-center font-semibold">Actions</th>
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
              visiblePapers.map((paper) => {
                const assignmentStatus = getAssignmentStatus(paper);
                const isSelected = selected.has(paper.id);
                const notesLabel = paper.noteCount === 1 ? 'note' : 'notes';

                return (
                  <tr key={paper.id} className="align-middle transition hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      {canBulkExport ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${paper.title}`}
                          checked={isSelected}
                          onChange={() => toggleOne(paper.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      ) : null}
                    </td>
                    <td className="max-w-[22rem] px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {paper.assignedStudyId}
                          </span>
                          <span className="text-xs text-slate-500">{paper.year}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/paper/${paper.id}`}
                            className="line-clamp-2 text-sm font-semibold text-slate-900 underline-offset-2 hover:text-indigo-700 hover:underline"
                          >
                            {paper.title}
                          </Link>
                          <p className="text-xs text-slate-600">{paper.leadAuthor || 'Unknown author'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                    <AssignmentBadge status={assignmentStatus} assigneeName={paper.assigneeName} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusPill status={paper.status} />
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-700">
                      {paper.noteCount} {notesLabel}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => setMenuOpenFor((prev) => (prev === paper.id ? null : paper.id))}
                          className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          Actions
                          <svg
                            className="ml-1.5 h-4 w-4 text-slate-500"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                          >
                            <path
                              d="M6 8l4 4 4-4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        {menuOpenFor === paper.id ? (
                          <div
                            ref={(el) => {
                              if (el) {
                                menuRefs.current.set(paper.id, el);
                              }
                            }}
                            className="absolute right-0 z-20 mt-2 w-44 origin-top-right overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 text-sm shadow-xl ring-1 ring-slate-200/60 backdrop-blur"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpenFor(null);
                                router.push(`/paper/${paper.id}`);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              Open
                              <span aria-hidden>↗</span>
                            </button>
                            {canBulkExport ? (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleOne(paper.id);
                                  setMenuOpenFor(null);
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                {isSelected ? 'Deselect' : 'Select'} for export
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  readOnly
                                  checked={isSelected}
                                />
                              </button>
                            ) : null}
                            {paper.downloadUrl ? (
                              <a
                                href={paper.downloadUrl}
                                download
                                onClick={() => setMenuOpenFor(null)}
                                className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                Download PDF
                              </a>
                            ) : null}
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
        {papers.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-slate-200/70 px-6 py-3 text-xs text-slate-500">
            <div>
              Showing {startIndex + 1}–{Math.min(endIndex, papers.length)} of {papers.length}
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!hasPreviousPage}
                className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
              >
                Previous
              </button>
              <span>
                Page {currentPageSafe} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!hasNextPage}
                className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
