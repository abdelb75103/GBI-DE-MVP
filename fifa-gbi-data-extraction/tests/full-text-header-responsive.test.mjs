import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/full-text-screening-workspace-client.tsx', import.meta.url),
  'utf8',
);

test('keeps the full-text header actions stable beside long titles', () => {
  assert.match(source, /className="space-y-3 min-w-0 flex-1"/);
  assert.match(source, /className="flex shrink-0 flex-wrap items-center gap-3"/);
  assert.match(
    source,
    /className="inline-flex whitespace-nowrap items-center justify-center gap-1\.5 rounded-full border/,
  );
});
