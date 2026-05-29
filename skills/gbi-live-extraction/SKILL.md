---
name: gbi-live-extraction
description: Use the terminal-first workflow for staged manual-tab extraction in the FIFA GBI repo. Use this when extracting, reviewing, applying, QA-checking, or batch-processing paper data in the live Supabase-backed extraction site without using the UI.
---

# GBI Live Extraction

Run commands from `fifa-gbi-data-extraction/`. Track review state in `docs/review-backlog.md`.

## Core Defaults

- Treat requests to "update the process" after a paper review as requests to update this skill, not the app's user-facing instructions.
- Extract Tabs `1-10` manually. Do not use Gemini-generated passes for `studyDetails`, `participantCharacteristics`, `definitions`, `exposure`, `injuryOutcome`, `illnessOutcome`, `injuryTissueType`, `injuryLocation`, `illnessRegion`, or `illnessEtiology` unless Abdel explicitly asks for Gemini in the current request.
- For project AI functions, run locally from the current workspace and apply results to Supabase from that local workflow. Default to GPT-5.5 with medium reasoning when available; if unavailable, use the closest suitable local Codex/OpenAI terminal model with explicit reasoning, record the model used, and explain the substitution before applying results.
- Prefer additive-only live updates. Do not overwrite nonblank values unless the user explicitly asks for a correction.
- Default assignment profile is `AbdelRahman Babiker` (`00000000-0000-0000-0000-000000000001`). Assign every paper selected for extraction or batch review to that profile unless the user states otherwise.
- Preserve existing live manual edits. If a selected paper is assigned to another profile, do not overwrite it silently; either skip it or reassign it only when the user explicitly asks for that paper/batch to be assigned to AbdelRahman Babiker.
- For papers awaiting human review, prefer live status `processing`, not `extracted`.
- Treat `studyId` as display-only/system-seeded. Preserve or restore it to `papers.assigned_study_id` when writing directly to Supabase.
- Put rationale, caveats, and reviewer-facing notes in `docs/review-backlog.md` by default. Use live paper notes for required provenance or user-requested record notes.

## References To Load

- Read `references/subgroup-selection.md` when pooled vs subgroup line mapping is not obvious.
- Read `references/field-completeness.md` when checking Tabs `1-4`, author/title metadata, definitions, exposure, status handling, or assignment safety.
- Read `references/structured-row-mapping.md` before filling or QA-checking `injuryTissueType`, `injuryLocation`, severity, diagnosis, or mechanism rows.
- Read `references/direct-vs-derived-values.md` before calculating or aggregating any value that is not printed directly.
- Read `references/translated-papers.md` for translated non-English PDFs, smart appendices, merged translated/original files, and translation provenance notes.
- Read `references/review-gate.md` for the mandatory post-apply high-reasoning Codex review gate.

## Workflow

1. Prepare the paper.
   - If available, run `bash -lc './scripts/terminal-extract.sh prep --paper <paperId|studyId>'`.
   - If the script is missing, inspect the PDF/text directly, use repo schema/types as source of truth, and apply approved changes through direct Supabase writes.
   - When selecting a "next available" paper, verify `assigned_to` first. `Available` means truly unassigned, not merely `uploaded`; assign selected papers to AbdelRahman Babiker before extraction unless instructed otherwise.
2. Choose population rows before filling fields.
   - Use the strongest directly reported axis: study arm, sex, age group, competition level, team/region, season, surface, tournament phase, or another explicit cohort split.
   - If pooled and subgroup values both exist, use `Total / subgroup...` unless the source table gives a more defensible order.
   - If subgroup-only values exist and no pooled total is reported, do not invent a `Total` row.
   - Shared/global values go on the first row only; subgroup-specific values go on matching rows; blanks preserve row alignment.
3. Extract manually.
   - If available, run `bash -lc './scripts/terminal-extract.sh extract --paper <paperId|studyId> --tab <manual-tab> --guidance "<user instruction>"'`.
   - If not available, stage values manually from the source text/PDF and live schema.
4. Review before apply.
   - If available, run `bash -lc './scripts/terminal-extract.sh review --paper <paperId|studyId>'`.
   - Check Tabs `1-4` for every included paper, and Tabs `5-10` whenever compatible outcome, structured, illness, or mechanism data exists.
   - Before calling a paper ready, scan all results tables and usable figures for location, type/diagnosis/tissue, severity, mechanism/contact, incidence, burden, and CI values.
5. Summarize and wait for explicit approval before applying.
   - State line mapping, additive vs corrective scope, source tables/figures scanned, derived/aggregated values, missing-but-checked items, and any reviewer caveats.
   - Never run `apply` without explicit approval.
6. Apply approved changes.
   - If available, run `bash -lc './scripts/terminal-extract.sh apply --paper <paperId|studyId>'`.
   - If not available, apply through direct Supabase writes.
   - Always dual-write structured rows: any value in `population_values` must have the matching newline-aligned `extraction_fields` value.
7. Run the high-reasoning review gate.
   - Use `references/review-gate.md`.
   - This is required after any live apply, whether one paper or a batch. Script success alone is not review readiness.
   - Fix blockers and rerun the gate on changed papers before saying they are ready for human review.
8. Manage status only when asked.
   - When the user says a batch is complete, mark each row `✅ reviewed_complete`, set remaining in-scope live statuses to `extracted`, and add `Completed: YYYY-MM-DD`.
   - Otherwise leave live statuses alone.

## Field Rules

- Format `leadAuthor` as `Surname Initials`, e.g. `Zebis MK`.
- Standardize `fifaDiscipline` to schema-supported values such as `Association football (11-a-side)`, `Futsal`, `Beach soccer`, or `Para football`.
- Normalize `injuryDefinition` to `physical complaint`, `medical attention`, `time-loss`, or the shortest accurate combined label.
- Make `incidenceDefinition` denominator-explicit whenever any incidence, prevalence, rate, or burden metric is extracted.
- Use the shortest accurate value; do not paste full prose definitions when the schema label already gives context.
- Preserve reported `95% CI` values in dedicated CI fields where available, otherwise inline as `estimate (lower - upper)`.
- Do not put burden metrics into raw days-out severity fields unless the paper reports total/mean/median days lost for that exact row.
- If a median days-lost value is stored in a generic severity field, label it as median and mention it in the backlog/review note.
- If a field is checked and genuinely absent, leave it blank/`not_reported`; do not skip it silently.
- Use `references/field-completeness.md` for detailed completeness rules.

## Safety

- Do not use `--allow-empty-overwrite` unless the user explicitly asks to blank existing values.
- Do not use `prep --force` if a staged draft exists unless the user wants to discard it.
- Do not call an extraction `review-ready` until the structured-table completion checklist in `references/structured-row-mapping.md` and the post-apply gate in `references/review-gate.md` are satisfied.
- Do not classify exclusion papers as `processing` just because they are awaiting review; preserve true exclusion statuses such as `american_data`, `systematic_review`, `uefa`, or `referee`.
- Only UEFA Elite Club study-family papers should be tagged `uefa`.
- If a paper appears to be a companion sub-study, flag it before treating it as routine new extraction work.
- If a local PDF is image-only or not machine-readable, a sparse abstract-level pass is allowed only if that limitation is stated explicitly.
- Use figure-derived values only when the figure is readable enough to support a defensible extraction; text/table values take precedence.
- Keep `docs/review-backlog.md` in strictly increasing batch order. Add new batches after the current highest batch.

## Manual Tabs

- `injuryOutcome`
- `illnessOutcome`
- `injuryTissueType`
- `injuryLocation`
- `illnessRegion`
- `illnessEtiology`
