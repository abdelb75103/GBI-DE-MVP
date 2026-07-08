import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const REVIEW_COMMENT_MAX_CHARS = 2000;
const FULL_TEXT_REVIEW_NOTES_KEY = 'fullTextReviewNotes';

const requestSchema = z.object({
  flagged: z.boolean(),
  comment: z.string().trim().max(REVIEW_COMMENT_MAX_CHARS).optional().nullable(),
  noteAction: z.enum(['none', 'add', 'edit', 'delete']).optional(),
  noteId: z.string().optional().nullable(),
  updatedAt: z.string().datetime().optional().nullable(),
});

type FullTextReviewNote = {
  id: string;
  body: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
};

const isFullTextReviewNote = (value: unknown): value is FullTextReviewNote => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<FullTextReviewNote>;
  return typeof candidate.id === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.createdAt === 'string';
};

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
    const metadata = record.metadata ?? {};
    const noteAction = parsed.data.noteAction ?? (parsed.data.comment?.trim() ? 'add' : 'none');
    const noteBody = parsed.data.comment?.trim() ?? '';
    const storedNotes = metadata[FULL_TEXT_REVIEW_NOTES_KEY];
    let reviewNotes = Array.isArray(storedNotes) ? storedNotes.filter(isFullTextReviewNote) : [];
    let notesUpdate: string | null | undefined;
    const legacyNote = record.notes?.trim();
    const shouldMigrateLegacyNote =
      legacyNote &&
      (noteAction === 'add' || (noteAction === 'edit' && parsed.data.noteId !== '__legacy_notes__'));

    if (shouldMigrateLegacyNote) {
      reviewNotes = [
        ...reviewNotes,
        {
          id: `legacy-${record.updatedAt}`,
          body: legacyNote,
          createdAt: record.updatedAt,
          createdBy: profile.id,
          createdByName: profile.fullName,
        },
      ];
      notesUpdate = null;
    }

    if (noteAction === 'add') {
      if (!noteBody) {
        return NextResponse.json({ error: 'Note cannot be empty.' }, { status: 400 });
      }
      reviewNotes = [
        ...reviewNotes,
        {
          id: crypto.randomUUID(),
          body: noteBody,
          createdAt: now,
          createdBy: profile.id,
          createdByName: profile.fullName,
        },
      ];
      notesUpdate = null;
    }

    if (noteAction === 'edit') {
      if (!parsed.data.noteId) {
        return NextResponse.json({ error: 'A note id is required to edit a note.' }, { status: 400 });
      }
      if (!noteBody) {
        return NextResponse.json({ error: 'Edited note cannot be empty.' }, { status: 400 });
      }
      if (parsed.data.noteId === '__legacy_notes__') {
        reviewNotes = [
          ...reviewNotes,
          {
            id: crypto.randomUUID(),
            body: noteBody,
            createdAt: now,
            createdBy: profile.id,
            createdByName: profile.fullName,
          },
        ];
        notesUpdate = null;
      } else {
        let found = false;
        reviewNotes = reviewNotes.map((note) => {
          if (note.id !== parsed.data.noteId) return note;
          found = true;
          return {
            ...note,
            body: noteBody,
            updatedAt: now,
            updatedBy: profile.id,
            updatedByName: profile.fullName,
          };
        });
        if (!found) {
          return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
        }
      }
    }

    if (noteAction === 'delete') {
      if (!parsed.data.noteId) {
        return NextResponse.json({ error: 'A note id is required to delete a note.' }, { status: 400 });
      }
      if (parsed.data.noteId === '__legacy_notes__') {
        notesUpdate = null;
      } else {
        const nextNotes = reviewNotes.filter((note) => note.id !== parsed.data.noteId);
        if (nextNotes.length === reviewNotes.length) {
          return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
        }
        reviewNotes = nextNotes;
      }
    }

    const nextMetadata = {
      ...metadata,
      fullTextReviewFlagged: parsed.data.flagged,
      fullTextReviewUpdatedAt: now,
      fullTextReviewUpdatedBy: profile.id,
      fullTextReviewUpdatedByName: profile.fullName,
      [FULL_TEXT_REVIEW_NOTES_KEY]: reviewNotes,
    };
    const updates = notesUpdate === undefined ? {} : { notes: notesUpdate };

    const updated = await mockDb.updateScreeningRecordMetadata(
      id,
      nextMetadata,
      updates,
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
