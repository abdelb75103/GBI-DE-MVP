# Structured Row Mapping

Read this file when filling `injuryTissueType`, `injuryLocation`, or other metric-table tabs.

## Fill Strategy

- Before finalizing a paper, check whether a structured tissue/type or location table contains directly fillable compatible rows.
- Fill all compatible rows rather than stopping after only the broadest categories.
- Do the same check for usable figures when the figure categories map cleanly to the schema.
- Apply the same scan to severity tables and mechanism tables before leaving `injuryMostCommonSeverity`, `injuryContact`, or `injuryNonContact` blank.

## Completeness Gate

- Do not label a pass `sparse`, `headline-only`, or `outcome only` until you have checked every results table and any usable figure for direct structured rows.
- If later tables contain compatible type, location, severity, or mechanism rows, extract them in the same pass instead of stopping at headline totals.
- If a paper still remains sparse after that scan, record why in the review summary or backlog note, for example: no direct pooled counts, only subgroup-specific rates, or categories too combined for the schema.

## Aggregation Rule

- If multiple directly reported subrows clearly belong to the same structured location or tissue/type category and share the same denominator, aggregate them into the matching structured category.
- When categories are broader or combined in a way that does not map cleanly, fill only the rows that are clearly justified and note which combined categories were intentionally not forced into narrower rows.
- If the source reports a combined category and the schema has a matching combined `overall` field, use that combined field instead of leaving the row blank.
- Example: map `head/face/neck` to `injuryLocation_head_neck_overall`, not to separate `head` or `neck` rows.
- If the source reports a narrower combined label that still maps cleanly into a single schema parent field, use the parent field.
- Examples: map `head/face` to `injuryLocation_head`; map `shoulder/clavicle` or `shoulder/clavicular` to `injuryLocation_shoulder`.

## Diagnosis Rule

- If the paper explicitly reports key diagnoses such as concussion or anterior cruciate ligament injury, populate the matching structured row or diagnosis row instead of leaving it blank.
- Do not duplicate a diagnosis in the free-text `injury diagnosis` row when that same condition is already captured in a structured row.

## Inline CI Rule

- Metric-table tabs such as `injuryTissueType` and `injuryLocation` do not have a separate structured `95% CI` field for incidence rows.
- If the paper reports incidence together with its CI and the user wants the CI preserved there, store it inline in the same cell as `rate (lower to upper)`.

## Subsection Rule

- Map each source-table subsection separately.
- If a source table mixes total-injury sections with subsection-specific rows, do not use the subsection rows to fill broader all-injury fields unless that narrower interpretation is explicitly intended.
- Example: an `Overuse injury location` subsection can support overuse-location values only; do not use it to fill generic all-injury location rows by default.

## Severity Rule

- If the source reports days lost per injury or severity by injury type or location, populate the matching severity field using the statistic actually reported.
- If the source reports mean days, enter the plain value.
- If the source reports median days, label it clearly in the value and mention that in the review summary or backlog note.
