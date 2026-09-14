# Inclusive injury CSV acceptance review

Status: accepted for the bounded code and CSV scope. Final preservation, eligibility, adjacent-definition annotation and replay checks pass for the files listed in `verification.json`. The owner confirmed that the exporter and CSV were stable before the final check. Documentation, pointers and checklist edits are outside this acceptance.

## Scope

Review the revised source-defined time-loss/player-hours rule, retained records, flags and reproducibility. Reuse the accepted alignment and overlap evidence. This review does not repeat the source PDF audit, adjudicate screening status or approve model fitting.

## Resolved finding

The first export left unspecified durations unflagged beside the definition. The final export adds `definition_threshold_status`, `definition_threshold_note` and `definition_evidence_field`. Missing durations are now explicit and their wording remains available, including missed-session definitions. Eligibility is unchanged. No blocker remains within the reviewed scope.

## Checks passed

- All 3,211 observations across 285 papers remain in their original order, with unique observation IDs.
- All 398,164 original observation cells match, including 147,154 blanks and 384 literal zeros. All 2,793,570 expanded source-context cells match their source rows.
- Eligibility is exactly source alignment supported and overlap selection select. There are 2,219 eligible observations across 220 papers, comprising 1,892 incidence and 327 burden observations.
- All 1,506 selected rates without reported sampling uncertainty remain eligible. Each distinct alignment-hold reason has a separate source, numerator, denominator or outcome-scope concern; none is solely an unavailable likelihood or unspecified threshold.
- All 157 duplicate representations remain flagged with reasons and valid observation links. Source holds and the S1680 screening gate remain visible.
- Longer thresholds remain eligible when the source and overlap gates pass. The selected seven-day definitions cover six observations from S1447, S594 and S604. The eight retained seven-day observations are all marked high-priority definition review.
- The parser reads definition wording only. Severity fields are unchanged. The mixed complaint duration in S260 is not converted into a time-loss threshold.
- Prior strict route and model-readiness fields are retained under `previous_` names. Every row states that likelihood and target-specific dependence must be specified before fitting.
- The CSV and summary replay byte-identically using the exporter and retained inputs.

Run `python3 protocol-v2/inclusive-injury-review-2026-09-14/acceptance/check_inclusive.py` from the Bayesian Analysis directory to repeat the checks. `verification.json` records exact code, CSV, summary and input hashes. These are counts of papers and observations, not a claim that every selected observation is independent or ready for one pooled model.

## Final binding

- Exporter SHA-256: `d834d218956cf02cb61c4e7697f44c3dc9f0673eff10acbf6d65a44288619d1b`.
- CSV SHA-256: `37c7487ac85798a8bb62644647b532b314edcee43e12b8810cffa17c98f26205`.
- Summary SHA-256: `e1d680f8f2befac5833cfdba358521119bb82863888e75c3ddcf2dd6b8ee74dc`.

Confidence is high for the implementation and cell-preservation checks. Source validity remains bounded by the previously accepted audit. Review edits are confined to this acceptance directory; the reviewer changed no source or illness file and fitted no model.
