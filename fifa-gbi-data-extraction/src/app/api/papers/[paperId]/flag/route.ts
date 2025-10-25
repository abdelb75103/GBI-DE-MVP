import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const paperId = request.nextUrl.pathname.split('/').slice(-2, -1)[0] ?? '';
  const { reason } = (await request.json()) as { reason?: string };

  if (!reason) {
    return NextResponse.json({ error: 'Reason is required to flag a paper' }, { status: 400 });
  }

  const flag = mockDb.toggleFlag(paperId, reason);

  if (flag) {
    return NextResponse.json({ flag });
  }

  return NextResponse.json({ message: 'Flag cleared' });
}
