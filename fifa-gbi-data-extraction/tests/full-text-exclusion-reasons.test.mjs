import assert from 'node:assert/strict';
import test from 'node:test';

import { EXCLUSION_REASONS } from '../src/lib/screening/reviewer-decisions.ts';

test('uses exposure-first wording for the missing denominator exclusion reason', () => {
  assert.ok(EXCLUSION_REASONS.includes('No exposure reported (no usable denominator)'));
  assert.ok(!EXCLUSION_REASONS.includes('No usable denominator'));
});
