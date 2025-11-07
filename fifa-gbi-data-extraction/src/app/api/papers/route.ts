import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { Paper } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const papers = await mockDb.listPapers();

  return NextResponse.json({ papers });
}

export async function POST(request: Request) {
  // Verify user is logged in and has an active profile
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json(
      { error: 'Authentication required. Please select a profile before creating papers.' },
      { status: 401 }
    );
  }

  const body = (await request.json()) as Partial<Omit<Paper, 'id' | 'createdAt' | 'noteCount'>> & { title?: string };

  if (!body.title || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'Paper title is required' }, { status: 400 });
  }

  try {
    const paper = await mockDb.createPaper({
      title: body.title.trim(),
      leadAuthor: body.leadAuthor,
      year: body.year,
      journal: body.journal,
      doi: body.doi,
      status: body.status,
      uploadedBy: profile.id, // Track who created the paper
    });

    return NextResponse.json({ paper }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/papers] Failed to create paper:', error);
    const message = error instanceof Error ? error.message : 'Failed to create paper';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
