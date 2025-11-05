import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const paperIdFromRequest = (request: NextRequest) => request.nextUrl.pathname.split('/').slice(-2, -1)[0] ?? '';

export async function GET(request: NextRequest) {
  const notes = await mockDb.listNotes(paperIdFromRequest(request));

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  try {
    const { body } = (await request.json()) as { body?: string };

    if (!body) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    }

    const note = await mockDb.addNote({ 
      paperId: paperIdFromRequest(request), 
      body 
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('[notes] Error saving note:', error);
    const message = error instanceof Error ? error.message : 'Failed to save note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
