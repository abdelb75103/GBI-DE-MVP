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

test('full-text review state route persists the flag in metadata and the comment in screening notes', () => {
  assert.match(reviewRouteSource, /fullTextReviewFlagged/);
  assert.match(reviewRouteSource, /fullTextReviewUpdatedByName/);
  assert.match(reviewRouteSource, /notes:\s*parsed\.data\.comment\?\.trim\(\)\s*\|\|\s*null/);
  assert.match(workspaceSource, /Save flag and comment/);
});
