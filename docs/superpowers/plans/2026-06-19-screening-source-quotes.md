# Screening Source Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove misleading source quotes from both screening stages while preserving AI rationales, decisions, and historical database compatibility.

**Architecture:** Treat quote removal as an output-boundary rule. The three reviewer-facing renderers stop consuming quote fields; full-text review normalizes new quote fields to `null`; title/abstract application accepts quote-free exclusions and writes `null`. Existing columns remain untouched.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, Supabase.

---

### Task 1: Lock the reviewer-facing contract

**Files:**
- Create: `fifa-gbi-data-extraction/tests/screening-source-quotes.test.mjs`
- Modify: `fifa-gbi-data-extraction/src/components/full-text-screening-workspace-client.tsx`
- Modify: `fifa-gbi-data-extraction/src/components/title-abstract-screening-client.tsx`
- Modify: `fifa-gbi-data-extraction/src/app/title-abstract-offline/[packId]/route.ts`

- [ ] Write a source-contract test that reads all three renderers and asserts they do not reference `aiEvidenceQuote`, `aiSourceLocation`, or the offline `ai-evidence` element.
- [ ] Run `node --test tests/screening-source-quotes.test.mjs` from `fifa-gbi-data-extraction` and confirm it fails.
- [ ] Remove only the quote/source rendering blocks from the three interfaces.
- [ ] Re-run the test and confirm it passes.

### Task 2: Stop full-text AI quote generation

**Files:**
- Modify: `fifa-gbi-data-extraction/src/lib/screening/ai-review.ts`
- Test: `fifa-gbi-data-extraction/tests/screening-source-quotes.test.mjs`

- [ ] Extend the contract test to assert the prompt does not request `evidenceQuote` or `sourceLocation`, quote validation errors are absent, and returned fields are always `null`.
- [ ] Export the prompt builder for direct testing and run the focused test to confirm failure.
- [ ] Remove quote/source fields from the AI JSON prompt and exclusion validation, while keeping result fields as compatibility `null`s.
- [ ] Re-run the focused test.

### Task 3: Stop title/abstract quote persistence

**Files:**
- Modify: `skills/fifa-title-abstract-screening-review/SKILL.md`
- Modify: `skills/fifa-title-abstract-screening-review/references/output-schema.md`
- Modify: `skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs`
- Modify: `skills/fifa-title-abstract-screening-review/scripts/append_chat_screening_recommendations.mjs`
- Modify: `skills/fifa-title-abstract-screening-review/scripts/merge_chat_screening_recommendations.mjs`
- Modify: `skills/fifa-title-abstract-screening-review/scripts/title_abstract_screening_rules.mjs`
- Test: `fifa-gbi-data-extraction/tests/first-batch-rayyan-validation.test.mjs`
- Test: `fifa-gbi-data-extraction/tests/screening-source-quotes.test.mjs`

- [ ] Add assertions that an exclusion needs an exclusion reason but no quote/source fields, and that persistence maps both database fields to `null`.
- [ ] Run the focused tests and confirm the old requirements fail.
- [ ] Relax recommendation validators, normalize output quote/source fields to `null`, and update workflow instructions without changing decision rules.
- [ ] Re-run the focused tests.

### Task 4: Regression verification

**Files:** All files above.

- [ ] Run `node --test tests/screening-source-quotes.test.mjs tests/first-batch-rayyan-validation.test.mjs tests/title-abstract-supabase-finalize.test.mjs`.
- [ ] Run ESLint on the edited application TypeScript files.
- [ ] Run `npx tsc --noEmit` and report any unrelated pre-existing failures separately.
- [ ] Review `git diff` to confirm no human-vote, decision, conflict, promotion, schema, or dev-server behavior changed.

No commit step is included because project instructions require explicit commit approval.
