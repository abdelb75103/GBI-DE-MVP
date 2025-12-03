import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST() {
  const profile = await readActiveProfileSession();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const duplicates = await mockDb.scanForDuplicates();
    return NextResponse.json({ duplicates, count: duplicates.length }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/admin/dedupe/scan] failed', error);
    const message = error instanceof Error ? error.message : 'Failed to run dedupe scan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
