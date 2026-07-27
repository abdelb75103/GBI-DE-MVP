# FIFA and international tournament batch audit

Date: 27 July 2026

## Result

The hybrid source-ledger reconciliation was applied live and passed its focused integrity gate.

- Live papers changed: S039, S048, S059, S081 and S277.
- Staged source fields reviewed: 170.
- New canonical extraction fields: 168.
- Existing canonical fields corrected: 1, S048 tournament duration.
- Existing canonical field source-confirmed without change: 1, S277 most-common severity.
- Population values inserted: 304.
- Population values corrected: 2, S048 duration after schema conversion and S277 severity dual-write.
- Population groups added: 5 across S039, S048, S059 and S081.
- Population group relabelled: 1, S277 from `Row 1` to `2002 FIFA World Cup`.
- Paper status corrected: S081 from unexplained `flagged` to `fifa_data`.
- Screening votes, screening decisions and resolver metadata changed: 0.

## Paper-level transfer

| Study | Before | Final population layout | Data added or corrected |
| --- | --- | --- | --- |
| S039 | Core tabs only, no population rows | Foul play / Non-foul play | 26 subgroup outcome, location and tissue fields. Nineteen invariant canonical fields were line-expanded to keep both supplement rows aligned. The rows are mechanism supplements, not tournament denominators. |
| S048 | Core tabs only, no population row | 2009 FIFA Confederations Cup | 41 new injury, illness and structured fields. Tournament duration corrected to `2.14` weeks from the direct 15-day source interval. |
| S059 | Core tabs only, no population row | 2010 FIFA World Cup | 38 new exposure, injury, illness and structured fields. Total exposure `15206` is the transparent sum of direct match and training player-hours. |
| S081 | Sparse participant and study details, status `flagged`, no flag reason | 2006 FIFA World Cup | 40 new definition, exposure, injury and structured fields. Status corrected to `fifa_data` because the attached source has a complete eligible tournament denominator. |
| S277 | One generic row with partial outcome data | 2002 FIFA World Cup | 23 new exposure, time-loss, location and tissue fields. Existing population severity was repaired from truncated `7 days absence` to source-aligned `1-7 days absence`. |

## Overlap controls

- S277, S081 and S059 own the 2002, 2006 and 2010 World Cup denominators.
- S039 and S096 reuse those tournaments and remain supplement-only.
- S640 is a nested one-team 2010 subset.
- S256 remains a pooled 1998-2012 FIFA trend record and cannot be added to tournament anchors.
- S5338 remains the valid two-row EURO 2024 and Copa América 2024 record.
- S2615 remains the standalone Qatar 2022 record.
- S1328 and S4691 remain audit-only because they lack a consistent eligible exposure denominator.
- S5151 remains in the UEFA ECIS club-season workflow.

## Gate evidence

The final live gate returned:

- result: `passed`;
- findings: `0`;
- exact population counts: S039 `2`, S048 `1`, S059 `1`, S081 `1`, S277 `1`;
- source file attached for all five papers;
- assignment preserved for all five papers;
- intended final status for all five papers;
- extraction-to-population dual-write mismatches: `0`;
- protected screening hash unchanged: `07022647d891b8f3472b3d8a444c60e7d705aa0991eba445d2d60d8e78336fb0`.

## Artefacts

- Source-family decision and tournament map: `fifa-gbi-data-extraction/data/tournament-family-reconciliation/2026-07-27/fifa-international-tournament-source-ledger-2026-07-27.md`
- Staged additive input: `fifa-gbi-data-extraction/data/tournament-family-reconciliation/2026-07-27/fifa-international-tournament-additive-input-2026-07-27.json`
- Apply and verification script: `fifa-gbi-data-extraction/scripts/apply-fifa-tournament-reconciliation.mjs`
- Pre-apply safety snapshot: `fifa-gbi-data-extraction/data/tournament-family-reconciliation/2026-07-27/fifa-international-tournament-pre-apply-live-snapshot-2026-07-27.json`
- Final live state and integrity audit: `fifa-gbi-data-extraction/data/tournament-family-reconciliation/2026-07-27/fifa-international-tournament-final-live-integrity-audit-2026-07-27.json`

The first apply attempt stopped after S039 extraction fields and population labels because `population_values` has no unique constraint suitable for an upsert. No population values were written in that attempt. The script was changed to explicit insert-or-update logic, the full dry run passed again, and the idempotent resume completed the batch. No deletion or destructive population rebuild was used.
