import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import type { Paper } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const papers = await mockDb.listPapers();

  return NextResponse.json({ papers });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Omit<Paper, 'id' | 'createdAt' | 'noteCount'>> & { title?: string };

  if (!body.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const paper = await mockDb.createPaper({
    title: body.title,
    leadAuthor: body.leadAuthor,
    year: body.year,
    journal: body.journal,
    doi: body.doi,
    status: body.status,
  });

  return NextResponse.json({ paper }, { status: 201 });
}
