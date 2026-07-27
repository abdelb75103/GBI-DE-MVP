# FIFA and international tournament source-family reconciliation

Date: 27 July 2026

## Decision

The live representation is a hybrid source ledger:

1. Keep a separate anchor record for a tournament when a tournament-specific publication exists.
2. Keep multi-tournament publications as row-level ledgers only for tournaments that do not have a stronger standalone anchor.
3. Keep pooled reviews and subgroup analyses as supplements. They may add disjoint mechanism, diagnosis, location, severity, burden or phase data, but they must not contribute a second tournament denominator.
4. Do not create a synthetic master paper. Existing records already preserve source provenance and are simpler to audit.

This model prevents duplicated denominators while preserving direct source ownership. It also avoids moving ECIS club-season sources into a national-team tournament family merely because a title mentions a World Cup season.

## Live and audit-history inventory

| Study | Search or recovery route | Live status at review | Family role |
| --- | --- | --- | --- |
| S010 | First search, FIFA tagged | `fifa_data` | 2014 World Cup anchor, already complete |
| S037 | First search, status-only filter would miss | `extracted` | Early FIFA multi-tournament row ledger |
| S039 | First search, FIFA tagged | `fifa_data` | 2002/2006/2010 foul-play supplement |
| S048 | First search, FIFA tagged | `fifa_data` | 2009 Confederations Cup anchor |
| S059 | First search, FIFA tagged | `fifa_data` | 2010 World Cup anchor |
| S064 | First search, status-only filter would miss | `extracted` | Women's World Cup, Olympic and youth row ledger |
| S078 | First search, status-only filter would miss | `extracted` | Futsal World Cup row ledger |
| S081 | First search, flagged source recovery | `flagged`, corrected to `fifa_data` | 2006 World Cup anchor |
| S096 | First search, status-only filter would miss | `retrospective_substudy_analysis` | Shared 2002/2006/2010 score-state supplement |
| S109 | First search, status-only filter would miss | `extracted` | UEFA senior and youth national-tournament ledger |
| S162 | First search, status-only filter would miss | `extracted` | 2017 Gold Cup anchor |
| S256 | First search, FIFA tagged | `fifa_data` | Pooled FIFA trend supplement only |
| S259 | First search, status-only filter would miss | `extracted` | 2004 Olympic multisport companion |
| S272 | First search, status-only filter would miss | `extracted` | Copa América 2011 anchor |
| S277 | First search, FIFA tagged | `fifa_data` | 2002 World Cup anchor |
| S292 | First search, status-only filter would miss | `extracted` | African international-competition series |
| S378 | First search, status-only filter would miss | `extracted` | UEFA Regions' Cup 2019 anchor |
| S391 | First search, status-only filter would miss | `extracted` | EURO 2004, Women's EURO 2005 and U-19 2005 ledger |
| S640 | First search, extracted subset | `extracted` | One-team 2010 World Cup supplement |
| S1328 | Second search | `flagged` | Copa América 2019 audit-only protocol source |
| S2615 | Second search | `extracted` | Qatar 2022 anchor |
| S3881 | Second search | `extracted` | Women's World Cup 2023 anchor |
| S4652 | Second search, comparable title | `extracted` | CONMEBOL club-tournament comparator |
| S4691 | Second search | `flagged` | Gold Cup 2019 audit-only, no exposure |
| S5151 | Second search, misleading World Cup wording | `uefa` | ECIS club-season source, excluded from this family |
| S5338 | Second search | `extracted` | EURO 2024 and Copa América 2024 two-row anchor |
| S558 | Local audit history | `archived` | Public or video craniofacial audit, no eligible denominator |
| S3229 | Local second-search screening history | no promoted live paper located | Qatar 2022 possible-concussion video audit |

## Tournament source map

| Tournament or series | Primary live anchor | Supplements or overlapping ledgers | Counting rule |
| --- | --- | --- | --- |
| FIFA World Cup 1998 | S037 | S256 pooled trend | Use the S037 tournament row. Exclude the corresponding S256 contribution from denominator aggregation. |
| FIFA Women's World Cup 1999 | S064 | S037; S256 pooled trend | Use the S064 women's-tournament row. Treat S037 and S256 as overlapping context. |
| FIFA U-20 World Cup 1999 | S037 | S256 pooled age-category trend | Use S037 row only. |
| FIFA U-17 World Cup 1999 | S037 | S256 pooled age-category trend | Use S037 row only. |
| FIFA Confederations Cup 1999 | S037 | S256 pooled Confederations trend | Use S037 row only. |
| FIFA Club World Cup 2000 | S037 | S256 pooled Club World Cup trend | Use S037 row only. |
| Men's Olympic football 2000 | S037 | S256 pooled Olympic trend | Use S037 row only. |
| Women's Olympic football 2000 | S064 | S037; S256 pooled Olympic trend | Use S064 row. S037 and S256 overlap the same tournament. |
| FIFA Futsal World Cup 2000 | S078 | S037 includes the same event | Use S078 as the discipline-specific anchor. |
| FIFA U-20 World Cup 2001 | S037 | S256 pooled age-category trend | Use S037 row only. |
| FIFA U-17 World Cup 2001 | S037 | S256 pooled age-category trend | Use S037 row only. |
| FIFA Confederations Cup 2001 | S037 | S256 pooled Confederations trend | Use S037 row only. |
| FIFA World Cup 2002 | S277 | S039 foul-play subgroup; S096 score-state subgroup; S256 pooled trend | S277 owns the denominator. S039 and S096 are supplement-only and cannot create tournament rows. |
| FIFA Women's World Cup 2003 | S064 | S256 pooled trend | Use S064 row only. |
| UEFA EURO 2004 | S391 | S256 broad world-tournament context | Use S391 tournament row. |
| Women's Olympic football 2004 | S064 | S259 Olympic team-sport surveillance; S256 pooled trend | Use S064 for the football denominator. S259 is multisport context or a disjoint-method supplement. |
| FIFA Futsal World Cup 2004 | S078 | None stronger located | Use S078 row. |
| UEFA Women's EURO 2005 | S391 | None stronger located | Use S391 row. |
| UEFA Men's U-19 Championship 2005 | S391 | None stronger located | Use S391 row. |
| FIFA World Cup 2006 | S081 | S039 foul-play subgroup; S096 score-state subgroup; S256 pooled trend | S081 owns the denominator. S039 and S096 are supplement-only. |
| FIFA Women's U-20 World Cup 2006 | S064 | S256 pooled age-category trend | Use S064 row. |
| UEFA national-team championships 2006 to 2008 | S109 | S256 pooled FIFA youth trend is methodologically separate | S109 is one pooled surveillance-series denominator across the reported senior and youth championships. Do not treat it as separate tournament rows. This is national-team surveillance, not the ECIS club cohort. |
| FIFA Futsal World Cup 2008 | S078 | None stronger located | Use S078 row. |
| FIFA Confederations Cup 2009 | S048 | S256 pooled Confederations trend | S048 owns injury and illness denominator, exposure, severity, location and system data. |
| FIFA World Cup 2010 | S059 | S039 foul-play subgroup; S096 score-state subgroup; S640 single-team rehabilitation/workload subset; S256 pooled trend | S059 owns the denominator. S039, S096 and S640 are supplements only. |
| Copa América 2011 | S272 | None stronger located | Use S272 row. |
| FIFA World Cup 2014 | S010 | None stronger located | Use S010 standalone tournament record. |
| CONCACAF Gold Cup 2017 | S162 | None stronger located | Use S162 standalone tournament record. |
| Copa América 2019 | No eligible live denominator | S1328 protocol analysis | Audit-only. S1328 uses an inconsistent team or exposure denominator and must not be promoted into the tournament count. |
| UEFA Regions' Cup 2019 | S378 | None stronger located | Keep as a distinct amateur regional-team tournament. |
| CONCACAF Gold Cup 2019 | No eligible exposure record | S4691 | Audit-only. Counts may remain visible, but `exclude - no exposure` prevents denominator use. |
| FIFA World Cup Qatar 2022 | S2615 | S3229 public-video possible-concussion audit | S2615 is the standalone tournament record. S3229 cannot add a medical-surveillance denominator. |
| FIFA Women's World Cup 2023 | S3881 | None stronger located | Use S3881 standalone tournament record. |
| UEFA EURO 2024 | S5338 row 1 | None stronger located | Existing reviewed extraction is valid and remains unchanged. |
| CONMEBOL Copa América 2024 | S5338 row 2 | S4652 is club competition surveillance, not Copa América | Existing reviewed extraction is valid and remains unchanged. |
| African elite international competition series | S292 | No exact tournament-specific replacement located | Keep the reported series as one denominator. Do not infer separate tournament rows or merge it with FIFA or UEFA denominators. |

## Multi-tournament and companion-source rules

### S256, pooled FIFA review

S256 covers 51 FIFA tournaments and four Olympic football tournaments from 1998 to 2012. Its main analyses pool categories across Women's World Cups, Olympic tournaments, youth World Cups, men's World Cups, Confederations Cups and Club World Cups. It reports 3,944 injuries across 1,681 matches and explicitly states that 22 component tournaments had already been published.

S256 remains a valid family-level trend record. It must never be summed with S037, S064, S078, S081, S109, S277, S048, S059 or other tournament anchors. It can support cross-tournament trend interpretation only.

### S037, early FIFA tournament ledger

S037 has direct tournament rows for 12 FIFA and Olympic competitions between 1998 and 2001. It remains the anchor for early tournaments without stronger discipline-specific sources. Where S064 or S078 covers the same women's or futsal event, the discipline-specific paper wins and the S037 row becomes overlap context.

### S039 and S096, shared three-World-Cup denominator

Both reuse the 2002, 2006 and 2010 FIFA World Cup injury datasets. S039 adds foul-play and non-foul mechanism, location, diagnosis and severity subgroups. S096 adds score-state and playing-position analysis. Neither is a new tournament denominator. The S039 live layout uses two supplement rows and duplicates invariant source fields only to preserve row alignment.

### S640, single-team 2010 subset

S640 observes one national team's rehabilitation and workload during the 2010 World Cup. It is a nested team subset, not an independent World Cup cohort. It cannot be pooled with S059.

## Explicit family exclusions

- S5151 remains in the UEFA ECIS men's club-season workflow. “World Cup season” describes a season phase, not a FIFA tournament cohort.
- S4652 covers CONMEBOL Libertadores and Sudamericana club tournaments from 2022 to 2024. It does not overlap S5338's Copa América 2024 national-team denominator.
- S558 and S3229 use public or video-derived craniofacial or possible-concussion observations and lack the eligible medical-surveillance denominator required for an anchor.
- S1930 concerns a transplant football World Cup and is not the same target population.
- S5447 is commentary or non-surveillance youth material.
- S2225, S295, S362, S563, S605, S627 and S641 are domestic, club, school, amateur or open youth-tournament comparators. They remain outside the international national-team tournament family.
- S035 and S060 are referee cohorts. They are protected separate populations and are not merged into player denominators.
- S506 is a club-season comparator, not a World Cup tournament cohort.
- Papers that only mention FIFA 11 or FIFA 11+ prevention programmes are not FIFA tournament surveillance sources.

## Earlier extraction reconciliation

The following extraction work was completed and audited before the metadata-only source-treatment control was applied. It is recorded here for source-family provenance, but it is not part of the labels-and-notes write described in the methodology or the `analysis-source-treatment` audit.

The additive live batch covers:

- S039: two disjoint mechanism rows, direct location and tissue counts, and subgroup rates.
- S048: Confederations Cup injury and illness outcomes, severity, leading injury distributions and illness systems. Its 15-day duration corrects the pre-existing rounded value.
- S059: World Cup match, training and illness outcomes, total exposure, full location counts and leading illness systems or aetiology.
- S081: full eligible 2006 World Cup extraction and correction from an unexplained `flagged` status to `fifa_data`.
- S277: exposure, time-loss and structured tables, plus a provenance-preserving population-label and dual-write repair.

No live changes are warranted for S010, S256, S2615, S3881 or S5338 because their current reviewed representations already support the family decision. No assignment, screening vote, resolver state or protected screening metadata is in scope.

## Derivation register

- S039 ligament/joint-capsule and superficial-tissue parent counts are sums of directly reported subtypes.
- S048 leading location, tissue and contact counts are rounded from source percentages using the stable direct denominator of 56 injuries. They are not direct counts.
- S059 total exposure is 2,046 match player-hours plus 13,160 training player-hours.
- S277 time-loss count is 160 injuries with known consequence minus 53 injuries with no expected absence. Eleven injuries have missing consequence and are not silently classified.
- No outcome count is reverse-engineered from a rate when the denominator is ambiguous.

## Integrity expectations

The apply is additive-only. It does not delete or rebuild population data. Any pre-existing nonblank mismatch blocks the batch unless the input names the expected value and corrective justification. Final gates require:

- exact population labels and row counts;
- one population value for each nonblank canonical extraction field;
- exact line-to-row dual-write agreement;
- attached source files;
- preserved assignment;
- intended final status;
- unchanged protected screening-record and screening-vote hash.
