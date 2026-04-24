'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  EXCLUSION_REASONS,
  getDecisionProgressLabel,
  getReviewerDecisions,
  getScreeningResolution,
  summarizeExclusionReasons,
  type FullTextDecisionAction,
  type ExclusionReason,
} from '@/lib/screening/reviewer-decisions';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecord: ScreeningRecord;
  currentReviewerId: string;
};

type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;
const cleanDisplayTitle = (title: string) => title.replace(/^Mock QA #\d+\s*-\s*/i, '');

export function FullTextScreeningWorkspaceClient({ initialRecord, currentReviewerId }: Props) {
  const [record, setRecord] = useState(initialRecord);
  const [decisionAction, setDecisionAction] = useState<FullTextDecisionAction>('reviewer_vote');
  const [decision, setDecision] = useState<ScreeningDecision | null>(null);
  const [reason, setReason] = useState<ExclusionReason | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();

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
  const canSubmitDecision = activeDecisionAction === 'consensus_resolution'
    ? canRecordConsensus
    : canChangeReviewerVote;
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : null;
  const displayTitle = cleanDisplayTitle(record.title);
  const pdfDirectUrl = `/api/full-text-screening/${record.id}/file`;
  const pdfUrl = `${pdfDirectUrl}#view=FitH`;

  const aiDecisionLabel = record.aiStatus === 'running'
    ? 'Running'
    : record.aiStatus === 'failed'
      ? 'Failed'
      : record.aiSuggestedDecision === 'include'
        ? 'Include'
        : record.aiSuggestedDecision === 'exclude'
          ? 'Exclude'
          : 'Not run';
  const aiDecisionTextClass = record.aiSuggestedDecision === 'include'
    ? 'text-emerald-900'
    : record.aiSuggestedDecision === 'exclude'
      ? 'text-rose-900'
    : record.aiStatus === 'failed'
        ? 'text-amber-900'
        : 'text-slate-900';
  const aiDecisionCardClass = record.aiSuggestedDecision === 'include'
    ? 'border-emerald-300 bg-emerald-100'
    : record.aiSuggestedDecision === 'exclude'
      ? 'border-rose-300 bg-rose-100'
      : record.aiStatus === 'failed'
        ? 'border-amber-300 bg-amber-100'
        : 'border-slate-300 bg-slate-100';
  const aiDecisionIcon = record.aiSuggestedDecision === 'include'
    ? '✓'
    : record.aiSuggestedDecision === 'exclude'
      ? 'X'
      : record.aiStatus === 'failed'
        ? '!'
        : '–';

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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'Failed to save decision' });
        return;
      }
      setRecord(payload.record);
      setDecision(null);
      setReason('');
      setOtherReason('');
      setNotice({
        tone: 'success',
        message: activeDecisionAction === 'consensus_resolution'
          ? 'Conflict resolution saved.'
          : 'Reviewer vote saved.',
      });
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/full-text-screening"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <span aria-hidden>←</span> Back to queue
        </Link>
        <ResolutionBadge resolution={resolution} />
      </div>

      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="grid min-h-[calc(100vh-168px)] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-h-[calc(100vh-168px)] min-w-0 grid-rows-[auto_minmax(0,1fr)] bg-gradient-to-br from-white/90 via-slate-50/85 to-sky-50/70">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-900">Evidence workspace</p>
              <p className="mt-1 text-xs font-medium text-slate-700">PDF source</p>
            </div>
            <a
              href={pdfDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-indigo-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              Open PDF
            </a>
          </div>
          <div className="flex min-h-0 p-2.5 sm:p-4">
            <div className="flex min-h-[calc(100vh-244px)] w-full overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-inner">
              <iframe
                src={pdfUrl}
                className="h-full min-h-[calc(100vh-244px)] w-full flex-1 border-0 bg-white"
                title={`${record.assignedStudyId} full text PDF`}
                allow="fullscreen"
              />
            </div>
          </div>
        </div>

        <form onSubmit={saveDecision} className="grid min-h-[calc(100vh-168px)] min-w-0 grid-rows-[auto_1fr_auto] border-l border-slate-200/80 bg-gradient-to-b from-sky-50/90 via-white/86 to-sky-50/90 text-slate-950 shadow-[inset_18px_0_36px_rgba(15,23,42,0.045)]">
          <div className="border-b border-slate-200/80 bg-gradient-to-br from-white/95 via-sky-50/80 to-indigo-50/60 px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-white/85 px-3 py-1 text-xs font-bold text-[#0b3a70] shadow-sm">{record.assignedStudyId}</span>
              <span className="rounded-full border border-blue-100 bg-blue-50/85 px-3 py-1 text-xs font-bold text-[#0b3a70]">full-text</span>
              <Pill tone="slate">{getDecisionProgressLabel(record)}</Pill>
            </div>
            <h1 className="mt-4 break-words text-2xl font-semibold leading-tight tracking-[-0.035em] text-[#092f5f]">{displayTitle}</h1>
            {[authorLabel, record.year].filter(Boolean).length > 0 ? (
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {[authorLabel, record.year].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className={`col-span-2 rounded-3xl border px-5 py-5 shadow-sm ${aiDecisionCardClass}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0b3a70]/70">AI read</p>
                <div className={`mt-3 flex items-center gap-3 text-4xl font-black tracking-[-0.055em] ${aiDecisionTextClass}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/60 text-2xl leading-none shadow-sm">{aiDecisionIcon}</span>
                  <span>{aiDecisionLabel}</span>
                </div>
                <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-700">
                  Advisory only. Final eligibility depends on reviewer votes.
                </p>
              </div>

              <section className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0b3a70]">Status</p>
                <div className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#092f5f]">{getDecisionProgressLabel(record)}</div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">Reviewer progress</p>
              </section>

              <section className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0b3a70]">Resolution</p>
                <div className="mt-3">
                  <ResolutionBadge resolution={resolution} />
                </div>
                <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-600">Current record state</p>
              </section>

              <section className="col-span-2 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0b3a70]">AI rationale</p>
                {record.aiReason ? (
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900">{record.aiReason}</p>
                ) : (
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-700">No AI recommendation has been recorded yet.</p>
                )}
              </section>

              <section className="col-span-2 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0b3a70]">Reviewer history</p>
                  <span className="rounded-full border border-blue-200 bg-blue-50/90 px-2.5 py-0.5 text-xs font-bold text-[#0b3a70]">{getDecisionProgressLabel(record)}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {reviewerDecisions.length > 0 ? reviewerDecisions.map((item, index) => (
                    <div key={`${item.reviewerProfileId}-${item.decidedAt}`} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <DecisionPill decision={item.decision} />
                        <span className="text-xs font-semibold text-slate-900">{item.reviewerName ?? 'Reviewer'}</span>
                      </div>
                      {item.reason ? <p className="mt-2 text-xs font-semibold text-slate-700">{item.reason}</p> : null}
                      {firstTwoConflict && index === 2 ? (
                        <p className="mt-2 text-xs font-bold text-slate-900">Final conflict decision</p>
                      ) : null}
                    </div>
                  )) : (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs font-bold text-slate-600">
                        <span>Reviewer 1</span>
                        <span>Not voted</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs font-bold text-slate-600">
                        <span>Reviewer 2</span>
                        <span>Not voted</span>
                      </div>
                    </div>
                  )}
                </div>
                {exclusionReasonSummary ? <p className="mt-3 text-xs font-semibold text-slate-800">Exclusion reasons: {exclusionReasonSummary}</p> : null}
              </section>
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-gradient-to-br from-sky-100/85 via-sky-50/90 to-white/90 px-5 py-5">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0b3a70]">{decisionMode}</p>
            {firstTwoConflict ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canChangeReviewerVote}
                  onClick={() => setDecisionAction('reviewer_vote')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    activeDecisionAction === 'reviewer_vote'
                      ? 'border-indigo-300 bg-indigo-100/90 text-indigo-900 shadow-sm ring-1 ring-indigo-200'
                      : 'border-indigo-200 bg-white/80 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  Change my vote
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionAction('consensus_resolution')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeDecisionAction === 'consensus_resolution'
                      ? 'border-amber-300 bg-amber-100/90 text-amber-950 shadow-sm ring-1 ring-amber-200'
                      : 'border-amber-200 bg-white/80 text-amber-900 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  Resolve conflict
                </button>
              </div>
            ) : null}
            {activeDecisionAction === 'consensus_resolution' || currentReviewerVote ? (
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
                {activeDecisionAction === 'consensus_resolution'
                  ? 'Stored as the final conflict decision. The first two reviewer votes remain unchanged. If you exclude, pick a reason.'
                  : 'Updates your individual reviewer vote. Any previous consensus remains active only if the first two votes still conflict.'}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision('include')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                  decision === 'include'
                    ? 'border-emerald-300 bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300/60'
                    : 'border-emerald-200/70 bg-emerald-50/60 text-emerald-950 hover:bg-emerald-50'
                }`}
              >
                Include
              </button>
              <button
                type="button"
                onClick={() => setDecision('exclude')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                  decision === 'exclude'
                    ? 'border-rose-300 bg-rose-600 text-white shadow-sm ring-1 ring-rose-300/60'
                    : 'border-rose-200/70 bg-white text-rose-950 hover:bg-rose-50'
                }`}
              >
                Exclude
              </button>
            </div>
            {decision === 'exclude' ? (
              <div className="mt-3 space-y-2">
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ExclusionReason)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-sm"
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-sm placeholder:text-slate-500"
                  />
                ) : null}
              </div>
            ) : null}
            {!canSubmitDecision ? (
              <p className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950">
                This record already has two reviewer votes. Only an original reviewer can change their vote, unless there is a conflict to resolve by consensus.
              </p>
            ) : null}
            <button
              disabled={isPending || !canSubmitDecision}
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
            >
              {activeDecisionAction === 'consensus_resolution' ? 'Save conflict resolution' : 'Save reviewer vote'}
            </button>
          </div>
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

function DecisionPill({ decision }: { decision: ScreeningDecision }) {
  return decision === 'include'
    ? <Pill tone="emerald">Reviewer include</Pill>
    : <Pill tone="rose">Reviewer exclude</Pill>;
}

function ResolutionBadge({ resolution }: { resolution: ReturnType<typeof getScreeningResolution> }) {
  const labels = {
    pending: 'Pending',
    ready_for_extraction: 'Ready for extraction',
    excluded: 'Excluded',
    conflict: 'Conflict',
    promoted: 'Promoted',
  } as const;
  const tones: Record<keyof typeof labels, PillTone> = {
    pending: 'slate',
    ready_for_extraction: 'emerald',
    excluded: 'rose',
    conflict: 'amber',
    promoted: 'sky',
  };
  return <Pill tone={tones[resolution]}>{labels[resolution]}</Pill>;
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200/70 bg-rose-50/80 text-rose-700'
    : tone === 'success'
      ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700'
      : 'border-slate-200/70 bg-slate-50/80 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}
