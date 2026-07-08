# Structured Row Mapping

Read this file when filling `injuryTissueType`, `injuryLocation`, or other metric-table tabs.

## Fill Strategy

- Before finalizing a paper, check whether a structured tissue/type or location table contains directly fillable compatible rows.
- Fill all compatible rows rather than stopping after only the broadest categories.
- If a table reports both parent categories and child subcategories, sweep both levels.
- Do not treat a parent bucket as complete if the same table also provides directly mappable subtypes beneath it.
- If the live paper is already mapped to a subgroup split such as `Total / subgroup...`, structured-row completeness includes column completeness. Do not leave a row pooled on the first line if the source table reports that same row across subgroup columns.
- When a structured table reports subgroup columns for only one family, expand only that family. Example: if a location table is age-group split but the type table is pooled-only, `injuryLocation_*` should be multiline by subgroup while `injuryTissueType_*` stays total-only.
- For multiline structured fields, use this rule consistently: reported subgroup values occupy their matching subgroup lines; pooled-only values stay on the first `Total` line only; unreported subgroup cells remain blank.
- Do the same check for usable figures when the figure categories map cleanly to the schema.
- Apply the same scan to severity tables and mechanism tables before leaving `injuryMostCommonSeverity`, `injuryContact`, or `injuryNonContact` blank.
- Treat multi-page or continued tables as a single audit unit. Do not stop after the first page of a table if later pages continue the same location, type, mechanism, or severity block.
- Do not let one structured family block another. If `injuryLocation` is subgroup-split but `injuryTissueType` is pooled-only, keep that mixed completion style instead of forcing both tabs into the same row detail.
- Treat structured tabs as metric sweeps, not count-only passes. For every compatible row, check prevalence/count, incidence, burden, severity, diagnosis, and confidence intervals before calling the family complete.

## Completeness Gate

- Do not label a pass `sparse`, `headline-only`, or `outcome only` until you have checked every results table and any usable figure for direct structured rows.
- If later tables contain compatible type, location, severity, or mechanism rows, extract them in the same pass instead of stopping at headline totals.
- If a paper still remains sparse after that scan, record why in the review summary or backlog note, for example: no direct pooled counts, only subgroup-specific rates, or categories too combined for the schema.
- Before calling a paper `review-ready`, explicitly confirm five things:
  - every direct one-to-one structured row was filled
  - every clean parent-field or matching `overall` mapping was filled
  - every directly mappable subtype row under a reported parent category was filled
  - every compatible aggregation was either applied or intentionally rejected with a reason
  - every intentionally blank row category was left blank for a stated mapping reason, not because the table sweep stopped early

## Parent vs Subtype Rule

- Parent buckets and subtype rows are not interchangeable completion states.
- If the table reports a parent row such as `muscle/tendon` and then separately reports `muscle injury`, `muscle contusion`, `tendinopathy`, or `tendon rupture`, capture the parent row and every directly mappable subtype row.
- Leave only the subtype rows blank that truly lack a schema field or are reported as zero-only placeholders.

## Aggregation Rule

- If multiple directly reported subrows clearly belong to the same structured location or tissue/type category and share the same denominator, aggregate them into the matching structured category.
- When categories are broader or combined in a way that does not map cleanly, fill only the rows that are clearly justified and note which combined categories were intentionally not forced into narrower rows.
- If the source reports a combined category and the schema has a matching combined `overall` field, use that combined field instead of leaving the row blank.
- Example: map `head/face/neck` to `injuryLocation_head_neck_overall`, not to separate `head` or `neck` rows.
- If the source reports a narrower combined label that still maps cleanly into a single schema parent field, use the parent field.
- Examples: map `head/face` to `injuryLocation_head`; map `shoulder/clavicle` or `shoulder/clavicular` to `injuryLocation_shoulder`.
- If the source splits a schema parent field into adjacent subrows that clearly belong together, aggregate them only when that mapping is transparent.
- Example: `calf` plus `Achilles tendon` may be combined into `injuryLocation_lower_leg` when both rows belong to the same denominator frame and no cleaner standalone lower-leg row is reported.

## Diagnosis Rule

- If the paper explicitly reports key diagnoses such as concussion or anterior cruciate ligament injury, populate the matching structured row or diagnosis row instead of leaving it blank.
- Do not duplicate a diagnosis in the free-text `injury diagnosis` row when that same condition is already captured in a structured row.
- For specific-injury cohorts, do not fill most-common diagnosis, type, or location with the target injury itself unless the paper reports a broader injury mix.

## CI Rule

- Preserve reported `95% CI` values anywhere they are available and relevant to the extracted metric.
- If the schema has a dedicated CI field for that value, use it.
- If the schema does not have a dedicated CI field, store the CI inline in the same cell as `rate (lower - upper)`.
- This applies to metric-table tabs such as `injuryTissueType` and `injuryLocation`, and also to other extracted numeric fields when no separate CI field exists.

## Definitions Rule

- Normalize `injuryDefinition` to one label: `physical complaint`, `all complaints`, `time loss`, or `medical attention`.
- Put qualifying scope in brackets after the label, e.g. `time loss [>3 days]` or `time loss [hamstring injuries only]`.
- If the paper's wording is ambiguous, workflow-based, or not fully formalized, choose the closest defensible standardized label and record the ambiguity in the backlog note.
- Whenever any incidence, prevalence, burden, or rate field is extracted, make sure `incidenceDefinition` states the denominator frame explicitly.
- Prefer forms such as `per 1000 player-hours`, `per 1000 athlete-exposures`, `per 100 players`, `per player-season`, or `per training day`.
- If the denominator basis is only partly clear, store the shortest accurate incidence-definition text you can support and note the uncertainty in the review summary or backlog note instead of leaving the field vague.

## Subsection Rule

- Map each source-table subsection separately.
- If a source table mixes total-injury sections with subsection-specific rows, do not use the subsection rows to fill broader all-injury fields unless that narrower interpretation is explicitly intended.
- Example: an `Overuse injury location` subsection can support overuse-location values only; do not use it to fill generic all-injury location rows by default.

## Severity Rule

- If the source reports days lost per injury or severity by injury type or location, populate the matching severity field using the statistic actually reported.
- If the source reports mean days, enter the plain value.
- If the source reports median days, label it clearly in the value and mention that in the review summary or backlog note.
- Never put burden metrics into `severityTotalDays`, `severityMeanDays`, or other raw-days fields unless the paper actually reports total, mean, or median days lost for that exact row. Burden belongs in `..._burden`.

## Mechanism And Onset Rule

- Classify each source-table row family before mapping: tissue/diagnosis rows go to `injuryTissueType`, location/body-region rows go to `injuryLocation`, onset rows go to `injuryMode...`, and mechanism rows stay in mechanism/contact fields.
- Do not aggregate overuse rows into `injuryTissueType_muscle_tendon` when overuse is reported as an onset category rather than a tissue diagnosis.
- For count-style onset rows, do not invent subgroup counts from percentages unless the paper prints a stable subgroup injury denominator.
- If the reviewer explicitly wants percentage fallbacks, store percentages with a `%` suffix and note that they are not true counts.

## Figure Rule

- Use figure-derived values only when the figure is readable enough to support defensible extraction.
- Restrict figure-derived rows to missing compatible rows.
- Mark figure-derived rows with lower confidence/page hint when the workflow supports it.
- Do not let a figure estimate overwrite a direct table/text value.

## Percentage-To-Count Rule

- If a paper reports clean percentages over a clearly stated numerator for compatible outcome, location, type, mechanism, or foul-play rows, convert to absolute counts only when defensible.
- Use the nearest whole-number count and keep it compatible with the printed subtotal.
- Do not derive counts from unclear, mixed, or overly rounded denominators.
- Record in the backlog that the stored count was percentage-derived and name the denominator.
