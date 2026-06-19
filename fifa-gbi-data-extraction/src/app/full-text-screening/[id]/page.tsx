import { notFound, redirect } from 'next/navigation';

import { FullTextScreeningWorkspaceClient } from '@/components/full-text-screening-workspace-client';
import { mockDb } from '@/lib/mock-db';
import {
  buildFullTextReaderUrl,
  parseFullTextQueueContext,
  parseFullTextReaderPosition,
} from '@/lib/screening/full-text-queue';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function FullTextScreeningWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await readActiveProfileSession();
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const queueContext = parseFullTextQueueContext(rawSearchParams);
  const queuePosition = parseFullTextReaderPosition(rawSearchParams);
  if (!profile) {
    redirect(`/profiles/select?returnTo=${encodeURIComponent(buildFullTextReaderUrl(id, queueContext, queuePosition))}`);
  }

  const record = await mockDb.getScreeningRecord(id);
  if (!record) {
    notFound();
  }
  const adjacentRecords = await mockDb.findAdjacentFullTextQueueRecordsForReviewer({
    reviewerProfileId: profile.id,
    context: queueContext,
    currentRecordId: record.id,
    position: queuePosition,
  });
  const previousRecordUrl = adjacentRecords.previous
    ? buildFullTextReaderUrl(
        adjacentRecords.previous.record.id,
        { ...queueContext, page: adjacentRecords.previous.page },
        adjacentRecords.previous.position,
      )
    : null;
  const nextRecordUrl = adjacentRecords.next
    ? buildFullTextReaderUrl(
        adjacentRecords.next.record.id,
        { ...queueContext, page: adjacentRecords.next.page },
        adjacentRecords.next.position,
      )
    : null;

  return (
    <FullTextScreeningWorkspaceClient
      key={record.id}
      initialRecord={record}
      currentReviewerId={profile.id}
      profileRole={profile.role}
      queueContext={queueContext}
      queuePosition={queuePosition}
      previousRecordUrl={previousRecordUrl}
      nextRecordUrl={nextRecordUrl}
    />
  );
}
