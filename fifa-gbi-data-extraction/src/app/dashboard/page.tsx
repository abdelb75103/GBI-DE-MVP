import Link from 'next/link';

import { ExportControls } from '@/components/export-controls';
import { FlagToggleButton } from '@/components/flag-toggle-button';
import { StatusPill } from '@/components/status-pill';
import { mockDb, seedIfEmpty } from '@/lib/mock-db';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  seedIfEmpty();

  const papers = mockDb.listPapers();
  const exportJobs = mockDb.listExports();
  const activePaperIds = papers.map((paper) => paper.id);
  const flaggedCount = papers.filter((paper) => Boolean(paper.flagId)).length;
  const extractedCount = papers.filter((paper) => paper.status === 'extracted').length;
  const inProgressCount = papers.filter((paper) => paper.status === 'processing' || paper.status === 'uploaded').length;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-4">
              <span className="inline-flex w-fit items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
                Workspace overview
              </span>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Confident, calm oversight for GBI extractions
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Monitor every paper in the pipeline, flag issues for reviewers, and export structured data the moment it&apos;s ready.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/upload"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500"
                >
                  Upload a PDF
                </Link>
                <Link
                  href="#uploads"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  Review uploads
                </Link>
              </div>
            </div>
            <div className="w-full max-w-xs rounded-2xl border border-white/60 bg-white/80 p-5 shadow-lg ring-1 ring-white/60 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Exports</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{exportJobs.length}</p>
              <p className="mt-1 text-xs text-slate-500">Exports generated in the last 7 days</p>
              <div className="mt-4 text-xs text-slate-500">
                Trigger new exports anytime to sync structured data to downstream tools.
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                <p className={`mt-3 text-3xl font-semibold ${item.text}`}>{item.value}</p>
                <p className="mt-2 text-xs text-slate-600">{item.caption}</p>
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
            <Link
              href="/upload"
              className="hidden rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700 sm:inline-flex"
            >
              Add new PDF
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/70 text-left text-sm text-slate-700">
              <thead className="bg-slate-900/5 text-xs uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Title</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Uploaded</th>
                  <th className="px-6 py-3 font-semibold">Notes</th>
                  <th className="px-6 py-3 font-semibold">Flag</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 bg-white/80">
                {papers.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={6}>
                      No uploads yet. Start by adding a PDF.
                    </td>
                  </tr>
                ) : (
                  papers.map((paper) => (
                    <tr key={paper.id} className="transition hover:bg-indigo-50/40">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-900">{paper.title}</span>
                          <span className="text-xs text-slate-500">
                            {paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}
                            {paper.year ?? 'Year N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill status={paper.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <time dateTime={paper.createdAt}>{new Date(paper.createdAt).toLocaleString()}</time>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{paper.noteIds.length}</td>
                      <td className="px-6 py-4">
                        <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagId)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/paper/${paper.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700"
                          >
                            Open workspace
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                        <time dateTime={job.createdAt}>{new Date(job.createdAt).toLocaleString()}</time>
                        {job.downloadUrl ? (
                          <span className="font-mono text-slate-400">checksum {job.checksumSha256}</span>
                        ) : null}
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
