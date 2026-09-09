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
