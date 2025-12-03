import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { PaperDuplicate } from '@/lib/types';

export const runtime = 'nodejs';

const allowedStatuses: PaperDuplicate['status'][] = ['confirmed_duplicate', 'not_duplicate', 'dismissed', 'unreviewed'];

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string; status?: PaperDuplicate['status']; notes?: string | null };

  if (!body.id || !body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Duplicate id and valid status are required' }, { status: 400 });
  }

  try {
    await mockDb.resolvePaperDuplicate(body.id, body.status, profile.id, body.notes ?? null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/admin/dedupe/resolve] failed', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve duplicate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
