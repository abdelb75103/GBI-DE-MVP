import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import {
  TITLE_ABSTRACT_QUEUE_PAGE_SIZE,
  type TitleAbstractQueueFilter,
} from '@/lib/db/screening';

export const runtime = 'nodejs';

const FILTERS: TitleAbstractQueueFilter[] = [
  'all',
  'needs_your_vote',
  'awaiting_ai_recommendation',
  'awaiting_other_reviewer',
  'needs_resolver',
  'ready_for_full_text',
  'excluded',
  'promoted_to_full_text',
  'missing_abstract',
  'flagged',
  'ai_include',
  'ai_exclude',
  'ai_systematic_review',
  'ai_not_run',
];

const parseNumber = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function GET(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const rawFilter = url.searchParams.get('filter');
    const filter = FILTERS.includes(rawFilter as TitleAbstractQueueFilter)
      ? rawFilter as TitleAbstractQueueFilter
      : 'all';
    const limit = Math.min(150, Math.max(1, parseNumber(url.searchParams.get('limit'), TITLE_ABSTRACT_QUEUE_PAGE_SIZE)));
    const offset = Math.max(0, parseNumber(url.searchParams.get('offset'), 0));
    const search = (url.searchParams.get('search') ?? '').slice(0, 200);
    const page = await mockDb.listTitleAbstractQueuePage({
      reviewerProfileId: profile.id,
      filter,
      search,
      offset,
      limit,
    });
    return NextResponse.json(page);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load title/abstract records' },
      { status: 500 },
    );
  }
}
