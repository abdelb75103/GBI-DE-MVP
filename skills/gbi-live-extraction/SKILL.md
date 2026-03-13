---
name: gbi-live-extraction
description: Use the terminal-first workflow for staged manual-tab extraction in the FIFA GBI repo. Use this when a user wants help extracting tabs 5-10 from a paper PDF, reviewing the draft in chat, and applying approved values to the live Supabase-backed site without touching the UI.
---

# GBI Live Extraction

Run all commands from `fifa-gbi-data-extraction/`.

## Default Interpretation

- Treat requests to "update the process" after a paper review as requests to update this skill, not the app's user-facing extraction instructions.
- Prefer additive-only live updates. Do not overwrite nonblank extraction values unless the user explicitly asks for a correction.
- Default to the terminal-first manual extraction workflow. Do not call Gemini or use AI suggestions unless the user explicitly asks for that.

## Workflow

1. Run `bash -lc './scripts/terminal-extract.sh prep --paper <paperId|studyId>'`.
2. If the paper is ambiguous, identify the intended subgroup before extracting. Read `references/subgroup-selection.md` when the right line mapping is not obvious.
   - For trials or controlled comparisons, check first whether the paper reports clean arm-level tables. If it does, default to arm-level line mapping instead of a pooled row.
3. Run `bash -lc './scripts/terminal-extract.sh extract --paper <paperId|studyId> --tab <manual-tab> --guidance "<user instruction>"'`.
4. Review the staged output with `bash -lc './scripts/terminal-extract.sh review --paper <paperId|studyId>'`.
   - Before calling a pass `sparse`, `headline-only`, or `outcome only`, scan all results tables and usable figures for directly fillable `injuryTissueType`, `injuryLocation`, severity, and mechanism/contact rows. Read `references/structured-row-mapping.md` when the paper has more than one outcome table.
5. Summarize the proposal and wait for explicit approval before applying.
   - Always state the line mapping, whether a stronger subgroup split replaces a pooled line, whether the update is additive-only or corrective, any compatible subrow aggregations, any median-labeled severity values, any tables or figures scanned for structured rows, and any intentionally blank fields.
6. Only after approval, run `bash -lc './scripts/terminal-extract.sh apply --paper <paperId|studyId>'`.
7. Leave live status changes to the user unless they explicitly ask for one. Use `--mark-complete` only when the user explicitly confirms the paper is ready for `extracted`.

## Safety

- Never use `apply` without explicit user approval.
- Do not pass `--allow-empty-overwrite` unless the user explicitly wants blank values to replace existing data.
- If a staged draft already exists, do not use `prep --force` unless the user wants to discard it.
- Preserve existing live manual edits unless the user explicitly approves changing populated values.
- For papers awaiting user review, prefer live status `processing` rather than `extracted`.
- Any paper touched during live extraction or exclusion work should be assigned to `AbdelRahman Babiker` immediately so it no longer appears available in the queue.
- Put rationale, caveats, and review commentary in the backlog by default rather than as live paper notes.

## References

- Read `references/subgroup-selection.md` for pooled-vs-split decisions, home-venue vs playing-surface distinctions, and sample-size line mapping.
- Read `references/direct-vs-derived-values.md` for direct-vs-calculated value rules and allowed aggregations.
- Read `references/structured-row-mapping.md` for tissue/type and location row mapping, inline CI handling, and subsection-specific table rules.

## Manual Tabs

- `injuryOutcome`
- `illnessOutcome`
- `injuryTissueType`
- `injuryLocation`
- `illnessRegion`
- `illnessEtiology`
