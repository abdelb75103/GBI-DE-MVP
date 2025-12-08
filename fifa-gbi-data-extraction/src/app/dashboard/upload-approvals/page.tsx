import { redirect } from 'next/navigation';

import { UploadApprovalClient } from '@/components/upload-approval-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function UploadApprovalsPage() {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const uploads = await mockDb.listUploadQueueEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Upload approvals</h1>
        <p className="text-sm text-slate-600">
          Newly uploaded PDFs stay hidden until you review them. Everything starts checked — uncheck any files you don&apos;t
          want to publish, then click approve to push the rest to the dashboard.
        </p>
      </div>

      <UploadApprovalClient initialUploads={uploads} />
    </div>
  );
}
