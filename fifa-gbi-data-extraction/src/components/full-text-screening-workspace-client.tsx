'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  EXCLUSION_REASONS,
  getDecisionProgressLabel,
  getReviewerDecisions,
  getScreeningResolution,
  summarizeExclusionReasons,
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
  const currentReviewerIsOriginalConflictReviewer = firstTwoConflict
    ? reviewerDecisions.slice(0, 2).some((item) => item.reviewerProfileId === currentReviewerId)
    : false;
  const decisionMode = firstTwoConflict && !thirdDecision ? 'Resolve conflict' : 'Your decision';
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : null;
  const displayTitle = cleanDisplayTitle(record.title);
  const pdfUrl = `/api/full-text-screening/${record.id}/file#view=FitH`;

  const saveDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision) {
      setNotice({ tone: 'error', message: 'Choose Include or Exclude.' });
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
        body: JSON.stringify({ decision, reason: decision === 'exclude' ? reason : null, otherReason }),
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
      setNotice({ tone: 'success', message: 'Reviewer decision saved.' });
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
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <iframe src={pdfUrl} className="h-full min-h-[82vh] w-full border-0 bg-white" title={`${record.assignedStudyId} full text PDF`} />
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
              {reviewerDecisions.length > 0 ? reviewerDecisions.map((item) => (
                <div key={`${item.reviewerProfileId}-${item.decidedAt}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <DecisionPill decision={item.decision} />
                    <span className="text-xs text-slate-500">{item.reviewerName ?? 'Reviewer'}</span>
                  </div>
                  {item.reason ? <p className="mt-2 text-xs text-slate-600">{item.reason}</p> : null}
                  {firstTwoConflict && reviewerDecisions[2]?.reviewerProfileId === item.reviewerProfileId ? (
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
              {firstTwoConflict && !thirdDecision ? (
                <p className="mt-1 text-xs text-slate-500">
                  A third decision resolves the conflict and becomes the final decision.
                </p>
              ) : null}
              {firstTwoConflict && !thirdDecision && currentReviewerIsOriginalConflictReviewer ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  This record needs an independent conflict reviewer.
                </p>
              ) : null}
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
            <button disabled={isPending} className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Save decision
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
