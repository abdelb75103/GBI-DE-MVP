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
    : currentReviewerVote ? 'Change my reviewer vote' : 'Your reviewer vote';
  const canSubmitDecision = activeDecisionAction === 'consensus_resolution'
    ? canRecordConsensus
    : canChangeReviewerVote;
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : null;
  const displayTitle = cleanDisplayTitle(record.title);
  const pdfDirectUrl = `/api/full-text-screening/${record.id}/file`;
  const pdfUrl = `${pdfDirectUrl}#view=FitH`;

  const aiTone: PillTone = record.aiSuggestedDecision === 'include'
    ? 'emerald'
    : record.aiSuggestedDecision === 'exclude'
      ? 'rose'
      : record.aiStatus === 'failed'
        ? 'amber'
        : 'slate';

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
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
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

      <div className="grid min-h-[calc(100vh-190px)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">PDF preview</p>
              <p className="text-xs text-slate-500">If the preview is blank, open the PDF directly.</p>
            </div>
            <a
              href={pdfDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-indigo-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              Open PDF in new tab
            </a>
          </div>
          <iframe
            src={pdfUrl}
            className="h-full min-h-[calc(82vh-58px)] w-full flex-1 border-0 bg-white"
            title={`${record.assignedStudyId} full text PDF`}
            allow="fullscreen"
          />
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="space-y-2 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Selected record</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{record.assignedStudyId}</span>
              {authorLabel ? <span className="text-sm text-slate-500">{authorLabel}</span> : null}
            </div>
            <h1 className="break-words text-xl font-semibold leading-snug text-slate-900">{displayTitle}</h1>
          </section>

          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">AI suggestion</p>
              <Pill tone={aiTone}>
                {record.aiStatus === 'running'
                  ? 'AI running'
                  : record.aiStatus === 'failed'
                    ? 'AI failed'
                    : record.aiSuggestedDecision === 'include'
                      ? 'AI include'
                      : record.aiSuggestedDecision === 'exclude'
                        ? 'AI exclude'
                        : 'Not run'}
              </Pill>
            </div>
            {record.aiReason ? <p className="mt-3 text-sm leading-relaxed text-slate-700">{record.aiReason}</p> : null}
            {record.aiEvidenceQuote ? (
              <blockquote className="mt-3 rounded-xl border-l-2 border-slate-300 bg-slate-50/70 px-3 py-2 text-sm leading-relaxed text-slate-700">
                {record.aiEvidenceQuote}
              </blockquote>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Reviewer decisions</p>
              <Pill tone="slate">{getDecisionProgressLabel(record)}</Pill>
            </div>
            <div className="mt-3 space-y-2">
              {reviewerDecisions.length > 0 ? reviewerDecisions.map((item, index) => (
                <div key={`${item.reviewerProfileId}-${item.decidedAt}`} className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <DecisionPill decision={item.decision} />
                    <span className="text-xs text-slate-500">{item.reviewerName ?? 'Reviewer'}</span>
                  </div>
                  {item.reason ? <p className="mt-2 text-xs text-slate-600">{item.reason}</p> : null}
                  {firstTwoConflict && index === 2 ? (
                    <p className="mt-2 text-xs font-semibold text-slate-700">Final conflict decision</p>
                  ) : null}
                </div>
              )) : (
                <p className="text-sm text-slate-500">No reviewer decision yet.</p>
              )}
            </div>
            {exclusionReasonSummary ? <p className="mt-3 text-xs text-slate-600">Exclusion reasons: {exclusionReasonSummary}</p> : null}
          </section>

          <form onSubmit={saveDecision} className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{decisionMode}</p>
              {firstTwoConflict ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canChangeReviewerVote}
                    onClick={() => setDecisionAction('reviewer_vote')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      activeDecisionAction === 'reviewer_vote'
                        ? 'border-indigo-300 bg-indigo-100/90 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'border-indigo-200 bg-white/80 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    Change my vote
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('consensus_resolution')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      activeDecisionAction === 'consensus_resolution'
                        ? 'border-amber-300 bg-amber-100/90 text-amber-800 shadow-sm ring-1 ring-amber-200'
                        : 'border-amber-200 bg-white/80 text-amber-700 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    Resolve conflict
                  </button>
                </div>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {activeDecisionAction === 'consensus_resolution'
                  ? 'Stored as the final conflict decision. The first two reviewer votes remain unchanged. If you exclude, pick a reason.'
                  : currentReviewerVote
                    ? 'Updates your individual reviewer vote. Any previous consensus remains active only if the first two votes still conflict.'
                    : 'Stored as your reviewer vote.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision('include')}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  decision === 'include'
                    ? 'border-emerald-300 bg-emerald-100/80 text-emerald-800 shadow-sm ring-1 ring-emerald-300/60'
                    : 'border-emerald-200/70 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Include
              </button>
              <button
                type="button"
                onClick={() => setDecision('exclude')}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  decision === 'exclude'
                    ? 'border-rose-300 bg-rose-100/80 text-rose-800 shadow-sm ring-1 ring-rose-300/60'
                    : 'border-rose-200/70 bg-rose-50/60 text-rose-700 hover:bg-rose-50'
                }`}
              >
                Exclude
              </button>
            </div>
            {decision === 'exclude' ? (
              <>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ExclusionReason)}
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm"
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
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm"
                  />
                ) : null}
              </>
            ) : null}
            {!canSubmitDecision ? (
              <p className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-800">
                This record already has two reviewer votes. Only an original reviewer can change their vote, unless there is a conflict to resolve by consensus.
              </p>
            ) : null}
            <button
              disabled={isPending || !canSubmitDecision}
              className={`w-full rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition disabled:opacity-50 ${
                activeDecisionAction === 'consensus_resolution'
                  ? 'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400 hover:from-rose-600 hover:via-orange-500 hover:to-amber-500'
                  : 'bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500'
              }`}
            >
              {activeDecisionAction === 'consensus_resolution' ? 'Save conflict resolution' : 'Save reviewer vote'}
            </button>
          </form>
        </aside>
      </div>
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
