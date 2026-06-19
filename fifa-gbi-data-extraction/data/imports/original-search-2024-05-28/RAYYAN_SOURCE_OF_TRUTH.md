# Rayyan Source Of Truth - Original Search

Captured from Rayyan on 2026-06-04.

Rayyan review: `FIFA Injury Surveillance`

Rayyan URLs checked:

- `https://new.rayyan.ai/reviews/1049813/overview`
- `https://new.rayyan.ai/reviews/1049813/review_data`
- `https://new.rayyan.ai/reviews/1049813/screening`

## Canonical Reference Counts

These are the source-of-truth numbers for the original-search reference flow.

| Rayyan item | Count | Meaning |
| --- | ---: | --- |
| Imported references / all references | 48,043 | Total records uploaded into Rayyan from the available original-search files |
| Deleted duplicates | 24,839 | Records Rayyan removed as duplicate records |
| Post-dedupe screening set | 23,204 | Records available for title/abstract screening after duplicate deletion |
| Total duplicates | 37,723 | Rayyan duplicate-review workload/status total; not the number deleted |
| Not duplicate | 426 | Duplicate candidates reviewed and kept |
| Unresolved duplicates | 0 | Duplicate candidates still pending |
| Resolved duplicates | 12,458 | Rayyan duplicate-resolution status bucket |

Arithmetic:

`48,043 imported - 24,839 deleted duplicates = 23,204 post-dedupe screening records`

Rayyan's `Total Duplicates` count reconciles as:

`24,839 deleted + 426 not duplicate + 12,458 resolved = 37,723 total duplicates`

Use `24,839`, not `37,723`, when reporting the number of duplicate records removed.

## Screening Decisions

Rayyan Screening page:

| Screening item | Count |
| --- | ---: |
| Post-dedupe screening articles | 23,204 |
| Undecided articles currently showing | 0 |
| Articles with at least 1 member decision | 23,204 |
| Articles with at least 2 member decisions | 23,199 |
| Articles with at least 3 member decisions | 8,772 |
| Conflicts | 842 |
| Alignment | 96% |

Rayyan Overview personal progress for Abdel:

| Personal item | Count |
| --- | ---: |
| Abdel-screened articles | 132 |
| Abdel included | 58 |
| Abdel maybe | 26 |
| Abdel excluded | 48 |
| Articles left for Abdel | 23,072 |

Interpretation:

- At the team/review level, all 23,204 post-dedupe articles have at least one screening decision.
- 23,199 have at least two member decisions.
- 842 records are conflicts and still require conflict handling/adjudication if the workflow requires final consensus.
- Abdel's personal count is separate from the team/review-level screening completion count.

## Source File Context

The `10,000` count is the PubMed source-file import count:

`20240528 pubmed First 10000 full texts .nbib = 10,000`

It is not a duplicate count and not a screening count. It confirms that the available PubMed original-search file contained only the first 10,000 records, while the search strategy document reported 14,595 PubMed hits.

The strategy document reports 52,643 raw database hits across databases, but Rayyan imported 48,043 records from the available original-search files. For project reporting of what was actually uploaded, deduplicated, and screened in Rayyan, use the Rayyan counts above.

## Superseded Local Reconstructions

Local deduplication reconstructions in `deduplicated/` were generated for audit/reproducibility only and do not exactly reproduce Rayyan's duplicate decisions. Do not use local reconstruction counts as the source of truth for original-search imported, duplicate-removed, or screened totals.
