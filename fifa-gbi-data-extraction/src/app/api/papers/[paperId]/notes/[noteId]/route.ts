import { NextRequest, NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;

    await mockDb.deleteNote(noteId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[notes] Error deleting note:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

