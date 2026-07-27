# FIFA GBI Screening Instructions

## Scope And Sources

Use this branch for title/abstract screening, full-text screening, AI recommendation refreshes, conflicts, criteria changes, screening imports/exports, and promotion-state questions.

- For title/abstract AI recommendations, use `skills/fifa-title-abstract-screening-review/SKILL.md` and its routed references.
- Do not reuse extraction rules as screening criteria.
- Title/abstract screening for `Second search - Ishanka - 2026-05-26` is frozen. Do not rerun recommendations, criteria/model audit fields, offline packs, conflicts, resolver state, or promotion state unless Abdel explicitly reopens that stage. Apply new edge cases at full text by default.

## Model Rule

Do not use Gemini unless Abdel explicitly requests it. Run project AI screening locally from the current workspace. Default to GPT-5.5 medium when available; otherwise use the closest suitable local Codex/OpenAI model with explicit reasoning and record the substitution before applying results.

## Decision Integrity

Human votes are immutable audit records. Never edit, replace, remove, or restore human entries in `metadata.titleAbstractDecisions`, full-text reviewer arrays, reviewer IDs/names, timestamps, or manual-review fields unless Abdel requests that exact repair.

An AI re-review updates only `ai_*` recommendations and their criteria/model audit fields. It must not add resolver decisions, resolve conflicts, manually promote records, or create/delete full-text placeholders. AI-human disagreement remains a conflict until Abdel approves the exact record-level adjudication.

When Abdel asks to correct or refresh an existing live AI recommendation, carry the approved AI-field correction through the live apply path and verify the written values unless he says `local-only` or `dry-run`. This never authorizes changes to human votes or resolver state.

## Full-Text Denominators

Treat a denominator as `paper_derivable` when the paper reports cohort-level inputs that multiply into a study total without extra assumptions—for example, mean match minutes times an explicit participant count—provided the numerator is cohort-wide and the at-risk frame is clear. Record the exact inputs and note that totals based on rounded means are approximate. Do not exclude solely because the paper reports a cohort mean rather than the multiplied total.

## Tracking And Status

Use descriptive filenames and opening summaries that identify search/import wave, screening stage, date, and artifact type. Distinguish already found/uploaded records, prior unsuccessful searches, newly promoted first-search records, and records skipped because a PDF already exists.

If Abdel flags a screening paper for exclusion, set the matching live and backlog status to `flagged` and record the reason. If he says review is complete, use `✅ reviewed_complete`; the flag alone must not leave it pending review.
