import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const reviewerDecisionsPath = path.resolve(
  import.meta.dirname,
  '../src/lib/screening/reviewer-decisions.ts',
);

test('full-text exclusion reasons use the combined public or invalid data-source label', () => {
  const source = readFileSync(reviewerDecisionsPath, 'utf8');

  assert.doesNotMatch(source, /'Public-source-only dataset'/);
  assert.match(source, /'Public or otherwise ineligible data source'/);
});

test('uses exposure-first wording for the missing denominator exclusion reason', () => {
  const source = readFileSync(reviewerDecisionsPath, 'utf8');

  assert.match(source, /'No exposure reported \(no usable denominator\)'/);
  assert.doesNotMatch(source, /'No usable denominator'/);
});

test('offers wrong study design as a full-text exclusion reason', () => {
  const source = readFileSync(reviewerDecisionsPath, 'utf8');

  assert.match(source, /'Wrong study design'/);
});

test('offers wrong outcomes as a full-text exclusion reason', () => {
  const source = readFileSync(reviewerDecisionsPath, 'utf8');

  assert.match(source, /'Wrong outcomes'/);
});

test('does not offer retired full-text exclusion reasons', () => {
  const source = readFileSync(reviewerDecisionsPath, 'utf8');

  assert.doesNotMatch(source, /'Review article for reference checking only'/);
  assert.doesNotMatch(source, /'Full text unavailable'/);
  assert.doesNotMatch(source, /'Non-English full text pending translation'/);
});
