import Link from 'next/link';

import { DashboardContributors } from '@/components/dashboard-contributors';
import { DashboardProgressVisual } from '@/components/dashboard-progress-visual';
import { ExportControls } from '@/components/export-controls';
import { PapersDashboardClient } from '@/components/papers-dashboard-client';
import { formatDateTimeUTC } from '@/lib/format';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const papers = await mockDb.listPapers();
  const exportJobs = await mockDb.listExports();
  const activePaperIds = papers.map((paper) => paper.id);
  const activeProfile = await readActiveProfileSession();
  const isAdmin = activeProfile?.role === 'admin';
  const userId = activeProfile?.id || null;
  
  // Extract first name from profile
  const firstName = activeProfile?.fullName?.split(' ')[0] || 'User';
  
  // Calculate metrics
  const totalPapers = papers.length;
  const availablePapers = papers.filter((paper) => !paper.assignedTo).length;
  const userPapers = papers.filter((paper) => paper.assignedTo === userId).length;
  const userPapersPercentage = totalPapers > 0 ? Math.round((userPapers / totalPapers) * 100) : 0;
  
  const completedCount = papers.filter((paper) => paper.status === 'extracted').length;
  const userCompletedCount = papers.filter(
    (paper) => paper.status === 'extracted' && paper.assignedTo === userId,
  ).length;
  const userCompletedPercentage = completedCount > 0 ? Math.round((userCompletedCount / completedCount) * 100) : 0;
  
  const inProgressCount = papers.filter(
    (paper) => paper.status === 'processing' || paper.status === 'uploaded',
  ).length;
  const userInProgressCount = papers.filter(
    (paper) => (paper.status === 'processing' || paper.status === 'uploaded') && paper.assignedTo === userId,
  ).length;
  const userInProgressPercentage = inProgressCount > 0 ? Math.round((userInProgressCount / inProgressCount) * 100) : 0;
  
  const flaggedCount = papers.filter((paper) => Boolean(paper.flagReason)).length;
  
  // Calculate contributor statistics
  type ContributorMap = Record<string, { name: string; completedCount: number }>;
  const contributorStats = papers.reduce<ContributorMap>((acc, paper) => {
    if (paper.status === 'extracted' && paper.assignedTo && paper.assigneeName) {
      if (!acc[paper.assignedTo]) {
        acc[paper.assignedTo] = { name: paper.assigneeName, completedCount: 0 };
      }
      acc[paper.assignedTo].completedCount += 1;
    }
    return acc;
  }, {});
  
  const contributors = Object.entries(contributorStats).map(([id, data]) => ({
    id,
    name: data.name,
    completedCount: data.completedCount,
  }));

  return (
    <div className="space-y-12">
      {/* Hero Section - Original Style with Personalized Badge */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-10 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="absolute top-6 left-6 z-20">
          <span className="inline-flex items-center rounded-full bg-gradient-to-br from-indigo-100/90 via-sky-50/80 to-indigo-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 shadow-sm ring-1 ring-indigo-200/50 backdrop-blur-sm">
            Dashboard
          </span>
        </div>
        <div className="relative z-10 space-y-10 pt-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-4">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {firstName}&apos;s Dashboard
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Track your papers and see your progress at a glance.
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
          <div className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            {/* Card 1: Active Papers (Available + My Papers combined) */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/20 via-sky-400/10 to-indigo-400/20 opacity-80" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Active papers</p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xl font-semibold text-indigo-700">{totalPapers}</p>
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                {userPapers} are yours ({userPapersPercentage}%) • {availablePapers} available
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500/20 via-sky-400/10 to-indigo-400/20 opacity-90"
                  style={{ width: `${Math.min(100, totalPapers === 0 ? 4 : Math.round((totalPapers / Math.max(1, totalPapers)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Card 2: In Progress */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-indigo-300/20 opacity-80" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">In progress</p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xl font-semibold text-sky-700">{inProgressCount}</p>
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                Processing or awaiting extraction • You have {userInProgressCount} ({userInProgressPercentage}%)
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full bg-gradient-to-r from-sky-500/20 via-cyan-400/10 to-indigo-300/20 opacity-90"
                  style={{ width: `${Math.min(100, inProgressCount === 0 ? 4 : Math.round((inProgressCount / Math.max(1, totalPapers)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Card 3: Completed */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/20 via-teal-400/10 to-green-400/20 opacity-80" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Completed</p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xl font-semibold text-emerald-700">{completedCount}</p>
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                You completed {userCompletedCount} ({userCompletedPercentage}%)
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500/20 via-teal-400/10 to-green-400/20 opacity-90"
                  style={{ width: `${Math.min(100, completedCount === 0 ? 4 : Math.round((completedCount / Math.max(1, totalPapers)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Card 4: Needs Attention (Admin Only) */}
            {isAdmin && (
              <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-500/20 via-orange-400/10 to-amber-400/20 opacity-80" aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Needs attention</p>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-xl font-semibold text-rose-700">{flaggedCount}</p>
                  <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-600">
                  Flagged items awaiting follow-up
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500/20 via-orange-400/10 to-amber-400/20 opacity-90"
                    style={{ width: `${Math.min(100, flaggedCount === 0 ? 4 : Math.round((flaggedCount / Math.max(1, totalPapers)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Progress Visual and Contributors Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Circular Progress Visualization */}
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Overall Progress</h2>
          </div>
          <DashboardProgressVisual
            totalPapers={totalPapers}
            completedPapers={completedCount}
            userCompletedPapers={userCompletedCount}
          />
        </section>

        {/* Top Contributors */}
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Team Progress</h2>
          </div>
          <DashboardContributors
            contributors={contributors}
            currentUserId={userId}
            totalCompleted={completedCount}
          />
        </section>
      </div>

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
          <PapersDashboardClient papers={papers} canBulkExport={isAdmin} isAdmin={isAdmin} />
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
