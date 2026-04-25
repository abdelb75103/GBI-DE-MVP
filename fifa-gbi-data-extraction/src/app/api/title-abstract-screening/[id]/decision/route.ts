import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const requestSchema = z.object({
  decision: z.enum(['include', 'exclude', 'flag']),
  decisionAction: z.enum(['reviewer_vote', 'resolver_decision']).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, { status: 400 });
  }

  try {
    const record = await mockDb.saveTitleAbstractDecision(id, {
      decision: parsed.data.decision,
      decisionAction: parsed.data.decisionAction,
      note: parsed.data.note,
      reviewerProfileId: profile.id,
      reviewerName: profile.fullName,
    });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save decision' },
      { status: 400 },
    );
  }
}
