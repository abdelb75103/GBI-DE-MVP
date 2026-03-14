# Structured Row Mapping

Read this file when filling `injuryTissueType`, `injuryLocation`, or other metric-table tabs.

## Fill Strategy

- Before finalizing a paper, check whether a structured tissue/type or location table contains directly fillable compatible rows.
- Fill all compatible rows rather than stopping after only the broadest categories.
- If a table reports both parent categories and child subcategories, sweep both levels.
- Do not treat a parent bucket as complete if the same table also provides directly mappable subtypes beneath it.
- Do the same check for usable figures when the figure categories map cleanly to the schema.
- Apply the same scan to severity tables and mechanism tables before leaving `injuryMostCommonSeverity`, `injuryContact`, or `injuryNonContact` blank.
- Treat multi-page or continued tables as a single audit unit. Do not stop after the first page of a table if later pages continue the same location, type, mechanism, or severity block.

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

## CI Rule

- Preserve reported `95% CI` values anywhere they are available and relevant to the extracted metric.
- If the schema has a dedicated CI field for that value, use it.
- If the schema does not have a dedicated CI field, store the CI inline in the same cell as `rate (lower to upper)`.
- This applies to metric-table tabs such as `injuryTissueType` and `injuryLocation`, and also to other extracted numeric fields when no separate CI field exists.

## Subsection Rule

- Map each source-table subsection separately.
- If a source table mixes total-injury sections with subsection-specific rows, do not use the subsection rows to fill broader all-injury fields unless that narrower interpretation is explicitly intended.
- Example: an `Overuse injury location` subsection can support overuse-location values only; do not use it to fill generic all-injury location rows by default.

## Severity Rule

- If the source reports days lost per injury or severity by injury type or location, populate the matching severity field using the statistic actually reported.
- If the source reports mean days, enter the plain value.
- If the source reports median days, label it clearly in the value and mention that in the review summary or backlog note.
