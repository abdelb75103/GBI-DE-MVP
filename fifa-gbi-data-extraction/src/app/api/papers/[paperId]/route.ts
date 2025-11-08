import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { Paper } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params;
  const paper = await mockDb.getPaper(paperId);

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  return NextResponse.json({ paper });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params;
  const updates = (await request.json()) as Partial<Omit<Paper, 'id' | 'createdAt' | 'noteCount'>>;

  const paper = await mockDb.updatePaper(paperId, updates);

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  return NextResponse.json({ paper });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const profile = await readActiveProfileSession();
  
  // Only admins can delete papers
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can delete papers.' },
      { status: 403 }
    );
  }

  const { paperId } = await params;

  try {
    await mockDb.deletePaper(paperId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[DELETE paper] failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete paper.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
