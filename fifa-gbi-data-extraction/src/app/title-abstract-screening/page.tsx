import { redirect } from 'next/navigation';

import { TitleAbstractScreeningClient } from '@/components/title-abstract-screening-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { ScreeningRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TitleAbstractScreeningPage() {
  const profile = await readActiveProfileSession();
  if (!profile) {
    redirect('/profiles/select?returnTo=/title-abstract-screening');
  }

  let records: ScreeningRecord[] = [];
  let loadError: string | null = null;
  try {
    records = await mockDb.listScreeningRecords('title_abstract');
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load title/abstract screening records.';
  }

  return (
    <TitleAbstractScreeningClient
      initialRecords={records}
      currentReviewerId={profile.id}
      profileRole={profile.role}
      loadError={loadError}
    />
  );
}
