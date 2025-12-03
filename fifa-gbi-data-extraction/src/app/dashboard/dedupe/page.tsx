import { redirect } from 'next/navigation';

import { DedupeAdminClient } from '@/components/dedupe-admin-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DedupeDashboardPage() {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const [duplicates, papers] = await Promise.all([mockDb.listPaperDuplicates(), mockDb.listPapers()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Deduplication Review</h1>
        <p className="text-sm text-slate-600">
          Run a scan to highlight suspected duplicates. No automatic actions are taken — review, keep, or delete as needed.
        </p>
      </div>

      <DedupeAdminClient initialDuplicates={duplicates} papers={papers} />
    </div>
  );
}
