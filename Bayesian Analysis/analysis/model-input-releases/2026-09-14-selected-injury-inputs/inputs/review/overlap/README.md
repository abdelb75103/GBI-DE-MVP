# Overlap representation selection

`observation-selection.csv` assigns one `select`, `duplicate` or `hold` decision to every one of the 3,211 working-master observations. It resolves representation overlap and applies the final source-alignment gate. Likelihood choice and final model selection remain separate.

The selection contains 2219 selects, 157 duplicates and 835 holds. Holds cover specific alignment gaps, unresolved competing parent/child representations and unverified matching parent/category pairs.

`verified-named-partitions.csv` records the ten source-row partitions accepted only where the prior review verified three or more quantity fields. Its parent is a duplicate only when every named child has the exact final target and alignment support.

`historical-family-links.csv` has the 28 study IDs from the historical source-family ledger that occur in this working master. It records each anchor, nested subset or separate family without treating a specialist outcome as a duplicate solely because its cohort overlaps an all-injury anchor.

The `analysis_target` and `setting_handling` columns keep overall combined, match and training results as distinct targets. A later likelihood must not pool an overall combined result with its match/training components as interchangeable evidence.

`quantitative-pair-coverage-review.csv` records every matching parent/detail pair where retaining source sampling information affected the representation decision.

`checks.json` records contract and selection checks. `summary.json` records exact input hashes, including the alignment decision file. No source file changed and no model was fitted.
