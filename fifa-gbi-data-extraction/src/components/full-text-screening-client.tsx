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

type CardTone = 'indigo' | 'sky' | 'amber' | 'emerald' | 'purple';

const CARD_TONES: Record<CardTone, { gradient: string; value: string }> = {
  indigo: { gradient: 'from-indigo-500/20 via-sky-400/10 to-indigo-400/20', value: 'text-indigo-700' },
  sky: { gradient: 'from-sky-500/20 via-cyan-400/10 to-indigo-300/20', value: 'text-sky-700' },
  amber: { gradient: 'from-rose-500/20 via-orange-400/10 to-amber-400/20', value: 'text-rose-700' },
  emerald: { gradient: 'from-emerald-500/20 via-teal-400/10 to-green-400/20', value: 'text-emerald-700' },
  purple: { gradient: 'from-purple-500/20 via-violet-400/10 to-purple-400/20', value: 'text-purple-700' },
};

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
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8 lg:p-10">
        <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center rounded-full bg-gradient-to-br from-indigo-100/90 via-sky-50/80 to-indigo-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 shadow-sm ring-1 ring-indigo-200/50 backdrop-blur-sm">
                Full-text screening
              </span>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Review queue</h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Vote on full-text PDFs, resolve conflicts, and promote included studies to extraction.
              </p>
            </div>
            {isAdmin ? (
              <form onSubmit={handleUpload} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={fileInputRef}
                  name="files"
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="w-full min-w-0 rounded-full border border-dashed border-slate-300 bg-white/70 px-4 py-2 text-sm text-slate-700 sm:w-80"
                />
                <button
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-white/80 px-5 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Upload PDFs
                </button>
              </form>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <QueueCard
              label="Screen studies"
              value={counts.needsYourVote}
              detail={`${counts.noVotes} no votes · ${counts.oneVote} one vote`}
              action="Continue screening"
              tone="indigo"
              onClick={() => setFilter('needs_your_vote')}
            />
            <QueueCard
              label="Awaiting other reviewer"
              value={counts.awaitingOther}
              detail="You have already voted"
              tone="sky"
              onClick={() => setFilter('awaiting_other_reviewer')}
            />
            <QueueCard
              label="Resolve conflicts"
              value={counts.conflicts}
              detail="Third decision is final"
              action="Continue"
              tone="amber"
              onClick={() => setFilter('conflict')}
            />
            <QueueCard
              label="Complete"
              value={counts.complete}
              detail="Included, excluded, or promoted"
              tone="emerald"
              onClick={() => setFilter('ready_for_extraction')}
            />
            <QueueCard
              label="Total records"
              value={counts.all}
              detail="All full-text records"
              tone="purple"
              onClick={() => setFilter('all')}
            />
          </div>
        </div>
      </section>

      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as QueueFilter)}
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
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
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/70 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Study</th>
                <th className="px-5 py-3 font-semibold">AI suggestion</th>
                <th className="px-5 py-3 font-semibold">Reviewers</th>
                <th className="px-5 py-3 font-semibold">Status</th>
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
            <p className="p-10 text-center text-sm text-slate-500">No records match this view.</p>
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
    <tr className="bg-white/60 hover:bg-slate-50/80">
      <td className="max-w-[440px] px-5 py-4 align-top">
        <Link href={`/full-text-screening/${record.id}`} className="group block">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{record.assignedStudyId}</span>
            <span className="text-xs text-slate-500">{authorLabel}</span>
          </div>
          <p className="mt-1 font-semibold text-slate-900 group-hover:text-indigo-700">{displayTitle}</p>
        </Link>
      </td>
      <td className="px-5 py-4 align-top">
        <AiBadge record={record} />
      </td>
      <td className="px-5 py-4 align-top">
        <p className="font-medium text-slate-800">{getDecisionProgressLabel(record)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {reviewerDecisions.length > 0
            ? reviewerDecisions.map((decision) => decision.decision).join(' + ')
            : 'No votes yet'}
        </p>
      </td>
      <td className="px-5 py-4 align-top">
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
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  action?: string;
  tone: CardTone;
  onClick: () => void;
}) {
  const toneClasses = CARD_TONES[tone];
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 text-left shadow-md ring-1 ring-slate-200/60 backdrop-blur transition hover:shadow-lg hover:ring-slate-300/70"
    >
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${toneClasses.gradient} opacity-80`} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p className={`text-xl font-semibold ${toneClasses.value}`}>{value}</p>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-600">{detail}</p>
      {action ? <p className="mt-2 text-[11px] font-semibold text-indigo-700">{action}</p> : null}
    </button>
  );
}

function AiBadge({ record }: { record: ScreeningRecord }) {
  if (record.aiStatus === 'running') {
    return <Pill tone="slate">AI running</Pill>;
  }
  if (record.aiStatus === 'failed') {
    return <Pill tone="amber">AI failed</Pill>;
  }
  if (record.aiSuggestedDecision === 'include') {
    return <Pill tone="emerald">AI include</Pill>;
  }
  if (record.aiSuggestedDecision === 'exclude') {
    return <Pill tone="rose">AI exclude</Pill>;
  }
  return <Pill tone="slate">Not run</Pill>;
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
  const tones: Record<ScreeningWorkStatus, PillTone> = {
    needs_your_vote: 'indigo',
    awaiting_other_reviewer: 'slate',
    ready_for_extraction: 'emerald',
    excluded: 'rose',
    conflict: 'amber',
    promoted: 'sky',
  };
  return (
    <div className="space-y-1">
      <Pill tone={tones[status]}>{labels[status]}</Pill>
      {resolution === 'conflict' ? <p className="text-xs text-slate-500">Resolve conflict</p> : null}
    </div>
  );
}

type PillTone = 'indigo' | 'slate' | 'emerald' | 'rose' | 'amber' | 'sky';

const PILL_CLASSES: Record<PillTone, string> = {
  indigo: 'border-indigo-200/70 bg-indigo-50/80 text-indigo-700',
  slate: 'border-slate-200/70 bg-slate-50/80 text-slate-700',
  emerald: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700',
  rose: 'border-rose-200/70 bg-rose-50/80 text-rose-700',
  amber: 'border-amber-200/70 bg-amber-50/80 text-amber-700',
  sky: 'border-sky-200/70 bg-sky-50/80 text-sky-700',
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200/70 bg-rose-50/80 text-rose-700'
    : tone === 'success'
      ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700'
      : 'border-slate-200/70 bg-slate-50/80 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}
