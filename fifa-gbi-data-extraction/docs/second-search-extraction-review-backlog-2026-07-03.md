# Second Search Extraction Review Backlog

Scope: second search full-text records from `Second search - Ishanka - 2026-05-26` that were temporarily bridged into the extraction workspace on 2026-07-03 because AI and one human reviewer both recommended include. Formal full-text inclusion still requires the normal second human full-text include vote.

Queue snapshot: 170 second-search full-text records currently have an AI include plus at least one human include and no human exclude. This backlog covers only the first two five-paper extraction batches.

Review state:
- `⏲️ pending_review`: staged, extracted, or tagged by Codex and still needs manual check
- `✅ reviewed_complete`: reviewed by Abdel and done
- `needs_follow_up`: reviewed, but something still needs changing

Workflow:
- Use 5-paper batches.
- Keep live papers in `processing` while awaiting Abdel review.
- If a bridged paper later receives a final full-text exclude, leave it visible but flag it for cleanup instead of deleting it automatically.
- If extraction prep finds a clearly ineligible paper, skip it, document why, and replace it with the next eligible second-search AI+human include record.

## Batch 001

Created: 2026-07-03

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S707 | processing | ⏲️ pending_review | Live extraction applied | Eligibility gate passed: professional female association-football injury epidemiology with published per-1000h rates. Sparse outcome extraction from supplied 6-page manuscript/abstract; bibliographic fields were completed from the matched live paper record. Lower-limb count is percentage-derived from 53 injuries. |
| S712 | processing | ⏲️ pending_review | Live extraction applied | Eligibility gate passed: professional football time-loss head/neck injury surveillance with per-1000 player-hour rates. Extracted head/neck and concussion counts/incidence; median severity values are labelled as median in generic severity fields. |
| S755 | processing | ⏲️ pending_review | Live extraction applied | Eligibility gate passed: male professional football cohort with HSI/groin injury incidence and burden per 1000 player-hours. Extracted control vs intervention rows for thigh/hamstring and groin outcomes; exposure totals were not back-calculated. |
| S759 | processing | ⏲️ pending_review | Live extraction applied | Eligibility gate passed under mental-health leniency: current football academy players with direct PHQ-9/GAD-7/SWLS prevalence counts. Sparse schema fit: stored depressive symptoms as the headline psychiatric count; anxiety and low-wellbeing counts need reviewer attention. |
| S789 | processing | ⏲️ pending_review | Live extraction applied | Eligibility gate passed: professional football soft-tissue injury rates/burden per 1000 player-hours. Extracted congested vs noncongested rows; location counts/rates use transparent sums of compatible table subrows where needed. |

## Batch 002

Created: 2026-07-03

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S817 | processing | ⏲️ pending_review | Extraction applied live | ACL-registry extraction applied from Tables 1-2 and results text. Line order is all-level pre/post, professional pre/post, semi-professional pre/post, amateur pre/post; exposure totals were not back-calculated. Mechanism percentages were not forced into count fields. Formal full-text inclusion still requires a second human include; screening remains pending. |
| S826 | flagged | ⏲️ pending_review | Eligibility failure; skipped for replacement | Failed eligibility gate: no football-specific subgroup denominator. Mixed soccer/volleyball/basketball cohort; soccer injury counts are reported, but CONC/CTRL exposure and rates are pooled across sports, so no football-specific denominator can be extracted without assumptions. Live `flag_reason`: `No football-specific subgroup denominator`. Formal full-text inclusion still requires a second human include; screening remains pending. |
| S933 | processing | ⏲️ pending_review | Replacement extraction applied live | Replacement for S826. Eligibility gate passed: elite female association-football cohort with noncontact injury counts and published match/training incidence per 1000 player-hours. Extracted one total female row from Table 1, Table 2, figures, and results text: 24 players, 40 noncontact injuries, 14 game and 26 practice injuries, match/training incidence 6.4/4.9, tissue counts for muscle/tendon, muscle, ligament, and cartilage, and left/right side counts. Total exposure and overall incidence were not back-calculated; generic tendon count is included only in the parent muscle/tendon total. Injury definition is normalized to medical attention from team-doctor/medical-department diagnosis and EMR capture, but the paper does not print a formal consensus definition. Formal full-text inclusion still requires a second human include; screening remains pending. |
| S859 | processing | ⏲️ pending_review | Extraction applied live | Soccer-only boys/girls rows extracted from High School RIO Tables 1-3 and abstract. Counts/rates use reported observed soccer injuries and AEs; structured diagnosis/location counts use reported national estimates, so reviewer should keep the weighting distinction in mind. Formal full-text inclusion still requires a second human include; screening remains pending. |
| S877 | processing | ⏲️ pending_review | Extraction applied live | LAS cohort extracted as Total/Male/Female from Tables 1-8. Participant count is inconsistent in source text (303/304 total while sex subtotals print 175 + 149); live uses methods total 303 and reported sex rows. Direct/indirect contact were combined only for the generic contact field. Formal full-text inclusion still requires a second human include; screening remains pending. |
| S892 | processing | ⏲️ pending_review | Extraction applied live | Single-team semiprofessional football workload cohort extracted from Tables 1-4. Total exposure hours were not back-calculated from incidence; tissue rows are limited to directly mappable non-contact injury type counts, with generic tendon count left unmapped. Formal full-text inclusion still requires a second human include; screening remains pending. |

## Live QA

Completed: 2026-07-03

- Ten extracted records remain assigned to AbdelRahman Babiker with status `processing`.
- S826 remains flagged and unextracted with `No football-specific subgroup denominator`.
- All ten extracted records have complete Tabs 1-4 row sets; checked but absent values are stored as `not_reported`.
- Structured population rows were rebuilt from the canonical extraction fields with punctuation preserved; source-specific labels and their sync signatures are stored in paper metadata so later saves retain them.
- Screening human votes, AI recommendations, resolver state, and promotion state were not changed.
