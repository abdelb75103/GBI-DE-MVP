'use client';

import { DownloadSimple } from '@phosphor-icons/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { DashboardContributors } from '@/components/dashboard-contributors';
import { DashboardProgressVisual } from '@/components/dashboard-progress-visual';
import { ExportControls } from '@/components/export-controls';
import { PapersDashboardClient } from '@/components/papers-dashboard-client';
import { ButtonLink, Card, ChipLink, PageHead, PanelHead, Pill, StatTile, t } from '@/components/ui';
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
    <div className="space-y-6">
      <PageHead
        eyebrow="Data extraction"
        title="Your extraction queue"
        description="Track your papers and see your progress at a glance."
        actions={
          isAdmin ? (
            <>
              <ButtonLink variant="primary" href="/upload">
                Upload a PDF
              </ButtonLink>
              <ButtonLink variant="secondary" href="/dashboard/dedupe">
                Run dedupe review
              </ButtonLink>
              <ButtonLink variant="secondary" href="/dashboard/upload-approvals">
                Review uploads
                {pendingUploadCount > 0 ? (
                  <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-navy-50 px-1.5 text-[11px] font-semibold text-navy-600 [font-variant-numeric:tabular-nums]">
                    {pendingUploadCount}
                  </span>
                ) : null}
              </ButtonLink>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {BATCH_FILTER_LINKS.map((option) => {
            const active = batchFilter === option.value;
            const href = getDataExtractionBatchHref(
              option.value,
              new URLSearchParams(searchParams.toString()),
            );
            return (
              <ChipLink
                key={option.value}
                href={href}
                active={active}
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
              >
                {option.label}
              </ChipLink>
            );
          })}
        </div>
      </PageHead>

      {/* Tone is what the metric means, never where the tile sits in the row. */}
      <div className={`grid gap-3.5 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <StatTile
          tone="total"
          label="All papers"
          value={totalPapers}
          progress={100}
          meta={`${availablePapers} available · you have ${userActivePapers} active (${userActiveShare}%)`}
        />
        <StatTile
          tone="attention"
          label="My papers in progress"
          value={userInProgressCount}
          progress={inProgressCount === 0 ? 0 : Math.round((userInProgressCount / Math.max(1, inProgressCount)) * 100)}
          meta={`${userInProgressPercentage}% of all in progress · ${inProgressCount} total`}
        />
        <StatTile
          tone="positive"
          label="Completed"
          value={userCompletedCount}
          progress={completedCount === 0 ? 0 : Math.round((userCompletedCount / Math.max(1, completedCount)) * 100)}
          meta={`${userCompletedPercentage}% of team output`}
        />
        {isAdmin ? (
          <StatTile
            tone="negative"
            label="Needs attention"
            value={flaggedCount}
            progress={flaggedCount === 0 ? 0 : Math.round((flaggedCount / Math.max(1, totalPapers)) * 100)}
            meta="Flagged, awaiting a reviewer"
          />
        ) : null}
      </div>

      <Card>
        <PanelHead title="Overall progress" />
        <div className="min-w-0">
          <DashboardProgressVisual
            totalPapers={totalPapers}
            completedPapers={progressCompletedCount}
            taggedCompletedPapers={taggedCompletedCount}
            flaggedPapers={flaggedCount}
            userCompletedPapers={userCompletedCount}
          />
        </div>
        {showTeamProgress ? (
          <div className="mt-6 border-t border-line pt-5">
            <h3 className={t.section}>Team progress</h3>
            <div className="mt-4">
              <DashboardContributors
                contributors={contributors}
                currentUserId={userId}
                totalCompleted={progressCompletedCount}
              />
            </div>
          </div>
        ) : null}
      </Card>

      {/* The library carries a seven-column table, so the exports rail only earns
          its place once there is genuinely room for both. */}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,2.6fr)_minmax(300px,1fr)]" id="uploads">
        {/* `min-w-0`: a grid item defaults to `min-width: auto`, so without this
            the table's intrinsic width pushes the whole page sideways on a phone. */}
        <Card flush className="min-w-0">
          <div className="px-5 pt-5">
            <PanelHead
              title="Uploaded PDFs"
              description="Every paper in the extraction library."
              actions={
                isAdmin ? (
                  <Link
                    href="/upload"
                    className="hidden min-h-[30px] items-center rounded-ctl border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-muted transition-[border-color,color] duration-[160ms] ease-gbi hover:border-navy-300 hover:text-ink focus-visible:outline-none focus-visible:shadow-focus sm:inline-flex"
                  >
                    Add new PDF
                  </Link>
                ) : null
              }
            />
          </div>
          <PapersDashboardClient
            key={batchFilter}
            papers={dashboardTablePapers}
            canBulkExport={isAdmin}
            isAdmin={isAdmin}
          />
        </Card>

        <aside className="min-w-0 space-y-6">
          <ExportControls paperIds={activePaperIds} />

          <Card>
            <PanelHead title="Recent exports" description="Generated CSV and JSON bundles." />
            {exportJobs.length === 0 ? (
              <p className={t.caption}>Exports will appear here once generated.</p>
            ) : (
              <ul className="space-y-2.5">
                {exportJobs.map((job) => (
                  <li key={job.id} className="rounded-card bg-surface-sunk p-3.5 shadow-e0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-ink">
                        {job.kind.toUpperCase()} · {job.paperIds.length} papers
                      </span>
                      {/* `failed` must not read the same as `pending`: one needs a
                          retry, the other needs patience. */}
                      <Pill
                        tone={job.status === 'ready' ? 'positive' : job.status === 'failed' ? 'negative' : 'attention'}
                        dot
                      >
                        {job.status}
                      </Pill>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                      <time dateTime={job.createdAt}>{formatDateTimeUTC(job.createdAt)}</time>
                      <div className="flex min-w-0 items-center gap-2">
                        {job.downloadUrl ? (
                          <a
                            href={job.downloadUrl}
                            download
                            className="inline-flex min-h-[30px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-2.5 text-xs font-semibold text-ink-muted transition-[border-color,color] duration-[160ms] ease-gbi hover:border-navy-300 hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
                          >
                            <DownloadSimple aria-hidden className="h-3.5 w-3.5" />
                            Download {job.kind.toUpperCase()}
                          </a>
                        ) : null}
                        {job.checksumSha256 ? (
                          <span className="truncate font-mono text-[11px] text-ink-soft">
                            checksum {job.checksumSha256}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
