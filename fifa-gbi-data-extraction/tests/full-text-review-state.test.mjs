import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

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
