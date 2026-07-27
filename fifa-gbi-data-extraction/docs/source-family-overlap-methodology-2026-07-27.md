# Source-family overlap audit methodology, 27 July 2026

## Purpose and boundary

This audit extends the tournament-family analysis-source policy to every paper in the live corpus. Its purpose is to prevent the same participants, exposure, injuries or programme period from owning more than one denominator in the default analysis export, while keeping every source and every extracted row available in source scope.

The live write boundary was deliberately narrow:

- merge `papers.metadata.analysisSourceTreatment`;
- append one exact audit note per treated paper;
- do not change extraction fields, population groups, population values, paper files, status, assignment, screening records or screening votes.

No grouped master, extraction value or population row was created, deleted or edited in this workflow.

## Corpus and candidate sweep

The complete live inventory covered 842 papers, 3,939 extractions, 1,438 population groups and 420 pre-existing notes. The deterministic candidate pass compared:

- DOI, normalised DOI, duplicate keys and title fingerprints;
- primary-file identity and SHA-256;
- title, author, journal and year similarity;
- sample size, observation period, exposure and injury totals;
- existing source links, family notes and known grouped masters.

It produced 901 candidate pairs: 1 file/identity-level pair, 31 bibliographic duplicates, 47 strong cohort candidates, 11 moderate cohort candidates and 811 weak similarities. Connected candidate components were reviewed against the live extraction rows and, for ambiguous high-risk pairs, the primary full text. The resulting ledger has 48 governed source families, 11 explicit non-overlap or preserved-treatment dispositions, no unreviewed candidate component and no row-identity gap.

The inventory is frozen in `complete-candidate-inventory-2026-07-27.json`. Its live-corpus hash is `91a0ce8bd8ef3f89bc6eb35a2be687663bc033fb8111007e3df8eda02f05e737`; its candidate hash is `21b1b8f07cc2d88dccd79f1aad0554abc641fd21f89d0b649f375b9f605905c8`.

The UEFA decision generator is self-contained. `uefa-source-family-evidence-input-2026-07-27.json` freezes the exact ECIS and second-search ledger sections used in this audit, with the SHA-256 of the user-owned source audit from which they were derived. The generator does not depend on uncommitted files outside this scoped artefact set.

## Decision hierarchy

Each paper is assigned one analysis role:

1. `anchor`: the best denominator-owning paper or existing grouped master.
2. `multi_tournament_ledger`: one paper with independently identifiable tournament rows.
3. `supplement` or `cross_tournament_supplement`: overlapping source material retained for provenance but excluded from default denominator aggregation.
4. `nested_subset`: a restricted age, diagnosis, period or subgroup inside an anchor cohort.
5. `audit_only`: useful source evidence without an independent, combinable denominator.
6. `separate_family`: superficially similar evidence shown to be a different cohort.
7. `standalone`: no demonstrated source-family overlap.

The anchor was chosen using denominator completeness, population and period coverage, direct reporting, stable row identity and compatibility with the existing master or validated tournament policy. A newer paper did not automatically replace an earlier anchor when the periods were disjoint.

Every complete row policy binds position, label and selected extracted values. Export fails closed if a row moves, changes label, changes a bound value, appears without a policy, or is omitted from a policy marked complete.

## Main governed families

The exact paper-by-paper mapping, role, anchor link, evidence, note text and row mode is recorded in `source-family-decision-ledger-2026-07-27.json`. The major families are:

- UEFA ECIS men: `UEFA-ECIS-MASTER` remains the grouped source of truth. Only its all-injury 2001/02 to 2018/19 row and disjoint 2022/23 row own default denominators. Diagnosis, prognosis, risk-factor and overlapping programme publications are source-only.
- UEFA WECIS women: S112 owns the pooled denominator; duplicate S1091 is source-only and season rows remain source-scope evidence.
- Aspire Academy: S261 owns 2012/13 to 2015/16 and S076 owns 2016/17 to 2019/20. S1431 is a nested U13 to U15 subset of the later period. The duplicated S1431 row embedded in S261 is excluded.
- Qatar Stars League: S2824 owns the pooled 2014/15 to 2021/22 period and the disjoint historical S195 2008/09 row. Component-season and diagnosis-specific publications are source-only.
- AFC multicountry: S602 owns the pooled professional-club denominator.
- German youth academy: S075 owns the 2012/13 cohort. S047 and S630 reuse the same 138 players, 41,973 hours and 109 injuries; S1389 is a long-term career follow-up of that academy cohort.
- Australian academy: S421 owns the 118-player 2017 to 2020 denominator; S600 is a restricted phase reanalysis.
- English FA academy: S452 and S454 use the same 41-academy registration database for diagnosis-specific thigh and knee analyses. Neither is promoted as a general all-injury anchor.
- FIFA 11+ collegiate: S628 owns the trial denominator; S026 is a secondary analysis and S116 is its bibliographic duplicate.
- 11+ Kids: S481 owns the multicountry trial denominator; S430 is a secondary analysis.
- Existing FIFA and other tournament families: the committed tournament reconciliation remains authoritative and is included in the combined export verification.

The remaining governed duplicate and nested families, including FUNBALL, Dutch amateur/professional, menstrual-cycle, A-League, #ReadyToPlay, futsal, academy, prevention-trial and import-alias families, are enumerated without abbreviation in the decision ledger.

## Explicit non-overlap decisions

Strong-looking similarities that were not treated as shared denominators are retained in the decision ledger. These include S050/S594, S176/S212, S188/S396, S620/S707, S392/S457 and S4562/S4619. They are different regions, periods, sexes, tournaments or disciplines. S309 is not part of the German youth academy family, and S3946 is not part of Aspire Academy.

S209 is source-only because its methods identify an earlier Norwegian randomised trial as the parent dataset, but that parent paper is not present in the live corpus. This is the only external-parent provenance item that cannot be linked to an in-corpus anchor. It is not an unreviewed candidate and contributes no default denominator.

## Live application and integrity proof

The guarded live apply updated 155 metadata records and appended 155 audit notes. It included 45 papers and excluded 110 papers at this extension layer. Across 97 complete row policies, 86 rows remain analysis-eligible and 184 rows are source-only.

Before and after the update, the protected-state aggregate hash was:

`b76ef7e3fb7cfb30b1a46fba688413dacb51b7f91c9c1d5f9d593c4525d924ec`

The category hashes for papers excluding the new treatment, pre-existing notes, files, extractions, population groups and values, screening records, and screening votes also matched exactly. The full pre-apply snapshot and final integrity result are retained beside the decision ledger.

The first post-apply verification exposed a local artefact-lifecycle defect: `--verify` rewrote the pre-apply snapshot path. It did not perform a live write. The apply script was corrected so verification never writes that path. The rollback metadata was reconstructed by removing the newly applied treatment from each current full metadata object and restoring any prior treatment from the frozen pre-write inventory. The snapshot records this reconstruction, its inputs and the matching protected hash. A second verification proved that the corrected path leaves the reconstructed snapshot intact.

A later end-state re-read found one post-window paper-metadata drift: S3577’s `activeSession.lastHeartbeatAt` advanced from 15 July to 27 July while another session was active. No extraction, population, file, status, assignment, screening or note value changed, and the apply-time before/after hashes remain identical. The heartbeat is recorded here as concurrent ephemeral activity, not attributed to this audit.

## Export verification

The real application exporters were run across the union of this extension and the previously validated tournament treatment:

- 182 audited papers requested;
- 63 papers included and 119 excluded in analysis scope;
- all 182 papers retained in source scope;
- 128 analysis CSV rows and 388 source CSV rows;
- 104 complete row policies exercised;
- analysis JSON, analysis CSV, source JSON and source CSV paper sets matched exactly;
- every staged analysis row and source-only row matched its bound position, label and key in both JSON and CSV;
- total CSV row counts matched the corresponding JSON population shape, detecting CSV-only drops or duplicates.

The exact included IDs, excluded IDs, excluded row keys, source row keys and hashes of all four generated export payloads are in `analysis-and-source-export-live-verification-2026-07-27.json`.

The exporter verification uses deterministic 20-paper batches because a full 182-paper fan-out caused transient Supabase origin timeouts. It still runs every requested paper through the real application exporter. The current largest paper has 652 population values, below the Supabase row cap. The underlying per-paper exporter queries are not paginated, so a future paper above that cap is a documented P2 engineering risk rather than a current audit gap.

## Rollback

The pre-apply snapshot contains every original metadata object and note state for the 155 treated papers. A rollback, if separately approved, would restore each original metadata object with an optimistic timestamp check and remove only the 155 exact notes inserted by this workflow. That would be destructive and is not part of this audit.
