---
name: gbi-live-extraction
description: Use the terminal-first workflow for staged manual-tab extraction in the FIFA GBI repo. Use this when a user wants help extracting all tabs from a paper PDF, reviewing the draft in chat, and applying approved values to the live Supabase-backed site without touching the UI.
---

# GBI Live Extraction

Run all commands from `fifa-gbi-data-extraction/`.

Track review state in `docs/review-backlog.md`.

## Default Interpretation

- Treat requests to "update the process" after a paper review as requests to update this skill, not the app's user-facing extraction instructions.
- When a reviewer correction reveals a reusable extraction rule, recurring miss, or clearer convention, update this skill in the same turn before continuing with later papers. Treat that maintenance step as part of the extraction workflow, not optional cleanup.
- Prefer additive-only live updates. Do not overwrite nonblank extraction values unless the user explicitly asks for a correction.
- Default to the terminal-first manual extraction workflow. Do not call Gemini or use AI suggestions unless the user explicitly asks for that.
- Extract Tabs `1-10` manually in the terminal/chat workflow. Do not use Gemini-generated passes for `studyDetails`, `participantCharacteristics`, `definitions`, `exposure`, `injuryOutcome`, `illnessOutcome`, `injuryTissueType`, `injuryLocation`, `illnessRegion`, or `illnessEtiology`.
- If `./scripts/terminal-extract.sh` is not present in this checkout, fall back to the direct terminal workflow:
  - inspect the local PDF/text manually
  - use the repo schema/types as the source of truth for field ids
  - apply approved live changes through direct Supabase terminal writes
  - record rationale and follow-up notes in `docs/review-backlog.md`

## Workflow

1. If available, run `bash -lc './scripts/terminal-extract.sh prep --paper <paperId|studyId>'`.
   - If the script is missing, create a local working folder, fetch or inspect the paper PDF/text directly, and proceed manually.
   - When a user asks for the "next available" paper or batch, treat `available` as `unassigned` first. Before selecting any paper, verify its live `assigned_to` value and exclude any paper already assigned to another profile, even if its status might otherwise look batchable.
2. If the paper is ambiguous, identify the intended subgroup before extracting. Read `references/subgroup-selection.md` when the right line mapping is not obvious.
   - For trials or controlled comparisons, check first whether the paper reports clean arm-level tables. If it does, default to arm-level line mapping instead of a pooled row.
   - If the paper reports clean age-group rows, default to an age-group split instead of a pooled-only line.
   - If the paper's main analysis is reported through another direct subgroup axis such as maturity status, menstrual-cycle phase, skill group, sex, or playing level, default to that split instead of a pooled row when the subgroup tables are clean and central to the paper's results.
   - When using an age-group split, put `Total` as the first row whenever the paper also reports pooled whole-cohort values.
   - For age-group splits, keep pooled-only metrics in the `Total` row rather than deriving subgroup values that the paper does not report directly.
   - Once a split is chosen, keep subgroup rows only for fields where the paper actually reports or implies subgroup differences. If a participant-characteristic field is global and identical for the whole paper, store it once as a single universal value rather than repeating the same line across every subgroup row. Example: use a single `male` or `Croatia` when that applies to the full cohort, but keep `U9 / U11 / U13 / U15` for `ageCategory` because that field is the actual split.
   - Exception for `sex` in subgroup papers: if a split is being shown live and a plain global sex value would hide which row is which, label the sex rows with the subgroup names instead of repeating a bare identical value. Example: `female - control`, `female - intervention` or `female - RR`, `female - RX`, `female - XX`.
3. If available, run `bash -lc './scripts/terminal-extract.sh extract --paper <paperId|studyId> --tab <manual-tab> --guidance "<user instruction>"'`.
   - If the script is missing, stage the proposal manually from the local source text and the live schema.
4. Review the staged output with `bash -lc './scripts/terminal-extract.sh review --paper <paperId|studyId>'` when available.
   - If the script is missing, review the proposed values directly against the source tables/figures before any live apply.
   - For any non-excluded extracted paper, Tabs `1-10` are manual review scope. Do not call a paper extracted-and-ready-for-review unless the directly relevant tabs have been checked field-by-field against the paper, with Tabs `1-4` always included and Tabs `5-10` reviewed whenever the paper reports compatible data for them.
   - If a paper already has Tabs `1-5` live but the source tables clearly support compatible structured rows for Tabs `7-8`, create those missing structured tabs rather than leaving the paper as a headline-only pass.
   - In `studyDetails`, always explicitly verify `leadAuthor`, `title`, `yearOfPublication`, `journal`, `doi` if present in the paper, and `studyDesign`.
   - Format `leadAuthor` as `Surname Initials` using the first author's published initials, not surname only. Examples: `Zebis MK`, `Kakavelakis KN`, `Szymski D`.
   - Treat `studyId` as display-only and system-seeded in Tab `1`, not as an extraction target. Preserve the app-assigned `studyId`; do not manually rewrite, replace, clear, or re-extract it during refreshes or corrective passes.
   - Treat Tab `2` (`participantCharacteristics`) as a completeness-checked tab, not a light pass. Explicitly verify `country`, `fifaDiscipline`, `levelOfPlay`, `ageCategory`, `sex`, `sampleSizePlayers`, `numberOfTeams`, `meanAge`, and `observationDuration` whenever the paper reports or clearly implies them.
   - When a paper gives a season or study window, preserve the year context in `observationDuration` rather than shortening it to a generic count. Example: `2009-2010 competitive season (33 weeks)`, not just `33 weeks`.
   - Do not leave easy participant fields blank when they are obvious from the paper context. If the cohort is clearly from one country, one football code, one level of play, one study window, or one club/team structure, fill `country`, `fifaDiscipline`, `levelOfPlay`, `observationDuration`, and `numberOfTeams` directly rather than leaving them empty.
   - Standardize `fifaDiscipline` to the schema’s exact supported values. Use `Association football (11-a-side)`, `Futsal`, `Beach soccer`, or `Para football` when applicable; do not leave non-standard free text such as `football` when the correct standardized option is obvious.
   - When a paper is stored as a subgroup split, keep `participantCharacteristics` row-by-row only for fields that truly vary by subgroup. If `country`, `levelOfPlay`, `fifaDiscipline`, `numberOfTeams`, `observationDuration`, or similar fields are identical across the whole paper, a single universal value is preferred over repeating the same line on every subgroup row. For `sex`, prefer a single universal value unless the live split would become ambiguous; in that case use subgroup-labeled sex rows such as `female - control` or `male - U17`.
   - Treat Tabs `3-4` as mandatory extraction work, not filler tabs. Before leaving `definitions` or `exposure` sparse, explicitly check for directly reported values for `injuryDefinition`, `illnessDefinition`, `incidenceDefinition`, `burdenDefinition`, `severityDefinition`, `recurrenceDefinition`, `mechanismReporting`, `seasonLength`, `numberOfSeasons`, `exposureMeasurementUnit`, `totalExposure`, `matchExposure`, and `trainingExposure`.
   - `mechanismReporting` should name the person or role reporting the injury data itself, using the shortest accurate reporter label such as `Medical Staff`, `Coach`, or `Player-selfreported`. Do not put mixed workflow prose there, and do not replace the injury reporter with the person who logged exposure if those were different.
   - If a paper reports exposure in non-hour denominators such as athlete-exposures, player-months, player-days, or match-minutes, still fill Tab `4` using the direct denominator rather than leaving exposure blank, and set `exposureMeasurementUnit` to the closest supported value or `other` when needed.
   - If a field in Tabs `1-4` is checked and genuinely not reported, leave it as `not_reported`; do not skip it just because a tab looks secondary.
   - Before calling a pass `sparse`, `headline-only`, or `outcome only`, scan all results tables and usable figures for directly fillable `injuryTissueType`, `injuryLocation`, severity, and mechanism/contact rows. Read `references/structured-row-mapping.md` when the paper has more than one outcome table.
   - For `injuryTissueType` and `injuryLocation`, do not stop at parent buckets if the same table also reports directly mappable subtypes or subregions.
   - Treat Tabs `7-8` as metric sweeps, not count-only passes. If a compatible row family reports prevalence/count, incidence, burden, and/or severity in the source table, check and fill every directly mappable metric for that row family before calling the tab complete.
   - Do not treat parent-category counts from one table as completion of subtype metrics from another table. If a later table or figure reports directly mappable subtype incidence, burden, diagnosis, or severity rows, sweep that later table separately and add those fields too.
   - If an injury-type table reports an `other`, `other injury`, or similarly residual diagnosis/tissue bucket that cannot be mapped more specifically, store it under `injuryTissueType_non_specific_tissue`.
   - If a paper already has extracted `injuryTissueType` or `injuryLocation` rows, also scan for matching directly mappable severity totals, severity means/medians, incidence rows, burden rows, and diagnosis rows and add them as a follow-up when available, not just counts.
   - When a structured row has already been filled with prevalence/count, explicitly verify whether the same source row or row family also reports incidence, burden, mean/median days lost, total days lost, or named diagnoses before leaving the row family incomplete.
   - Use source priority in this order for structured rows: direct table values first, explicit prose summaries second, readable figures third. Do not let a figure estimate overwrite a direct text/table value for the same row.
   - Use readable figures to support completeness when the paper clearly shows additional compatible location/type rows that are not quantified in the prose or tables.
   - When adding figure-derived rows, restrict them to rows that are missing from the direct text/table extraction, store them as estimates rather than direct counts, and mark them with lower confidence plus a figure page hint.
   - Never put burden metrics into `severityTotalDays`, `severityMeanDays`, or other raw-days fields unless the paper actually reports total days lost or mean/median days lost for that exact row. Burden belongs in `..._burden` fields only.
   - If a location/type subtype table reports named diagnoses such as `ACL rupture`, `ankle sprain`, `hamstring strain`, `foot fracture`, `tendinopathy`, or `tendon rupture`, map them into the closest diagnosis/subtype row when the schema supports it, or note explicitly in the backlog why they were left blank.
   - When multiple directly reported subtype rows map cleanly into one schema row and share the same denominator, you may aggregate not just prevalence/count but also incidence and burden into that schema row. Record the aggregation explicitly in the backlog note.
   - If the paper reports clean percentages over a clearly stated numerator for injury outcome fields, injury location, type, mechanism, foul-play, or similar compatible rows, convert those percentages into absolute counts and store them in the appropriate fields when the mapping is defensible. Record in the backlog note that those counts were percentage-derived rather than directly printed as raw counts.
   - Only do this percentage-to-count conversion when the base numerator is explicit and stable (for example `58` total injuries or `53` traumatic injuries). Do not derive counts from percentages when the denominator is unclear, mixed across subgroups, or obviously rounded too coarsely to support a reliable count.
   - When converting percentages to counts, use the nearest defensible whole-number count and make sure the result stays compatible with the paper’s stated subtotal. If several rounded percentages compete and cannot all be made internally consistent, prefer leaving the row blank over forcing a misleading count.
   - For count-style fields such as mode-of-onset rows, do not invent subgroup counts from percentages unless the paper prints a stable subgroup injury denominator. If a reviewer explicitly wants those rows filled anyway and only percentages are available, store the percentages with a `%` suffix and note clearly in the backlog that the onset rows are percentage fallbacks rather than true counts.
   - When a reported count, incidence, burden, or similar extracted value includes a `95% CI`, preserve it during this review step using the schema’s dedicated CI field when available, otherwise inline after the value itself.
   - If a dedicated CI field exists for a metric, store the base estimate in the main field and the interval only in the dedicated CI field. Do not duplicate that same CI inline in the estimate field.
   - Standardize inline confidence interval formatting as `estimate (lower-upper)` even if the paper uses commas, `to`, brackets, or another delimiter. Example: `2.7 (2.2-3.2)`.
   - Use this completion checklist before calling any paper `review-ready`:
     - line mapping confirmed against the strongest directly reported subgroup axis
     - all location/type/mechanism/severity tables or figures scanned through their final continuation page
     - all clean one-to-one rows filled
     - all clean parent-field or `overall` mappings filled
     - all directly mappable subtype rows under any filled parent bucket also checked and filled
     - every filled structured location/type row family checked for reported prevalence/count, incidence, burden, severity, and diagnosis metrics rather than stopping after the first compatible metric
     - Tabs `1-4` checked and filled, with any missing first-tab fields intentionally left `not_reported` rather than skipped
     - Tab `2` specifically checked for direct participant fields including `country` and `fifaDiscipline`
     - Tabs `3-4` specifically checked for all direct definition and exposure fields before calling the paper review-ready
     - `observationDuration` checked anywhere it appears and kept year-specific when the source reports a season or study window
     - `mechanismReporting` explicitly checked for the injury reporter role rather than the exposure logger or a workflow description
     - `studyId` preserved as the app-assigned value
     - all reported `95% CI` values either stored in their dedicated field or appended inline where no CI field exists
     - any compatible subrow aggregations noted
     - any intentionally blank combined or incompatible rows noted
     - any still-sparse paper has an explicit reason recorded
5. Summarize the proposal and wait for explicit approval before applying.
   - Always state the line mapping, whether a stronger subgroup split replaces a pooled line, whether the update is additive-only or corrective, any compatible subrow aggregations, any proportion-derived participant counts, any median-labeled severity values, any tables or figures scanned for structured rows, and any intentionally blank fields.
   - In the summary, call out any preserved season-year wording in `observationDuration` and where reported `95% CI` values were stored, especially when a dedicated CI field was used instead of inline text.
   - If exposure or incidence rows come from a subset but sample size comes from the full cohort, keep the direct values but call out that denominator mismatch explicitly in the backlog note.
   - If a value is derived rather than directly reported, say so explicitly in the backlog note instead of presenting it as though it were a direct paper value.
   - This applies to percentage-derived counts as well: if you convert percentages into absolute counts for structured rows, note the source denominator and that the stored count was derived from reported percentages.
   - This also applies to figure-derived counts: if you estimate row values from a graph, note that the stored row was figure-derived, that text/table values took precedence where available, and that the figure was used only for missing compatible rows.
6. Only after approval, run `bash -lc './scripts/terminal-extract.sh apply --paper <paperId|studyId>'` when available.
   - If the script is missing, apply approved changes through direct Supabase terminal writes.
7. Leave live status changes to the user unless they explicitly ask for one.
   - When the user says a whole batch is complete, mark each row in that batch `✅ reviewed_complete`, set any remaining in-scope paper statuses to `extracted`, and add `Completed: YYYY-MM-DD` to that batch section in `docs/review-backlog.md`.

## Safety

- Always dual-write structured tab rows. Any field stored in `population_values` must also have a corresponding `extraction_fields` entry (newline-separated Total/arm values) under that tab's `extraction_id` — this applies to `injuryLocation`, `injuryTissueType`, and all other structured-row tabs.
- Use the shortest accurate field value. Do not write full prose definitions or repeat context the schema label already provides. Examples: `injuryDefinition: "time-loss"`, `exposureMeasurementUnit: "player-hours"`, `observationDuration: "6 months (2012/2013)"`.
- Never use `apply` without explicit user approval.
- Do not pass `--allow-empty-overwrite` unless the user explicitly wants blank values to replace existing data.
- If a staged draft already exists, do not use `prep --force` unless the user wants to discard it.
- Preserve existing live manual edits unless the user explicitly approves changing populated values.
- For papers awaiting user review, prefer live status `processing` rather than `extracted`.
- Do not describe a paper as `review-ready` if the structured-table completion checklist has not been satisfied.
- Never treat a paper as available for a new batch if `assigned_to` is already set to another profile. `available` queue selection must exclude all papers already assigned to someone else.
- `Available` means truly unassigned, not merely `uploaded`.
- Before creating any new batch, explicitly verify the `assigned_to` value for each candidate paper. If any candidate is already assigned, skip it and move to the next truly unassigned paper instead of touching, tagging, or reassigning it.
- If you discover after the fact that a paper in a batch was already assigned to someone else, record that audit issue in `docs/review-backlog.md`, do not describe it as newly available work, and do not use that paper as justification for future queue selection.
- Any paper touched during live extraction or exclusion work should be assigned to `AbdelRahman Babiker` only if it is truly unassigned and legitimately part of the current queue. Do not overwrite another extractor's existing assignment just because the paper was selected by mistake.
- Put rationale, caveats, and review commentary in the backlog by default rather than as live paper notes.
- Only UEFA Elite Club study-family papers should be tagged `uefa`. Do not exclude a paper as `uefa` just because it is UEFA-branded or takes place in a UEFA competition.
- Exclusion papers should keep their true live statuses while pending review. Do not normalize `american_data`, `systematic_review`, `uefa`, `referee`, or other exclusion statuses to `processing` just because they are still awaiting manual review.
- If a paper appears to be a companion sub-study of an already extracted cohort, flag that to the user before treating it as routine new extraction work.
- If a local PDF is image-only or not machine-readable, a sparse abstract-level pass is allowed only if that limitation is stated explicitly in the backlog note.
- Use figure-driven values only when the figure is readable enough to support a defensible extraction. If the figure text, labels, or plotted values are not legible, stay text/table-only rather than guessing or over-interpreting the figure.
- If a reported days-lost field is labeled as median or `median (IQR)`, do not describe it as mean. If the schema only offers a generic severity-days field for that row, store the reported median value there and note the median labeling clearly in the backlog/review commentary.
- When normalizing inline uncertainty text, convert confidence intervals to range form only. Do not rewrite non-CI statistics such as SD, IQR, or raw ranges into CI-style notation.
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
