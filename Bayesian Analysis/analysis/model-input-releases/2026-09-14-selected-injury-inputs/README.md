# Reviewed injury analysis inputs

This release separates scientific input selection from model fitting. One observation is one reported or source-supported metric for a population, setting and injury outcome. Rows are not independent studies.

## Files

- `injury-all-reviewed-observations.csv` preserves all 3,211 candidate observations and their decisions.
- `injury-main-analysis.csv` contains selected inputs satisfying the main definition and sampling-information gates.
- `injury-sensitivity-additions.csv` contains selected additions for explicitly flagged sensitivity analyses. Combine only the relevant additions with the corresponding main target.
- `injury-descriptive-only.csv` retains supported rates without sufficient sampling information for the current quantitative routes.
- `injury-held-records.csv` retains unresolved source, denominator, scope or overlap conflicts and reasons.
- `injury-duplicate-representations.csv` retains alternative representations and their links.
- `coverage-by-target.csv` shows observation and paper counts by disposition, metric, setting, scope and discipline. These counts must not be summed to infer independent studies.
- `analysis-source-context.csv` retains the full non-illness source context. Join using `sourceDataRow`, not file position. Original source links remain in every observation.

Clinical and population descriptors remain explicit, including location, tissue type, diagnosis, onset, position, laterality, sex, age, level, geography and discipline. Original clinical descriptors are retained in `candidate_*` fields when the reviewed scope differs.

## Use

Choose a scientific target before using rows. Keep overall, match and training estimates separate. An anatomical, tissue-specific, overuse-only or other restricted outcome contributes to that target, never to an all-injury estimate. Respect `overlap_family`, `cohort_family`, parent/duplicate links and shared cohorts across targets. Separate target keys do not imply independent observations.

`main_scientific_input_selected` records the scientific selection. `primary_model_eligible` remains false because the exact likelihood, dependency structure and target-specific model specification have not been implemented or validated. No model has been fitted. Screening eligibility is outside this data review; S1680 carries an explicit pre-fit screening-status check.

Use `sampling_information_route` to distinguish observed counts with player-hours, days lost with player-hours, rates with reported intervals, approximate reconstructed exposure, and descriptive rates. Days lost are not injury event counts. A rate with an interval does not automatically qualify for a count likelihood. Neither SD nor rounding compatibility is a confidence interval.

Supported reverse exposure uses the observed count and matched crude reported rate. It remains in a separate approximate exposure field and is a sensitivity input. Unknown original decimal precision means no rounding bounds are claimed. Approximate reverse count proposals remain proposals, not observed or reconstructed integer event counts.

S300 uses the source-verified 312 total injuries as its match count because the study is match-only. The original blank candidate match count, source field, correction reason and evidence are retained. This is a source-supported count transfer, not reverse estimation.

Missing values remain blank unless a documented source correction supplies the value, and zeros remain zero. The release does not add imputed days, convert athlete exposures to hours, or change frozen source cells. Review flags from the candidate phase remain available for provenance; the explicit final decisions determine this release's disposition.

## Limits and reproducibility

This is a review of the saved extraction and existing source audits, including targeted conflicts. It is not a fresh full-PDF audit of every paper. Held observations remain available for a later corrected release; they are not silently deleted or assumed irrelevant.

The review decision maps, input master, source context and build script are retained with file hashes. Rebuild CSV outputs in a new directory using the copied script and its `--working` and `--review` paths. Never rebuild over a frozen release. The validation record and independent review describe the checks actually performed.
