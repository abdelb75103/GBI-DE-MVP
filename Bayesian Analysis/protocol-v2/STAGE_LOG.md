# Stage decisions and evidence

## 9 September 2026: V2 protocol adjudication

- Abdel supplied decisions 1 to 5, recorded in `DECISIONS.md`.
- V2 is the primary working protocol. The annotated downloaded document is retained in `sources/`; the clean protocol records amendments in green.
- Document and checklist verification evidence is retained in this folder. These checks establish document fidelity and checklist operation, not readiness of data or models.
- Read-only data inspection reverified the two candidate file hashes and dimensions. No data transformation or model fit was performed.
- Next human gate: confirm the governing baseline and how to handle the differing Desktop copy after reviewing the comparison. This gate is pending.

## Template for each subsequent stage

### 9 September 2026: scope amendment and folder organisation

- Abdel excluded athlete-exposure-based observations from the first analysis and deferred conversion to a separate planned year-long project for future iterations.
- Updated the primary protocol and standalone checklist. First-analysis dataset checks must exclude these observations, including converted versions, while retaining source records for future work.
- Preserved the complete prior V2 release in `../archive/protocol-v2-before-exposure-deferral-2026-09-09/`. Moved primary Word, PDF and checklist files to the Bayesian Analysis folder's top level.
- Archived superseded drafts, older visuals, audits and working files with byte-for-byte verification. `../archive/RELOCATION_LOG.csv` records each moved file.
- This was document and folder maintenance. No data-preparation stage or model fit was executed. The checklist is a standalone document for later use.

### Fields to complete for each future stage

- Stage and date:
- Agreed action and scope:
- Input files, versions and checksums:
- Code, configuration and environment:
- Outputs and checks performed:
- Pass/fail result and unresolved items:
- Abdel's actual decision and date:
- Next permitted action:


## 10 September 2026: checkpoint 1 adoption and checkpoints 2–3 proposal

- Agreed action: Abdel authorised the byte-identical adoption of the Desktop CSV and preservation of the previous project version, then an analysis-focused column dictionary and proposed technical rules.
- Input: `v004-authoritative-desktop-adoption`, SHA-256 `a4257f7b153ddaae0aeea46492e6361152075619758e6087dc8b376599052e34`, 1,193 rows and 482 columns. Previous v003 SHA-256 `79d429964fc1cb8c4a9fd3947ae2d4b1d845667ca40f41d1889c8470a9bb3c70`, 1,197 rows and 478 columns.
- Evidence: `../analysis/step-runs/step-004-authoritative-desktop-adoption-20260910T154646Z/`, `../analysis/CURRENT_VERSION.json`, `../analysis/MANIFEST.md`; retained profiling script and outputs under `data-preparation/`; retained documentation update scripts under `scripts/`.
- Checks: both expected input hashes, byte-identical source/active adoption, previous-version archive, full raw rows and headers, key/cell comparison, read-only profiling, and unchanged external original. Exact run results and environment are retained with their scripts. These checks do not certify scientific eligibility.
- Reproducibility: deterministic preparation and profiling use no random seeds or statistical compiler. No model, priors, chains, diagnostics or fitted output exists for this stage. The modelling environment remains a later gate.
- Preservation: pre-update documentation, checklist source, audit scripts and prior release inventory are in `../archive/before-v004-adoption-2026-09-10/`. Raw inputs and historical audit evidence remain intact.
- Human decision: adoption approved by Abdel in this task on 10 September. He also approved a unified burden variable with no separation or exclusion solely by reported/calculated origin; source calculations remain auditable. See `DECISIONS.md`.
- Stage result: authorised freeze complete. Column and missingness proposals prepared. Checkpoint 2 approval and checkpoint 3 technical-rule approval remain pending; no substantive harmonisation, exclusion or model fit performed.
- Next permitted action: present `data-preparation/REVIEW.md`, resolve the human decisions and record the approved technical scope before executing checkpoint 3.


### Final verification of the preparation proposal

- Independent GPT-6 Astra review, medium reasoning, passed after correction of six mapping and metadata findings. The final record is `reviews/checkpoints-1-3-scientific-review.md`. The reviewer checked all 482 source-header mappings and all 46 profiled field missingness counts.
- `data-stage-validation.json` records the combined preservation, current-profile, checklist-link and gate checks. The checklist retained ten stages and forty personal checkboxes, with persistence and expansion working and no page errors or horizontal overflow at 1024, 736 and 360 pixels. Desktop and narrow-layout screenshots were inspected. A one-day footer date update followed the browser run; the final static build and link checks include it.
- The first static checkbox guard matched ordinary prose containing the word checked. It was narrowed to HTML input attributes and passed on rerun. No checkbox was pre-ticked.
- `scripts/audit_release.py` passed verification of the protocol source/output hashes, current data hash and 217 retained historical archive files. Its checks of 1,037 historical disposable files confirmed earlier removals; this task removed none of those files.
- `../analysis/step-runs/step-004-authoritative-desktop-adoption-20260910T154646Z/post-adoption-controls/` retains the legacy-mapping refusal check and exact executed/current script hashes. A historical v003 parsed-table metadata discrepancy is explained in the adoption run; its byte hash is unchanged and remains the identity authority.
- Human approval of checkpoint 2 and the checkpoint 3 technical rules remains pending. Independent review is not human approval.


## 10 September 2026: CP3-20260910 technical review copy

- Human authority: Abdel confirmed all six dimensions above and approved creating the labelled review copy through an in-conversation choice. His scope and restrictions are retained in `../analysis/review-copies/v004-labelled-review-2026-09-10/approval-record.json`.
- Input: authoritative v004, SHA-256 `a4257f7b153ddaae0aeea46492e6361152075619758e6087dc8b376599052e34`, 1,193 rows and 482 columns. The raw master, frozen snapshot and previous v003 archive remain unchanged.
- Outputs: `../analysis/review-copies/v004-labelled-review-2026-09-10/` contains a byte-identical `review-source.csv`, read-only `review.html`, all-header `column-mapping.csv`, keyed `cell-states.csv`, technical rules, change ledger, manifest, executed recipe and validation results.
- Transformations: display labels and literal cell states only, in separate records. No raw cell, header, row order, scientific meaning, missing value or row membership was changed. No numeric parsing, unit conversion, burden calculation or bibliography merge was performed.
- Validation: all 575,026 source cells, all 482 original headers, every sidecar coordinate, embedded HTML values and output hashes passed. A clean rerun of the retained recipe reproduced the output files byte-for-byte. `validation.json` records exact checks and Python 3.13 runtime information. Deterministic text processing uses no random seed or model compiler.
- Scope mapping: the new dictionary in `data-preparation/outputs/v004-confirmed-scope-profile/` includes sex, age, playing level, geography, injury location and injury type as planned scope. All prior profiles and reviews are retained as historical evidence. All category quantities remain subject to taxonomy, source meaning and completeness checks.
- Historical preservation: 21 previous decision/checklist/build/state records were snapshotted with hashes under `../archive/before-checkpoint-3-review-copy-2026-09-10/` before updates.
- Status: approved technical work complete. Human acceptance of the completed review copy and the next scientific decisions remain pending. Scientific harmonisation, exclusion and fitting counts are zero.
- Next permitted action: present acceptance and scientific direction choices in conversation; execute only the option Abdel submits. Definitions remain separate, no unreported category becomes zero, and athlete-exposure-based observations including conversions remain outside later first-analysis tables while all raw records are retained.


### Final review and interface checks

- Independent GPT-6 Astra review with medium reasoning passed the full raw-value and literal-state checks, current dimension roles and no-change boundaries. Its retained record is `reviews/checkpoint-3-review-copy.md`.
- Browser checks passed for 1,193 selectable populations, all 482 source fields, included location/type groups, S425's unchanged blank sex and desktop/mobile layouts. Screenshots at 1024 and 360 pixels were inspected. Results are in the review release's `browser-checks/` folder.
- The existing checklist again passed ten-stage, forty-checkbox, persistence, expansion, no page error and no horizontal-overflow checks at 1024, 736 and 360 pixels. Previous QA evidence was preserved before rerunning.
- The external Desktop original and `analysis/CURRENT_VERSION.json` are unchanged. The full release inventory and original executed scripts are retained with the review copy. Existing adoption-only replay scripts now refuse to overwrite later CP3 decisions.
- Governance integration was checked by the owner: current decisions, scope dictionary, checklist and review pointer agree. No completed-output acceptance or scientific choice is inferred from the approval to create the copy.


## 10 September 2026: TIMELOSS-20260910

- Abdel accepted the completed technical review copy. His free-text clarification chooses time-loss injuries only for the first analysis, actual reported days or burden without estimated days, and reported follow-up rather than a mandatory complete-episode-only gate. See the exact bounded record in `standardisation-scope-2026-09-10/decision.json`.
- Rechecked v004 SHA-256 a4257f7b153ddaae0aeea46492e6361152075619758e6087dc8b376599052e34. No raw data or source header changed.
- Read-only `inspect_definitions.py` inventories nine relevant source-label fields, retains source-row counts, drafts limited reporter-label examples and identifies burden-method wording needing review. These are proposals and inventories, not applied mappings or eligibility decisions.
- Inspection confirms case/spelling synonyms such as Medical Staff/medical staff/medical satff, alongside scientifically meaningful time-loss thresholds and mixed reporter roles. Meaning cannot be standardised by spelling alone.
- Independent GPT-6 Astra review with medium reasoning supports this distinction; record in `reviews/time-loss-standardisation-direction-review.md`.
- Previous decision, pointer, checklist and replay-script records were snapshotted before this update in `../archive/before-time-loss-clarification-2026-09-10/`.
- Next gate: prepare and review the full proposed harmonisation map with source wording, proposed labels and meaningful distinctions. Use clickable decisions for ambiguous mappings and burden-method cases. No imputation, applied scientific harmonisation, row exclusions, model fitting or live writes are authorised here.


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

## Injury candidate CSV update, 14 September 2026

The authorised update is implemented. `analysis/STANDARDISED_CURRENT.json` and `analysis/MODEL_INPUT_CURRENT.json` point to `analysis/model-input-releases/2026-09-14-injury-candidates/`. The corrected source retains 1,193 rows and 930 columns with 23 documented corrections. The candidate tables contain 2,670 incidence and 541 burden observations from 646 source rows and 285 papers, including supported time-loss subsets in mixed-definition papers. Current-match-only S055 events are excluded; restricted outcomes retain their scope.

The saved snapshot is reproducible, not a final independently eligible modelling dataset. Four broad review groups cover time-loss/metric alignment, outcome scope, population overlap and source/denominator conflicts. Rate-only routes also require an appropriate likelihood. All 51 tests passed, ten generated files replayed byte-identically, and independent GPT-5.6 Sol high review found no remaining blocker in the inspected candidate-only scope. Raw data, prior freezes and illness remain unchanged. No model was fitted; final eligibility and dependence review remain open. This execution record supersedes earlier statements that candidate preparation or these CSV corrections are only proposed.

## Adjudication applied to working analysis structure, 14 September 2026

Abdel accepted R1–R6 with restricted-outcome, granular-population and related-quantity refinements. The controlling record is `protocol-v2/injury-rule-review-2026-09-14/approved-decisions.json`. Unclear time-loss thresholds and estimated attendance exposure are retained for sensitivity analyses; standard pitch-player match exposure is acceptable in principle and flagged by method.

`analysis/ANALYSIS_WORKING_CURRENT.json` points to a working master with 3,211 observations and explicit outcome variables. It preserves the 50 aligned diagnosis descriptions and all source context. There are 120 matching overall/category pairs across 22 papers; equality alone does not resolve scope. Numerical parent/subgroup partitions and historical source-family links require source identity/period checks. The bounded exposure inventory identifies four candidate papers with estimation/imputation signals and two with explicit standard 90-minute pitch-player formulas. Unknown methods remain unknown.

This completes rule recording and structural enrichment, not the requested full source-alignment and cohort-overlap audit. No candidate is certified for fitting yet. Three delegates reached usage limits before final acceptance; their available findings were integrated and checked locally. Fifty-seven tests and byte-identical replay passed. Frozen sources and current source/candidate pointers remain unchanged. Continue the unresolved source checks before selecting and freezing final main/sensitivity analysis inputs.

## Unfiltered illness export completed, 14 September 2026

`analysis/ILLNESS_CURRENT.json` points to `analysis/illness-releases/2026-09-14-all-illness/`. The full illness CSV retains all 1,193 source rows and adds one explicitly labelled S4562 time-loss illness subset from the existing audit. The populated view has 66 records across 30 papers, including 65 original rows. No scientific inclusion or exclusion rule was applied. All 60 illness fields, shared and raw context, and illness-relevant diagnosis-family fields are retained. S206 heat-illness diagnosis entries are preserved; original illness values, blanks and zeros match raw v004 across all 71,580 cells. S541/S602 source qualifications and S4562 audit evidence are retained.

Byte-identical replay and independent GPT-5.6 Sol medium review passed. Luna xhigh execution was paused after no deliverable; owner completed the export. The evidence snapshot is frozen for reproducibility, not approved for illness modelling. Illness definitions, denominators and eligibility remain undecided. Injury work continues; S300's explicit exclusion of chronic/training injuries is now marked in the working analysis master, with source freezes unchanged. Broader injury source-alignment and overlap checks remain incomplete.

## Checklist refresh, 14 September 2026

17/40 documented items complete. Added s4b for adjudicated comparison/compatibility rules. Stage 5 remains active; source alignment, overlap/appraisal and Stage 6 final selection/validation/freeze remain incomplete. Candidate tables and unfiltered illness export are described as completed preparatory outputs, not certified model inputs.


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
