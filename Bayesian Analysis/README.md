# FIFA GBI Bayesian analysis

## Authoritative eligible-only injury CSV, 14 September 2026

The authoritative analysis input is `analysis/model-input-releases/2026-09-14-authoritative-injury-analysis/injury-analysis.csv`: 2,219 eligible result rows from 220 papers, comprising 1,892 incidence and 327 burden rows. All 1,012 columns and every selected cell are preserved. `analysis/MODEL_INPUT_CURRENT.json` is the authority pointer. The previous 3,211-row file remains the complete audit record, not the analysis input. No eligibility rule or numerical value changed in this subset export.

Eligibility preparation is complete. Next recommend the target-specific model specification, likelihoods, uncertainty and dependence handling. Await Abdel's input before implementing or fitting models. Historical sections below describe superseded releases.


Start with these files at the top of this folder:

- [Protocol V2 Word](FIFA_GBI_Bayesian_Protocol_V2.docx), the primary editable protocol. Green text marks V2 changes.
- [Protocol V2 PDF](FIFA_GBI_Bayesian_Protocol_V2.pdf), the matching reading copy.
- [Working checklist](BAYESIAN_ANALYSIS_CHECKLIST.html), a standalone interactive document with expandable actions and checkpoints. Open it in a browser when ready to work through the project.

The first analysis excludes athlete-exposure-based observations. Their conversion to rates per 1,000 player-hours is a separate planned year-long project for later iterations.

## Folder guide

| Folder | Contents |
|---|---|
| `analysis/` | Governed data, preparation code and complete version history. |
| `protocol-v2/` | Active protocol decisions, stage log, sources, build code and verification records. |
| `fifa-gbi-bayesian-learning-packet/` | Reference material for learning and method development. It is not the approved analysis plan. |
| `archive/` | Superseded releases, old visualisations and historical audits. |

`CURRENT_PROTOCOL.md` identifies the current scope and human gate. `AGENTS.md` and `CLAUDE.md` are automation instructions. Keep all three in place.

The archive preserves research evidence and superseded releases. Disposable caches, generated previews and local software environments are not retained. See `archive/RELOCATION_LOG.csv` for historical moves and `archive/CLEANUP_LOG.md` for removals. Historical records retain their original wording and may contain old paths.


Current data stage, 10 September 2026: the authorised Desktop input is frozen as project v004. See [the current data decision](protocol-v2/DATA_START.md) and [the column review](protocol-v2/data-preparation/REVIEW.md). Checkpoint 2 and the specific technical rules for checkpoint 3 await approval. The 9 September candidate comparison is historical.


## CP3-20260910 current review stage

The approved labelled review copy is complete. The authoritative master remains v004 and its bytes are unchanged. `analysis/REVIEW_COPY_CURRENT.json`, relative to the Bayesian Analysis root, identifies the review release and current scoped dictionary. Sex, age, playing level, geography, injury location and injury type are included. Scientific coding, missingness, taxonomy, ownership and measurement decisions remain pending.

The approval and output checks are retained in `analysis/review-copies/v004-labelled-review-2026-09-10/`; the recipe and independent full-cell validator are in `analysis/review-tools/`. Prior documents and the old release inventory are preserved under `archive/before-checkpoint-3-review-copy-2026-09-10/`. Offer the next human decisions as clickable choices in conversation. Earlier pending-approval text above describes the previous stage.
