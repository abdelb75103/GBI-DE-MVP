import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/lib/screening/reviewer-decisions.ts', import.meta.url),
  'utf8',
);

test('uses exposure-first wording for the missing denominator exclusion reason', () => {
  assert.match(source, /'No exposure reported \(no usable denominator\)'/);
  assert.doesNotMatch(source, /'No usable denominator'/);
});

test('offers wrong study design as a full-text exclusion reason', () => {
  assert.match(source, /'Wrong study design'/);
});

test('offers wrong outcomes as a full-text exclusion reason', () => {
  assert.match(source, /'Wrong outcomes'/);
});
