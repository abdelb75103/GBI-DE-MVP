import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractionTabs } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const requestSchema = z.object({
  paperId: z.string().min(1),
  tab: z.enum(extractionTabs),
  fieldId: z.string().min(1),
  decision: z.enum(['approved', 'declined']),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { paperId, tab, fieldId, decision } = parsed;
  await mockDb.upsertAiReviewDecision({
    paperId,
    tab,
    fieldId,
    decision,
    reviewerProfileId: profile.id,
  });

  return NextResponse.json({ ok: true });
}

