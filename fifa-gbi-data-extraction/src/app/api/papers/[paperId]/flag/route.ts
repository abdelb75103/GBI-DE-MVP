import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const paperId = request.nextUrl.pathname.split('/').slice(-2, -1)[0] ?? '';
  const body = (await request.json().catch(() => ({}))) as { reason?: string | null };
  const paper = await mockDb.getPaper(paperId);

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const wantsToFlag = !paper.flagReason;
  const reason = body.reason ?? null;

  if (wantsToFlag && (!reason || reason.trim().length === 0)) {
    return NextResponse.json({ error: 'Reason is required to flag a paper' }, { status: 400 });
  }

  await mockDb.toggleFlag(paperId, reason);

  return NextResponse.json({ flagReason: reason });
}
