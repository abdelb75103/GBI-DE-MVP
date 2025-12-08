import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const uploads = await mockDb.listUploadQueueEntries();
  return NextResponse.json({ uploads });
}
