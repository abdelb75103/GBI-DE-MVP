import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createJiti } from 'jiti';

const readProjectFile = (relativePath) => readFileSync(
  path.resolve(import.meta.dirname, '..', relativePath),
  'utf8',
);

test('full-text workspace shows reviewer queue progress', () => {
  const pageSource = readProjectFile('src/app/full-text-screening/[id]/page.tsx');
  const clientSource = readProjectFile('src/components/full-text-screening-workspace-client.tsx');

  assert.match(pageSource, /reviewerProgress=\{reviewerProgress\}/);
  assert.match(clientSource, /Your screening progress/);
  assert.match(clientSource, /\{reviewerProgress\.completed\}\/\{reviewerProgress\.total\} papers · \{reviewerProgress\.percent\}%/);
  assert.match(clientSource, /width: `\$\{reviewerProgress\.percent\}%`/);
});

test('full-text reviewer progress uses the fixed 386-paper denominator', async () => {
  const jiti = createJiti(import.meta.url);
  const {
    FULL_TEXT_SCREENING_REVIEW_TOTAL,
    getFullTextReviewerProgress,
  } = await jiti.import('../src/lib/screening/full-text-queue.ts');
  const metadata = {
    fullTextDecisions: [
      { reviewerProfileId: 'reviewer-1', decision: 'include', decidedAt: '2026-06-19T00:00:00Z' },
    ],
  };

  assert.equal(FULL_TEXT_SCREENING_REVIEW_TOTAL, 386);
  assert.deepEqual(getFullTextReviewerProgress([{ metadata }, { metadata: {} }], 'reviewer-1'), {
    completed: 1,
    total: 386,
    percent: 0,
  });
});

test('full-text queue upload loading is separate from navigation loading', () => {
  const clientSource = readProjectFile('src/components/full-text-screening-client.tsx');

  assert.match(clientSource, /const \[isUploadPending, setIsUploadPending\] = useState\(false\)/);
  assert.match(clientSource, /isUploadPending \? \(/);
  assert.doesNotMatch(clientSource, /htmlFor="full-text-upload"[\s\S]{0,500}isPending \? \(/);
});
