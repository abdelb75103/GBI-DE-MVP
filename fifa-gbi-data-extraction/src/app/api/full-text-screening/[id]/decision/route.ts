import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb } from '@/lib/mock-db';
import { EXCLUSION_REASONS, MAX_EXCLUSION_REASON_CHARS } from '@/lib/screening/reviewer-decisions';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const requestSchema = z.object({
  decision: z.enum(['include', 'exclude']),
  decisionAction: z.enum(['reviewer_vote', 'consensus_resolution']).optional(),
  reason: z.enum(EXCLUSION_REASONS).optional().nullable(),
  otherReason: z.string().trim().max(MAX_EXCLUSION_REASON_CHARS).optional().nullable(),
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
    const reason = parsed.data.reason === 'Other'
      ? parsed.data.otherReason
      : parsed.data.reason;
    const record = await mockDb.saveScreeningDecision(id, {
      decision: parsed.data.decision,
      decisionAction: parsed.data.decisionAction,
      reason,
      reviewerProfileId: profile.id,
      reviewerName: profile.fullName,
    });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save screening decision' },
      { status: 400 },
    );
  }
}
