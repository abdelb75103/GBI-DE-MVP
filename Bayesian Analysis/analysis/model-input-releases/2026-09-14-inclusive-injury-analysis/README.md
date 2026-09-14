# Injury analysis data release

Use `injury-analysis.csv`. It retains all 3,211 observations from 285 papers and the full source context. `analysis_eligible=true` identifies 2,219 supported, selected observations from 220 papers: 1,892 incidence and 327 burden results. These are results, not independent cohorts. Do not sum overlapping events or exposure across outcome and setting rows.

The approved rule is source-defined time-loss injury with compatible player-hours. Alternative or unspecified thresholds and rate-only evidence remain eligible. Definition wording, duration status, restrictive-threshold flags and manual-review notes are adjacent. Seven-day entry thresholds can omit shorter injuries and lower incidence. Restricted diagnoses remain available for their actual targets. Source conflicts and duplicate representations remain in this file with flags; eligibility does not resolve an outstanding screening-status gate.

All clinical descriptors, locations, injury types, incidence, burden, uncertainty, populations and source fields are retained. Original decisions are preserved as `previous_*` where superseded. No original numeric values, blanks or zeros were changed. Source-defined time loss does not reinstate S055 current-match-only stoppages previously excluded by explicit adjudication.

Eligibility is complete under the approved rule. Before fitting, specify target-specific likelihoods, sampling uncertainty and dependence, then freeze each model's exact row selection. Rate-only evidence is not excluded because a likelihood has not yet been implemented. No model has been fitted.

Replay from the Bayesian Analysis directory:

```sh
python3 analysis/model-input-releases/2026-09-14-inclusive-injury-analysis/recipe/build_inclusive_injury.py --source analysis/model-input-releases/2026-09-14-selected-injury-inputs --output /tmp/inclusive-injury-replay
```

The source release remains frozen. `summary.json` records its exact hashes and the output hash. Independent acceptance is retained with this release. This review reuses the accepted source audit; it is not a new audit of every PDF.
