import { NextResponse } from 'next/server';

import { mockDb, seedIfEmpty } from '@/lib/mock-db';
import type { Paper } from '@/lib/types';

export const runtime = 'nodejs';

seedIfEmpty();

export async function GET() {
  const papers = mockDb.listPapers();

  return NextResponse.json({ papers });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Paper> & { title?: string };

  if (!body.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const paper = mockDb.createPaper({
    title: body.title,
    leadAuthor: body.leadAuthor,
    year: body.year,
    journal: body.journal,
    doi: body.doi,
    status: body.status,
  });

  return NextResponse.json({ paper }, { status: 201 });
}
