# Aspetar ASPREV reconciliation

Completed: 27 July 2026

## Architecture

The reconciliation uses three existing-paper anchors. No synthetic Aspetar master was created.

| Surveillance family | Anchor | Included source rows | Sources not independently extracted |
| --- | --- | --- | --- |
| Qatar Stars League professional programme | S2824 | S195 historical 2008/09 all-injury; S344 groin; S555 ACL; S712 head/neck-concussion | S544 and S3577 are covered by S344 |
| Aspire Academy | S261 | S1431 later 2016/17-2018/19 U13-U15 cohort | S071 is a duplicate manuscript alias of S261 |
| AFC multicountry professional cohort | S602 | S602 only | None |

The professional league, youth academy, and AFC multicountry denominators remain separate. Topic supplements that overlap S2824 are source-scoped rows and must not be summed as independent all-injury cohorts.

## Where the supplementary data now lives

Yes, directly supported data from five companion papers were added to the grouped anchors:

| Supplement source | Data added to | How it is represented |
| --- | --- | --- |
| S1431 | S261 | One labelled later-period U13-U15 academy row containing direct core and compatible Table 1 values |
| S195 | S2824 | One labelled historical 2008/09 all-injury row |
| S344 | S2824 | One labelled 2013/14-2014/15 groin-specific topic row |
| S555 | S2824 | One labelled 2013/14-2017/18 ACL-specific topic row |
| S712 | S2824 | One labelled 2013/14-2020/21 head/neck-concussion-specific topic row |

The original companion paper records were not cleared or deleted. Where they already had extraction data, those source records still retain it. For grouped analysis, the anchor row is the selected representation and the original companion record is source provenance, so both representations must not be counted together.

No supplementary data were added from S071, S544, or S3577. S071 is a duplicate alias of S261. S544 and S3577 are covered by the S344 groin row. S602 was extracted on its own record as a separate anchor.

One explicit source-family treatment note was added to all 11 live paper records on 27 July 2026. The notes name the classification, the selected anchor, exactly where supplementary values were represented, and the duplicate-counting rule. The note-only final gate confirmed that extraction fields, population groups and values, statuses, flags, assignments, source IDs, and protected screening metadata were unchanged.

An independent `sol_xhigh` T4 review accepted the 11-note update with no P0, P1, or P2 findings.

## Source identity and overlap decisions

- S2824 is the strongest modern Qatar Stars League all-injury anchor: 17 clubs, 1,466 unique players, 746,384 player-hours, 4,789 injuries, and eight seasons from 2014/15 to 2021/22.
- S195 covers August 2008 to April 2009 and is disjoint from S2824's modern period.
- S344 and S544 share the 2013/14-2014/15 programme and the same 205,466-hour exposure. Their 606 versus 579 player counts reflect analytic selection, not independent surveillance denominators.
- S3577 is a retrospective limb-asymmetry analysis of the S344 cohort and adds no independent denominator.
- S555 and S712 overlap the professional programme but add ACL-specific and head/neck-concussion-specific detail only.
- S071 and S261 have the same four-season, 551-player U9-U19 academy study identity. S261 is the final publication and S071 is the manuscript alias.
- S1431 is the same academy affiliation but a later, non-overlapping 2016/17-2018/19 U13-U15 cohort.
- S602 covers 22 teams across nine countries from 2017 to 2019, so it remains separate from the Qatar Stars League.

The source-family ledger records all 11 classifications, exact PDF SHA-256 values, and the architecture rationale.

## Live changes

| Anchor | Population rows | Population values | Extraction-field result |
| --- | ---: | ---: | --- |
| S261 | 13 | 652 | 129 staged fields verified; 117 new fields and 6 changed fields relative to the rollback snapshot |
| S2824 | 13 | 216 | Four source-scoped rows appended to the existing nine; 57 staged fields verified and every prior non-empty anchor value retained as an unchanged value or prefix |
| S602 | 4 | 98 | 102 staged fields verified; 91 new fields and 7 changed fields relative to the rollback snapshot |

One dated reconciliation note was added to each anchor. No source status, assignment, flag reason, source attachment, screening vote, or protected screening metadata was changed.

## Preserved source discrepancies

- S261's pooled Supplementary Table 3 reports Knee 218 and Lower leg/calf 105, while the age rows sum to Knee 168 and Lower leg/calf 155. Both source views total 323. Both were retained in their directly supported rows without reassignment.
- S602 prints total exposure of 232,665 hours, while its three season values of 72,431, 80,470, and 80,470 hours sum to 233,371 hours. Both printed views were retained.
- S602 states that the cohort spans nine countries but enumerates ten jurisdictions, including China and Hong Kong separately. Both printed views were retained.
- Four legacy duplicate field aliases on S261 and S602 were aligned to the canonical direct-source values before the final population rebuild. Their exact prior rows and replacement values are preserved in the alias-repair audit.

## Integrity result

The focused live gate passed with no warnings or failures:

- exact 11-paper source-family membership;
- exact three-anchor apply membership;
- all staged fields equal live values;
- all extraction-to-population dual writes agree;
- all extraction study IDs equal assigned study IDs;
- all dated reconciliation notes are present exactly once;
- source files, statuses, assignments, and flags are unchanged;
- protected screening signature unchanged at `7179d619e77b17c99f088f118253ebb5707638ad94ba603ae68052cb1a70dbd7`;
- both relevant extraction backlogs updated.

Rollback evidence is retained in `aspetar-pre-apply-live-rollback-snapshot-2026-07-27.json`.
