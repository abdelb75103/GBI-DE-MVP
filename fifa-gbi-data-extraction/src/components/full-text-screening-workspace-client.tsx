'use client';

import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  EXCLUSION_REASONS,
  getReviewerDecisions,
  getScreeningResolution,
  isAwaitingFullTextPdf,
  summarizeExclusionReasons,
  type FullTextDecisionAction,
  type ExclusionReason,
} from '@/lib/screening/reviewer-decisions';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecord: ScreeningRecord;
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
};

type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;
type DuplicateWarning = {
  target: 'full_text' | 'extraction';
  matchedStudyId: string | null;
  matchedTitle: string;
  reason: string;
  score: number;
};
const cleanDisplayTitle = (title: string) => title.replace(/^Mock QA #\d+\s*-\s*/i, '');

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function FullTextScreeningWorkspaceClient({ initialRecord, currentReviewerId, profileRole }: Props) {
  const [record, setRecord] = useState(initialRecord);
  const [decisionAction, setDecisionAction] = useState<FullTextDecisionAction>('reviewer_vote');
  const [decision, setDecision] = useState<ScreeningDecision | null>(null);
  const [reason, setReason] = useState<ExclusionReason | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const isAdmin = profileRole === 'admin';
  const awaitingPdf = isAwaitingFullTextPdf(record);

  const reviewerDecisions = useMemo(() => getReviewerDecisions(record), [record]);
  const resolution = getScreeningResolution(record);
  const exclusionReasonSummary = summarizeExclusionReasons(record);
  const firstTwoConflict =
    reviewerDecisions.length >= 2 &&
    reviewerDecisions[0]?.decision !== reviewerDecisions[1]?.decision;
  const thirdDecision = firstTwoConflict ? reviewerDecisions[2] : undefined;
  const currentReviewerVote = reviewerDecisions
    .slice(0, 2)
    .find((item) => item.reviewerProfileId === currentReviewerId);
  const canChangeReviewerVote = reviewerDecisions.length < 2 || Boolean(currentReviewerVote);
  const canRecordConsensus = firstTwoConflict;
  const activeDecisionAction = canRecordConsensus && (!canChangeReviewerVote || decisionAction === 'consensus_resolution')
    ? 'consensus_resolution'
    : 'reviewer_vote';
  const decisionMode = activeDecisionAction === 'consensus_resolution'
    ? thirdDecision ? 'Update conflict resolution' : 'Resolve conflict'
    : currentReviewerVote ? 'Update your vote' : 'Your vote';
  const canSubmitDecision = !awaitingPdf && (activeDecisionAction === 'consensus_resolution'
    ? canRecordConsensus
    : canChangeReviewerVote);
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : null;
  const displayTitle = cleanDisplayTitle(record.title);
  const pdfDirectUrl = `/api/full-text-screening/${record.id}/file`;
  const pdfUrl = `${pdfDirectUrl}#view=FitH`;

  const aiHasDecision = record.aiSuggestedDecision === 'include' || record.aiSuggestedDecision === 'exclude';
  const aiDecisionLabel = record.aiStatus === 'running'
    ? 'Running'
    : record.aiStatus === 'failed'
      ? 'Failed'
      : record.aiSuggestedDecision === 'include'
        ? 'Include'
        : record.aiSuggestedDecision === 'exclude'
          ? 'Exclude'
          : 'Not run';
  const aiTone = record.aiSuggestedDecision === 'include'
    ? 'emerald'
    : record.aiSuggestedDecision === 'exclude'
      ? 'rose'
      : record.aiStatus === 'failed'
        ? 'amber'
        : 'slate';
  const aiSectionBgClass = aiTone === 'emerald'
    ? 'bg-emerald-50/40'
    : aiTone === 'rose'
      ? 'bg-rose-50/40'
      : aiTone === 'amber'
        ? 'bg-amber-50/40'
        : 'bg-slate-50/40';
  const aiAccentBarClass = aiTone === 'emerald'
    ? 'bg-emerald-500'
    : aiTone === 'rose'
      ? 'bg-rose-500'
      : aiTone === 'amber'
        ? 'bg-amber-500'
        : 'bg-slate-300';

  const totalReviewerVotes = reviewerDecisions.length;
  const includeVotes = reviewerDecisions.filter((d) => d.decision === 'include').length;
  const excludeVotes = reviewerDecisions.filter((d) => d.decision === 'exclude').length;

  const saveDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision) {
      setNotice({ tone: 'error', message: 'Choose Include or Exclude.' });
      return;
    }
    if (!canSubmitDecision) {
      setNotice({
        tone: 'error',
        message: activeDecisionAction === 'consensus_resolution'
          ? 'Conflict resolution is only available for conflicting reviewer decisions.'
          : 'This record already has two reviewer votes. Only an original reviewer can change their vote.',
      });
      return;
    }
    if (decision === 'exclude' && !reason) {
      setNotice({ tone: 'error', message: 'Choose an exclusion reason.' });
      return;
    }
    if (decision === 'exclude' && reason === 'Other' && !otherReason.trim()) {
      setNotice({ tone: 'error', message: 'Add the other exclusion reason.' });
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/full-text-screening/${record.id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decisionAction: activeDecisionAction,
          reason: decision === 'exclude' ? reason : null,
          otherReason,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        record?: ScreeningRecord;
        error?: string;
        duplicateWarnings?: DuplicateWarning[];
      };
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'Failed to save decision' });
        return;
      }
      if (!payload.record) {
        setNotice({ tone: 'error', message: 'Failed to save decision' });
        return;
      }
      setRecord(payload.record);
      setDecision(null);
      setReason('');
      setOtherReason('');
      const duplicateMessage = formatDuplicateWarningMessage(payload.duplicateWarnings ?? []);
      setNotice({
        tone: duplicateMessage ? 'neutral' : 'success',
        message: duplicateMessage
          ? `${activeDecisionAction === 'consensus_resolution' ? 'Conflict resolution saved.' : 'Reviewer vote saved.'} ${duplicateMessage}`
          : activeDecisionAction === 'consensus_resolution'
            ? 'Conflict resolution saved.'
            : 'Reviewer vote saved.',
      });
    });
  };

  const attachPdf = (event: ChangeEvent<HTMLInputElement>) => {
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
      const response = await fetch(`/api/full-text-screening/${record.id}/file`, { method: 'POST', body: data });
      const payload = await response.json().catch(() => ({})) as { record?: ScreeningRecord; error?: string };
      event.target.value = '';
      if (!response.ok || !payload.record) {
        setNotice({ tone: 'error', message: payload.error ?? 'PDF attach failed' });
        return;
      }
      setRecord(payload.record);
      setNotice({ tone: 'success', message: `Attached ${file.name} to this full-text record.` });
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-7">
        <div className="absolute -top-12 left-0 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 right-0 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-indigo-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">
              Full-text screening
            </span>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {record.assignedStudyId}
                </span>
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{displayTitle}</h1>
                <ResolutionBadge resolution={resolution} />
              </div>
              {[authorLabel, record.year].filter(Boolean).length > 0 ? (
                <p className="text-sm text-slate-600">
                  {[authorLabel, record.year].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/full-text-screening"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <span aria-hidden>←</span> Back to queue
            </Link>
          </div>
        </div>
      </section>

      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="grid min-h-[calc(100vh-220px)] overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-xl ring-1 ring-slate-200/60 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col border-b border-slate-200/70 bg-slate-50/40 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">PDF source</p>
              <p className="mt-0.5 text-xs text-slate-500">Evidence workspace</p>
            </div>
            {!awaitingPdf ? (
              <a
                href={pdfDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                Open PDF
              </a>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 px-3 pb-3">
            <div className="flex min-h-[calc(100vh-300px)] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              {awaitingPdf ? (
                <div className="grid w-full place-items-center p-8 text-center">
                  <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <p className="text-sm font-semibold">Full-text PDF required</p>
                    <p className="mt-2 text-sm leading-6">
                      This record came through title/abstract screening and is waiting for the full-text PDF before reviewer voting or AI review can begin.
                    </p>
                    {isAdmin ? (
                      <div className="mt-4">
                        <input id="workspace-pdf-upload" type="file" accept="application/pdf" className="hidden" disabled={isPending} onChange={attachPdf} />
                        <label
                          htmlFor="workspace-pdf-upload"
                          className={`inline-flex cursor-pointer items-center rounded-full bg-[#0b3a70] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#092f5f] ${
                            isPending ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          {isPending ? 'Uploading…' : 'Upload full-text PDF'}
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <iframe
                  src={pdfUrl}
                  className="h-full min-h-[calc(100vh-300px)] w-full flex-1 border-0 bg-white"
                  title={`${record.assignedStudyId} full text PDF`}
                  allow="fullscreen"
                />
              )}
            </div>
          </div>
        </div>

        <form onSubmit={saveDecision} className="relative flex min-w-0 flex-col justify-center bg-gradient-to-b from-indigo-50/70 via-violet-50/30 to-indigo-50/60">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-violet-200/40 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 -left-10 h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="relative z-10 px-6 pt-7 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-900/80">{decisionMode}</p>
              </div>
              {currentReviewerVote ? (
                <span className="text-[11px] font-semibold text-slate-500">You voted {currentReviewerVote.decision}</span>
              ) : null}
            </div>

            {firstTwoConflict ? (
              <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  disabled={!canChangeReviewerVote}
                  onClick={() => setDecisionAction('reviewer_vote')}
                  className={`rounded-full px-3 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    activeDecisionAction === 'reviewer_vote'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Change my vote
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionAction('consensus_resolution')}
                  className={`rounded-full px-3 py-1 transition ${
                    activeDecisionAction === 'consensus_resolution'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Resolve conflict
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDecision('include')}
                className={`group rounded-xl border px-4 py-3.5 text-sm font-semibold transition ${
                  decision === 'include'
                    ? 'border-emerald-400 bg-emerald-100/90 text-emerald-900 shadow-sm ring-1 ring-emerald-300/60'
                    : 'border-emerald-200/70 bg-emerald-50/50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/60'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span aria-hidden className="text-base leading-none">✓</span>
                  Include
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDecision('exclude')}
                className={`group rounded-xl border px-4 py-3.5 text-sm font-semibold transition ${
                  decision === 'exclude'
                    ? 'border-rose-400 bg-rose-100/90 text-rose-900 shadow-sm ring-1 ring-rose-300/60'
                    : 'border-rose-200/70 bg-rose-50/50 text-rose-800 hover:border-rose-300 hover:bg-rose-100/60'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span aria-hidden className="text-base leading-none">✕</span>
                  Exclude
                </span>
              </button>
            </div>

            {decision === 'exclude' ? (
              <div className="mt-3 space-y-2">
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ExclusionReason)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="">Select exclusion reason</option>
                  {EXCLUSION_REASONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {reason === 'Other' ? (
                  <input
                    value={otherReason}
                    onChange={(event) => setOtherReason(event.target.value)}
                    placeholder="Other exclusion reason"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                  />
                ) : null}
              </div>
            ) : null}

            {!canSubmitDecision ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {awaitingPdf
                  ? 'Attach the full-text PDF before reviewer voting.'
                  : 'Two reviewer votes already recorded. Only an original reviewer can change their vote, unless there is a conflict to resolve.'}
              </p>
            ) : null}

            <button
              disabled={isPending || !canSubmitDecision}
              className="mt-4 w-full rounded-xl bg-[#0b3a70] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#0b3a70]/20 transition hover:bg-[#092f5f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? 'Saving…'
                : activeDecisionAction === 'consensus_resolution'
                  ? 'Save conflict resolution'
                  : 'Save reviewer vote'}
            </button>

            {activeDecisionAction === 'consensus_resolution' ? (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Stored as the final conflict decision. The first two reviewer votes remain unchanged.
              </p>
            ) : null}
          </div>

          <div className={`relative z-10 mx-5 mt-2 overflow-hidden rounded-2xl px-5 py-5 backdrop-blur-sm ${aiSectionBgClass}`}>
            <span className={`absolute left-0 top-0 h-full w-1 ${aiAccentBarClass}`} aria-hidden />
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">AI suggestion</p>
              <AiStatusBadge tone={aiTone} label={aiDecisionLabel} hasDecision={aiHasDecision} />
            </div>
            {record.aiReason ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{record.aiReason}</p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-500">No AI recommendation has been recorded yet.</p>
            )}
            {record.aiSuggestedDecision === 'exclude' && record.aiEvidenceQuote ? (
              <blockquote className="mt-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm leading-6 text-slate-700">
                “{record.aiEvidenceQuote}”
                {record.aiSourceLocation ? <footer className="mt-1 text-xs font-semibold text-slate-500">{record.aiSourceLocation}</footer> : null}
              </blockquote>
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Advisory only. Final eligibility depends on reviewer votes.</p>
          </div>

          <div className="relative z-10 px-6 pt-3 pb-2">
            <div className="rounded-2xl border border-indigo-100/80 bg-white/70 p-4 shadow-sm shadow-indigo-900/5 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-900/60">Resolution</p>
                  <div className="mt-2">
                    <ResolutionBadge resolution={resolution} />
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-900/60">Reviewer votes</p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <VoteSlots decisions={reviewerDecisions} />
                    <span className="text-sm font-semibold text-[#0b3a70]">{totalReviewerVotes}<span className="text-slate-400">/2</span></span>
                  </div>
                  {totalReviewerVotes > 0 ? (
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {includeVotes > 0 ? `${includeVotes} include` : ''}
                      {includeVotes > 0 && excludeVotes > 0 ? ' · ' : ''}
                      {excludeVotes > 0 ? `${excludeVotes} exclude` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              {firstTwoConflict ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <p className="text-[11px] font-semibold text-amber-900">Conflict — awaiting resolution</p>
                </div>
              ) : null}
            </div>
          </div>

          {reviewerDecisions.length > 0 || exclusionReasonSummary ? (
            <div className="relative z-10 px-6 pt-3 pb-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-900/70">Reviewer history</p>
              <div className="mt-3 space-y-2">
                {reviewerDecisions.map((item, index) => {
                  const isInclude = item.decision === 'include';
                  const rowClasses = isInclude
                    ? 'border-emerald-200/70 bg-emerald-50/60'
                    : 'border-rose-200/70 bg-rose-50/60';
                  const initials = (item.reviewerName ?? 'Reviewer')
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('') || 'R';
                  const avatarClasses = isInclude
                    ? 'bg-emerald-500/90 text-white'
                    : 'bg-rose-500/90 text-white';
                  const decisionPillClasses = isInclude
                    ? 'border-emerald-300/80 bg-white text-emerald-700'
                    : 'border-rose-300/80 bg-white text-rose-700';
                  return (
                    <div key={`${item.reviewerProfileId}-${item.decidedAt}`} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 shadow-sm shadow-slate-900/[0.02] ${rowClasses}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold tracking-wide ${avatarClasses}`}>
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#0b3a70]">{item.reviewerName ?? 'Reviewer'}</span>
                          {firstTwoConflict && index === 2 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Final</span>
                          ) : null}
                        </div>
                        {item.reason ? <p className="mt-1 truncate text-xs text-slate-600">{item.reason}</p> : null}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${decisionPillClasses}`}>
                        {isInclude ? 'Include' : 'Exclude'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {exclusionReasonSummary ? (
                <p className="mt-3 text-xs text-slate-500">Exclusion reasons: {exclusionReasonSummary}</p>
              ) : null}
            </div>
          ) : null}
        </form>
      </section>
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

function VoteSlots({ decisions }: { decisions: ReadonlyArray<{ decision: ScreeningDecision }> }) {
  const slots = [decisions[0]?.decision, decisions[1]?.decision];
  return (
    <div className="flex items-center gap-1.5">
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
            className="h-5 w-5 rounded-full border-2 border-dashed border-slate-300 bg-white/50"
          />
        );
      })}
    </div>
  );
}

function AiStatusBadge({ tone, label, hasDecision }: { tone: 'emerald' | 'rose' | 'amber' | 'slate'; label: string; hasDecision: boolean }) {
  const classes = tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
    : tone === 'rose'
      ? 'border-rose-300 bg-rose-100 text-rose-900'
      : tone === 'amber'
        ? 'border-amber-300 bg-amber-100 text-amber-900'
        : 'border-slate-200 bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {hasDecision ? (
        <span aria-hidden className="text-sm leading-none">{tone === 'emerald' ? '✓' : '✕'}</span>
      ) : null}
      {label}
    </span>
  );
}

function ResolutionBadge({ resolution }: { resolution: ReturnType<typeof getScreeningResolution> }) {
  const labels = {
    awaiting_pdf: 'Upload full text',
    pending: 'Pending',
    ready_for_extraction: 'Ready for extraction',
    excluded: 'Excluded',
    conflict: 'Conflict',
    promoted: 'Promoted',
  } as const;
  const tones: Record<keyof typeof labels, PillTone> = {
    awaiting_pdf: 'amber',
    pending: 'slate',
    ready_for_extraction: 'emerald',
    excluded: 'rose',
    conflict: 'amber',
    promoted: 'sky',
  };
  return <Pill tone={tones[resolution]}>{labels[resolution]}</Pill>;
}

function formatDuplicateWarningMessage(warnings: DuplicateWarning[]) {
  const warning = warnings[0];
  if (!warning) {
    return '';
  }
  const study = warning.matchedStudyId ? `${warning.matchedStudyId}: ` : '';
  const extraCount = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : '';
  return `Possible duplicate found in extraction: ${study}${warning.matchedTitle}${extraCount}. Please check before continuing.`;
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200/70 bg-rose-50/80 text-rose-700'
    : tone === 'success'
      ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700'
      : 'border-slate-200/70 bg-slate-50/80 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}
