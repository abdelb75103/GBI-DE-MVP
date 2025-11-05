import Link from 'next/link';

import { ExportControls } from '@/components/export-controls';
import { PapersTable } from '@/components/papers-table';
import { formatDateTimeUTC } from '@/lib/format';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const papers = await mockDb.listPapers();
  const exportJobs = await mockDb.listExports();
  const activePaperIds = papers.map((paper) => paper.id);
  const flaggedCount = papers.filter((paper) => Boolean(paper.flagReason)).length;
  const extractedCount = papers.filter((paper) => paper.status === 'extracted').length;
  const inProgressCount = papers.filter(
    (paper) => paper.status === 'processing' || paper.status === 'uploaded',
  ).length;
  const activeProfile = await readActiveProfileSession();
  const isAdmin = activeProfile?.role === 'admin';

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-4">
              <span className="inline-flex w-fit items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600 data-[theme=dark]:bg-indigo-500/20 data-[theme=dark]:text-indigo-200">
                Overall workspace
              </span>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Confident, calm oversight for GBI extractions
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Monitor every paper in the pipeline, flag issues for reviewers, and export structured data the moment it&apos;s ready.
              </p>
              {isAdmin ? (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/upload"
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500"
                  >
                    Upload a PDF
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[{
              label: 'Active papers',
              value: papers.length,
              caption: 'Currently tracked in the workspace',
              accent: 'from-indigo-500/20 via-sky-400/10 to-indigo-400/20',
              text: 'text-indigo-700',
            },
            {
              label: 'In progress',
              value: inProgressCount,
              caption: 'Processing or awaiting extraction',
              accent: 'from-sky-500/20 via-cyan-400/10 to-indigo-300/20',
              text: 'text-sky-700',
            },
            {
              label: 'Ready for review',
              value: extractedCount,
              caption: 'Marked as extracted and ready to QA',
              accent: 'from-emerald-500/20 via-teal-400/10 to-green-400/20',
              text: 'text-emerald-700',
            },
            {
              label: 'Needs attention',
              value: flaggedCount,
              caption: 'Flagged items awaiting follow-up',
              accent: 'from-rose-500/20 via-orange-400/10 to-amber-400/20',
              text: 'text-rose-700',
            }].map((item) => (
              <div
                key={item.label}
                className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-md ring-1 ring-slate-200/60 backdrop-blur"
              >
                <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${item.accent} opacity-80`} aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                <div className="mt-3 flex items-baseline justify-between gap-4">
                  <p className={`text-3xl font-semibold ${item.text}`}>{item.value}</p>
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{item.caption}</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/60">
                  <div
                    className={`h-full bg-gradient-to-r ${item.accent} opacity-90`}
                    style={{ width: `${Math.min(100, item.value === 0 ? 4 : Math.round((item.value / Math.max(1, papers.length)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.85fr,1fr]" id="uploads">
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Uploaded PDFs</h2>
              <p className="text-xs text-slate-500">Keep track of status, notes, and flags per paper.</p>
            </div>
            {isAdmin ? (
              <Link
                href="/upload"
                className="hidden rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700 sm:inline-flex"
              >
                Add new PDF
              </Link>
            ) : null}
          </div>
          <PapersTable papers={papers} canBulkExport={isAdmin} />
        </section>

        <aside className="space-y-6">
          <ExportControls paperIds={activePaperIds} />

          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Recent exports</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Activity
              </span>
            </div>
            <div className="mt-4">
              {exportJobs.length === 0 ? (
                <p className="text-sm text-slate-500">Exports will appear here once generated.</p>
              ) : (
                <ul className="space-y-4">
                  {exportJobs.map((job) => (
                    <li
                      key={job.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-md ring-1 ring-slate-200/60 backdrop-blur"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          {job.kind.toUpperCase()} · {job.paperIds.length} papers
                        </span>
                        <span className="inline-flex items-center rounded-full bg-emerald-100/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <time dateTime={job.createdAt}>{formatDateTimeUTC(job.createdAt)}</time>
                        <div className="flex items-center gap-2">
                          {job.downloadUrl ? (
                            <a
                              href={job.downloadUrl}
                              download
                              className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700"
                            >
                              Download {job.kind.toUpperCase()}
                            </a>
                          ) : null}
                          {job.checksumSha256 ? (
                            <span className="font-mono text-slate-400">checksum {job.checksumSha256}</span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
