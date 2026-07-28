import { redirect } from 'next/navigation';

import { UploadApprovalClient } from '@/components/upload-approval-client';
import { PageHead } from '@/components/ui';
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
      <PageHead
        eyebrow="Uploads"
        title="Upload approvals"
        description="Newly uploaded PDFs stay hidden until you review them. Everything starts checked. Uncheck any files you don't want to publish, then click approve to push the rest to the dashboard."
      />

      <UploadApprovalClient initialUploads={uploads} />
    </div>
  );
}
