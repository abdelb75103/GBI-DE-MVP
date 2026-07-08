'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { DashboardContributors } from '@/components/dashboard-contributors';
import { DashboardProgressVisual } from '@/components/dashboard-progress-visual';
import { ExportControls } from '@/components/export-controls';
import { PapersDashboardClient } from '@/components/papers-dashboard-client';
import {
  filterDataExtractionPapers,
  getDataExtractionBatchFilter,
  getDataExtractionBatchHref,
  type DataExtractionBatchFilter,
  type DataExtractionPaperSummary,
} from '@/lib/data-extraction-batch-filter';
import { formatDateTimeUTC } from '@/lib/format';
import {
  isBulkExportStatus,
  isActiveStatus,
  isCompletedStatus,
  isDashboardCountExcludedStatus,
  isProgressCompletedStatus,
  isTaggedAutoCompleteStatus,
} from '@/lib/status-groups';
import type { ExportJob } from '@/lib/types';

type DataExtractionDashboardClientProps = {
  activeProfile: { id: string; fullName: string; role: 'admin' | 'extractor' | 'observer' };
  papers: DataExtractionPaperSummary[];
  exportJobs: ExportJob[];
  pendingUploadCount: number;
};

const BATCH_FILTER_LINKS: Array<{ value: DataExtractionBatchFilter; label: string }> = [
  { value: 'total', label: 'Total' },
  { value: 'first', label: 'First search' },
  { value: 'second', label: 'Second search' },
];

export function DataExtractionDashboardClient({
  activeProfile,
  papers,
  exportJobs,
  pendingUploadCount,
}: DataExtractionDashboardClientProps) {
  const searchParams = useSearchParams();
  const batchFilter = getDataExtractionBatchFilter(searchParams.get('batch'));

  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0 });
    }
  }, []);

  const filteredPapers = useMemo(
    () => filterDataExtractionPapers(papers, batchFilter),
    [papers, batchFilter],
  );
  const isAdmin = activeProfile.role === 'admin';
  const countablePapers = filteredPapers.filter((paper) => !isDashboardCountExcludedStatus(paper.status));
  const tablePapers = filteredPapers.filter((paper) => paper.status !== 'archived');
  const dashboardTablePapers = isAdmin ? filteredPapers : tablePapers;
  const activePaperIds = tablePapers.filter((paper) => isBulkExportStatus(paper.status)).map((paper) => paper.id);
  const userId = activeProfile.id || null;

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
  const totalPapers = countablePapers.length;
  const availablePapers = countablePapers.filter((paper) => !paper.assignedTo).length;

  const activePapers = countablePapers.filter((paper) => isActiveStatus(paper.status));
  const completedPapers = countablePapers.filter((paper) => isCompletedStatus(paper.status));
  const taggedCompletedPapers = countablePapers.filter((paper) => isTaggedAutoCompleteStatus(paper.status));
  const progressCompletedPapers = countablePapers.filter((paper) => isProgressCompletedStatus(paper.status));

  const inProgressCount = activePapers.length;
  const completedCount = completedPapers.length;
  const taggedCompletedCount = taggedCompletedPapers.length;
  const progressCompletedCount = progressCompletedPapers.length;

  const userActivePapers = activePapers.filter((paper) => paper.assignedTo === userId).length;
  const userActiveShare = inProgressCount > 0 ? Math.round((userActivePapers / inProgressCount) * 100) : 0;
  const userInProgressCount = userActivePapers;
  const userInProgressPercentage = userActiveShare;

  const userCompletedCount = completedPapers.filter((paper) => paper.assignedTo === userId).length;
  const userCompletedPercentage =
    completedCount > 0 ? Math.round((userCompletedCount / completedCount) * 100) : 0;

  const flaggedCount = countablePapers.filter((paper) => Boolean(paper.flagReason)).length;
  const showTeamProgress = false;

  // Calculate contributor statistics
  type ContributorMap = Record<string, { name: string; completedCount: number }>;
  const contributorStats = countablePapers.reduce<ContributorMap>((acc, paper) => {
    if (isProgressCompletedStatus(paper.status) && paper.assignedTo && paper.assigneeName) {
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
    <div className="space-y-10 sm:space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-br from-indigo-100/90 via-sky-50/80 to-indigo-50/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0b3a70] shadow-sm ring-1 ring-indigo-200/50 backdrop-blur-sm">
              Data extraction
            </span>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]">
                  {firstName}&apos;s Data Extraction
                </h1>
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                  Track your papers and see your progress at a glance.
                </p>
              </div>
              {isAdmin ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/upload"
                    className="inline-flex items-center justify-center rounded-full bg-[#0b3a70] px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(11,58,112,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f5d]"
                  >
                    Upload a PDF
                  </Link>
                  <Link
                    href="/dashboard/dedupe"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/80 px-5 py-2 text-sm font-semibold text-[#0b3a70] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#0b3a70]/30 hover:bg-white"
                  >
                    Run dedupe review
                  </Link>
                  <Link
                    href="/dashboard/upload-approvals"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-5 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    Review uploads
                    {pendingUploadCount > 0 ? (
                      <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-600/10 px-2 text-xs font-semibold text-emerald-700">
                        {pendingUploadCount}
                      </span>
                    ) : null}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {BATCH_FILTER_LINKS.map((option) => {
              const active = batchFilter === option.value;
              const href = getDataExtractionBatchHref(
                option.value,
                new URLSearchParams(searchParams.toString()),
              );
              return (
                <a
                  key={option.value}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={(event) => {
                    if (
                      event.button !== 0
                      || event.metaKey
                      || event.ctrlKey
                      || event.shiftKey
                      || event.altKey
                    ) return;
                    event.preventDefault();
                    if (active) return;
                    window.history.pushState(null, '', href);
                  }}
                  className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 ease-out ${
                    active
                      ? 'bg-[#0b3a70] text-white shadow-[0_8px_22px_-10px_rgba(11,58,112,0.6)] ring-1 ring-[#0b3a70]/40'
                      : 'border border-slate-300 bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 hover:border-[#0b3a70]/40 hover:bg-slate-50 hover:text-[#0b3a70] hover:ring-[#0b3a70]/30'
                  }`}
                >
                  {option.label}
                </a>
              );
            })}
          </div>
          <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            <StatCard
              tone="purple"
              label="All papers"
              value={totalPapers}
              eyebrow="Overall"
              caption={`${availablePapers} available · You have ${userActivePapers} active (${userActiveShare}%)`}
              progress={100}
            />
            <StatCard
              tone="sky"
              label="My papers in progress"
              value={userInProgressCount}
              eyebrow="Yours"
              caption={`${userInProgressPercentage}% of all in-progress · ${inProgressCount} total`}
              progress={inProgressCount === 0 ? 0 : Math.round((userInProgressCount / Math.max(1, inProgressCount)) * 100)}
            />
            <StatCard
              tone="emerald"
              label="Completed"
              value={userCompletedCount}
              eyebrow="Yours"
              caption={`You completed ${userCompletedCount} (${userCompletedPercentage}% of team output)`}
              progress={completedCount === 0 ? 0 : Math.round((userCompletedCount / Math.max(1, completedCount)) * 100)}
            />
            {isAdmin ? (
              <StatCard
                tone="rose"
                label="Needs attention"
                value={flaggedCount}
                eyebrow="Flagged"
                caption="Items awaiting reviewer attention"
                progress={flaggedCount === 0 ? 4 : Math.round((flaggedCount / Math.max(1, totalPapers)) * 100)}
              />
            ) : null}
          </div>
        </div>
      </section>

      {/* Overall Progress (full width, team progress hidden) */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-52 w-52 rounded-full bg-emerald-200/30 blur-3xl" aria-hidden />
        <div className="relative mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Progress</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Overall progress</h2>
          </div>
        </div>
        <div className="relative">
          <DashboardProgressVisual
            totalPapers={totalPapers}
            completedPapers={progressCompletedCount}
            taggedCompletedPapers={taggedCompletedCount}
            flaggedPapers={flaggedCount}
            userCompletedPapers={userCompletedCount}
          />
        </div>
        {showTeamProgress ? (
          <div className="relative mt-8 border-t border-slate-200/70 pt-6">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">Team progress</h3>
            <div className="mt-4">
              <DashboardContributors
                contributors={contributors}
                currentUserId={userId}
                totalCompleted={progressCompletedCount}
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.85fr,1fr]" id="uploads">
        <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-6 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Library</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Uploaded PDFs</h2>
            </div>
            {isAdmin ? (
              <Link
                href="/upload"
                className="hidden rounded-full border border-slate-200/80 bg-white px-4 py-1.5 text-xs font-semibold text-[#0b3a70] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#0b3a70]/30 hover:bg-slate-50 sm:inline-flex"
              >
                Add new PDF
              </Link>
            ) : null}
          </div>
          <PapersDashboardClient
            key={batchFilter}
            papers={dashboardTablePapers}
            canBulkExport={isAdmin}
            isAdmin={isAdmin}
          />
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

type StatTone = 'purple' | 'sky' | 'emerald' | 'rose';

const STAT_TONES: Record<StatTone, { value: string; gradient: string; bar: string; ring: string; track: string }> = {
  purple: {
    value: 'text-purple-700',
    gradient: 'from-purple-500/20 via-violet-400/10 to-purple-400/20',
    bar: 'bg-gradient-to-r from-purple-500 via-violet-400 to-purple-400',
    ring: 'ring-purple-300/30',
    track: 'bg-purple-100/60',
  },
  sky: {
    value: 'text-sky-700',
    gradient: 'from-sky-500/20 via-cyan-400/10 to-indigo-300/20',
    bar: 'bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-300',
    ring: 'ring-sky-300/30',
    track: 'bg-sky-100/60',
  },
  emerald: {
    value: 'text-emerald-700',
    gradient: 'from-emerald-500/20 via-teal-400/10 to-green-400/20',
    bar: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400',
    ring: 'ring-emerald-300/30',
    track: 'bg-emerald-100/60',
  },
  rose: {
    value: 'text-rose-700',
    gradient: 'from-rose-500/20 via-orange-400/10 to-amber-400/20',
    bar: 'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400',
    ring: 'ring-rose-300/30',
    track: 'bg-rose-100/60',
  },
};

function StatCard({
  tone,
  label,
  value,
  eyebrow,
  caption,
  progress,
}: {
  tone: StatTone;
  label: string;
  value: number;
  eyebrow: string;
  caption: string;
  progress: number;
}) {
  const styles = STAT_TONES[tone];
  return (
    <div className={`group relative flex h-full min-h-[148px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-md ring-1 ${styles.ring} backdrop-blur transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg`}>
      <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${styles.gradient}`} />
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${styles.value}`}>{value}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{caption}</p>
      </div>
      <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${styles.track}`}>
        <div
          className={`h-full rounded-full ${styles.bar} transition-[width] duration-700 ease-out`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}
