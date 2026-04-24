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
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/full-text-screening" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to queue
        </Link>
        <ResolutionBadge resolution={resolution} />
      </div>

      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <div className="grid min-h-[calc(100vh-190px)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">PDF preview</p>
              <p className="text-xs text-slate-500">If the preview is blank, open the PDF directly.</p>
            </div>
            <a
              href={pdfDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

        <aside className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected record</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{record.assignedStudyId}</span>
              {authorLabel ? <span className="text-sm text-slate-500">{authorLabel}</span> : null}
            </div>
            <h1 className="break-words text-xl font-semibold leading-snug text-slate-950">{displayTitle}</h1>
          </section>

          <section className={`rounded-xl border p-4 ${record.aiSuggestedDecision === 'exclude' ? 'border-rose-100 bg-rose-50' : record.aiSuggestedDecision === 'include' ? 'border-emerald-100 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI suggestion</p>
            <div className="mt-2">
              <AiBadge record={record} />
            </div>
            {record.aiReason ? <p className="mt-3 text-sm leading-relaxed text-slate-700">{record.aiReason}</p> : null}
            {record.aiEvidenceQuote ? (
              <blockquote className="mt-3 border-l-4 border-white/80 pl-3 text-sm leading-relaxed text-slate-800">
                {record.aiEvidenceQuote}
              </blockquote>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reviewer decisions</p>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{getDecisionProgressLabel(record)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {reviewerDecisions.length > 0 ? reviewerDecisions.map((item, index) => (
                <div key={`${item.reviewerProfileId}-${item.decidedAt}`} className="rounded-xl border border-slate-200 bg-white p-3">
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

          <form onSubmit={saveDecision} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{decisionMode}</p>
              {firstTwoConflict ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canChangeReviewerVote}
                    onClick={() => setDecisionAction('reviewer_vote')}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${activeDecisionAction === 'reviewer_vote' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    Change my vote
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('consensus_resolution')}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${activeDecisionAction === 'consensus_resolution' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    Resolve conflict
                  </button>
                </div>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {activeDecisionAction === 'consensus_resolution'
                  ? 'This is stored as the final conflict decision and does not overwrite the first two reviewer votes. If you choose exclude, select an exclusion reason.'
                  : currentReviewerVote
                    ? 'This updates only your individual reviewer vote. Any previous consensus remains active only if the first two votes still conflict.'
                    : 'This is stored as your reviewer vote.'}
              </p>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setDecision('include')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${decision === 'include' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}
              >
                Include
              </button>
              <button
                type="button"
                onClick={() => setDecision('exclude')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${decision === 'exclude' ? 'bg-rose-600 text-white' : 'border border-rose-200 bg-rose-50 text-rose-800'}`}
              >
                Exclude
              </button>
            </div>
            {decision === 'exclude' ? (
              <>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ExclusionReason)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                ) : null}
              </>
            ) : null}
            {!canSubmitDecision ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                This record already has two reviewer votes. Only an original reviewer can change their vote, unless there is a conflict to resolve by consensus.
              </p>
            ) : null}
            <button disabled={isPending || !canSubmitDecision} className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {activeDecisionAction === 'consensus_resolution' ? 'Save conflict resolution' : 'Save reviewer vote'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function AiBadge({ record }: { record: ScreeningRecord }) {
  if (record.aiStatus === 'running') return <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-800">AI running</span>;
  if (record.aiStatus === 'failed') return <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-semibold text-amber-900">AI failed</span>;
  if (record.aiSuggestedDecision === 'include') return <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">AI include</span>;
  if (record.aiSuggestedDecision === 'exclude') return <span className="rounded-full bg-rose-600 px-3 py-1 text-sm font-semibold text-white">AI exclude</span>;
  return <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">Not run</span>;
}

function DecisionPill({ decision }: { decision: ScreeningDecision }) {
  return decision === 'include'
    ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Reviewer include</span>
    : <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">Reviewer exclude</span>;
}

function ResolutionBadge({ resolution }: { resolution: ReturnType<typeof getScreeningResolution> }) {
  const labels = {
    pending: 'Pending',
    ready_for_extraction: 'Ready for extraction',
    excluded: 'Excluded',
    conflict: 'Conflict',
    promoted: 'Promoted',
  };
  const classes = {
    pending: 'border-slate-200 bg-white text-slate-700',
    ready_for_extraction: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    excluded: 'border-rose-200 bg-rose-50 text-rose-800',
    conflict: 'border-amber-200 bg-amber-50 text-amber-800',
    promoted: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return <span className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${classes[resolution]}`}>{labels[resolution]}</span>;
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}
