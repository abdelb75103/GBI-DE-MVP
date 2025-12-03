'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { formatDateTimeUTC } from '@/lib/format';
import type { Paper, PaperDuplicate } from '@/lib/types';

type Props = {
  initialDuplicates: PaperDuplicate[];
  papers: Paper[];
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

export function DedupeAdminClient({ initialDuplicates, papers }: Props) {
  const [duplicates, setDuplicates] = useState<PaperDuplicate[]>(initialDuplicates);
  const [papersState, setPapersState] = useState<Paper[]>(papers);
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
      const res = await fetch('/api/papers', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { papers: Paper[] };
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
      return <span className="text-sm text-rose-600">Unknown paper</span>;
    }
    return (
      <div className="space-y-1">
        <div className="text-sm font-semibold text-slate-900">{paper.title}</div>
        <div className="text-xs text-slate-600">
          ID: {paper.assignedStudyId} • Uploaded {formatDateTimeUTC(paper.createdAt)}
        </div>
        {paper.status === 'archived' ? (
          <div className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Archived
          </div>
        ) : null}
        <div className="text-xs text-slate-500 truncate">
          {paper.originalFileName ? `File: ${paper.originalFileName}` : null}
        </div>
        <div className="flex gap-2 text-xs text-indigo-600">
          <Link href={`/paper/${paper.id}`} className="hover:underline">
            Open paper
          </Link>
        </div>
      </div>
    );
  };

  const resolveOrder = (row: PaperDuplicate): { leftId: string; rightId: string } => {
    const paperA = paperMap.get(row.paperIdA);
    const paperB = paperMap.get(row.paperIdB);

    const parseTime = (paper?: Paper) => {
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
        <button
          type="button"
          onClick={runScan}
          disabled={isScanning}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow ${
            isScanning ? 'bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {isScanning ? 'Scanning…' : 'Run dedupe scan'}
        </button>
        <button
          type="button"
          onClick={refreshDuplicates}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh list'}
        </button>
        {actionState ? (
          <span
            className={`text-xs font-semibold ${
              actionState.tone === 'error' ? 'text-rose-600' : actionState.tone === 'success' ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            {actionState.message}
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <div className="col-span-3">Paper A (earlier upload)</div>
          <div className="col-span-3">Paper B (later upload)</div>
          <div className="col-span-2">Reason</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {visibleRows.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">No suspected duplicates. Run a scan to update.</div>
        ) : (
          visibleRows.map((row) => {
            const { leftId, rightId } = resolveOrder(row);
            return (
            <div
              key={row.id}
              className="grid grid-cols-12 items-start gap-3 border-t border-slate-100 px-4 py-3 hover:bg-slate-50/60"
            >
              <div className="col-span-3">{renderPaper(leftId)}</div>
              <div className="col-span-3">{renderPaper(rightId)}</div>
              <div className="col-span-2 text-sm text-slate-700">
                <div className="font-semibold">{reasonCopy[row.reason] ?? row.reason}</div>
                {row.score !== null ? <div className="text-xs text-slate-500">Score: {row.score}%</div> : null}
              </div>
              <div className="col-span-2 text-sm">
                <div className="font-semibold text-slate-800">{statusCopy[row.status] ?? row.status}</div>
                <div className="text-xs text-slate-500">
                  Detected {formatDateTimeUTC(row.detectedAt)}
                  {row.resolvedAt ? ` • Resolved ${formatDateTimeUTC(row.resolvedAt)}` : ''}
                </div>
              </div>
                <div className="col-span-2 flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => resolveDuplicate(row.id, 'confirmed_duplicate')}
                    className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                  >
                    Mark duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveDuplicate(row.id, 'not_duplicate')}
                    className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
                  >
                    Keep both
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveDuplicate(row.id, 'dismissed')}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => archivePaper(leftId)}
                    disabled={archivingId === leftId || archivingId === rightId}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      archivingId === leftId || archivingId === rightId
                        ? 'bg-amber-50 text-amber-400 cursor-not-allowed'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    {archivingId === leftId ? 'Archiving...' : 'Archive A'}
                  </button>
                  <button
                    type="button"
                    onClick={() => archivePaper(rightId)}
                    disabled={archivingId === leftId || archivingId === rightId}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      archivingId === leftId || archivingId === rightId
                        ? 'bg-amber-50 text-amber-400 cursor-not-allowed'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    {archivingId === rightId ? 'Archiving...' : 'Archive B'}
                  </button>
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
