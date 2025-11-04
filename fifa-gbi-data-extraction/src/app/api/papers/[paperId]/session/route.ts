import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb, PaperSessionConflictError } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['start', 'heartbeat', 'end']),
});

export async function POST(request: NextRequest, { params }: { params: { paperId: string } }) {
  const profile = readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Select a profile before editing papers.' }, { status: 401 });
  }

  const paperId = params.paperId;
  let parsed: z.infer<typeof bodySchema>;

  try {
    const body = await request.json();
    parsed = bodySchema.parse(body);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (parsed.action === 'start') {
      const session = await mockDb.startPaperSession(paperId, {
        profileId: profile.id,
        fullName: profile.fullName,
      });
      return NextResponse.json({ session });
    }

    if (parsed.action === 'heartbeat') {
      const session = await mockDb.heartbeatPaperSession(paperId, profile.id);
      return NextResponse.json({ session });
    }

    await mockDb.endPaperSession(paperId, profile.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PaperSessionConflictError) {
      return NextResponse.json(
        { error: error.message, current: error.current },
        { status: 409 },
      );
    }

    console.error('[paperSession] failed', error);
    return NextResponse.json({ error: 'Failed to update paper session.' }, { status: 500 });
  }
}
