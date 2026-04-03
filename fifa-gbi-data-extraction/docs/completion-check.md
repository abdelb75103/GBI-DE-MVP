# Completion Check

Created: 2026-03-28

Scope:
- All papers currently live as `processing`
- The single live `uploaded` paper `S584`

Method:
- Checked the live `papers`, `extractions`, and `extraction_fields` tables
- Counted saved extraction tabs and non-empty/reported field rows
- Marked papers as:
  - `populated`: clear saved extraction content exists
  - `partial`: some saved content exists but looks thin
  - `blank`: no saved extraction content exists

Headline result:
- All `26` papers currently live as `processing` are actually populated
- `S584` is still live as `uploaded` and is currently blank in the database

Note on `S584`:
- User instruction says `S584` was just added to `Batch 058` and extracted live, ready for review
- The live database did not yet reflect that at the time of this check: current live status is `uploaded` with `0` extraction rows and `0` saved field rows

## Batch 1

| Study ID | Live status | Assignee | Assessment | Evidence |
| --- | --- | --- | --- | --- |
| S287 | processing | AbdelRahman Babiker | populated | `7` extraction tabs, `47` reported fields |
| S367 | processing | AbdelRahman Babiker | populated | `5` extraction tabs, `16` reported fields |
| S403 | processing | Eamonn Hameid | populated | `7` extraction tabs, `59` reported fields |
| S405 | processing | Eamonn Hameid | populated | `7` extraction tabs, `63` reported fields |
| S407 | processing | Eamonn Hameid | populated | `7` extraction tabs, `46` reported fields |

## Batch 2

| Study ID | Live status | Assignee | Assessment | Evidence |
| --- | --- | --- | --- | --- |
| S408 | processing | Eamonn Hameid | populated | `7` extraction tabs, `52` reported fields |
| S409 | processing | Eamonn Hameid | populated | `7` extraction tabs, `51` reported fields |
| S410 | processing | Eamonn Hameid | populated | `7` extraction tabs, `32` reported fields |
| S411 | processing | Eamonn Hameid | populated | `7` extraction tabs, `56` reported fields |
| S412 | processing | Eamonn Hameid | populated | `7` extraction tabs, `60` reported fields |

## Batch 3

| Study ID | Live status | Assignee | Assessment | Evidence |
| --- | --- | --- | --- | --- |
| S413 | processing | Eamonn Hameid | populated | `9` extraction tabs, `39` reported fields |
| S414 | processing | Eamonn Hameid | populated | `6` extraction tabs, `32` reported fields |
| S416 | processing | Eamonn Hameid | populated | `6` extraction tabs, `37` reported fields |
| S417 | processing | Eamonn Hameid | populated | `7` extraction tabs, `44` reported fields |
| S418 | processing | Eamonn Hameid | populated | `7` extraction tabs, `36` reported fields |

## Batch 4

| Study ID | Live status | Assignee | Assessment | Evidence |
| --- | --- | --- | --- | --- |
| S419 | processing | Eamonn Hameid | populated | `7` extraction tabs, `37` reported fields |
| S420 | processing | Eamonn Hameid | populated | `7` extraction tabs, `31` reported fields |
| S421 | processing | Eamonn Hameid | populated | `7` extraction tabs, `69` reported fields |
| S472 | processing | AbdelRahman Babiker | populated | `6` extraction tabs, `33` reported fields |
| S475 | processing | AbdelRahman Babiker | populated | `7` extraction tabs, `36` reported fields |

## Batch 5

| Study ID | Live status | Assignee | Assessment | Evidence |
| --- | --- | --- | --- | --- |
| S476 | processing | AbdelRahman Babiker | populated | `7` extraction tabs, `43` reported fields |
| S569 | processing | AbdelRahman Babiker | populated | `6` extraction tabs, `27` reported fields |
| S570 | processing | AbdelRahman Babiker | populated | `6` extraction tabs, `11` reported fields |
| S571 | processing | AbdelRahman Babiker | populated | `6` extraction tabs, `15` reported fields |
| S572 | processing | AbdelRahman Babiker | populated | `4` extraction tabs, `6` reported fields |

## Batch 6

| Study ID | Live status | Assignee | Assessment | Evidence |
| --- | --- | --- | --- | --- |
| S573 | processing | AbdelRahman Babiker | populated | `4` extraction tabs, `15` reported fields |
| S584 | uploaded | AbdelRahman Babiker | blank | `0` extraction tabs, `0` reported fields |

## 2026-03-30 Addendum

Purpose:
- Report-only pass requested after the original completion check
- No live DB assignment, status, or extraction changes were made in this pass

Reporting override for this addendum:
- For completion-check reporting, treat all papers still live as `processing` as assigned to `AbdelRahman Babiker`
- This is only a documentation override for review tracking inside this file

Current live `processing` set at the time of this addendum:
- `S287`, `S367`, `S403`, `S405`, `S407`, `S408`, `S409`, `S410`, `S411`, `S412`, `S413`, `S414`, `S416`, `S417`, `S418`, `S419`, `S420`, `S421`, `S472`, `S475`, `S476`, `S584`

Changes relative to the original check above:
- `S569`, `S570`, and `S573` are no longer live `processing`; they are now `flagged`
- `S571` and `S572` are no longer live `processing`; they are now `extracted`
- `S584` is no longer `uploaded`; it is now live `processing`

Headline judgment:
- I am broadly happy with the current metric-field inputs for the live `processing` set
- Most of the remaining caveats are intentional scope decisions, not data-entry mistakes
- The one paper I would explicitly keep on the follow-up list for metric-field review is `S287`
- `S408` is also worth keeping caveated because its denominator is stored from a `1000` match-minute frame rather than the app's usual hour-based frame

Per-paper report:

| Study ID | Completion-check assignee | Judgment | Report note |
| --- | --- | --- | --- |
| S287 | AbdelRahman Babiker | needs follow-up | Extraction is internally consistent, but the paper does not report direct exposure hours. Keep the current sparse/structured fields, but this is the main paper that still needs explicit denominator review before calling the metric inputs fully clean. |
| S367 | AbdelRahman Babiker | acceptable as entered | Intentionally minimal football-only subgroup record. Do not expand with mixed-sport denominators or non-football fields. |
| S403 | AbdelRahman Babiker | acceptable as entered | Pooled single-team extraction is coherent. The unique multi-season player count caveat is already handled by not forcing a synthetic census. |
| S405 | AbdelRahman Babiker | acceptable as entered | Total plus season rows are appropriate, and pooled structured location/type rows are intentionally kept in the total frame. |
| S407 | AbdelRahman Babiker | acceptable as entered | Total plus age-group rows are appropriate. Pooled structured rows are an intentional simplification because the source table does not support a clean age-split mapping for every schema row. |
| S408 | AbdelRahman Babiker | acceptable with caveat | I would not rewrite the current fields, but keep the denominator caveat explicit because the paper reports incidence in `1000` match-minutes and some structured rows are prose-derived. |
| S409 | AbdelRahman Babiker | acceptable as entered | Correctly scoped as a muscle-injury-only cohort. No metric-field change needed unless the project decides muscle-only cohorts should be handled differently. |
| S410 | AbdelRahman Babiker | acceptable as entered | Tournament split is the right live mapping because the paper does not provide clean position-specific denominators. |
| S411 | AbdelRahman Babiker | acceptable as entered | Age-group injury rows are reasonable as entered. Exposure remains pooled intentionally because the age-group exposure table is not directly reported. |
| S412 | AbdelRahman Babiker | acceptable as entered | The live fields follow the Results count instead of the conflicting abstract count. That is the correct call unless the paper is re-adjudicated manually. |
| S413 | AbdelRahman Babiker | acceptable as entered | Injury and illness fields are intentionally sparse and exposure totals remain blank for good reason. No metric-field correction is indicated. |
| S414 | AbdelRahman Babiker | acceptable as entered | `Total / Senior / Youth` is the right split, and leaving exposure totals blank is preferable to deriving them. |
| S416 | AbdelRahman Babiker | acceptable as entered | The structured layer is intentionally limited because the anatomy table is percentage-based. I would not force extra location rows. |
| S417 | AbdelRahman Babiker | acceptable as entered | The player-count caveat is known and documented. The rest of the outcome and structured rows look consistent with the paper’s reporting frame. |
| S418 | AbdelRahman Babiker | acceptable as entered | Leaving `sampleSizePlayers` blank is the correct choice because the paper does not give a clean unique pooled player census. |
| S419 | AbdelRahman Babiker | acceptable as entered | Hamstring-injury-focused outcome framing is intentional and matches the paper’s usable direct tables. |
| S420 | AbdelRahman Babiker | acceptable as entered | The selected subgroup structure and limited structured rows are appropriate to the source tables. No field-level correction stands out. |
| S421 | AbdelRahman Babiker | acceptable as entered | Leaving row-level severity-day fields blank is the right decision because the PDF table text is garbled. The stored rows are otherwise coherent. |
| S472 | AbdelRahman Babiker | acceptable with caveat | Current values are reasonable, but remember the detailed structured location rows come from the `580` analysable-video subset rather than the full `632` headline injuries. |
| S475 | AbdelRahman Babiker | acceptable as entered | The stored `Total` row is explicitly a derived roll-up of the two season rows; that is acceptable and already documented. |
| S476 | AbdelRahman Babiker | acceptable as entered | The paper reports grouped per-season means, and the live fields correctly preserve that scale instead of inventing pooled raw totals. |
| S584 | AbdelRahman Babiker | acceptable pending review | The new `LMF / HMF` extraction looks coherent. Exposure-hour totals and direct match/training injury counts were correctly left blank instead of being back-calculated. |

Summary:
- I do not see a broad clean-up need across the live `processing` set
- I would leave all current metric inputs in place for now
- The only paper I would actively queue for a metric-field follow-up check is `S287`
- `S408` and `S472` should stay explicitly caveated in downstream review because of denominator/frame limitations, but I would not silently rewrite their current inputs
