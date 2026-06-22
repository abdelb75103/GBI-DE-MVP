import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const REVIEW_COMMENT_MAX_CHARS = 2000;

const requestSchema = z.object({
  flagged: z.boolean(),
  comment: z.string().trim().max(REVIEW_COMMENT_MAX_CHARS).optional().nullable(),
  updatedAt: z.string().datetime().optional().nullable(),
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
    const record = await mockDb.getScreeningRecord(id);
    if (!record) {
      return NextResponse.json({ error: 'Screening record not found.' }, { status: 404 });
    }
    if (record.stage !== 'full_text') {
      return NextResponse.json({ error: 'Review flagging is only available for full-text records.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const nextMetadata = {
      ...record.metadata,
      fullTextReviewFlagged: parsed.data.flagged,
      fullTextReviewUpdatedAt: now,
      fullTextReviewUpdatedBy: profile.id,
      fullTextReviewUpdatedByName: profile.fullName,
    };

    const updated = await mockDb.updateScreeningRecordMetadata(
      id,
      nextMetadata,
      { notes: parsed.data.comment?.trim() || null },
      parsed.data.updatedAt ?? record.updatedAt,
    );

    return NextResponse.json({ record: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save review flag and comment.' },
      { status: 400 },
    );
  }
}
