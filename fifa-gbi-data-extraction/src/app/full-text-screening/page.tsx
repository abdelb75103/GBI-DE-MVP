import { redirect } from 'next/navigation';

import { FullTextScreeningClient } from '@/components/full-text-screening-client';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { ScreeningRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FullTextScreeningPage() {
  const profile = await readActiveProfileSession();
  if (!profile) {
    redirect('/profiles/select?returnTo=/full-text-screening');
  }

  let records: ScreeningRecord[] = [];
  let loadError: string | null = null;
  try {
    records = await mockDb.listScreeningRecords('full_text');
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load full-text screening records.';
  }

  return (
    <FullTextScreeningClient
      initialRecords={records}
      currentReviewerId={profile.id}
      profileRole={profile.role}
      loadError={loadError}
    />
  );
}
