import Link from 'next/link';

import { DashboardContributors } from '@/components/dashboard-contributors';
import { DashboardProgressVisual } from '@/components/dashboard-progress-visual';
import { ExportControls } from '@/components/export-controls';
import { PapersDashboardClient } from '@/components/papers-dashboard-client';
import { formatDateTimeUTC } from '@/lib/format';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import {
  isActiveStatus,
  isCompletedStatus,
  isProgressCompletedStatus,
  isTaggedAutoCompleteStatus,
} from '@/lib/status-groups';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const papers = await mockDb.listPapers();
  const exportJobs = await mockDb.listExports();
  const activePaperIds = papers.map((paper) => paper.id);
  const activeProfile = await readActiveProfileSession();
  const isAdmin = activeProfile?.role === 'admin';
  const userId = activeProfile?.id || null;
  
  // Extract first name from profile, skipping common titles
  const extractFirstName = (fullName: string | undefined | null): string => {
    if (!fullName) return 'User';
    
    const words = fullName.trim().split(/\s+/);
    if (words.length === 0) return 'User';
    
    // Common titles to skip (case-insensitive, with/without periods)
    const titles = new Set([
      'dr', 'dr.', 'doctor',
      'prof', 'prof.', 'professor',
      'mr', 'mr.', 'mister',
      'mrs', 'mrs.', 'missus',
      'ms', 'ms.', 'miss'
    ]);
    
    // Check if first word is a title
    const firstWord = words[0].toLowerCase().replace(/\.$/, ''); // Remove trailing period
    if (titles.has(firstWord) && words.length > 1) {
      // Skip title and return the next word (actual first name)
      return words[1];
    }
    
    // Return first word if it's not a title or if there's only one word
    return words[0];
  };
  
  const firstName = extractFirstName(activeProfile?.fullName);
  
  // Calculate metrics
  const totalPapers = papers.length;
  const availablePapers = papers.filter((paper) => !paper.assignedTo).length;
  
  const activePapers = papers.filter((paper) => isActiveStatus(paper.status));
  const completedPapers = papers.filter((paper) => isCompletedStatus(paper.status));
  const taggedCompletedPapers = papers.filter((paper) => isTaggedAutoCompleteStatus(paper.status));
  const progressCompletedPapers = papers.filter((paper) => isProgressCompletedStatus(paper.status));
  
  const inProgressCount = activePapers.length;
  const completedCount = completedPapers.length;
  const taggedCompletedCount = taggedCompletedPapers.length;
  const progressCompletedCount = progressCompletedPapers.length;
  
  const userActivePapers = activePapers.filter((paper) => paper.assignedTo === userId).length;
  const userActiveShare = inProgressCount > 0 ? Math.round((userActivePapers / inProgressCount) * 100) : 0;
  const userInProgressCount = userActivePapers;
  const userInProgressPercentage = userActiveShare;
  
  const userCompletedCount = completedPapers.filter((paper) => paper.assignedTo === userId).length;
  const userCompletedPercentage = completedCount > 0 ? Math.round((userCompletedCount / completedCount) * 100) : 0;
  
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
            {/* Card 1: All Papers */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-500/20 via-violet-400/10 to-purple-400/20 opacity-80" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">All papers</p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xl font-semibold text-purple-700">{totalPapers}</p>
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                {availablePapers} available right now • You have {userActivePapers} active ({userActiveShare}% of workload)
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full bg-gradient-to-r from-purple-500/20 via-violet-400/10 to-purple-400/20 opacity-90"
                  style={{ width: `${Math.min(100, totalPapers === 0 ? 4 : Math.round((totalPapers / Math.max(1, totalPapers)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Card 2: My Papers In Progress */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-indigo-300/20 opacity-80" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">My papers in progress</p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xl font-semibold text-sky-700">{userInProgressCount}</p>
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Yours</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                {userInProgressPercentage}% of all in-progress work • {inProgressCount} total
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full bg-gradient-to-r from-sky-500/40 via-cyan-400/30 to-indigo-300/40 opacity-90"
                  style={{ width: `${Math.min(100, inProgressCount === 0 ? 0 : Math.round((userInProgressCount / Math.max(1, inProgressCount)) * 100))}%` }}
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
                You completed {userCompletedCount} ({userCompletedPercentage}% of team output)
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
              <Link
                href="/dashboard?filter=flagged"
                className="relative block overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-md ring-1 ring-slate-200/60 backdrop-blur transition hover:shadow-lg hover:ring-slate-300/60"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-500/20 via-orange-400/10 to-amber-400/20 opacity-80" aria-hidden />
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-rose-600"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 2.25a.75.75 0 01.75.75v16.5a.75.75 0 01-1.064.681l-1.5-.681a.75.75 0 01-.186-1.238L3 18.75V3A.75.75 0 013 2.25zm16.023 2.25a.75.75 0 01.75.75v11.5a.75.75 0 01-.75.75h-5.5a.75.75 0 01-.75-.75V5.25a.75.75 0 01.75-.75h5.5zM8.25 2.25a.75.75 0 01.75.75v16.5a.75.75 0 01-.75.75h-5.5a.75.75 0 01-.75-.75V3a.75.75 0 01.75-.75h5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Needs attention</p>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-xl font-semibold text-rose-700">{flaggedCount}</p>
                  <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Overall</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-600">
                  Flagged items awaiting review
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500/20 via-orange-400/10 to-amber-400/20 opacity-90"
                    style={{ width: `${Math.min(100, flaggedCount === 0 ? 4 : Math.round((flaggedCount / Math.max(1, totalPapers)) * 100))}%` }}
                  />
                </div>
              </Link>
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
            completedPapers={progressCompletedCount}
            taggedCompletedPapers={taggedCompletedCount}
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
