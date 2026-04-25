import { notFound, redirect } from 'next/navigation';

import { FullTextScreeningWorkspaceClient } from '@/components/full-text-screening-workspace-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function FullTextScreeningWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await readActiveProfileSession();
  const { id } = await params;
  if (!profile) {
    redirect(`/profiles/select?returnTo=/full-text-screening/${id}`);
  }

  const record = await mockDb.getScreeningRecord(id);
  if (!record) {
    notFound();
  }

  return <FullTextScreeningWorkspaceClient initialRecord={record} currentReviewerId={profile.id} profileRole={profile.role} />;
}
