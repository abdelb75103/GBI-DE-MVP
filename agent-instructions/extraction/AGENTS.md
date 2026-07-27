# FIFA GBI Live Extraction Instructions

## Scope And Source Of Truth

Use this branch for manual Tabs 1–10 extraction, live apply, extraction QA, Backlog 2 batches, translated-paper extraction, population layouts, and extraction-status changes.

Follow `skills/gbi-live-extraction/SKILL.md` end to end. Load only the paper-relevant references it routes to. Track general review in `fifa-gbi-data-extraction/docs/review-backlog.md` and second-search Backlog 2 work in `fifa-gbi-data-extraction/docs/second-search-extraction-review-backlog-2026-07-03.md`.

## Model And Write Rules

- Do not use Gemini unless Abdel explicitly requests it.
- Default to local GPT-5.5 medium when available; record any model substitution.
- Prefer additive-only writes. Do not overwrite nonblank extraction values unless Abdel requests a correction.
- Preserve `studyId` as `papers.assigned_study_id`.
- Assign selected records to AbdelRahman Babiker (`00000000-0000-0000-0000-000000000001`) unless instructed otherwise.
- Keep human-review candidates `processing`; preserve true exclusion statuses.
- Never change screening votes, resolver decisions, or protected manual-review fields during extraction.

An explicit extraction, review, apply, correction, refresh, or batch-processing request authorizes the skill's live apply and focused integrity gate unless Abdel says `local-only`, `dry-run`, or asks to review a proposal first. Verify live-backed corrections in the live record; do not stop at local JSON or Markdown.

## Backlog 2 Parallel Batches

For multiple batches, use one coordinator plus one fresh-context agent per fixed five-paper batch:

1. Reserve every selected unassigned live paper in one conditional update.
2. Create numbered five-record batches and pre-create backlog rows.
3. Give each agent only its own five IDs using `skills/gbi-live-extraction/references/parallel-batch-agent-prompt.md`.
4. Each agent owns source review, pre-apply completeness, live apply, the focused integrity gate, and its five backlog rows.
5. Keep exclusions/systematic reviews in their original batch; never replace them.
6. Do not add cross-agent extraction review. Human review is the next substantive review.
7. The coordinator performs one final reconciliation of membership, status, assignment, population count/layout, and backlog rows. Trust a successful agent gate for source and field-level checks.

Do not repeatedly poll agents, inspect intermediate live writes, or rerun gates unless an agent reports failure, conflicting evidence, or a blocker.

## Tracking And Review State

Use filenames and opening summaries that identify search wave, extraction stage, date, and artifact type. Persist only the batch input and final live audit by default; create a correction audit only when a post-apply correction was required.

When Abdel says a batch is complete, mark its rows `✅ reviewed_complete`, set remaining in-scope live papers to `extracted`, and add the completion date. When he explicitly flags an extraction paper for exclusion, set live/backlog status to `flagged`, record the reason, and mark it reviewed complete only when he says review is complete.
