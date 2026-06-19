import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { parseFullTextQueueContext, parseFullTextReaderPosition } from '@/lib/screening/full-text-queue';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const context = parseFullTextQueueContext(url.searchParams);
    if (url.searchParams.get('navigation') === 'next') {
      const completedRecordId = url.searchParams.get('completedRecordId')?.trim();
      if (!completedRecordId) {
        return NextResponse.json({ error: 'completedRecordId is required' }, { status: 400 });
      }
      const nextRecord = await mockDb.findNextFullTextQueueRecordForReviewer({
        reviewerProfileId: profile.id,
        context,
        completedRecordId,
        position: parseFullTextReaderPosition(url.searchParams),
      });
      return NextResponse.json({ nextRecordId: nextRecord?.id ?? null });
    }

    const queue = await mockDb.listFullTextQueuePage({
      reviewerProfileId: profile.id,
      context,
    });
    return NextResponse.json({ ...queue, context: { ...context, page: queue.page } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load full-text screening records' },
      { status: 500 },
    );
  }
}
