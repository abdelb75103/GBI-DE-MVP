---
name: gbi-live-extraction
description: Use when extracting, reviewing, applying, QA-checking, or batch-processing FIFA GBI paper data.
---

# GBI Live Extraction

Default project path: `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction`.

When local scripts are explicitly requested, run them from `fifa-gbi-data-extraction/`. Track general review state in `docs/review-backlog.md`; track second-search extraction in `docs/second-search-extraction-review-backlog-2026-07-03.md` (Backlog 2).

## Core Defaults

- Treat requests to "update the process" after a paper review as requests to update this skill, not the app's user-facing instructions.
- Extract Tabs `1-10` manually. Do not use Gemini-generated passes for `studyDetails`, `participantCharacteristics`, `definitions`, `exposure`, `injuryOutcome`, `illnessOutcome`, `injuryTissueType`, `injuryLocation`, `illnessRegion`, or `illnessEtiology` unless Abdel explicitly asks for Gemini in the current request.
- For project AI functions, work inline in Codex chat by default and apply results from the current workspace workflow. Do not hand extraction work off to terminal scripts unless Abdel explicitly asks for that path. Default to GPT-5.5 with medium reasoning when available; if unavailable, use the closest suitable local Codex/OpenAI model with explicit reasoning, record the model used, and explain the substitution before applying results.
- When a task corrects a live-backed paper locally, do not stop at the local artifact unless Abdel explicitly says `local-only` or `dry-run`. Carry the corresponding live sync through in the same task, including replacement PDFs/storage objects and corrected `ai_*` fields where applicable, then verify the written hashes/values.
- An explicit request to extract, review, apply, correct, refresh, or batch-process live records authorizes the complete default workflow through live apply and the required review gate. Do not pause for a separate apply confirmation unless Abdel says `local-only`, `dry-run`, or explicitly asks to review a proposal first.
- Separate full-text screening from downstream extraction status. Do not keep a football-specific direct specific-injury, specific-illness, or case-only current-participant cohort in the screening stream when it lacks an at-risk denominator; exclude it at full text for no usable denominator. If the paper uses current-season club or team medical reports from current players, do not default to a retrospective-design exclusion on the label alone; when exposure is still missing, the decisive reason is the denominator failure.
- Re-run the denominator check before applying an extraction whenever the source notes say exposure is unavailable, not reported, or not back-calculated. A headcount, injury count, percentage, annual player proportion, or incomplete match/training subset is not a usable denominator. Unless the source also gives an accepted denominator (exposure hours, athlete-/match-exposures, a study-specific usable rate, or exact inputs for a defensible derivation), set the paper to `flagged` with `flag_reason` `No exposure - exclude`, update the backlog as `🚩 flagged_for_exclusion`, and preserve all human screening votes.
- Treat conference abstracts, supplement abstracts, and citation/abstract pages as `Abstract` at full text. Do not force them into denominator, public-source, or study-design exclusion buckets when the real issue is that no full paper is available.
- Treat league or MLS injury-surveillance database papers as eligible when the paper reports football-specific rates from current-player surveillance and the database is only the reporting channel. Do not auto-exclude them for denominator failure just because raw exposure totals are omitted.
- Do not classify a study as public-source-only merely because it mentions Transfermarkt or other public media. Verify whether primary outcomes come from club, medical, registry, insurer, or surveillance reporting, and whether public data are only a validation or comparison layer.
- When an exclusion rule names specific surveillance systems, verify source-system ownership and geographic scope. Organizational affiliation is not dataset equivalence.
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
- Read `references/web-app-extraction-attachment-contract.md` before attaching or replacing a translated PDF in the live extraction path.
- Read `references/review-gate.md` for the pre-apply completeness check and focused post-apply integrity gate.

For parallel batches, the coordinator loads only coordination rules. Each batch agent loads the paper-level references it actually needs; do not make the coordinator reread extraction references or source evidence that the agent owns.

## Workflow

1. Prepare the paper.
   - Inspect the PDF/text directly, use repo schema/types as source of truth, and prepare the work inline in Codex chat.
   - If a cached local PDF SHA-256 differs from the registered paper-file hash, discard the cache and inspect the matching live attachment before staging any payload.
   - For a translated-PDF follow-up, preflight `papers` plus `paper_files` before uploading. Live extraction supports one `paper_files` row per paper; use a new versioned storage object and guarded pointer replacement, not a second-row insert. Preserve and verify the original object by exact path and SHA-256.
   - When selecting a "next available" paper, verify `assigned_to` first. `Available` means truly unassigned, not merely `uploaded`; assign selected papers to AbdelRahman Babiker before extraction unless instructed otherwise.
   - For a second-search `next batch`, select any five unprocessed records already promoted to the live extraction phase after two-human full-text screening. Do not select from the retired AI-plus-one-human bridge or require study-ID order. Set selected records to `processing`, then add them to the next numbered Backlog 2 batch as `⏲️ pending_review` after extraction and the review gate.
   - For a requested parallel Backlog 2 run, the coordinator first reserves every selected record in one conditional live update, creates all numbered five-paper batch rows, then assigns exactly one fresh-context agent to each batch. An agent may update only its own five rows. Never replace an excluded/systematic-review paper: it remains one of the five batch members with its correct live/backlog status.
   - After conditional reservation or status updates, reconcile returned IDs immediately; a malformed identifier can produce partial success even when every accepted row met its guard conditions.
   - After delegation, do not poll agents or inspect intermediate DB/artifact state. Wait for completion unless an agent reports failure, goes silent beyond a reasonable batch runtime, or Abdel asks for status.
   - Preserve the exact five-record batch membership even when a source is correctly tagged as an exclusion; keep the row and any directly reported population/year split instead of replacing it with a pooled fallback.
2. Choose population rows before filling fields.
   - Use the strongest directly reported axis: study arm, sex, age group, competition level, team/region, season, surface, tournament phase, or another explicit cohort split.
   - If pooled and subgroup values both exist, use `Total / subgroup...` unless the source table gives a more defensible order.
   - If subgroup-only values exist and no pooled total is reported, do not invent a `Total` row.
   - Shared/global values go on the first row only; subgroup-specific values go on matching rows; blanks preserve row alignment.
3. Extract manually.
   - Stage values manually from the source text/PDF and live schema in Codex chat by default.
4. Complete the source-to-payload check before apply.
   - Review inline in the same batch-agent pass; do not start a second reviewer or reread the paper after apply.
   - Check Tabs `1-4` for every included paper, and Tabs `5-10` whenever compatible outcome, structured, illness, or mechanism data exists.
   - Before calling a paper ready, scan all results tables and usable figures for location, type/diagnosis/tissue, severity, mechanism/contact, incidence, burden, and CI values.
   - Confirm population alignment, canonical definitions, match/training orientation, recurrence, common outcomes, every compatible structured metric (count, incidence, burden, severity, CI), and reasons for intentionally blank structured families.
   - Fix completeness blockers in the staged payload before the dry run.
5. Summarize the intended live update, then apply as part of the same request.
   - State line mapping, additive vs corrective scope, source tables/figures scanned, derived/aggregated values, missing-but-checked items, and any reviewer caveats in the backlog/review output.
   - Stop before apply only when Abdel explicitly requests `local-only`, `dry-run`, or proposal review before apply.
6. Apply changes.
   - Apply through direct Supabase writes by default.
   - Always dual-write structured rows: any value in `population_values` must have the matching newline-aligned `extraction_fields` value.
7. Run the focused live integrity gate.
   - Use `references/review-gate.md`.
   - The same batch agent runs it immediately after apply. It verifies live integrity and exact source-to-live transfer; it is not a second extraction review.
   - Fix blockers and rerun only the changed paper before saying it is ready for human review.
   - Do not add cross-agent or coordinator field-level review for routine batches. Human review is the next substantive extraction review.
8. Manage status only when asked.
   - When the user says a batch is complete, mark each row `✅ reviewed_complete`, set remaining in-scope live statuses to `extracted`, and add `Completed: YYYY-MM-DD`.
   - When the user says to flag a paper for exclusion, set its live and backlog status to `flagged`, state the exclusion reason in the backlog Notes, and mark it `✅ reviewed_complete` when the user says its review is complete. A flagged exclusion is not itself a pending-review state.
   - Otherwise leave live statuses alone.

## Fast Parallel Batch Handoff

- Use `references/parallel-batch-agent-prompt.md`; substitute only batch number and five IDs instead of composing a long custom brief.
- Each batch agent returns one completion message with: five fixed IDs, classification/status, population labels/count, source sections scanned, apply result, integrity-gate result, caveats, and artifact paths.
- Persist only the batch input and one final live audit by default. A separate correction audit is warranted only when a post-apply correction was actually required; do not create reservation, progress, duplicate dry-run, or duplicate verification artifacts.
- The coordinator runs one lightweight final query across all batches for exact membership, assignment, status, population count/layout, and backlog-row presence. Do not re-query all fields, hashes, votes, or source tables when the agent gate passed.
- Report completion from those two evidence layers. Additional review is triggered only by a failed gate, conflicting evidence, protected-field change, or explicit user request.

## Field Rules

- Use `references/field-completeness.md` for core metadata, canonical definitions, denominator-explicit incidence, status, and assignment.
- Use `references/structured-row-mapping.md` for outcome/structured sweeps, CIs, severity statistics, readable figures, and specific-injury cohorts.
- Use `references/direct-vs-derived-values.md` before any arithmetic; never infer exposure/counts from rates.
- Before review handoff, compare game/match versus training counts directly against the source table orientation; text extraction can be column-first and make row-order swaps look plausible.
- Keep consequence class separate from duration severity, and broad descriptive records separate from exposure-aligned rate cases. Never derive time loss solely from positive recorded days.
- `apply-second-search-extraction-json.mjs` dry-runs do not simulate new multiline fields before population sync. Validate field IDs separately before applying population-layout changes.

## Safety

- Do not use `--allow-empty-overwrite` unless the user explicitly asks to blank existing values.
- Do not call an extraction `review-ready` until the pre-apply completeness checklist and focused post-apply integrity gate in `references/review-gate.md` are satisfied.
- Do not classify exclusion papers as `processing` just because they are awaiting review; preserve true exclusion statuses such as `american_data`, `systematic_review`, `uefa`, or `referee`.
- Tag U.S. High School RIO, NCAA, and national U.S. surveillance studies as `american_data` rather than leaving them in `processing`.
- Only UEFA Elite Club study-family papers should be tagged `uefa`.
- If a paper appears to be a companion sub-study, flag it before treating it as routine new extraction work.
- If a local PDF is image-only or not machine-readable, a sparse abstract-level pass is allowed only if that limitation is stated explicitly.
- Keep `docs/review-backlog.md` in strictly increasing batch order. Add new batches after the current highest batch.
