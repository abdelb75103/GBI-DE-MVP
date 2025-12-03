import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await readActiveProfileSession();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const duplicates = await mockDb.listPaperDuplicates();
    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('[GET /api/admin/dedupe/conflicts] failed', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dedupe conflicts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
