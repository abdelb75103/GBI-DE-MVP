import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, {
  alias: {
    '@': new URL('../src', import.meta.url).pathname,
  },
});
const { getExtractionMetrics } = await jiti.import('../src/lib/workflow-metrics.ts');

test('excludes synthetic master records from extraction workflow metrics', () => {
  const metrics = getExtractionMetrics([
    { status: 'extracted', assignedTo: 'reviewer-1', flagReason: null },
    { status: 'uefa_master_extraction', assignedTo: 'reviewer-1', flagReason: null },
    { status: 'archived', assignedTo: 'reviewer-1', flagReason: null },
  ]);

  assert.deepEqual(metrics, {
    total: 1,
    completed: 1,
    remaining: 0,
    progress: 100,
    primaryCount: 0,
    primaryLabel: 'In progress',
    secondaryCount: 0,
    secondaryLabel: 'Flagged',
    tertiaryCount: 0,
    tertiaryLabel: 'Available',
  });
});
