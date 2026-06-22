# Second Search Full-Text Abstract And Surveillance Correction Sweep - 2026-06-22

Scope: `Second search - Ishanka - 2026-05-26` live full-text screening corrections for abstract-only records and league-surveillance denominator mistakes.

## Corrected records

- `S1758`: corrected to full-text exclude reason `Abstract`. The attached source is a conference abstract (`BMJ Open Sport and Exercise Medicine`, Supplement 1, `A6`), not a full paper.
- `S1843`: corrected to full-text exclude reason `Abstract`. The source is an `AOSSM 2024` conference abstract and should not sit under the public-source bucket.
- `S4793`: corrected from full-text `exclude` for `No exposure reported (no usable denominator)` to `include`. The paper reports football-specific injury-rate results from the MLS Injury Surveillance Database, so the league database is the reporting channel rather than an ineligible data source or a denominator failure.
- `S4778`: corrected from full-text `exclude` for `No exposure reported (no usable denominator)` to `include` for the same MLS surveillance reason.

## Preventive rule update

- Added `Abstract` to the full-text exclusion picker.
- Updated the full-text criteria text to say:
  - abstract-only PDFs/pages should be excluded as `Abstract`;
  - published football-specific rate results from league/current-player surveillance remain eligible even if every raw exposure total is not printed.
- Updated the no-exposure workflow and live-extraction skill so future reviews do not route these two cases into the wrong bucket.

## Sweep result

- Conference-abstract full-text records with an existing non-abstract exclusion reason: `S1843` only.
- MLS/current-player surveillance full-text excludes mislabelled as denominator failures in this sweep: `S4793`, `S4778`.
