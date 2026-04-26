'use client';

import { ChangeEvent, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  getReviewerDecisions,
  getScreeningResolution,
  getScreeningWorkStatus,
  isAwaitingFullTextPdf,
  type ScreeningWorkStatus,
} from '@/lib/screening/reviewer-decisions';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecords: ScreeningRecord[];
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type QueueFilter =
  | 'all'
  | 'awaiting_pdf'
  | 'needs_your_vote'
  | 'awaiting_other_reviewer'
  | 'ready_for_extraction'
  | 'excluded'
  | 'conflict'
  | 'promoted';
type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;

type CardTone = 'purple' | 'indigo' | 'sky' | 'amber' | 'emerald' | 'rose';

const CARD_TONES: Record<CardTone, { gradient: string; value: string }> = {
  purple: { gradient: 'from-purple-500/20 via-violet-400/10 to-purple-400/20', value: 'text-purple-700' },
  indigo: { gradient: 'from-indigo-500/20 via-sky-400/10 to-indigo-400/20', value: 'text-indigo-700' },
  sky: { gradient: 'from-sky-500/20 via-cyan-400/10 to-indigo-300/20', value: 'text-sky-700' },
  amber: { gradient: 'from-amber-400/25 via-orange-300/15 to-amber-300/20', value: 'text-amber-700' },
  emerald: { gradient: 'from-emerald-500/20 via-teal-400/10 to-green-400/20', value: 'text-emerald-700' },
  rose: { gradient: 'from-rose-500/20 via-orange-400/10 to-amber-400/20', value: 'text-rose-700' },
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
      awaitingPdf: records.filter(isAwaitingFullTextPdf).length,
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
  const progressPercent = counts.all > 0 ? Math.round((counts.complete / counts.all) * 100) : 0;

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

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    startTransition(async () => {
      const failures: string[] = [];
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

  const handleRecordPdfSelected = (recordId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setNotice({ tone: 'error', message: `${file.name}: not a PDF` });
        event.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setNotice({ tone: 'error', message: `${file.name}: exceeds 20 MB` });
        event.target.value = '';
        return;
      }

      const data = new FormData();
      data.set('file', file);
      const response = await fetch(`/api/full-text-screening/${recordId}/file`, { method: 'POST', body: data });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      event.target.value = '';
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'PDF attach failed' });
        return;
      }
      await refreshRecords();
      setNotice({ tone: 'success', message: `Attached ${file.name} to the full-text record.` });
    });
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-br from-teal-100/90 via-emerald-50/80 to-teal-50/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700 shadow-sm ring-1 ring-teal-200/50 backdrop-blur-sm">
                Full-text screening
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]">Full-text screening</h1>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Vote on full-text PDFs, resolve conflicts, and promote included studies to extraction.
              </p>
            </div>
            {isAdmin ? (
              <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                  id="full-text-upload"
                />
                <label
                  htmlFor="full-text-upload"
                  className={`group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0b3a70] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(11,58,112,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f5d] ${
                    isPending ? 'pointer-events-none opacity-70' : ''
                  }`}
                >
                  {isPending ? (
                    <>
                      <span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Upload full text
                    </>
                  )}
                </label>
                <p className="text-[11px] text-slate-500">PDF only · up to 20 MB each</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <QueueCard
              label="Upload full text"
              value={counts.awaitingPdf}
              detail="Included at title/abstract"
              tone="amber"
              onClick={() => setFilter('awaiting_pdf')}
            />
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

          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 shadow-sm ring-1 ring-slate-200/50 backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Full-text progress</p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-semibold tabular-nums text-slate-800">{counts.complete}</span> of{' '}
                  <span className="font-semibold tabular-nums text-slate-800">{counts.all}</span> full-text records have a final screening outcome.
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-teal-700">{progressPercent}%</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-700 via-teal-500 to-emerald-400 transition-[width] duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
              <span>{counts.needsYourVote} need your vote</span>
              <span>{counts.awaitingPdf} need PDF upload</span>
              <span>{counts.conflicts} conflicts</span>
            </div>
          </div>
        </div>
      </section>

      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50/40 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as QueueFilter)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-slate-400 focus:outline-none"
            >
              <option value="all">All records</option>
              <option value="awaiting_pdf">Upload full text</option>
              <option value="needs_your_vote">Needs my vote</option>
              <option value="awaiting_other_reviewer">Awaiting other reviewer</option>
              <option value="ready_for_extraction">Included</option>
              <option value="excluded">Excluded</option>
              <option value="conflict">Conflicts</option>
              <option value="promoted">Promoted to extraction</option>
            </select>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, study ID, author, DOI..."
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/60 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Study</th>
                <th className="px-5 py-3 font-semibold">AI suggestion</th>
                <th className="px-5 py-3 font-semibold">Reviewers</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {filteredRecords.map((record) => (
                <ScreeningRow
                  key={record.id}
                  record={record}
                  currentReviewerId={currentReviewerId}
                  isAdmin={isAdmin}
                  isPending={isPending}
                  onAttachPdf={handleRecordPdfSelected}
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

const STATUS_ACCENT: Record<ScreeningWorkStatus, string> = {
  awaiting_pdf: 'bg-amber-400',
  needs_your_vote: 'bg-indigo-400',
  awaiting_other_reviewer: 'bg-sky-300',
  ready_for_extraction: 'bg-emerald-400',
  excluded: 'bg-rose-400',
  conflict: 'bg-amber-400',
  promoted: 'bg-violet-400',
};

function ScreeningRow({
  record,
  currentReviewerId,
  isAdmin,
  isPending,
  onAttachPdf,
}: {
  record: ScreeningRecord;
  currentReviewerId: string;
  isAdmin: boolean;
  isPending: boolean;
  onAttachPdf: (recordId: string, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const resolution = getScreeningResolution(record);
  const reviewerDecisions = getReviewerDecisions(record);
  const status = getScreeningWorkStatus(record, currentReviewerId);
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : 'Author pending';
  const displayTitle = cleanDisplayTitle(record.title);
  const totalVotes = reviewerDecisions.length;
  const includeVotes = reviewerDecisions.filter((d) => d.decision === 'include').length;
  const excludeVotes = reviewerDecisions.filter((d) => d.decision === 'exclude').length;
  const awaitingPdf = isAwaitingFullTextPdf(record);
  const uploadInputId = `full-text-upload-${record.id}`;

  return (
    <tr className="group relative bg-white transition-colors duration-200 ease-out hover:bg-[#0b3a70]/[0.04]">
      <td className="relative max-w-[440px] py-4 pl-5 pr-5 align-middle">
        <span aria-hidden className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${STATUS_ACCENT[status]}`} />
        <Link href={`/full-text-screening/${record.id}`} className="block pl-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wide text-[#0b3a70]">{record.assignedStudyId}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{authorLabel}</span>
          </div>
          <p className="mt-1 line-clamp-2 font-semibold leading-snug text-slate-900 transition group-hover:text-[#0b3a70]">{displayTitle}</p>
        </Link>
      </td>
      <td className="px-5 py-4 align-middle">
        <AiBadge record={record} />
      </td>
      <td className="px-5 py-4 align-middle">
        <div className="flex items-center gap-2.5">
          <VoteSlots decisions={reviewerDecisions} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-[#0b3a70]">
              {totalVotes}
              <span className="text-slate-400">/2</span>
            </span>
            {totalVotes > 0 ? (
              <span className="text-[11px] text-slate-500">
                {includeVotes > 0 ? `${includeVotes} inc` : ''}
                {includeVotes > 0 && excludeVotes > 0 ? ' · ' : ''}
                {excludeVotes > 0 ? `${excludeVotes} exc` : ''}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">No votes</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-4 align-middle">
        <div className="space-y-2">
          <StatusBadge status={status} resolution={resolution} />
          {record.promotedPaperId ? (
            <Link
              href={`/paper/${record.promotedPaperId}`}
              className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              Open extraction
            </Link>
          ) : null}
          {isAdmin && awaitingPdf ? (
            <div>
              <input
                id={uploadInputId}
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={isPending}
                onChange={(event) => onAttachPdf(record.id, event)}
              />
              <label
                htmlFor={uploadInputId}
                className={`inline-flex cursor-pointer items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 ${
                  isPending ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                Upload full text
              </label>
            </div>
          ) : null}
        </div>
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
      className="group relative flex h-full min-h-[128px] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-left shadow-md ring-1 ring-slate-200/60 backdrop-blur transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:ring-slate-300/70"
    >
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${toneClasses.gradient}`} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${toneClasses.value}`}>{value}</p>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{detail}</p>
      {action ? <p className="mt-auto pt-2 text-[11px] font-semibold text-[#0b3a70]">{action} →</p> : null}
    </button>
  );
}

function AiBadge({ record }: { record: ScreeningRecord }) {
  if (record.aiStatus === 'running') {
    return <IconPill tone="slate" icon="dot">AI running</IconPill>;
  }
  if (record.aiStatus === 'failed') {
    return <IconPill tone="amber" icon="warn">AI failed</IconPill>;
  }
  if (record.aiSuggestedDecision === 'include') {
    return <IconPill tone="emerald" icon="check">AI include</IconPill>;
  }
  if (record.aiSuggestedDecision === 'exclude') {
    return <IconPill tone="rose" icon="cross">AI exclude</IconPill>;
  }
  return <IconPill tone="slate" icon="dash">Not run</IconPill>;
}

function StatusBadge({
  status,
  resolution,
}: {
  status: ScreeningWorkStatus;
  resolution: ReturnType<typeof getScreeningResolution>;
}) {
  const labels: Record<ScreeningWorkStatus, string> = {
    awaiting_pdf: 'Upload full text',
    needs_your_vote: 'Needs my vote',
    awaiting_other_reviewer: 'Awaiting other reviewer',
    ready_for_extraction: 'Ready for extraction',
    excluded: 'Excluded',
    conflict: 'Conflict',
    promoted: 'Promoted',
  };
  const tones: Record<ScreeningWorkStatus, PillTone> = {
    awaiting_pdf: 'amber',
    needs_your_vote: 'indigo',
    awaiting_other_reviewer: 'sky',
    ready_for_extraction: 'emerald',
    excluded: 'rose',
    conflict: 'amber',
    promoted: 'violet',
  };
  return (
    <div className="space-y-1">
      <Pill tone={tones[status]}>{labels[status]}</Pill>
      {resolution === 'conflict' ? <p className="text-[11px] font-medium text-amber-700">Resolve conflict →</p> : null}
    </div>
  );
}

type PillTone = 'indigo' | 'slate' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet';

const PILL_CLASSES: Record<PillTone, string> = {
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

const ICON_PILL_DOT_CLASSES: Record<PillTone, string> = {
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-400',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
};

function IconPill({ tone, icon, children }: { tone: PillTone; icon: 'check' | 'cross' | 'dot' | 'dash' | 'warn'; children: React.ReactNode }) {
  const iconChar = icon === 'check' ? '✓' : icon === 'cross' ? '✕' : icon === 'warn' ? '!' : icon === 'dash' ? '–' : '';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_CLASSES[tone]}`}>
      {icon === 'dot' ? (
        <span aria-hidden className={`inline-block h-1.5 w-1.5 animate-pulse rounded-full ${ICON_PILL_DOT_CLASSES[tone]}`} />
      ) : (
        <span aria-hidden className="text-[11px] leading-none">{iconChar}</span>
      )}
      {children}
    </span>
  );
}

function VoteSlots({ decisions }: { decisions: ReadonlyArray<{ decision: ScreeningDecision }> }) {
  const slots = [decisions[0]?.decision, decisions[1]?.decision];
  return (
    <div className="flex items-center gap-1">
      {slots.map((slot, i) => {
        if (slot === 'include') {
          return (
            <span
              key={i}
              aria-hidden
              className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold leading-none text-white shadow-sm shadow-emerald-500/40 ring-2 ring-emerald-100"
            >
              ✓
            </span>
          );
        }
        if (slot === 'exclude') {
          return (
            <span
              key={i}
              aria-hidden
              className="grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[10px] font-bold leading-none text-white shadow-sm shadow-rose-500/40 ring-2 ring-rose-100"
            >
              ✕
            </span>
          );
        }
        return (
          <span
            key={i}
            aria-hidden
            className="h-5 w-5 rounded-full border-2 border-dashed border-slate-300 bg-white"
          />
        );
      })}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 11V2.5" />
      <path d="m4.5 6 3.5-3.5L11.5 6" />
      <path d="M2.5 11.5v1A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="7" cy="7" r="5" />
      <path d="m13.5 13.5-3-3" />
    </svg>
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
