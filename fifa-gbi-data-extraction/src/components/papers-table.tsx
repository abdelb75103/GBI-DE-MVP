'use client';

import { ArrowSquareOut, CaretDown, FileText } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { AssignmentBadge } from '@/components/assignment-badge';
import { FlagToggleButton } from '@/components/flag-toggle-button';
import { StatusPill, statusTone } from '@/components/status-pill';
import {
  Button,
  Checkbox,
  cn,
  EmptyState,
  numericCell,
  RecordRow,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  t,
} from '@/components/ui';
import { useActiveProfileState } from '@/hooks/use-active-profile';
import type { DataExtractionPaperSummary } from '@/lib/data-extraction-batch-filter';
import { getAnalysisPaperRoleLabel } from '@/lib/analysis-source-policy';

type PapersTableProps = {
  papers: DataExtractionPaperSummary[];
  canBulkExport?: boolean;
  isAdmin?: boolean;
};

const PAGE_SIZE = 20;

export function PapersTable({ papers, canBulkExport = true, isAdmin: _isAdmin = false }: PapersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const getAssignmentStatus = (paper: DataExtractionPaperSummary) => {
    if (paper.status === 'archived') {
      return 'duplicate' as const;
    }
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
  const currentQuery = searchParams.toString();
  const returnTo = `${pathname}${currentQuery ? `?${currentQuery}` : ''}`;
  const getPaperHref = (paperId: string) => `/paper/${paperId}?returnTo=${encodeURIComponent(returnTo)}`;

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
        excludedPapers?: Array<{ id: string }>;
      };

      if (!response.ok) {
        setError(payload.error ?? 'Unable to start export');
        return;
      }

      const excludedCount = payload.excludedPapers?.length ?? 0;
      setMessage(
        excludedCount > 0
          ? `${kind.toUpperCase()} export ready. ${excludedCount} source-only ${excludedCount === 1 ? 'paper was' : 'papers were'} excluded.`
          : `${kind.toUpperCase()} export ready`,
      );
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
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpenFor(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpenFor]);

  // One definition each, rendered in both the mobile and desktop branches.
  const exportBar = canBulkExport ? (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
      <p className={t.caption}>{selected.size === 0 ? 'No papers selected' : `${selected.size} selected`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => exportSelected('csv')}
          disabled={selected.size === 0}
          loading={isPending}
        >
          Export selected CSV
        </Button>
        <Button size="sm" onClick={() => exportSelected('json')} disabled={isPending || selected.size === 0}>
          Export selected JSON
        </Button>
        {message ? <span className="text-xs font-medium text-positive-ink">{message}</span> : null}
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download
            className="text-xs font-semibold text-navy-600 underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-focus"
          >
            Download {downloadKind?.toUpperCase()}
          </a>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs font-medium text-negative-ink">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  ) : null;

  const pagination =
    papers.length > PAGE_SIZE ? (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className={`${t.caption} ${t.num}`}>
          Showing {startIndex + 1}–{Math.min(endIndex, papers.length)} of {papers.length}
        </p>
        <div className="inline-flex items-center gap-2">
          <Button size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={!hasPreviousPage}>
            Previous
          </Button>
          <span className={`${t.caption} ${t.num}`}>
            Page {currentPageSafe} of {totalPages}
          </span>
          <Button
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    ) : null;

  const emptyState = (
    <EmptyState
      icon={<FileText />}
      title="No uploads yet"
      description="Papers appear here once a PDF has been added to the library."
    />
  );

  const analysisRoleTag = (paper: DataExtractionPaperSummary) =>
    paper.analysisRole !== 'standalone' ? (
      <Tag>
        {getAnalysisPaperRoleLabel(paper.analysisRole)}
        {paper.includeInAnalysisExport ? '' : ' · source only'}
      </Tag>
    ) : null;

  return (
    <div>
      {/* Mobile card list */}
      <div className="md:hidden">
        {exportBar}
        <div className="space-y-2.5 px-4 py-4">
          {papers.length === 0
            ? emptyState
            : visiblePapers.map((paper) => {
                const isSelected = selected.has(paper.id);
                const notesLabel = paper.noteCount === 1 ? 'note' : 'notes';

                return (
                  <RecordRow key={paper.id} tone={statusTone(paper.status)} selected={isSelected}>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag mono>{paper.assignedStudyId}</Tag>
                        <span className={t.caption}>{paper.year}</span>
                        <StatusPill status={paper.status} />
                      </div>
                      <Link
                        href={getPaperHref(paper.id)}
                        className="block text-[13px] font-semibold text-ink underline-offset-2 hover:text-navy-600 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
                      >
                        {paper.title}
                      </Link>
                      <p className={t.caption}>{paper.leadAuthor || 'Unknown author'}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {analysisRoleTag(paper)}
                        <AssignmentBadge status={getAssignmentStatus(paper)} assigneeName={paper.assigneeName} />
                        <Tag>
                          {paper.noteCount} {notesLabel}
                        </Tag>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Link
                          href={getPaperHref(paper.id)}
                          className="inline-flex min-h-9 items-center rounded-ctl bg-navy-600 px-3.5 text-[13px] font-semibold text-white transition-colors duration-[160ms] ease-gbi hover:bg-navy-500 focus-visible:outline-none focus-visible:shadow-focus"
                        >
                          Open paper
                        </Link>
                        <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                        {canBulkExport ? (
                          <Checkbox
                            label={`Select ${paper.title} for export`}
                            hideLabel
                            checked={isSelected}
                            onChange={() => toggleOne(paper.id)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </RecordRow>
                );
              })}
        </div>
        {pagination}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        {exportBar}
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <thead>
              <tr>
                <Th className="w-12">
                  {canBulkExport ? (
                    <Checkbox
                      label="Select all papers"
                      hideLabel
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                    />
                  ) : null}
                </Th>
                <Th>Title</Th>
                <Th>Assignment</Th>
                <Th>Status</Th>
                <Th className={numericCell}>Notes</Th>
                <Th>Flag</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {papers.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="p-0">
                    {emptyState}
                  </Td>
                </tr>
              ) : (
                visiblePapers.map((paper) => {
                  const isSelected = selected.has(paper.id);

                  return (
                    <Tr key={paper.id}>
                      <Td>
                        {canBulkExport ? (
                          <Checkbox
                            label={`Select ${paper.title}`}
                            hideLabel
                            checked={isSelected}
                            onChange={() => toggleOne(paper.id)}
                          />
                        ) : null}
                      </Td>
                      <Td className="max-w-[22rem]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Tag mono>{paper.assignedStudyId}</Tag>
                            <span className={t.caption}>{paper.year}</span>
                          </div>
                          <Link
                            href={getPaperHref(paper.id)}
                            // No `block` here: line-clamp needs its own display value.
                            className="line-clamp-2 text-[13px] font-semibold text-ink underline-offset-2 hover:text-navy-600 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
                          >
                            {paper.title}
                          </Link>
                          <p className={t.caption}>{paper.leadAuthor || 'Unknown author'}</p>
                          {analysisRoleTag(paper)}
                        </div>
                      </Td>
                      <Td>
                        <AssignmentBadge status={getAssignmentStatus(paper)} assigneeName={paper.assigneeName} />
                      </Td>
                      <Td>
                        <StatusPill status={paper.status} />
                      </Td>
                      <Td className={numericCell}>{paper.noteCount}</Td>
                      <Td>
                        <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                      </Td>
                      <Td>
                        <div className="relative inline-block text-left">
                          <Button
                            size="sm"
                            aria-expanded={menuOpenFor === paper.id}
                            aria-haspopup="menu"
                            onClick={() => setMenuOpenFor((prev) => (prev === paper.id ? null : paper.id))}
                          >
                            Actions
                            <CaretDown aria-hidden weight="bold" className="h-3.5 w-3.5" />
                          </Button>

                          {menuOpenFor === paper.id ? (
                            <div
                              role="menu"
                              ref={(el) => {
                                if (el) {
                                  menuRefs.current.set(paper.id, el);
                                }
                              }}
                              className="absolute right-0 z-20 mt-1.5 w-48 origin-top-right animate-[gbi-pop_120ms_var(--ease)] rounded-card bg-surface p-1 shadow-e2"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuOpenFor(null);
                                  router.push(getPaperHref(paper.id));
                                }}
                                className={MENU_ITEM}
                              >
                                Open
                                <ArrowSquareOut aria-hidden className="h-3.5 w-3.5" />
                              </button>
                              {canBulkExport ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    toggleOne(paper.id);
                                    setMenuOpenFor(null);
                                  }}
                                  className={MENU_ITEM}
                                >
                                  {isSelected ? 'Deselect' : 'Select'} for export
                                </button>
                              ) : null}
                              {paper.downloadUrl ? (
                                <a
                                  href={paper.downloadUrl}
                                  download
                                  role="menuitem"
                                  onClick={() => setMenuOpenFor(null)}
                                  className={MENU_ITEM}
                                >
                                  Download PDF
                                </a>
                              ) : null}
                              <a
                                href={`/api/papers/${paper.id}/export?format=csv${
                                  paper.includeInAnalysisExport ? '' : '&scope=source'
                                }`}
                                download
                                role="menuitem"
                                onClick={() => setMenuOpenFor(null)}
                                className={MENU_ITEM}
                              >
                                {paper.includeInAnalysisExport ? 'Download CSV' : 'Download source CSV'}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
        {pagination}
      </div>
    </div>
  );
}

const MENU_ITEM = cn(
  'flex w-full min-h-9 items-center justify-between gap-2 rounded-ctl px-2.5 text-[13px] font-medium text-ink-muted',
  'transition-[background-color,color] duration-[160ms] ease-gbi hover:bg-surface-sunk hover:text-ink',
  'focus-visible:outline-none focus-visible:shadow-focus',
);
