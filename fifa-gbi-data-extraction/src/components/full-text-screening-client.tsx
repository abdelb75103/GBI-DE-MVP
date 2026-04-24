'use client';

import { FormEvent, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  getDecisionProgressLabel,
  getReviewerDecisions,
  getScreeningResolution,
  getScreeningWorkStatus,
  type ScreeningWorkStatus,
} from '@/lib/screening/reviewer-decisions';
import type { ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecords: ScreeningRecord[];
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type QueueFilter =
  | 'all'
  | 'needs_your_vote'
  | 'awaiting_other_reviewer'
  | 'ready_for_extraction'
  | 'excluded'
  | 'conflict'
  | 'promoted';
type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const cleanDisplayTitle = (title: string) => title.replace(/^Mock QA #\d+\s*-\s*/i, '');

export function FullTextScreeningClient({
  initialRecords,
  currentReviewerId,
  profileRole,
  loadError,
}: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = profileRole === 'admin';

  const counts = useMemo(() => {
    const noVotes = records.filter((record) => getReviewerDecisions(record).length === 0).length;
    const oneVote = records.filter((record) => getReviewerDecisions(record).length === 1).length;
    return {
      all: records.length,
      needsYourVote: records.filter((record) => getScreeningWorkStatus(record, currentReviewerId) === 'needs_your_vote').length,
      awaitingOther: records.filter((record) => getScreeningWorkStatus(record, currentReviewerId) === 'awaiting_other_reviewer').length,
      complete: records.filter((record) => {
        const status = getScreeningWorkStatus(record, currentReviewerId);
        return status === 'ready_for_extraction' || status === 'excluded' || status === 'promoted';
      }).length,
      conflicts: records.filter((record) => getScreeningResolution(record) === 'conflict').length,
      noVotes,
      oneVote,
    };
  }, [currentReviewerId, records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const status = getScreeningWorkStatus(record, currentReviewerId);
      if (filter !== 'all' && status !== filter) return false;
      if (!query) return true;
      return [
        record.assignedStudyId,
        record.title,
        record.leadAuthor,
        record.year,
        record.journal,
        record.doi,
        record.originalFileName,
        record.aiReason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [currentReviewerId, records, filter, search]);

  const refreshRecords = async () => {
    const response = await fetch('/api/full-text-screening', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to refresh screening records');
    }
    const payload = (await response.json()) as { records: ScreeningRecord[] };
    setRecords(payload.records ?? []);
  };

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const files = fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : [];
    if (files.length === 0) {
      setNotice({ tone: 'error', message: 'Select at least one PDF.' });
      return;
    }

    startTransition(async () => {
      const failures = [];
      let successCount = 0;
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          failures.push(`${file.name}: not a PDF`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          failures.push(`${file.name}: exceeds 20 MB`);
          continue;
        }

        const data = new FormData();
        data.set('file', file);
        const response = await fetch('/api/full-text-screening/uploads', { method: 'POST', body: data });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          failures.push(`${file.name}: ${payload.error ?? 'upload failed'}`);
          continue;
        }
        successCount += 1;
      }

      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshRecords();
      setNotice({
        tone: failures.length > 0 ? 'error' : 'success',
        message: failures.length > 0
          ? `Uploaded ${successCount}; ${failures.length} failed. ${failures.slice(0, 2).join(' | ')}`
          : `Uploaded ${successCount} PDF${successCount === 1 ? '' : 's'} to screening.`,
      });
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Full-text screening</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Review queue</h1>
          </div>
          {isAdmin ? (
            <form onSubmit={handleUpload} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                name="files"
                type="file"
                accept="application/pdf"
                multiple
                className="w-full min-w-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:w-80"
              />
              <button
                disabled={isPending}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              >
                Upload
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <QueueCard
            label="Screen studies"
            value={counts.needsYourVote}
            detail={`${counts.noVotes} no votes · ${counts.oneVote} one vote`}
            action="Continue screening"
            onClick={() => setFilter('needs_your_vote')}
          />
          <QueueCard
            label="Awaiting other reviewer"
            value={counts.awaitingOther}
            detail="You have already voted"
            onClick={() => setFilter('awaiting_other_reviewer')}
          />
          <QueueCard
            label="Resolve conflicts"
            value={counts.conflicts}
            detail="Third decision is final"
            action="Continue"
            onClick={() => setFilter('conflict')}
          />
          <QueueCard
            label="Complete"
            value={counts.complete}
            detail="Included, excluded, or promoted"
            onClick={() => setFilter('ready_for_extraction')}
          />
          <QueueCard
            label="Total records"
            value={counts.all}
            detail="All full-text records"
            onClick={() => setFilter('all')}
          />
        </div>
      </section>

      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as QueueFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              <option value="all">All records</option>
              <option value="needs_your_vote">Needs my vote</option>
              <option value="awaiting_other_reviewer">Awaiting other reviewer</option>
              <option value="ready_for_extraction">Included</option>
              <option value="excluded">Excluded</option>
              <option value="conflict">Conflicts</option>
              <option value="promoted">Promoted to extraction</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, study ID, author, DOI..."
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Study</th>
                <th className="px-4 py-3">AI suggestion</th>
                <th className="px-4 py-3">Reviewers</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <ScreeningRow
                  key={record.id}
                  record={record}
                  currentReviewerId={currentReviewerId}
                />
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No records match this view.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ScreeningRow({
  record,
  currentReviewerId,
}: {
  record: ScreeningRecord;
  currentReviewerId: string;
}) {
  const resolution = getScreeningResolution(record);
  const reviewerDecisions = getReviewerDecisions(record);
  const status = getScreeningWorkStatus(record, currentReviewerId);
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : 'Author pending';
  const displayTitle = cleanDisplayTitle(record.title);

  return (
    <tr className="bg-white hover:bg-slate-50">
      <td className="max-w-[440px] px-4 py-4 align-top">
        <Link href={`/full-text-screening/${record.id}`} className="group">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{record.assignedStudyId}</span>
            <span className="text-xs text-slate-500">{authorLabel}</span>
          </div>
          <p className="mt-1 font-semibold text-slate-950 group-hover:text-indigo-700">{displayTitle}</p>
        </Link>
      </td>
      <td className="px-4 py-4 align-top">
        <AiBadge record={record} />
      </td>
      <td className="px-4 py-4 align-top">
        <p className="font-semibold text-slate-900">{getDecisionProgressLabel(record)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {reviewerDecisions.length > 0
            ? reviewerDecisions.map((decision) => decision.decision).join(' + ')
            : 'No votes yet'}
        </p>
      </td>
      <td className="px-4 py-4 align-top">
        <StatusBadge status={status} resolution={resolution} />
      </td>
    </tr>
  );
}

function QueueCard({
  label,
  value,
  detail,
  action,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  action?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      {action ? <p className="mt-3 text-xs font-semibold text-indigo-700">{action}</p> : null}
    </button>
  );
}

function AiBadge({ record }: { record: ScreeningRecord }) {
  if (record.aiStatus === 'running') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">AI running</span>;
  }
  if (record.aiStatus === 'failed') {
    return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">AI failed</span>;
  }
  if (record.aiSuggestedDecision === 'include') {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">AI include</span>;
  }
  if (record.aiSuggestedDecision === 'exclude') {
    return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">AI exclude</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Not run</span>;
}

function StatusBadge({
  status,
  resolution,
}: {
  status: ScreeningWorkStatus;
  resolution: ReturnType<typeof getScreeningResolution>;
}) {
  const labels: Record<ScreeningWorkStatus, string> = {
    needs_your_vote: 'Needs my vote',
    awaiting_other_reviewer: 'Awaiting other reviewer',
    ready_for_extraction: 'Ready for extraction',
    excluded: 'Excluded',
    conflict: 'Conflict',
    promoted: 'Promoted',
  };
  const classes: Record<ScreeningWorkStatus, string> = {
    needs_your_vote: 'bg-indigo-50 text-indigo-800',
    awaiting_other_reviewer: 'bg-slate-100 text-slate-700',
    ready_for_extraction: 'bg-emerald-50 text-emerald-800',
    excluded: 'bg-rose-50 text-rose-800',
    conflict: 'bg-amber-50 text-amber-800',
    promoted: 'bg-sky-50 text-sky-800',
  };
  return (
    <div className="space-y-1">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>{labels[status]}</span>
      {resolution === 'conflict' ? <p className="text-xs text-slate-500">Resolve conflict</p> : null}
    </div>
  );
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}
