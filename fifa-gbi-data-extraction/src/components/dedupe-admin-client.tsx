'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button, EmptyState, Pill, Tag, t } from '@/components/ui';
import type { Tone } from '@/components/ui';
import { formatDateTimeUTC } from '@/lib/format';
import type { DedupePaperSummary, PaperDuplicate } from '@/lib/types';

type Props = {
  initialDuplicates: PaperDuplicate[];
  papers: DedupePaperSummary[];
};

type ActionState = { message: string; tone: 'neutral' | 'error' | 'success' };

const statusCopy: Record<PaperDuplicate['status'], string> = {
  unreviewed: 'Needs review',
  confirmed_duplicate: 'Marked duplicate',
  not_duplicate: 'Not a duplicate',
  dismissed: 'Dismissed',
};

const reasonCopy: Record<string, string> = {
  doi: 'DOI match',
  file_hash: 'File hash match',
  exact_key: 'Exact key (title/author/year)',
  fuzzy_title: 'Fuzzy title match',
  filename: 'Filename similarity',
};

const statusTone: Record<PaperDuplicate['status'], Tone> = {
  unreviewed: 'attention',
  confirmed_duplicate: 'negative',
  not_duplicate: 'positive',
  dismissed: 'neutral',
};

export function DedupeAdminClient({ initialDuplicates, papers }: Props) {
  const [duplicates, setDuplicates] = useState<PaperDuplicate[]>(initialDuplicates);
  const [papersState, setPapersState] = useState<DedupePaperSummary[]>(papers);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState | null>(null);

  const paperMap = useMemo(() => new Map(papersState.map((p) => [p.id, p])), [papersState]);

  const refreshDuplicates = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/dedupe/conflicts', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { duplicates: PaperDuplicate[] };
      setDuplicates(data.duplicates ?? []);
    } catch (error) {
      console.error('Failed to refresh duplicates', error);
      setActionState({ message: 'Failed to refresh duplicates', tone: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshPapers = async () => {
    try {
      const res = await fetch('/api/papers?view=dedupe', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { papers: DedupePaperSummary[] };
      setPapersState(data.papers ?? papersState);
    } catch (error) {
      console.error('Failed to refresh papers', error);
      setActionState({ message: 'Failed to refresh papers', tone: 'error' });
    }
  };

  const runScan = async () => {
    setIsScanning(true);
    setActionState(null);
    try {
      const res = await fetch('/api/admin/dedupe/scan', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      await Promise.all([refreshDuplicates(), refreshPapers()]);
      setActionState({ message: 'Dedupe scan completed', tone: 'success' });
    } catch (error) {
      console.error('Failed to run dedupe scan', error);
      setActionState({ message: 'Failed to run dedupe scan', tone: 'error' });
    } finally {
      setIsScanning(false);
    }
  };

  const resolveDuplicate = async (id: string, status: PaperDuplicate['status']) => {
    try {
      const res = await fetch('/api/admin/dedupe/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refreshDuplicates();
      setActionState({ message: 'Updated review status', tone: 'success' });
    } catch (error) {
      console.error('Failed to update duplicate status', error);
      setActionState({ message: 'Failed to update status', tone: 'error' });
    }
  };

  const archivePaper = async (paperId: string) => {
    const confirmArchive = window.confirm('Archive this paper so it no longer shows in dashboards?');
    if (!confirmArchive) return;

    setArchivingId(paperId);
    try {
      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Archive failed (${res.status})`);
      }
      // Optimistic local update so the row disappears immediately
      setPapersState((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, status: 'archived' } : p)),
      );
      setDuplicates((prev) => prev.filter((row) => row.paperIdA !== paperId && row.paperIdB !== paperId));
      await Promise.all([refreshDuplicates(), refreshPapers()]);
      setActionState({ message: 'Paper archived', tone: 'success' });
    } catch (error) {
      console.error('Failed to archive paper', error);
      setActionState({ message: 'Failed to archive paper', tone: 'error' });
    } finally {
      setArchivingId(null);
    }
  };

  useEffect(() => {
    if (actionState) {
      const timer = setTimeout(() => setActionState(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [actionState]);

  const rows = duplicates.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  const visibleRows = rows.filter((row) => {
    const paperA = paperMap.get(row.paperIdA);
    const paperB = paperMap.get(row.paperIdB);
    return paperA?.status !== 'archived' && paperB?.status !== 'archived';
  });

  const renderPaper = (paperId: string) => {
    const paper = paperMap.get(paperId);
    if (!paper) {
      return <span className="text-[13px] font-medium text-negative-ink">Unknown paper</span>;
    }
    return (
      <div className="space-y-1.5">
        <div className="text-[13px] font-semibold text-ink">{paper.title}</div>
        <div className={t.caption}>
          ID: {paper.assignedStudyId} · Uploaded {formatDateTimeUTC(paper.createdAt)}
        </div>
        {paper.status === 'archived' ? <Pill tone="neutral" dot>Archived</Pill> : null}
        <div className={`${t.caption} truncate`}>
          {paper.originalFileName ? `File: ${paper.originalFileName}` : null}
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href={`/paper/${paper.id}`}
            className="text-navy-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
          >
            Open paper
          </Link>
        </div>
      </div>
    );
  };

  const resolveOrder = (row: PaperDuplicate): { leftId: string; rightId: string } => {
    const paperA = paperMap.get(row.paperIdA);
    const paperB = paperMap.get(row.paperIdB);

    const parseTime = (paper?: DedupePaperSummary) => {
      if (!paper) return Number.NaN;
      const t = new Date(paper.createdAt).getTime();
      if (!Number.isNaN(t)) return t;
      // fallback: try updatedAt, then assignedStudyId ordering
      const alt = new Date(paper.updatedAt).getTime();
      if (!Number.isNaN(alt)) return alt;
      return Number.NaN;
    };

    const timeA = parseTime(paperA);
    const timeB = parseTime(paperB);

    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      return timeA <= timeB ? { leftId: row.paperIdA, rightId: row.paperIdB } : { leftId: row.paperIdB, rightId: row.paperIdA };
    }

    // Fallback: alphabetical by assignedStudyId, then id
    const left = (paperA?.assignedStudyId ?? paperA?.id ?? '').localeCompare(paperB?.assignedStudyId ?? paperB?.id ?? '') <= 0;
    return left ? { leftId: row.paperIdA, rightId: row.paperIdB } : { leftId: row.paperIdB, rightId: row.paperIdA };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={runScan} loading={isScanning}>
          Run dedupe scan
        </Button>
        <Button variant="secondary" size="sm" onClick={refreshDuplicates} loading={isRefreshing}>
          Refresh list
        </Button>
        {actionState ? (
          <span
            role={actionState.tone === 'error' ? 'alert' : 'status'}
            className={`text-xs font-semibold ${
              actionState.tone === 'error'
                ? 'text-negative-ink'
                : actionState.tone === 'success'
                  ? 'text-positive-ink'
                  : 'text-ink-muted'
            }`}
          >
            {actionState.message}
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card bg-surface shadow-e1">
        <div className={`grid grid-cols-12 gap-3 border-b border-line bg-surface-sunk px-4 py-3 ${t.label}`}>
          <div className="col-span-3">Paper A (earlier upload)</div>
          <div className="col-span-3">Paper B (later upload)</div>
          <div className="col-span-2">Reason</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {visibleRows.length === 0 ? (
          <EmptyState title="No suspected duplicates" description="Run a scan to update this list." />
        ) : (
          visibleRows.map((row) => {
            const { leftId, rightId } = resolveOrder(row);
            return (
              <div
                key={row.id}
                className="grid grid-cols-12 items-start gap-3 border-t border-line px-4 py-3 transition-colors duration-[160ms] ease-gbi hover:bg-surface-sunk"
              >
                <div className="col-span-3">{renderPaper(leftId)}</div>
                <div className="col-span-3">{renderPaper(rightId)}</div>
                <div className="col-span-2 space-y-1.5">
                  <Tag>{reasonCopy[row.reason] ?? row.reason}</Tag>
                  {row.score !== null ? <div className={t.caption}>Score: {row.score}%</div> : null}
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Pill tone={statusTone[row.status]} dot>
                    {statusCopy[row.status] ?? row.status}
                  </Pill>
                  <div className={t.caption}>
                    Detected {formatDateTimeUTC(row.detectedAt)}
                    {row.resolvedAt ? `, resolved ${formatDateTimeUTC(row.resolvedAt)}` : ''}
                  </div>
                </div>
                <div className="col-span-2 flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" onClick={() => resolveDuplicate(row.id, 'confirmed_duplicate')}>
                      Mark duplicate
                    </Button>
                    <Button size="sm" onClick={() => resolveDuplicate(row.id, 'not_duplicate')}>
                      Keep both
                    </Button>
                    <Button size="sm" onClick={() => resolveDuplicate(row.id, 'dismissed')}>
                      Dismiss
                    </Button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="dangerSoft"
                      onClick={() => archivePaper(leftId)}
                      disabled={archivingId === leftId || archivingId === rightId}
                      loading={archivingId === leftId}
                    >
                      Archive A
                    </Button>
                    <Button
                      size="sm"
                      variant="dangerSoft"
                      onClick={() => archivePaper(rightId)}
                      disabled={archivingId === leftId || archivingId === rightId}
                      loading={archivingId === rightId}
                    >
                      Archive B
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
