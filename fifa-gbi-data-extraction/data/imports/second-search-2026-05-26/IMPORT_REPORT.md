# Second Search Import Report

Date imported: 2026-05-27

Search batch label: `Second search - Ishanka - 2026-05-26`

Search run date stated by Ishanka: `2026-05-26`

Provided by: Ishanka Weerasekara

## Source Files

- `20260526 Medline ris (44).ris`
- `20260526 Embase.ris`
- `20260526 SportDiscus.ris`
- `20260526 Pubmed.nbib`
- `20260526 updated search strategies IW.docx`

## Strategy Document Scope

The search strategy document in this folder contains the 2026 updated-search counts and also includes an `OLD SEARCH` section with the original 2024 counts for context. The updated-search reference files are the four 2026 database exports listed above.

## Raw Reference File Counts

| Source | Strategy/document count | Raw records in file | Status |
| --- | ---: | ---: | --- |
| Medline | 806 | 806 | Matches |
| Embase | 1,054 | 1,054 | Matches; one record had no title and was omitted from parsed/importable references |
| SportDiscus | 2,271 | 2,271 | Matches |
| PubMed | 2,921 | 2,921 | Matches |
| Total | 7,052 | 7,052 | Matches raw search-export counts |

## Final Import Counts

| Metric | Count |
| --- | ---: |
| Parsed references | 7,051 |
| Removed after deduplication | 2,179 |
| Imported into title/abstract screening | 4,872 |
| Left for screening | 4,872 |
| Imported/restored with visible abstracts | 4,746 |
| Imported/restored missing abstracts | 126 |

The initial import inserted 4,827 records. A deduplication audit found that fuzzy-title-only matching had removed 45 records that should be visible to reviewers, so those 45 records were restored into the same second-search batch.

## Parsed by Source

| Source | Parsed |
| --- | ---: |
| Medline | 806 |
| Embase | 1,053 |
| SportDiscus | 2,271 |
| PubMed | 2,921 |

## Imported by Source

| Source | Imported |
| --- | ---: |
| Medline | 793 |
| Embase | 449 |
| SportDiscus | 1,967 |
| PubMed | 1,663 |

## Deduplication

Final automatic duplicate removal uses conservative signals only:

| Reason | Removed |
| --- | ---: |
| DOI + title match | 2,142 |
| Title + author + year exact key | 37 |
| Fuzzy-title-only match | 0 |

| Matched area | Removed |
| --- | ---: |
| Existing extraction records | 50 |
| Within the second-search batch | 2,129 |

The final duplicate-removal export is `deduplication-removed-records.csv`. The fuzzy-title correction is recorded in `FUZZY_RESTORE_REPORT.json`; it restored 45 records, 42 with abstracts already present and 3 without abstracts.

## Missing Abstract Lookup

Initial missing abstracts after the first import: 134.

External lookup safely fetched and updated 10 abstracts.

After restoring the 45 fuzzy-title records, 3 additional records had no abstract. A final exact DOI/PMID lookup pass safely fetched 1 more abstract.

Final missing abstracts: 126.

Final visible abstracts: 4,746.

The 10 fetched abstracts are recorded in `FETCHED_ABSTRACTS_REPORT.json`. The final missing-abstract lookup pass is recorded in `MISSING_ABSTRACT_FETCH_REPORT.json`.

## System Recording

Every imported or restored screening record was inserted into `screening_records` with:

- `stage`: `title_abstract`
- `metadata.searchBatch`: `second`
- `metadata.searchBatchLabel`: `Second search - Ishanka - 2026-05-26`
- `metadata.searchRunDate`: `2026-05-26`
- `metadata.searchProvidedBy`: `Ishanka Weerasekara`

Restored records also have:

- `metadata.restoredAfterDeduplicationAudit`: `true`
- `metadata.restoredReason`: `fuzzy_title_removed_in_initial_import`

Independent Supabase verification after correction confirmed 4,872 matching title/abstract records, 4,746 with visible abstracts, 126 missing abstracts, 45 restored records, no duplicate assigned study IDs across screening plus extraction, next available study ID `S5533`, and 4,872 unscreened records.
