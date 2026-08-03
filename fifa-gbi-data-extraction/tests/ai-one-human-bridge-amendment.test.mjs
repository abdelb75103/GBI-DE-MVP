import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const scriptSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../scripts/promote-2026-07-30-ai-one-human-cohort.mjs',
  ),
  'utf8',
);
const amendmentSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../docs/full-text-ai-one-human-bridge-amendment-2026-07-30.md',
  ),
  'utf8',
);

test('bridge amendment is bounded to the approved exact six records', () => {
  for (const studyId of ['S683', 'S2699', 'S2761', 'S3931', 'S4859', 'S4860']) {
    assert.match(scriptSource, new RegExp(`'${studyId}'`));
    assert.match(amendmentSource, new RegExp(`\\\`${studyId}\\\``));
  }
  assert.match(scriptSource, /full-text-ai-one-human-bridge-2026-07-30-v1/);
  assert.match(scriptSource, /fifa-gbi-full-text-v8-2026-06-23/);
});

test('bridge reads authoritative relational votes without writing or deleting votes', () => {
  assert.match(scriptSource, /async function readVotes/);
  assert.match(scriptSource, /'screening_votes'/);
  assert.match(scriptSource, /vote_role === 'reviewer_vote'/);
  assert.match(scriptSource, /includeVotes\.length !== 1/);
  assert.match(scriptSource, /excludeVotes\.length !== 0/);
  assert.doesNotMatch(scriptSource, /screening_votes[\s\S]{0,120}\.insert/);
  assert.doesNotMatch(scriptSource, /screening_votes[\s\S]{0,120}\.update/);
  assert.doesNotMatch(scriptSource, /\.delete\(/);
});

test('bridge uses compare-and-swap guards and global ordered duplicate scans', () => {
  assert.match(scriptSource, /\.eq\('updated_at', record\.updated_at\)/);
  assert.match(scriptSource, /\.is\('manual_decision', null\)/);
  assert.match(scriptSource, /\.is\('promoted_paper_id', null\)/);
  assert.match(scriptSource, /request\.order\('id'\)\.range/);
  assert.match(scriptSource, /paper\.assigned_study_id === record\.assigned_study_id/);
  assert.match(scriptSource, /file\.file_sha256 === record\.file_sha256/);
});

test('S2699 is reference-check only and receives no primary extraction status', () => {
  assert.match(scriptSource, /SYSTEMATIC_REVIEW_ID = 'S2699'/);
  assert.match(scriptSource, /\? 'systematic_review'\s*:\s*'processing'/);
  assert.match(scriptSource, /referenceCheckingOnly:/);
  assert.match(amendmentSource, /Do not create Tabs 1–10 extraction rows for it/);
});

test('screening promotion fields remain null while the second human vote is pending', () => {
  assert.match(scriptSource, /record\.promoted_paper_id !== null/);
  assert.match(scriptSource, /record\.metadata\?\.fullTextResolution !== 'pending'/);
  assert.doesNotMatch(scriptSource, /promoted_paper_id:\s*paperId/);
  assert.doesNotMatch(scriptSource, /manual_decision:\s*'include'/);
});
