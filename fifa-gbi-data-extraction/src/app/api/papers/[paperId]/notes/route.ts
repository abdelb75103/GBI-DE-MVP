import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

const paperIdFromRequest = (request: NextRequest) => request.nextUrl.pathname.split('/').slice(-2, -1)[0] ?? '';

export async function GET(request: NextRequest) {
  const notes = await mockDb.listNotes(paperIdFromRequest(request));

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const { author, body } = (await request.json()) as { author?: string; body?: string };

  if (!author || !body) {
    return NextResponse.json({ error: 'Author and body are required' }, { status: 400 });
  }

  const note = await mockDb.addNote({ paperId: paperIdFromRequest(request), author, body });

  return NextResponse.json({ note }, { status: 201 });
}
