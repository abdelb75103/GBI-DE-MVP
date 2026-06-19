import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const readProjectFile = (relativePath) => readFileSync(
  path.resolve(import.meta.dirname, '..', relativePath),
  'utf8',
);

test('screening interfaces do not render AI source quotes or locations', () => {
  const fullText = readProjectFile('src/components/full-text-screening-workspace-client.tsx');
  const titleAbstract = readProjectFile('src/components/title-abstract-screening-client.tsx');
  const offlinePack = readProjectFile('src/app/title-abstract-offline/[packId]/route.ts');

  for (const renderer of [fullText, titleAbstract]) {
    assert.doesNotMatch(renderer, /aiEvidenceQuote/);
    assert.doesNotMatch(renderer, /aiSourceLocation/);
  }
  assert.doesNotMatch(offlinePack, /ai-evidence/);
  assert.doesNotMatch(offlinePack, /aiEvidenceQuote/);
  assert.doesNotMatch(offlinePack, /aiSourceLocation/);
});

test('full-text AI review does not request or validate source quotes', () => {
  const aiReview = readProjectFile('src/lib/screening/ai-review.ts');

  assert.doesNotMatch(aiReview, /missing a source quote/i);
  assert.doesNotMatch(aiReview, /missing a source location/i);
  assert.doesNotMatch(aiReview, /direct quote from the PDF/i);
  assert.match(aiReview, /evidenceQuote: null/);
  assert.match(aiReview, /sourceLocation: null/);
});

test('title\/abstract persistence clears quote fields and does not require them', () => {
  const applier = readProjectFile('../skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs');
  const runner = readProjectFile('../skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs');

  for (const workflow of [applier, runner]) {
    assert.doesNotMatch(workflow, /require(?:s)? exclusionReason, sourceQuote, and sourceLocation/i);
    assert.doesNotMatch(workflow, /exact quote for excludes/i);
    assert.match(workflow, /ai_evidence_quote:\s*null/);
    assert.match(workflow, /ai_source_location:\s*null/);
  }
});
