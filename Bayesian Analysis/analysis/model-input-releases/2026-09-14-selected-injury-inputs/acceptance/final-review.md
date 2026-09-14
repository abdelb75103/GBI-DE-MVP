# Final independent review

Accepted for the bounded injury-data preparation scope. No remaining blocker was found in the reviewed release after the recorded corrections. This acceptance applies to the 37 existing release files listed in `final-file-hashes.json`. It permits adding the acceptance record and freeze metadata without changing those reviewed files.

## Accepted output

The release preserves all 3,211 candidate observations in five disjoint partitions: 47 main scientific inputs, 666 sensitivity additions, 1,506 descriptive records, 835 held records and 157 duplicate representations. Each observation has an alignment decision, overlap decision, reason and evidence. Paper counts across partitions are not independent study counts.

`main_scientific_input_selected` is separate from actual model eligibility. `primary_model_eligible` is false throughout. This acceptance is for the reviewed input partition and its reproducibility, not permission to fit an unspecified model.

## Checks performed independently

- The complete observation-ID set equals the 3,211-row master. The five partition CSVs are disjoint, cover every observation and match the all-records CSV exactly.
- The reviewed source-context file retains 646 source rows. All 562,020 retained source cells match the frozen candidate source exactly. Demographics, original definitions, source notes and source links remain intact in the observation table.
- The only change among observed count, exposure, rate, days and interval fields is S300's documented transfer of its 312 match-only total injuries into the match numerator. Its original blank and source evidence remain available. S055 retains the adjudicated 30/251 and 19/545.2 positive-day subsets.
- S005, S086, S156 and S623 remain held for the specific denominator or source-count concerns. The S551 parent fracture rate remains available when a child target is missing. The nested S1431 restricted targets without corresponding anchor outcomes are retained for their own target assessment.
- The 30 count-bearing or days-bearing records previously threatened by descriptive aliases now comprise six main and 22 sensitivity records, with two parents replaced by verified quantitative granular representations. S3931 and S1665 zero-event arms retain their observed counts and exposures.
- No selected parent and selected granular child in the recorded partition groups share the same final metric, setting, scope and threshold target. Canonical outcome selection therefore does not bypass those population gates in this release.
- Specialist scopes retain their narrow outcomes. The final checks include S300, S1665, S2040, S2823, S3931, S4800 and the final S755, S604, S1299 and S482 corrections. S755's combined hamstring-strain and groin numerator is distinct from either component target.
- Supported reverse exposure remains a sensitivity route using an observed count and matched crude rate, with a separate approximate exposure value and no invented precision bounds. No reconstructed integer event count is promoted. The S2147 source check identifies its printed rate as a GLMM estimate; its observed 611-count/143,573-hour route is retained separately and no ten-event subtraction is made.
- The copied build recipe passed seven focused tests. An independent rebuild from the copied inputs reproduced all seven generated CSVs byte for byte. `validation.json` has different input-path strings in the replay, with matching source hashes. The owner's separate execution record reports 64 passing tests; this reviewer did not rerun that entire suite.

## Scope limits

This is a review of the saved extraction, existing source audits and targeted conflicts across these 3,211 candidates. It is not a new full-PDF audit of every paper, proof of independence from all external studies, or certification of current systematic-review screening status. S1680 retains an explicit screening-confirmation gate before fitting.

The 835 held records have unresolved source, scope, denominator or overlap questions. They remain available for a later release. Descriptive rates do not become count data merely because a rate is numeric. Rate-and-interval inputs, days-lost inputs, approximate exposure, target choice and dependence structure still require the appropriate model specification and validation. Different target keys are not automatically independent observations. No model was fitted.

The original exact-hours count diagnostic is not used to promote counts in this release. Any future integer recovery must use verified original rate and exposure precision, suitable rounding bounds and an unadjusted matched crude-rate identity. Its conditional result must remain distinguishable from an observed count.

## Evidence binding

- `final-file-hashes.json` binds the 37 reviewed release files.
- `final-validation.json` records exhaustive partition and source-field checks.
- `final-scientific-checks.json` records the selected overlap, canonical-case and independent replay checks.
- `source-context-check.json` records the exact source-cell comparison.
- `initial-review.md` and `same-outcome-information-loss.csv` preserve the findings and their scope before integration.
