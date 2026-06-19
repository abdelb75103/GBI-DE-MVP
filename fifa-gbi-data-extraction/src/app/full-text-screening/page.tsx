import { redirect } from 'next/navigation';

import { FullTextScreeningClient } from '@/components/full-text-screening-client';
import { mockDb } from '@/lib/mock-db';
import {
  buildFullTextQueueUrl,
  parseFullTextQueueContext,
  type FullTextQueuePage,
} from '@/lib/screening/full-text-queue';
import { readActiveProfileSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function FullTextScreeningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearchParams = await searchParams;
  const requestedContext = parseFullTextQueueContext(rawSearchParams);
  const profile = await readActiveProfileSession();
  if (!profile) {
    redirect(`/profiles/select?returnTo=${encodeURIComponent(buildFullTextQueueUrl(requestedContext))}`);
  }

  let initialQueue: FullTextQueuePage | null = null;
  let loadError: string | null = null;
  try {
    initialQueue = await mockDb.listFullTextQueuePage({
      reviewerProfileId: profile.id,
      context: requestedContext,
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load full-text screening records.';
  }

  const context = {
    ...requestedContext,
    page: initialQueue?.page ?? requestedContext.page,
  };
  const rawValue = (key: string) => {
    const value = rawSearchParams[key];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
  };
  const isCanonical = rawValue('filter') === context.filter
    && rawValue('page') === String(context.page)
    && rawValue('search').trim() === context.search
    && (context.search ? rawValue('search') === context.search : !rawValue('search'))
    && (context.notice ? rawValue('notice') === context.notice : !rawValue('notice'));
  if (!isCanonical) {
    redirect(buildFullTextQueueUrl(context));
  }

  return (
    <FullTextScreeningClient
      key={`${context.filter}:${context.search}:${context.page}`}
      initialQueue={initialQueue}
      context={context}
      currentReviewerId={profile.id}
      profileRole={profile.role}
      loadError={loadError}
    />
  );
}
