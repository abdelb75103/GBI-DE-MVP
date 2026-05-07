# High-Reasoning Review Gate

Run this gate after any live extraction apply, for one paper or a batch, before saying the work is ready for human review.

## Model Rule

- Use the newest available Codex model at high reasoning.
- As of 2026-05-07, prefer GPT-5.5 high reasoning when available.
- Do not freeze this to one model name. If a newer Codex model is available, use it and record it in the review notes/backlog.
- If the runtime cannot select a separate model/reasoning level, run the strongest available independent review pass and state that limitation in the backlog or final summary.

## Live-State Scope

Review the live website/Supabase state, not only local drafts. Inspect these where applicable:

- `papers`
- `paper_files`
- `extractions`
- `extraction_fields`
- `population_groups`
- `population_values`
- `paper_notes`
- `docs/review-backlog.md`

For batches, verify every paper independently and then verify batch membership, count, missing/extra IDs, and backlog order.

## Required Checks

- `studyId` is present and equals `papers.assigned_study_id`.
- Status is appropriate for the current review stage, usually `processing` for human-review-ready papers.
- Source file is attached and opens from the live record.
- Required provenance notes are present, especially translated-paper language/date/model notes.
- Population groups match the strongest direct source split.
- Multiline values preserve population row order and use blank placeholders where needed.
- `population_values` and `extraction_fields` are dual-written for structured rows.
- Tabs `1-4` are checked for lead author, title, year, journal/DOI where present, design, participant fields, definitions, incidence denominator, and exposure.
- Outcome tabs include directly reported totals, match/training splits, incidence, burden, severity, CIs, recurrence, mechanism/contact, and common diagnosis/location/type where available.
- `injuryLocation` and `injuryTissueType` are filled wherever compatible location/type counts, incidence, burden, severity, diagnosis, or readable figure rows exist.
- If location/type rows are absent, the reason is explicit: not reported, incompatible denominator, unreadable figure, no clean numeric value, or no schema mapping.
- No prose caveats such as "not quantified" are stored inside numeric extraction fields.

## Findings

Classify each issue:

- `blocker`: must fix before human review readiness.
- `needs reviewer attention`: defensible live data, but the human reviewer should see the caveat.
- `no action`: checked and ready.

Fix blockers before saying the extraction is ready for human review. If the gate changes live data, rerun the gate on the changed paper(s).

Do not mark a paper `reviewed_complete` during this gate. The gate output is only `ready for human review` unless the user explicitly asks to complete the batch.
