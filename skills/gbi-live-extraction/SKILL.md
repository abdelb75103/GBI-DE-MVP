---
name: gbi-live-extraction
description: Use the terminal-first workflow for staged manual-tab extraction in the FIFA GBI repo. Use this when a user wants help extracting tabs 5-10 from a paper PDF, reviewing the draft in chat, and applying approved values to the live Supabase-backed site without touching the UI.
---

# GBI Live Extraction

Run all commands from `fifa-gbi-data-extraction/`.

Track review state in `docs/review-backlog.md`.

## Default Interpretation

- Treat requests to "update the process" after a paper review as requests to update this skill, not the app's user-facing extraction instructions.
- Prefer additive-only live updates. Do not overwrite nonblank extraction values unless the user explicitly asks for a correction.
- Default to the terminal-first manual extraction workflow. Do not call Gemini or use AI suggestions unless the user explicitly asks for that.
- If `./scripts/terminal-extract.sh` is not present in this checkout, fall back to the direct terminal workflow:
  - inspect the local PDF/text manually
  - use the repo schema/types as the source of truth for field ids
  - apply approved live changes through direct Supabase terminal writes
  - record rationale and follow-up notes in `docs/review-backlog.md`

## Workflow

1. If available, run `bash -lc './scripts/terminal-extract.sh prep --paper <paperId|studyId>'`.
   - If the script is missing, create a local working folder, fetch or inspect the paper PDF/text directly, and proceed manually.
2. If the paper is ambiguous, identify the intended subgroup before extracting. Read `references/subgroup-selection.md` when the right line mapping is not obvious.
   - For trials or controlled comparisons, check first whether the paper reports clean arm-level tables. If it does, default to arm-level line mapping instead of a pooled row.
3. If available, run `bash -lc './scripts/terminal-extract.sh extract --paper <paperId|studyId> --tab <manual-tab> --guidance "<user instruction>"'`.
   - If the script is missing, stage the proposal manually from the local source text and the live schema.
4. Review the staged output with `bash -lc './scripts/terminal-extract.sh review --paper <paperId|studyId>'` when available.
   - If the script is missing, review the proposed values directly against the source tables/figures before any live apply.
   - Before calling a pass `sparse`, `headline-only`, or `outcome only`, scan all results tables and usable figures for directly fillable `injuryTissueType`, `injuryLocation`, severity, and mechanism/contact rows. Read `references/structured-row-mapping.md` when the paper has more than one outcome table.
   - For `injuryTissueType` and `injuryLocation`, do not stop at parent buckets if the same table also reports directly mappable subtypes or subregions.
   - If a paper already has extracted `injuryTissueType` or `injuryLocation` rows, also scan severity tables for matching directly mappable days-lost rows and add them as a follow-up when available.
   - When a reported count, incidence, burden, or similar extracted value includes a `95% CI`, preserve it during this review step using the schema’s dedicated CI field when available, otherwise inline after the value itself.
   - Use this completion checklist before calling any paper `review-ready`:
     - line mapping confirmed against the strongest directly reported subgroup axis
     - all location/type/mechanism/severity tables or figures scanned through their final continuation page
     - all clean one-to-one rows filled
     - all clean parent-field or `overall` mappings filled
     - all directly mappable subtype rows under any filled parent bucket also checked and filled
     - all reported `95% CI` values either stored in their dedicated field or appended inline where no CI field exists
     - any compatible subrow aggregations noted
     - any intentionally blank combined or incompatible rows noted
     - any still-sparse paper has an explicit reason recorded
5. Summarize the proposal and wait for explicit approval before applying.
   - Always state the line mapping, whether a stronger subgroup split replaces a pooled line, whether the update is additive-only or corrective, any compatible subrow aggregations, any proportion-derived participant counts, any median-labeled severity values, any tables or figures scanned for structured rows, and any intentionally blank fields.
   - If `observationDuration` includes a reported season or tournament year range, preserve that year context in the value instead of shortening it to a generic season count.
   - Preserve reported `95% CI` values. Use the dedicated CI field when the schema provides one; otherwise append the interval inline after the reported number.
   - If exposure or incidence rows come from a subset but sample size comes from the full cohort, keep the direct values but call out that denominator mismatch explicitly in the backlog note.
6. Only after approval, run `bash -lc './scripts/terminal-extract.sh apply --paper <paperId|studyId>'` when available.
   - If the script is missing, apply approved changes through direct Supabase terminal writes.
7. Leave live status changes to the user unless they explicitly ask for one.
   - When the user says a whole batch is complete, mark each row in that batch `✅ reviewed_complete`, set any remaining in-scope paper statuses to `extracted`, and add `Completed: YYYY-MM-DD` to that batch section in `docs/review-backlog.md`.

## Safety

- Never use `apply` without explicit user approval.
- Do not pass `--allow-empty-overwrite` unless the user explicitly wants blank values to replace existing data.
- If a staged draft already exists, do not use `prep --force` unless the user wants to discard it.
- Preserve existing live manual edits unless the user explicitly approves changing populated values.
- For papers awaiting user review, prefer live status `processing` rather than `extracted`.
- Do not describe a paper as `review-ready` if the structured-table completion checklist has not been satisfied.
- Any paper touched during live extraction or exclusion work should be assigned to `AbdelRahman Babiker` immediately so it no longer appears available in the queue.
- Put rationale, caveats, and review commentary in the backlog by default rather than as live paper notes.
- Only UEFA Elite Club study-family papers should be tagged `uefa`. Do not exclude a paper as `uefa` just because it is UEFA-branded or takes place in a UEFA competition.
- If a local PDF is image-only or not machine-readable, a sparse abstract-level pass is allowed only if that limitation is stated explicitly in the backlog note.
- If a reported days-lost field is labeled as median or `median (IQR)`, do not describe it as mean. If the schema only offers a generic severity-days field for that row, store the reported median value there and note the median labeling clearly in the backlog/review commentary.
- When multiline labels or multiline extracted values are corrected live, keep `population_groups` and `population_values` aligned with the corrected split.

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
