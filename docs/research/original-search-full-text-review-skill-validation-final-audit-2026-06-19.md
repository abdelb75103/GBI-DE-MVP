# Original-search full-text review skill validation — final audit

**Workflow stage:** FIFA GBI full-text screening skill validation
**Search/import wave:** Original search historical decisions, plus one fixed second-updated-search regression case
**Date:** 19 June 2026
**Status:** Final audit; no database or Covidence decisions changed
**Criteria version:** FIFA GBI full-text eligibility v4 (2026-06-19)

## Executive finding

The revised full-text review skill is suitable for controlled use with mandatory evidence cards and explicit denominator classification. Calibration agreement was 12/12. The sealed holdout agreement was 10/12; both disagreements were historical includes that the authoritative prospective-design rule excludes. The prespecified untuned extension then agreed 8/8. Across all 32 historical records, decision agreement was 30/32 (93.8%); there were no false includes against the historical labels, two criteria-based excludes against historical includes, and no `unsure` recommendations. The fixed S2580 denominator regression also passed.

This validation did not alter human votes, historical decisions, Covidence records, database records, or extraction data.

## Scope and controls

- Calibration: 12 historical full texts, balanced 6 include / 6 exclude.
- Sealed holdout: 12 historical full texts, balanced 6 include / 6 exclude. Labels were not opened until all recommendation cards were fixed and schema-valid.
- Extension: 8 fresh historical full texts, balanced 4 include / 4 exclude. It was required because holdout agreement was below the prespecified 11/12 threshold. No skill changes were made after opening holdout labels.
- Regression: S2580, outside the scored sample, tested the distinction between an injured-case count and a valid exposure denominator.
- Review method: local PDF review using page-linked evidence. Scripts were limited to sampling, hashing, text extraction, packet construction, and output validation/rendering.
- Source criteria: FIFA GBI project plan, PROSPERO protocol, title/abstract criteria, and the no-exposure review workflow.

## Validation sequence and results

| Phase | Historical include | Historical exclude | Exact agreement | Result |
|---|---:|---:|---:|---|
| Calibration | 6 | 6 | 12/12 (100%) | Passed; skill revised only after this phase |
| Sealed holdout | 6 | 6 | 10/12 (83.3%) | Below 11/12 threshold; extension triggered |
| Untuned extension | 4 | 4 | 8/8 (100%) | Passed without further tuning |
| All historical records | 16 | 16 | 30/32 (93.8%) | Two disagreement records require human audit |
| S2580 regression | n/a | n/a | Pass | Correctly rejected injured-case count as denominator |

### Confusion table against historical decisions

| Recommendation | Historical include | Historical exclude | Total |
|---|---:|---:|---:|
| Include | 14 | 0 | 14 |
| Exclude | 2 | 16 | 18 |
| Unsure | 0 | 0 | 0 |
| Total | 16 | 16 | 32 |

Interpretation: relative to the historical labels, sensitivity for historical includes was 14/16 (87.5%) and specificity for historical excludes was 16/16 (100%). The two apparent false excludes are both defensible criteria-based historical-label discrepancies, not random misses.

## Holdout disagreement register

| ID | Paper | Historical decision | Fixed recommendation | Governing evidence | Required action |
|---|---|---|---|---|---|
| H02 | Abbott et al. (2021), disordered eating in elite soccer players | Include | Exclude — `E-DES-01` | “Using a cross-sectional design”; “case-control study” (p. 1) | Human eligibility audit; do not change the historical vote automatically |
| H08 | Kutnjak et al. (2021), Injury Analysis in Slovenian Women's Football | Include | Exclude — `E-DES-01`, `E-DEN-01` | Anonymous one-time injury questionnaire; participant counts but no cohort exposure denominator (translated PDF p. 2) | Human eligibility and downstream extraction audit; do not change the historical vote automatically |

Both disagreements concern one-time questionnaires. The v4 rule consistently treats cross-sectional or retrospective prevalence surveys as ineligible even when the population and health outcome are otherwise relevant. The 8/8 extension included another cross-sectional questionnaire exclusion and a no-denominator exclusion, supporting the revised rule without holdout-driven tuning.

## Reason-level audit

- C01 matched the historical exclude decision but not its historical reason. The paper is a narrative clinical review, so `Ineligible publication type` is the criteria-controlled primary reason. The historical reason was a no-exposure category. This is a reason-code discrepancy, not a decision discrepancy.
- H07 matched the historical exclude decision. The evidence supports public-source/retrospective selected-case exclusion; the historical record used the broader “Wrong study design” label.
- No historical excluded record in the validation sample was recommended for inclusion. No Covidence exclusion decision is therefore identified for reversal from this sample.

## Criteria coverage matrix

| Criterion family | Calibration | Holdout | Extension / regression | Outcome |
|---|---|---|---|---|
| Sport / eligible discipline | C04, C10 | H04, H10 | E04, E07 | Covered, including futsal, referees, mixed-sport subgroup, and wrong football code |
| Population / competitive setting | C04, C07, C10 | H03, H09, H10 | E01, E02, E04 | Covered across youth, women, men, elite, tournament, and recreational exclusions |
| Prospective study design | C06-C09, C11 | H02, H03, H08, H09, H11 | E02, E03, E05, E08 | Covered; two historical inconsistencies isolated |
| Data source | C03, C07 | H03, H05, H07 | E05, E07 | Covered across team surveillance, public media/video, and organizational surveillance |
| Injury / illness outcome | C01, C04, C12 | H02-H04, H07, H09, H11 | E03, E07, S2580 | Covered across injury, illness/health problems, symptoms, and proxy/selected-case distinctions |
| Definition validity | C12 | H03, H04, H09 | E05, S2580 | Covered; invalid mapping and valid time-loss/IOC/BAMIC definitions tested |
| Denominator / rate | C03, C04, C07-C12 | H02-H05, H08-H11 | E01, E02, E05, E07, E08, S2580 | Covered across direct time, published rates, athlete-exposures, derivation, unusable counts |
| Publication type | C01, C02, C05 | H01, H06, H12 | E06 | Covered across systematic review, narrative review, editorial, letter, and abstract |
| Football-specific subgroup | C06 | H10 | E03, E07, E08 | Covered across inseparable and separable subgroup data |

All original inclusion and exclusion families were exercised either directly in the scored papers or through the fixed regression case.

## Denominator-specific findings

The revised skill correctly distinguishes:

- `direct_time`: explicit player- or athlete-hours (for example H03, H04, E01, E02, E05).
- `published_time_rate`: an eligible published incidence rate when raw exposure is not required for the screening decision (H09, H10).
- `athlete_exposures`: defined participation opportunities (E07).
- `paper_derivable`: numerator and exposure frame that can be calculated transparently from the paper (tested during calibration).
- `unusable`: participant counts, injury counts, injured-case samples, or prevalence denominators without exposure (H02, H08, E03, E08, S2580).
- `not_applicable_review`: publication-type exclusions and review routing where an original-study denominator is not applicable.

S2580 passed because “95 injuries analyzed” is an injured-case count, not player-time, athlete-exposures, match-exposures, a published incidence rate, or a paper-derivable cohort exposure frame.

## Evidence-card and schema audit

Every fixed calibration, holdout, extension, and regression recommendation was rendered with the revised schema. Required fields include decision, triggered criteria, controlled exclusion reason, study design, timing, population, discipline, setting, data source, outcome, definition, denominator status, derivation fields, short evidence quotes, page locations, confidence, and audit notes. Final renderer runs reported zero validation warnings.

The evidence-location audit confirmed that each recommendation contains at least one short quote and a page-level source location. Hashes and neutral IDs were retained in the blinded manifests for sample integrity.

## Skill changes made after calibration only

- Replaced the eligibility reference with versioned criterion IDs and controlled exclusion vocabulary.
- Added explicit prospective-design, publication-type, data-source, subgroup, and denominator gates.
- Added denominator statuses and the rule that participant or injured-case counts are not exposure denominators.
- Expanded the output schema to require auditable evidence cards.
- Updated the packet builder signals and renderer validation.
- Verified the renderer by demonstrating warnings under the prior format and zero warnings under the revised format.

No skill, criteria, or renderer logic was changed after holdout labels were opened.

## Follow-up audit queues

### Existing included/extraction papers needing focused review

1. Abbott et al. (2021), holdout H02 — verify whether it should remain included given its explicit cross-sectional/case-control design.
2. Kutnjak et al. (2021), holdout H08 / translated Covidence #716 — verify eligibility and any downstream extraction because the study is a one-time injury questionnaire without a valid exposure denominator.
3. Any existing extraction record using participant count, injured-case count, number of injuries, or prevalence denominator as an incidence exposure should be rechecked under `E-DEN-01`. S2580 is the fixed regression exemplar.

### Existing Covidence exclusions potentially needing reconsideration

None were identified for decision reversal in this validation sample. C01 and H07 merit reason-label normalization only if the project later undertakes an explicitly approved reason-cleanup exercise; their exclusion decisions remain supported.

## Conclusion

The skill met the practical validation objective after the prespecified extension: perfect calibration, 10/12 sealed holdout with two coherent historical-label conflicts, 8/8 untuned extension, complete criteria-family coverage, zero schema warnings, and a passing fixed denominator regression. Use the v4 skill prospectively, retain human votes unchanged, and route H02 and H08 to an explicit human historical-eligibility audit.

## Audit artifacts

- Blinded manifests and sealed labels: `tmp/full-text-skill-validation-2026-06-19/`
- Calibration cards: `tmp/full-text-skill-validation-2026-06-19/calibration-recommendations.enriched.json`
- Holdout cards: `tmp/full-text-skill-validation-2026-06-19/holdout-recommendations.fixed.json`
- Extension cards: `tmp/full-text-skill-validation-2026-06-19/extension/recommendations.fixed.json`
- S2580 regression: `tmp/full-text-skill-validation-2026-06-19/S2580-denominator-regression.fixed.json`
- Revised skill: `/Users/abdelbabiker/.codex/skills/fifa-full-text-screening-review/`
