# Authoritative injury analysis CSV

`injury-analysis.csv` contains exactly 2,219 eligible results from 220 papers: 1,892 incidence and 327 burden. All 1,012 columns and selected cell values are unchanged from the reviewed audit release. Alternative definitions, review flags, clinical descriptors and source context remain.

The complete 3,211-row, 285-paper audit CSV remains immutable in `../2026-09-14-inclusive-injury-analysis/injury-analysis.csv`. It is not the modelling input. `analysis/MODEL_INPUT_CURRENT.json` identifies this eligible-only release as authoritative.

Eligibility is complete. These results are not independent observations for one pooled likelihood. Next specify outcomes, likelihoods, uncertainty and within-study dependence, and freeze model-specific row selections. Outstanding screening and source flags remain visible. No model has been fitted.

Run the canonical builder in `analysis/standardisation-tools/` to reproduce this subset into a new release after changing its output path. Validation checks exact selected-cell equality, unique IDs and counts.
