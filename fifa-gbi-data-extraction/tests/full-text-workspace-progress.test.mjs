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
  assert.match(clientSource, /<Meter[\s\S]{0,120}value=\{reviewerProgress\.percent\}/);
});

test('full-text reviewer progress counts the records it was given', async () => {
  const jiti = createJiti(import.meta.url);
  const { getFullTextReviewerProgress } = await jiti.import('../src/lib/screening/full-text-queue.ts');
  const voted = (reviewerProfileId) => ({
    metadata: {
      fullTextDecisions: [
        { reviewerProfileId, decision: 'include', decidedAt: '2026-06-19T00:00:00Z' },
      ],
    },
  });

  assert.deepEqual(getFullTextReviewerProgress([voted('reviewer-1'), { metadata: {} }], 'reviewer-1'), {
    completed: 1,
    total: 2,
    percent: 50,
  });

  // The denominator must grow with the queue. A fixed total once reported 411/386 = 106%.
  const queue = [...Array(414)].map((_, index) => (index < 411 ? voted('reviewer-1') : { metadata: {} }));
  assert.deepEqual(getFullTextReviewerProgress(queue, 'reviewer-1'), {
    completed: 411,
    total: 414,
    percent: 99,
  });

  assert.deepEqual(getFullTextReviewerProgress([], 'reviewer-1'), {
    completed: 0,
    total: 0,
    percent: 0,
  });
});

test('full-text queue upload loading is separate from navigation loading', () => {
  const clientSource = readProjectFile('src/components/full-text-screening-client.tsx');

  assert.match(clientSource, /const \[isUploadPending, setIsUploadPending\] = useState\(false\)/);
  assert.match(clientSource, /isUploadPending \? \(/);
  assert.doesNotMatch(clientSource, /htmlFor="full-text-upload"[\s\S]{0,500}isPending \? \(/);
});
