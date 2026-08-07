import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { z } from 'zod';

const reviewRouteSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/app/api/full-text-screening/[id]/review-state/route.ts'),
  'utf8',
);

const workspaceSource = readFileSync(
  path.resolve(import.meta.dirname, '../src/components/full-text-screening-workspace-client.tsx'),
  'utf8',
);

test('full-text review state route persists the flag and structured review notes in metadata', () => {
  assert.match(reviewRouteSource, /fullTextReviewFlagged/);
  assert.match(reviewRouteSource, /fullTextReviewUpdatedByName/);
  assert.match(reviewRouteSource, /const FULL_TEXT_REVIEW_NOTES_KEY = 'fullTextReviewNotes'/);
  assert.match(reviewRouteSource, /noteAction:\s*z\.enum\(\['none', 'add', 'edit', 'delete'\]\)/);
  assert.match(reviewRouteSource, /\[FULL_TEXT_REVIEW_NOTES_KEY\]:\s*reviewNotes/);
  assert.match(reviewRouteSource, /const updates = notesUpdate === undefined \? \{\} : \{ notes: notesUpdate \}/);
  assert.doesNotMatch(reviewRouteSource, /notes:\s*parsed\.data\.comment\?\.trim\(\)\s*\|\|\s*null/);
  assert.match(
    workspaceSource,
    /\{editingNote \? 'Update note' : reviewComment\.trim\(\) \? 'Save note' : 'Save flag'\}/,
  );
});

test('review state route accepts the offset timestamps Supabase actually returns', () => {
  // The client posts `record.updatedAt` back unchanged, and that value comes straight from
  // Postgres via `mapScreeningRecordRow`, so it carries a `+00:00` offset rather than `Z`.
  // A bare `z.string().datetime()` rejects it and every note save fails with
  // "Invalid ISO datetime".
  assert.match(reviewRouteSource, /updatedAt:\s*z\.string\(\)\.datetime\(\{ offset: true \}\)/);
  assert.match(workspaceSource, /updatedAt: record\.updatedAt/);

  const updatedAt = z.string().datetime({ offset: true }).optional().nullable();
  for (const value of [
    '2026-08-07T14:06:30.485308+00:00',
    '2026-07-30T18:41:43.35+00:00',
    '2026-08-07T14:06:30.485Z',
    null,
    undefined,
  ]) {
    assert.equal(updatedAt.safeParse(value).success, true, `expected ${String(value)} to be accepted`);
  }

  assert.equal(updatedAt.safeParse('not-a-timestamp').success, false);
});
