# Original Search Intake Report

Date organized: 2026-06-04

Search batch label: `Original search - Ishanka - 2024-05-28`

Search run date stated by source files/documentation: `2024-05-28`

Provided by: Ishanka Weerasekara via OneDrive download `OneDrive_1_04-06-2026`

## Rayyan Source Of Truth

Rayyan is the source of truth for the original-search imported, duplicate-removed, and screened counts.

Source-of-truth file: `RAYYAN_SOURCE_OF_TRUTH.md`

Rayyan counts captured on 2026-06-04:

| Rayyan item | Count | Meaning |
| --- | ---: | --- |
| Imported references / all references | 48,043 | Total records uploaded into Rayyan from the available original-search files |
| Deleted duplicates | 24,839 | Records Rayyan removed as duplicate records |
| Post-dedupe screening set | 23,204 | Records available for title/abstract screening after duplicate deletion |
| Total duplicates | 37,723 | Rayyan duplicate-review workload/status total; not the number deleted |
| Not duplicate | 426 | Duplicate candidates reviewed and kept |
| Unresolved duplicates | 0 | Duplicate candidates still pending |
| Resolved duplicates | 12,458 | Rayyan duplicate-resolution status bucket |

Screening status from Rayyan:

| Screening item | Count |
| --- | ---: |
| Articles with at least 1 member decision | 23,204 |
| Articles with at least 2 member decisions | 23,199 |
| Conflicts | 842 |
| Undecided articles currently showing | 0 |

Use `24,839`, not `37,723`, when reporting duplicate records removed.

## Source Files

- `20240528 EMBASE 1-3000.ris`
- `20240528 EMBASE 3001-6000.ris`
- `20240528 EMBASE 6001-9000.ris`
- `20240528 EMBASE 9001-12000.ris`
- `20240528 EMBASE 12001-15000.ris`
- `20240528 EMBASE 15001-15260.ris`
- `20240528 Medline 1-2000.ris`
- `20240528 Medline 2001-5000.ris`
- `20240528 Medline 5001-8000.ris`
- `20240528 Medline 8001-11000.ris`
- `20240538 Medline 11000-12911.ris`
- `20240528 Sportdiscuss 9872.ris`
- `20240528 pubmed First 10000 full texts .nbib`
- `20240528 search strategies IW.docx`

## Strategy Document Scope

The Word document in this folder is the OneDrive copy and contains the original 2024 search counts only. It is not the same binary file as the same-named Gmail attachment from Ishanka; the Gmail attachment also includes the 2026 updated-search counts and belongs conceptually with the second-search documentation.

## Parsed Counts

| Source | Strategy/document count | Parsed from files | Status |
| --- | ---: | ---: | --- |
| Medline | 12,911 | 12,911 | Matches; final split filename appears to contain a date typo: `20240538` |
| Embase | 15,260 | 15,260 | Matches |
| SportDiscus | 9,877 | 9,872 | Needs confirmation; file name and parsed count are 9,872 |
| PubMed | 14,595 | 10,000 | Incomplete against strategy count; current file is named `First 10000` and appears capped at PubMed's 10,000-record Citation Manager export limit |
| Total | 52,643 | 48,043 | Not complete if the strategy counts are authoritative |

## Field Coverage In Parsed Files

| Metric | Count |
| --- | ---: |
| Parsed records | 48,043 |
| Records with title | 48,037 |
| Records with year | 48,034 |
| Records with abstract | 41,910 |
| Records with DOI | 39,433 |
| Records with source ID | 32,969 |

## Year Coverage

The available parsed records include enough publication-year metadata for year-by-year analysis after deduplication: 48,034 of 48,043 records have a year.

Observed year ranges in the available raw files:

| Source | Min year | Max year |
| --- | ---: | ---: |
| Medline | 1913 | 2024 |
| Embase | 1946 | 2024 |
| SportDiscus | 1895 | 2024 |
| PubMed | 1993 | 2024 |

## Audit Notes

- The raw database export files in this folder are preserved unchanged for audit trail integrity. Local reconstruction artifacts are stored separately in `deduplicated/`.
- The current PubMed export appears incomplete for the original search: only the first 10,000 records are present, while the search strategy document reports 14,595 PubMed hits. PubMed's Citation Manager export is capped at 10,000 all-results citations, so the remaining 4,595 PubMed results likely required a second split export that is not present in the OneDrive download or local files.
- The SportDiscus strategy/document count and available file count differ by five records.
- The SportDiscus file contains 9,872 complete RIS records by `ER  -` end marker. It also contains 154 empty `TY  - JOUR` stubs with no title or year, which are not importable records.
- The Medline file `20240538 Medline 11000-12911.ris` is retained with its original filename for audit trail integrity, but it appears to be the final `20240528` Medline split.
- The Word document package structure was validated with `unzip -t` and reported no errors.
- The original OneDrive zip download was validated with `unzip -t` and reported no compressed-data errors.

## Superseded Local Dedupe Reconstruction

Local deduplication was run on the available original-search reference files on 2026-06-04 as an audit/reproducibility reconstruction. It did not exactly reproduce Rayyan's duplicate decisions and is not the source of truth for reporting imported, duplicate-removed, or screened totals.

The local reconstruction artifacts remain in `deduplicated/` for traceability only:

- `deduplicated/original-search-2024-05-28-deduplicated-records.csv`
- `deduplicated/original-search-2024-05-28-deduplicated-records.json`
- `deduplicated/original-search-2024-05-28-deduplicated-records.ris`
- `deduplicated/original-search-2024-05-28-duplicates-removed.csv`
- `deduplicated/DEDUPLICATION_AUDIT.json`
- `deduplicated/DEDUPLICATION_REPORT.md`

Do not use the local reconstruction counts in `deduplicated/` as the original-search source-of-truth numbers. Use the Rayyan counts in `RAYYAN_SOURCE_OF_TRUTH.md`.

## Remaining Checks

- Request or locate the missing PubMed split covering records 10001-14595, or regenerate the PubMed original-search export in date/result-range chunks.
- Confirm whether SportDiscus should be 9,872 or 9,877 records.
- Regenerate the deduplicated available-file output if additional original-search reference files are located.
