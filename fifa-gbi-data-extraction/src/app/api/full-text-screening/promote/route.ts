import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const requestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, { status: 400 });
  }

  const promoted = [];
  const errors = [];

  for (const id of Array.from(new Set(parsed.data.ids))) {
    try {
      const result = await mockDb.promoteScreeningRecord(id, profile.id);
      promoted.push(result);
    } catch (error) {
      errors.push({ id, message: error instanceof Error ? error.message : 'Promotion failed' });
    }
  }

  return NextResponse.json({ promoted, errors });
}
