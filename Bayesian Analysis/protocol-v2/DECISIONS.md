# Bayesian protocol V2: adjudicated decisions

Status: primary working protocol. Adjudications supplied by Abdel on 9 September 2026. This records approval of the direction below, not approval of unchosen numerical assumptions, a particular burden likelihood, data changes or model results.

V2 incorporates the feedback revisions prepared on 9 September and the five adjudications below. It supersedes the interim protocol in `../archive/protocol-revision-2026-09-09/`. The sent original and annotated review source remain evidence; the learning packet remains a learning resource.

| Decision | Review advice and our adjudication | Material effect |
|---|---|---|
| 1. One implementation now | The review suggested cross-software verification. Use PyMC with ArviZ now. Stan is optional only if time permits and it adds little complexity or work. | Avoids maintaining two model implementations. Numerical checks, simulations, independent review and clean reruns still apply. Unresolved implementation problems must be corrected before results pass. |
| 2. Start with the proposed burden options | Assess the proposed total-days approaches and follow-up concerns first. Select only after checking measurements and simulated behaviour; use a justified fallback if unsuitable. | Adds a burden assessment before fitting. It does not select a distribution in advance or turn the linked frequency/severity analysis into a co-primary model. No defensible likelihood means descriptive reporting or a recorded amendment. |
| 3. Check like-for-like settings | Use our diagnostic recommendation for matched populations, periods and definitions with complete component coverage. | Overall versus match/training differences will not be misread when the studies or included settings differ. A formal joint probability comparison requires a dependence model. |
| 4. Let the study design determine complexity | Use our replication and simulation recommendation rather than a universal row-count rule. | Keep extra model levels only when the actual evidence supports them. A valid near-zero variation estimate is not an automatic failure. |
| 5. Test the prediction we intend to make | Use our prediction-target-specific validation recommendation. | Prediction for a new study requires holding out whole independent study/source families. Predicting another row in a known study is a different test. |

The prior review's other amendments remain in V2, including follow-up and reporting completeness, calibrated half-normal heterogeneity priors with half-Cauchy sensitivity, population characteristics, category completeness, explicit parameter conventions, predictive checks, appraisal and reproducible updates. The exact paragraph-level edits and original-to-V2 changes are retained in `v2-edits.json` and `document-change-ledger.json`.

## How later decisions are made

### First-analysis scope amendment on 9 September 2026

Abdel explicitly deferred athlete-exposure-based observations from the first analysis. This supersedes the earlier AC01 provision for a parallel athlete-exposure reporting stream or an approved conversion before the first freeze. No athlete-exposure-based observation, including a converted version, enters the first-analysis model datasets.

Keep those raw records and label their exclusion as deferred to a future iteration. A separate planned year-long project will develop and validate conversion to rates per 1,000 player-hours. It has not started through this protocol edit. Any later inclusion needs a documented protocol amendment and validation of the conversion. A study's separately reported compatible player-hour observations may still be assessed under the existing eligibility rules.

Material effect: the first release concentrates on compatible player-hour evidence, with lower immediate conversion work and narrower evidence coverage. Report the deferred evidence in the exclusion/coverage accounting. The five adjudications above remain unchanged.

The protocol Word/PDF and standalone interactive checklist now live at the top level of the Bayesian Analysis folder. Supporting records remain here; the full pre-amendment release is preserved under `../archive/protocol-v2-before-exposure-deferral-2026-09-09/`.

Before each analysis stage, show Abdel the proposed action, its purpose, expected output and concrete pass/fail checks in plain English. Run only the agreed stage. Present the evidence and record Abdel's decision before advancing. A checklist tick is a personal progress marker, not a scientific approval.

Keep an append-only stage record in `STAGE_LOG.md`. Record dates, input versions/checksums, scripts/configurations, checks and failures, output paths and Abdel's actual decision. If a check fails, correct or amend the current stage and repeat its checks; do not quietly proceed. Never mark a missing human decision as approved.

At model specification, agree numerical tolerances before final fitting. The checklist intentionally does not invent those values now. An updated primary protocol must retain the previous release, explain the amendment and identify which outputs require rerunning.

## First data decision

The governed candidate is `../analysis/analysis.csv`, version `v003-source-fidelity`. Its checksum was reverified on 9 September 2026 and matches the retained source-fidelity version: 1,197 rows and 478 columns. The Desktop CSV differs and has 1,199 rows and 478 columns. Both checks are recorded in `data-candidate-check.json`.

Recommendation: retain the governed project CSV as the baseline, review the Desktop differences for approved additions or corrections, and freeze one named input before changing columns. A newer modification time is not evidence of authority. This V2 edit has not selected a replacement file or changed either dataset.

Then create a dictionary and reversible technical mapping, preserving raw values and identities. Use Excel as a review copy of the governed CSV. Resolve meaning, units, injury definitions, missingness, overlaps and burden derivations during scientific harmonisation. Derive the smaller analysis tables afterwards. Existing exact-cell mapping scripts enforce header identity; column renaming requires a checked compatibility plan, not an unrecorded manual edit.


## 10 September 2026: authoritative input adopted

Abdel explicitly authorised adopting `/Users/abdelbabiker/Desktop/analysis.csv` as the starting dataset. This supersedes the earlier recommendation under "First data decision" above, which records the 9 September candidate state.

The authoritative input is `../analysis/analysis.csv`, `v004-authoritative-desktop-adoption`, with 1,193 rows and 482 columns. Its SHA-256 is `a4257f7b153ddaae0aeea46492e6361152075619758e6087dc8b376599052e34`. The adopted file is byte-identical to the authorised Desktop input. The external Desktop original is unchanged. The previous v003 and its metadata, new source snapshot, comparisons, scripts and validation evidence are retained through `../analysis/step-runs/step-004-authoritative-desktop-adoption-20260910T154646Z/` and `../analysis/MANIFEST.md`.

The rechecked adoption hashes match the values supplied with Abdel's instruction. Adoption establishes authority and provenance; it is not a fresh source-paper audit or approval of every scientific value. The S425 setting/numerator and illness caveats, blank sex, S300 approximate concussion count and derived exposure, and overlap between Total and subgroup rows remain for scientific review. Historical candidate evidence remains unchanged.

## 10 September 2026: one burden variable

Abdel clarified: "If we have the days lost and we have the exposure, we can calculate it, and that's the definition of burden." He does not want reported, calculated or derived rates treated as different outcomes.

Use one burden variable, days lost divided by compatible player-hours, multiplied by 1,000. Do not separate observations, exclude them, or schedule a sensitivity analysis solely because the rate was reported or calculated. This supersedes the V2 provisions for stratification or restriction based solely on directly reported versus derived burden. This decision concerns burden rates; it does not change the first-analysis exclusion of athlete-exposure-based observations or the separate incidence analysis.

Retain source values, units, locators and any calculation in the audit trail. Validity checks concern the population, injuries, setting, period, injury definition and follow-up target. Observation uncertainty and rounding still govern the supported likelihood. A rounded rate alone does not establish an exact days-lost total. Aligned incidence multiplied by mean time-loss severity remains an allowable derivation under the recorded alignment rules; a median or incompatible summaries are insufficient.

The Word/PDF V2 release predates this clarification. Read it with this superseding decision record. No numerical model, observation likelihood, missingness rule or final analysis set is approved by this clarification.

## Human gate before checkpoint 3 approval

Review `data-preparation/REVIEW.md` for the required, optional and not-used column groups, relevant missingness and proposed reversible technical rules. Checkpoint 1's authorised freeze is complete. Checkpoint 2's proposal is prepared for Abdel's decision. Checkpoint 3 has not executed because its specific technical rules remain unapproved. No substantive harmonisation, exclusions, analysis tables or model fitting have been performed.


## CP3-20260910: confirmed scope and approved technical review copy

Abdel confirmed that sex, age, playing level and geography are included planned dimensions. Injury location and injury type are also included. This supersedes earlier descriptions of these dimensions as optional scope or merely retained for possible future work. Their coding, category definitions, measurement support and missingness handling still require scientific decisions. Alternative source representations of age are not automatically separate model predictors. Location and type require supported category-specific analyses; their inclusion does not stack categories as independent observations or bypass taxonomy and completeness checks.

Abdel then submitted the clickable approval to create a labelled review copy with a separate mapping and missingness-state record. He explicitly required preservation of every raw value, all 482 source headers, row identities and source evidence. Missing values remain unresolved. He did not approve imputation, substantive harmonisation, row exclusions or model fitting. The submitted authority is retained in `../analysis/review-copies/v004-labelled-review-2026-09-10/approval-record.json`.

The review copy and every raw cell passed preservation checks and a clean deterministic rerun. The master remains v004, SHA-256 `a4257f7b153ddaae0aeea46492e6361152075619758e6087dc8b376599052e34`. The copy is a review artefact, not a new authoritative raw dataset or model table. `../analysis/REVIEW_COPY_CURRENT.json` identifies the current review release; `data-preparation/outputs/v004-confirmed-scope-profile/` is the current scoped column dictionary and read-only profile.

Checkpoint 2's corrected scope and the narrow technical work in checkpoint 3 are authorised. The technical work is complete; acceptance of the completed output remains a human gate. The next scientific gate is the estimand and evidence-compatibility decision: which separate injury-definition outputs to prioritise, and whether burden targets observed-window days, complete injury episodes or separately justified outputs for both. The missing structured follow-up evidence supports an evidence-review-first option. Offer these as clickable in-conversation choices. No scientific rule is selected by this record.

The existing Word/PDF must be read with these later decisions. User-facing decisions use clickable choices; the project checklist and this log retain the resulting authority.


## TIMELOSS-20260910: technical acceptance and time-loss-only clarification

Abdel accepted the completed v004 labelled technical review copy. His additional free-text instruction supersedes the prefilled choices in the submitted message where they differ.

The first analysis uses time-loss injuries only. Other injury-definition families are not additional first-analysis outputs under this clarification. Retain their raw records. A separately identifiable time-loss subset in a broader surveillance study may still be assessed. Different time-loss thresholds, restricted injury diagnoses and participation criteria remain distinguishable until scientific compatibility is adjudicated. A broad time-loss family label is not proof that those definitions are interchangeable.

Burden uses actual study-reported days lost or study-reported burden. Estimated days lost are outside the intended analysis. Dividing actual aligned days by player-hours remains an allowed calculation; this is not an estimate of days. Actual return-to-play absence reported after study end remains source evidence for injuries occurring during the study. Do not impose a complete-episode-only inclusion gate based on the earlier selected button. Keep the reported follow-up construction, unresolved injuries and study-window limitations explicit; pooling different constructions still needs a compatibility rule. Do not add assumed absence beyond observation.

Incidence multiplied by mean severity is held for concrete source-method review under the new no-estimated-days restriction. It is not automatically rejected because it is calculated, and a rounded mean or rate cannot certify an exact days-lost total. Median-based reconstruction remains outside the prior approved derivation rule. No affected raw values are changed or excluded at this stage.

Sex, age, playing level, geography, injury location and injury type remain included. The next preparation task is a proposed harmonisation map for relevant column values. Standardise genuine spelling/case synonyms in a separate mapping while retaining source wording. A broad medical-personnel category may group doctors and physiotherapists while retaining their specific role and recording/diagnosis/clearance responsibility. Personnel labels do not establish an injury-definition family.

The current stage is read-only mapping preparation, not applied scientific harmonisation. `standardisation-scope-2026-09-10/` retains the decision, raw wording inventory, limited reporter examples and burden-method cases. A complete mapping must be shown with clickable approval before recoding. No imputation, scientific value change, row exclusion or model fit has occurred. `analysis/REVIEW_COPY_CURRENT.json` now records technical acceptance, while v004 itself is unchanged.


## STANDARDISATION-PREPARED-20260910

The full proposed standardisation and mapping is prepared for human review in `protocol-v2/harmonisation-proposal-2026-09-10/` (paths relative to the Bayesian Analysis root). It contains 752 population-label mappings, 1,031 definition/reporting mappings, 367 injury-description mappings and 304 location/type column mappings. All 482 original columns are covered by the column plan. A separate register flags 5,463 raw quantity cells for review without parsing or altering them.

The clickable review retains exact source wording, proposed treatment and rationale, with individual approval, revision and source-adjudication actions. `review-manifest.json` binds it to exact proposal-file hashes and the unchanged v004 source. Approval is pending; no proposed mapping, exclusion, numerical conversion or model has been applied. A proposal to retain unresolved wording does not resolve its scientific meaning. Reported and calculated burden remain the same quantity; origin alone does not determine grouping or eligibility.

Source roles, thresholds, population qualifiers, diagnosis-specific metrics and parent/child categories remain distinct where meaningful. Position and laterality columns are identified separately from anatomical location. See `protocol-v2/reviews/full-standardisation-proposal-review.md` for the bounded independent review. Next action: record Abdel's selected mapping decisions and seek adjudication for unresolved source meaning before affected changes.


## Standardised source freeze, 11 September 2026

Abdel approved G1-G5 with competition-family, clinical-family, reporter-family and separate-summary refinements. Exact choices and comments are retained in `protocol-v2/global-decisions-2026-09-11/approved-decisions.json`, relative to the Bayesian Analysis root. The versioned release is `analysis/standardised-releases/v004-standardised-2026-09-11/`; `analysis/STANDARDISED_CURRENT.json` points to it.

All 1,193 source rows and 575,026 original cells are preserved. Added companions standardise labels and families and separate explicitly identified quantities, medians, CI limits, SDs and IQRs. Nine boundary tests and a byte-identical rebuild passed. Raw v004 remains authoritative and unchanged. Unresolved meanings remain flagged; no analytical exclusions, burden reconstruction or model fitting occurred. Source-method and denominator alignment are not certified merely by numerical parsing. Previous pending-approval statements above are superseded by this record.


## Current adjudicated bucket release, 11 September 2026

The latest authority is `analysis/STANDARDISED_CURRENT.json`, pointing to `v004-buckets-2026-09-11`. This supersedes earlier pending mapping statements and the first standardised release. Abdel’s voice adjudication and follow-up confirmations are recorded in `protocol-v2/bucket-revision-2026-09-11/adjudicated-rules.json`.

The release applies broad population, competition, injury-definition, reporter and quantity rules. Sex, age, playing level, geography, injury location and injury type remain included. Raw v004 and earlier freezes remain unchanged. All 1,193 rows and 733 literal numeric zeros are retained. Forty-one tests, byte-identical replay and independent scientific checks passed. Two source-verified actual-days burden ratios were added; no CI was derived from SD. Burden origin alone does not determine eligibility. Estimated/imputed days and denominator alignment concerns remain in the source audit.

The checklist records 16 completed items. Stage 5 remains active, with stage 4 compatibility/targets and stage 5 overlaps/appraisal still pending. This is a standardised source freeze; analytical eligibility, model inputs and fitting remain unapproved and incomplete.



## Complaint spelling correction, 12 September 2026

The current standardised source is `v004-buckets-2026-09-12`, recorded in `analysis/STANDARDISED_CURRENT.json`. Eleven injury-definition cells across S319, S334, S465 and S644 changed from Other to Physical complaints/all complaints. Every other CSV cell is identical to the prior freeze, including descriptions, quantities and blanks. Raw v004 and the previous freeze remain intact. No eligibility or checklist stage changed. Verification is retained in the new release.



## Injury-first scope, 14 September 2026

Abdel deferred illness analysis and adjudication until after the injury work. Preserve the illness inventory for later; current work concerns injury model inputs. The proposed >=1-day time-loss threshold remains unapproved while the S055 source wording is clarified. The next proposed deliverable is a candidate time-loss/player-hour observation table with outcome scope, original definitions, cohort identity and review status retained; final eligibility and freeze follow broad-rule adjudication.



## Injury eligibility adjudication, 14 September 2026

Abdel confirmed that current-match-only time loss is excluded. For S055, use the positive-day categories: 30 recreational and 19 amateur injuries, with their respective source exposures of 251.0 and 545.2 player-hours. The broader source totals of 100 and 59 include match-only stoppages and are not eligible numerators for this target. Preserve the source definition and threshold; this decision does not establish an unstated day threshold for other papers.

Abdel also confirmed that restricted outcomes, including overuse-only, concussion-only and ankle-only injuries, may contribute to their corresponding analyses but must not be represented as all-injury outcomes. Preserve outcome scope separately from time-loss definition.

These decisions authorise the corresponding rules for candidate model-input preparation. This record does not apply CSV corrections or freeze model inputs. Illness remains deferred.

## Injury candidate CSV update, 14 September 2026

The authorised update is implemented. `analysis/STANDARDISED_CURRENT.json` and `analysis/MODEL_INPUT_CURRENT.json` point to `analysis/model-input-releases/2026-09-14-injury-candidates/`. The corrected source retains 1,193 rows and 930 columns with 23 documented corrections. The candidate tables contain 2,670 incidence and 541 burden observations from 646 source rows and 285 papers, including supported time-loss subsets in mixed-definition papers. Current-match-only S055 events are excluded; restricted outcomes retain their scope.

The saved snapshot is reproducible, not a final independently eligible modelling dataset. Four broad review groups cover time-loss/metric alignment, outcome scope, population overlap and source/denominator conflicts. Rate-only routes also require an appropriate likelihood. All 51 tests passed, ten generated files replayed byte-identically, and independent GPT-5.6 Sol high review found no remaining blocker in the inspected candidate-only scope. Raw data, prior freezes and illness remain unchanged. No model was fitted; final eligibility and dependence review remain open. This execution record supersedes earlier statements that candidate preparation or these CSV corrections are only proposed.

## Injury rule review, 14 September 2026

Six agent-selected rules and their evidence are recorded in `protocol-v2/injury-rule-review-2026-09-14/decisions.json`, presented for Abdel to revise. Two human choices remain pending: unresolved time-loss thresholds and estimated attendance/programme exposure, each recommended for sensitivity analysis. Defaults in the interactive review are not approvals. Technical source, category and cohort checks remain agent work. No frozen CSV changed, and no final eligibility or model fitting is certified by this rule review.

## Adjudication applied to working analysis structure, 14 September 2026

Abdel accepted R1–R6 with restricted-outcome, granular-population and related-quantity refinements. The controlling record is `protocol-v2/injury-rule-review-2026-09-14/approved-decisions.json`. Unclear time-loss thresholds and estimated attendance exposure are retained for sensitivity analyses; standard pitch-player match exposure is acceptable in principle and flagged by method.

`analysis/ANALYSIS_WORKING_CURRENT.json` points to a working master with 3,211 observations and explicit outcome variables. It preserves the 50 aligned diagnosis descriptions and all source context. There are 120 matching overall/category pairs across 22 papers; equality alone does not resolve scope. Numerical parent/subgroup partitions and historical source-family links require source identity/period checks. The bounded exposure inventory identifies four candidate papers with estimation/imputation signals and two with explicit standard 90-minute pitch-player formulas. Unknown methods remain unknown.

This completes rule recording and structural enrichment, not the requested full source-alignment and cohort-overlap audit. No candidate is certified for fitting yet. Three delegates reached usage limits before final acceptance; their available findings were integrated and checked locally. Fifty-seven tests and byte-identical replay passed. Frozen sources and current source/candidate pointers remain unchanged. Continue the unresolved source checks before selecting and freezing final main/sensitivity analysis inputs.

## Exposure methods approved, 14 September 2026

Abdel accepted exposure construction for S176, S330, S417, S2147, S223, S300, S443 and S4562. `protocol-v2/injury-rule-review-2026-09-14/exposure-method-approval.json` records the scope. These eight papers may enter main-analysis consideration on exposure-method grounds; this supersedes earlier sensitivity-only exposure treatment for them. Preserve the method flags for sensitivity checks. Unknown time-loss thresholds, source alignment and overlap remain separate gates. Approval of S2147 exposure does not approve its imputed days-lost burden. Frozen sources remain unchanged.

## Illness export authorised, 14 September 2026

Abdel requested a separate illness CSV containing all available illness information, with no analytical inclusion/exclusion decisions. This supersedes deferral of illness data preparation only. Illness eligibility and modelling remain undecided. Preserve raw illness cells, shared population and denominator context, original generic wording, zeros and blanks; retain existing source-audit additions with provenance. The injury work remains active.



## Reviewed injury input release completed, 14 September 2026

`analysis/MODEL_INPUT_CURRENT.json` now points to `analysis/model-input-releases/2026-09-14-selected-injury-inputs/`. All 3,211 observations remain in the complete reviewed CSV, with explicit clinical and population descriptors and full source context. The mutually exclusive dispositions are 47 main, 666 sensitivity, 1,506 descriptive, 835 held and 157 duplicate representations. The 713 quantitative selections cover 193 papers and include 670 incidence and 43 burden observations. These are target-specific observations, not independent studies to pool together.

The applied rules retain supported time-loss subsets, restrict specialist results to their actual outcomes, preserve count-bearing and zero-event records, and avoid duplicate parents or aliases. S300 receives the source-verified 312 match injuries. S2147 retains 611 analysed football time-loss injuries with its adjusted published rate identified separately. Approximate reverse exposure remains a sensitivity route; no approximate count was promoted to an observed integer. Unresolved source questions remain explicit holds. S1680 retains a screening-status pre-fit gate.

Independent GPT-6 Astra high review accepted this bounded data release. All 562,020 retained source-context cells match, all seven generated CSVs replay byte-identically, and all 64 project checks pass. The 43-file freeze includes reviewed inputs, decisions, recipe, validation and acceptance. Raw v004, the corrected source freeze and the seven-file illness freeze are unchanged. This is not a fresh PDF audit of every paper and does not certify screening eligibility or model fitting.

The checklist now records 19/40 completed items, adding separate analysis tables and inclusion accounting. Target-specific scientific readiness, appraisal, unresolved source alternatives and exact fitting-input selection remain open. Next, specify compatible targets, likelihoods and dependence before fitting. No additional human adjudication was required to apply the existing rules in this release; no model was fitted.


## Inclusive injury eligibility approved, 14 September 2026

Abdel approved source-defined time-loss injuries with compatible player-hours as the primary eligibility rule. Alternative, restrictive or unspecified absence thresholds are retained with adjacent definition wording and flags; they no longer trigger sensitivity-only routing. Rate-only results remain eligible while their likelihood is specified. Existing source contradictions, duplicate representations and screening-status gates remain visible; all candidate records remain in one CSV. Restricted injury outcomes contribute only to their actual target. The earlier specific exclusion of S055 current-match-only stoppages remains.

The definitive `injury-analysis.csv` retains 3,211 results from 285 papers, including 2,219 supported selected results from 220 papers (1,892 incidence, 327 burden). It preserves all source context and original values. This supersedes the previous 47 main / 666 sensitivity / 1,506 descriptive split for current eligibility. Exact target-specific likelihoods, dependence and fitting selections are next; no model has been fitted.


## Authoritative eligible-only injury CSV, 14 September 2026

The authoritative analysis input is `analysis/model-input-releases/2026-09-14-authoritative-injury-analysis/injury-analysis.csv`: 2,219 eligible result rows from 220 papers, comprising 1,892 incidence and 327 burden rows. All 1,012 columns and every selected cell are preserved. `analysis/MODEL_INPUT_CURRENT.json` is the authority pointer. The previous 3,211-row file remains the complete audit record, not the analysis input. No eligibility rule or numerical value changed in this subset export.

Eligibility preparation is complete. Next recommend the target-specific model specification, likelihoods, uncertainty and dependence handling. Await Abdel's input before implementing or fitting models. Historical sections below describe superseded releases.
