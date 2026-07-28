import { redirect } from 'next/navigation';

import { DedupeAdminClient } from '@/components/dedupe-admin-client';
import { PageHead } from '@/components/ui';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DedupeDashboardPage() {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const [duplicates, papers] = await Promise.all([mockDb.listPaperDuplicates(), mockDb.listDedupePapers()]);

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="Dedupe"
        title="Deduplication review"
        description="Run a scan to highlight suspected duplicates. No automatic actions are taken: review, keep, or delete as needed."
      />

      <DedupeAdminClient initialDuplicates={duplicates} papers={papers} />
    </div>
  );
}
