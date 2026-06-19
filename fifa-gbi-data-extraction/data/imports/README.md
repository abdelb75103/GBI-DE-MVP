# Search Import Source Files

This directory is the central local intake area for FIFA GBI reference-search source files and import audit reports.

## Batches

| Folder | Search batch | Status |
| --- | --- | --- |
| `original-search-2024-05-28/` | Original search provided by Ishanka Weerasekara | Raw files organized from OneDrive; Rayyan counts in `RAYYAN_SOURCE_OF_TRUTH.md` are canonical; local dedupe artifacts in `deduplicated/` are non-canonical audit reconstructions |
| `second-search-2026-05-26/` | Second/update search provided by Ishanka Weerasekara | Imported into title/abstract screening; strategy document covers the 2026 update and also includes old-search reference counts |

## Notes

- Keep original and second-search exports separate.
- Preserve raw source filenames for audit-trail integrity, even when filenames contain apparent typos.
- The OneDrive `20240528 search strategies IW.docx` and Ishanka email attachment with the same filename are not identical: the OneDrive version is original-search-only, while the email version also contains 2026 update counts.
- For original-search reporting, use Rayyan source-of-truth counts: 48,043 imported, 24,839 duplicate records deleted, and 23,204 post-dedupe screening records.
- The original-search local dedupe reconstruction should be regenerated only for audit comparison if the missing PubMed 10001-14595 split or corrected SportDiscus export is obtained; it is not the source of truth for Rayyan reporting.
- Do not delete local downloads or duplicate source copies until Abdel has approved the exact cleanup targets.
