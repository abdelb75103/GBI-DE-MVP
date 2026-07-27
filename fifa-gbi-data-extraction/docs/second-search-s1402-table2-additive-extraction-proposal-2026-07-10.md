# S1402 Table 2 additive extraction proposal — second search — 2026-07-10

## Scope

Focused review of live paper S1402 (Marques et al., 2024; DOI 10.3389/fspor.2024.1363006). This is a local proposal only. No live database fields, human votes, screening status, or resolver fields were changed.

Existing live population rows are `Elite`, `Sub-elite`, `Amateur`, in that order. Existing headline fields were preserved.

## Direct additional values from Table 2

The source prints percentages, not absolute injury counts. The values below should be stored with the `%` suffix in the structured `prevalence` field as percentage fallbacks, not treated as counts.

### Injury location — body-location parent rows

| Field | Elite | Sub-elite | Amateur |
| --- | --- | --- | --- |
| `injuryLocation_lower_limb_overall_prevalence` | 30.8% | 25.6% | 25% |
| `injuryLocation_trunk_overall_prevalence` | 7.7% | blank | blank |
| `injuryLocation_upper_limb_overall_prevalence` | blank | 5.1% | blank |

### Injury location — anatomical-region rows

| Field | Elite | Sub-elite | Amateur |
| --- | --- | --- | --- |
| `injuryLocation_ankle_prevalence` | 23.1% | 2.6% | 6.3% |
| `injuryLocation_knee_prevalence` | 7.7% | 2.6% | 12.5% |
| `injuryLocation_lumbosacral_prevalence` | 7.7% | blank | blank |
| `injuryLocation_thigh_prevalence` | blank | 10.3% | 6.3% |
| `injuryLocation_groin_prevalence` | blank | 5.1% | blank |
| `injuryLocation_foot_prevalence` | blank | 2.6% | blank |
| `injuryLocation_elbow_prevalence` | blank | 2.6% | blank |
| `injuryLocation_wrist_prevalence` | blank | 2.6% | blank |
| `injuryLocation_hip_prevalence` | blank | 2.6% | blank |

### Injury type — directly compatible tissue/type rows

| Field | Elite | Sub-elite | Amateur |
| --- | --- | --- | --- |
| `injuryTissueType_muscle_injury_prevalence` | 7.7% | 15.4% | 12.5% |
| `injuryTissueType_bone_prevalence` | blank | 2.6% | blank |
| `injuryTissueType_ligament_joint_capsule_prevalence` | 23.1% | 5.1% | 12.5% |

The ligament row uses the schema’s compatible parent `Ligament/joint capsule`; the source’s printed category is specifically `Ligament`. This is a defensible parent mapping but should remain visibly caveated for review.

## Source mapping

- PDF, Table 2, page 3: body location, anatomic region, type of injury, mechanism, and severity columns.
- PDF, page 3, lines in extracted layout 215–225: exact subgroup percentages listed above.
- PDF, Results, page 3, extracted layout 187–210: confirms the interpretation of the subgroup rows, including ankle, thigh, knee, ligament/muscle, and severity summaries.
- Table 1, page 3: group denominators and exposure already present live (`Elite 13 / 80 h`; `Sub-elite 39 / 26 h`; `Amateur 16 / 18 h`). No count conversion is proposed.

## Values intentionally left blank

- `injuryTotalCount` and all training/match count fields: Table 2 provides percentages and rates, not directly reported injury counts.
- `injuryContact`, `injuryNonContact`, and acute/repetitive onset fields: `Traumatic`/`Non-Traumatic` is not mapped to onset or contact counts under the extraction rules, and no count is printed.
- Structured severity fields: Table 2 prints severity-class percentages, but the structured schema stores days-based severity metrics; no days lost are reported for these rows.
- `injuryTissueType_cartilage_synovium_bursa_prevalence` for `Joint`: the source category `Joint` does not map cleanly to that narrower schema parent.
- Unlisted body-region/type cells: blank means the source table did not print a value for that subgroup, not zero.
- The existing headline fields (`injuryIncidenceOverall`, `injuryIncidenceTraining`, and most-common type/location/severity) are nonblank and are not part of this additive proposal.

## Review caveat

The table percentages appear to use the subgroup participant denominator and are rounded (for example, 7.7% of 13). This proposal intentionally keeps the printed percentages rather than deriving counts. If later approved for live application, the structured rows must be dual-written to both canonical extraction fields and aligned `population_values` rows.
