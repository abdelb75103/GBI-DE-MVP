import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import type { Paper } from '@/lib/types';

export const runtime = 'nodejs';

const getPaperId = (request: NextRequest) => request.nextUrl.pathname.split('/').pop() ?? '';

export async function GET(request: NextRequest) {
  const paperId = getPaperId(request);
  const paper = await mockDb.getPaper(paperId);

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  return NextResponse.json({ paper });
}

export async function PATCH(request: NextRequest) {
  const paperId = getPaperId(request);
  const updates = (await request.json()) as Partial<Omit<Paper, 'id' | 'createdAt' | 'noteCount'>>;

  const paper = await mockDb.updatePaper(paperId, updates);

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  return NextResponse.json({ paper });
}
