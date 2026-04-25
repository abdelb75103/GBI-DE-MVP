import { redirect } from 'next/navigation';

import { extractionFieldDefinitions, extractionTabMeta } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { ExtractionTab, ScreeningRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

type TabFieldKey = `${ExtractionTab}:${string}`;

export default async function AiReviewMetricsPage() {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  let decisions: Awaited<ReturnType<typeof mockDb.listAiReviewDecisions>> = [];
  let loadError: string | null = null;
  let titleAbstractRecords: ScreeningRecord[] = [];
  let fullTextRecords: ScreeningRecord[] = [];
  let screeningLoadError: string | null = null;
  try {
    decisions = await mockDb.listAiReviewDecisions();
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }
  try {
    [titleAbstractRecords, fullTextRecords] = await Promise.all([
      mockDb.listScreeningRecords('title_abstract'),
      mockDb.listScreeningRecords('full_text'),
    ]);
  } catch (error) {
    screeningLoadError = error instanceof Error ? error.message : String(error);
  }

  const profileNameById = loadError
    ? new Map<string, string>()
    : await mockDb.listProfileNamesById(decisions.map((item) => item.reviewerProfileId));

  const fieldLabelByKey = new Map<TabFieldKey, string>();
  extractionFieldDefinitions.forEach((field) => {
    fieldLabelByKey.set(`${field.tab}:${field.id}`, field.label);
  });

  const totals = { approved: 0, declined: 0 };

  const byTabField = new Map<TabFieldKey, { tab: ExtractionTab; fieldId: string; approved: number; declined: number }>();
  const byReviewer = new Map<string, { reviewerId: string; name: string; approved: number; declined: number }>();

  decisions.forEach((item) => {
    totals[item.decision] += 1;

    const tabFieldKey = `${item.tab}:${item.fieldId}` as TabFieldKey;
    const tabField = byTabField.get(tabFieldKey) ?? {
      tab: item.tab,
      fieldId: item.fieldId,
      approved: 0,
      declined: 0,
    };
    tabField[item.decision] += 1;
    byTabField.set(tabFieldKey, tabField);

    const reviewerId = item.reviewerProfileId;
    const reviewer = byReviewer.get(reviewerId) ?? {
      reviewerId,
      name: profileNameById.get(reviewerId) || reviewerId,
      approved: 0,
      declined: 0,
    };
    reviewer[item.decision] += 1;
    byReviewer.set(reviewerId, reviewer);
  });

  const totalDecisions = totals.approved + totals.declined;
  const approvalRate = totalDecisions ? Math.round((totals.approved / totalDecisions) * 100) : 0;

  const tabFieldRows = Array.from(byTabField.values()).sort((a, b) => {
    if (a.tab !== b.tab) {
      return extractionTabMeta[a.tab].title.localeCompare(extractionTabMeta[b.tab].title);
    }
    const labelA = fieldLabelByKey.get(`${a.tab}:${a.fieldId}` as TabFieldKey) ?? a.fieldId;
    const labelB = fieldLabelByKey.get(`${b.tab}:${b.fieldId}` as TabFieldKey) ?? b.fieldId;
    return labelA.localeCompare(labelB);
  });

  const reviewerRows = Array.from(byReviewer.values()).sort((a, b) => {
    const totalA = a.approved + a.declined;
    const totalB = b.approved + b.declined;
    if (totalA !== totalB) {
      return totalB - totalA;
    }
    return a.name.localeCompare(b.name);
  });

  const screeningAiTotals = (records: ScreeningRecord[]) => ({
    total: records.length,
    completed: records.filter((record) => record.aiStatus === 'completed').length,
    include: records.filter((record) => record.aiSuggestedDecision === 'include').length,
    exclude: records.filter((record) => record.aiSuggestedDecision === 'exclude').length,
    failed: records.filter((record) => record.aiStatus === 'failed').length,
  });
  const titleAbstractAi = screeningAiTotals(titleAbstractRecords);
  const fullTextAi = screeningAiTotals(fullTextRecords);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">AI review metrics</h1>
        <p className="text-sm text-slate-600">
          Shows the current approve/decline state for AI-extracted fields. Decisions reset automatically when a field is
          re-extracted.
        </p>
      </div>

      {loadError ? (
        <section className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm ring-1 ring-amber-200/50 backdrop-blur">
          <p className="font-semibold">Metrics table not available yet.</p>
          <p className="mt-2 text-amber-800">
            Apply the Supabase migration at <code>supabase/migrations/20260130120000_ai_review_decisions.sql</code>, then
            refresh this page.
          </p>
          <p className="mt-2 text-xs text-amber-700">{loadError}</p>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Total decisions</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalDecisions}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 shadow-sm ring-1 ring-emerald-200/50 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Approved</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-900">{totals.approved}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 shadow-sm ring-1 ring-rose-200/50 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700">Declined</p>
          <p className="mt-2 text-3xl font-semibold text-rose-900">{totals.declined}</p>
        </div>
      </section>

      {screeningLoadError ? (
        <section className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm ring-1 ring-amber-200/50 backdrop-blur">
          <p className="font-semibold">Screening AI metrics are not available yet.</p>
          <p className="mt-2 text-xs text-amber-700">{screeningLoadError}</p>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm ring-1 ring-slate-200/60 backdrop-blur">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Screening AI coverage</h2>
            <p className="text-sm text-slate-600">Advisory recommendations for title/abstract and full-text screening.</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ScreeningAiCard title="Title and abstract" totals={titleAbstractAi} />
            <ScreeningAiCard title="Full text" totals={fullTextAi} />
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm ring-1 ring-slate-200/60 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Breakdown by tab & field</h2>
          <p className="text-sm text-slate-600">Approval rate: {approvalRate}%</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="py-3 pr-4">Tab</th>
                <th className="py-3 pr-4">Field</th>
                <th className="py-3 pr-4 text-right">Approved</th>
                <th className="py-3 pr-4 text-right">Declined</th>
                <th className="py-3 pr-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {tabFieldRows.length ? (
                tabFieldRows.map((row) => {
                  const total = row.approved + row.declined;
                  const rate = total ? Math.round((row.approved / total) * 100) : 0;
                  const label = fieldLabelByKey.get(`${row.tab}:${row.fieldId}` as TabFieldKey) ?? row.fieldId;
                  return (
                    <tr key={`${row.tab}:${row.fieldId}`} className="text-slate-700">
                      <td className="py-3 pr-4 font-medium text-slate-900">{extractionTabMeta[row.tab].title}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{label}</span>
                          <span className="text-xs text-slate-500">{row.fieldId}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-emerald-700">{row.approved}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-rose-700">{row.declined}</td>
                      <td className="py-3 pr-2 text-right font-semibold text-slate-700">{rate}%</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                    No review decisions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm ring-1 ring-slate-200/60 backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">Breakdown by reviewer</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="py-3 pr-4">Reviewer</th>
                <th className="py-3 pr-4 text-right">Approved</th>
                <th className="py-3 pr-4 text-right">Declined</th>
                <th className="py-3 pr-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {reviewerRows.length ? (
                reviewerRows.map((row) => {
                  const total = row.approved + row.declined;
                  const rate = total ? Math.round((row.approved / total) * 100) : 0;
                  return (
                    <tr key={row.reviewerId} className="text-slate-700">
                      <td className="py-3 pr-4 font-medium text-slate-900">{row.name}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-emerald-700">{row.approved}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-rose-700">{row.declined}</td>
                      <td className="py-3 pr-2 text-right font-semibold text-slate-700">{rate}%</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                    No review decisions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScreeningAiCard({
  title,
  totals,
}: {
  title: string;
  totals: { total: number; completed: number; include: number; exclude: number; failed: number };
}) {
  const coverage = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{coverage}% reviewed by AI</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          {totals.completed}/{totals.total}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-emerald-800">
          <p className="font-semibold">{totals.include}</p>
          <p>Include</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-rose-800">
          <p className="font-semibold">{totals.exclude}</p>
          <p>Exclude</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-amber-800">
          <p className="font-semibold">{totals.failed}</p>
          <p>Failed</p>
        </div>
      </div>
    </div>
  );
}
