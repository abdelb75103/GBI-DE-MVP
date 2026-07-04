import { redirect } from 'next/navigation';

import { DataExtractionDashboardClient } from '@/components/data-extraction-dashboard-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DataExtractionPage() {
  const activeProfile = await readActiveProfileSession();
  if (!activeProfile) {
    redirect('/profiles/select');
  }

  const isAdmin = activeProfile.role === 'admin';
  const [papers, exportJobs, pendingUploadCount] = await Promise.all([
    mockDb.listDataExtractionPapers(),
    mockDb.listExports(),
    isAdmin ? mockDb.countPendingUploadQueueEntries() : Promise.resolve(0),
  ]);
  const dashboardPapers = isAdmin ? papers : papers.filter((paper) => paper.status !== 'archived');

  return (
    <DataExtractionDashboardClient
      activeProfile={activeProfile}
      papers={dashboardPapers}
      exportJobs={exportJobs}
      pendingUploadCount={pendingUploadCount}
    />
  );
}
