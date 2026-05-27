import { redirect } from 'next/navigation';

import { TitleAbstractScreeningClient } from '@/components/title-abstract-screening-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import { TITLE_ABSTRACT_QUEUE_PAGE_SIZE, type TitleAbstractQueuePage } from '@/lib/db/screening';

export const dynamic = 'force-dynamic';

export default async function TitleAbstractScreeningPage() {
  const profile = await readActiveProfileSession();
  if (!profile) {
    redirect('/profiles/select?returnTo=/title-abstract-screening');
  }

  let initialQueue: TitleAbstractQueuePage | null = null;
  let loadError: string | null = null;
  try {
    initialQueue = await mockDb.listTitleAbstractQueuePage({
      reviewerProfileId: profile.id,
      limit: TITLE_ABSTRACT_QUEUE_PAGE_SIZE,
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load title/abstract screening records.';
  }

  return (
    <TitleAbstractScreeningClient
      initialQueue={initialQueue}
      currentReviewerId={profile.id}
      profileRole={profile.role}
      loadError={loadError}
    />
  );
}
