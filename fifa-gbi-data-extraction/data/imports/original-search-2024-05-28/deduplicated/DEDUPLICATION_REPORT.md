# Superseded Local Deduplication Reconstruction

This folder contains local deduplication reconstruction artifacts generated on 2026-06-04 for audit/reproducibility only.

Do not use this folder's local reconstruction counts as the source of truth for original-search imported, duplicate-removed, or screened totals.

Canonical source-of-truth file:

`../RAYYAN_SOURCE_OF_TRUTH.md`

Canonical Rayyan counts:

| Rayyan item | Count |
| --- | ---: |
| Imported references / all references | 48,043 |
| Deleted duplicate records | 24,839 |
| Post-dedupe screening set | 23,204 |
| Total duplicates status/workload count | 37,723 |
| Not duplicate | 426 |
| Unresolved duplicates | 0 |
| Resolved duplicates | 12,458 |

Use `24,839`, not `37,723`, when reporting duplicate records removed.

The generated local files in this folder remain available for reproducibility and method comparison, but they did not exactly reproduce Rayyan's duplicate decisions.
