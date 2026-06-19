# Second Updated Search Full-Text PDF Retrieval Audit - 2026-06-16

## Scope

This audit covers the second updated search full-text screening records that had been promoted to full-text review in the local Supabase-backed screening app but still had the `awaitingFullTextPdf` placeholder.

This is not an original-search Covidence backlog audit and not a manual Covidence upload pass. The in-app Browser was opened to Covidence review `603597`, but the Covidence session was signed out, so no Covidence-side PDF uploads were performed in this pass.

## Source Queue

- Source system: local Supabase screening database for `fifa-gbi-data-extraction`
- Stage: `full_text`
- Search/import wave: second updated search / second-search records
- Initial awaiting-PDF queue captured: `351` records
- Queue capture files:
  - `tmp/full-text-pdf-browser-session-2026-06-16/awaiting-local-queue.json`
  - `tmp/full-text-pdf-browser-session-2026-06-16/awaiting-local-queue.csv`

## Retrieval Method

The project script `fifa-gbi-data-extraction/scripts/fetch-full-text-screening-pdfs.mjs` was run with `--upload`.

For each awaiting record, the script attempted legal/open-access DOI routes including publisher patterns, Europe PMC, OpenAlex, and DOI landing-page PDF metadata. Candidate PDFs were accepted only when they had a PDF signature and matched the target by DOI or title-token evidence. Accepted PDFs were uploaded to Supabase storage and attached to the matching local full-text screening record.

## Outcome

- PDFs attached to local full-text screening records: `138`
- Records still awaiting a PDF after this pass: `213`
- Explicit timeout skips: `2`

The final completed resume pass processed `266` records:

| Status | Count |
| --- | ---: |
| `uploaded` | 55 |
| `not_found` | 197 |
| `duplicate_hash` | 2 |
| `no_doi` | 12 |

Earlier partial runs in the same session uploaded `83` additional PDFs before the final resume pass:

- First partial run before timeout fix: `23` uploads
- Second partial run before `S2962` timeout skip: `60` uploads

Because each resume re-queried the current Supabase awaiting-PDF state, successful prior uploads were not reprocessed as awaiting records.

## Explicit Skips

These records repeatedly blocked the automated open-access download pass and were skipped explicitly so the remaining queue could continue.

| Study ID | DOI | Title | Reason |
| --- | --- | --- | --- |
| `S2400` | `10.1007/s11332-025-01334-9` | *Recording time-loss injuries: systematic review and recommendations to improve reliability of surveillance data* | Open-access candidate download hung twice during the second updated search full-text PDF retrieval pass. |
| `S2962` | `10.1007/s11332-023-01127-y` | *Acute:chronic workload ratio of professional soccer players preceding hamstring muscle injuries: a 2-season retrospective study.* | Springer/open-access candidate download hung during the second updated search full-text PDF retrieval pass. |

Skip log:

- `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-explicit-skips-2026-06-16.json`

## Key Tracking Files

- Final uploaded-record list from Supabase:
  - `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-uploaded-to-database-2026-06-16.json`
- Current awaiting-PDF backlog after upload:
  - `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-current-awaiting-after-upload-2026-06-16.json`
- Final completed resume pass report:
  - `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-upload-final-pass-2026-06-16.json`
- Preserved partial reports:
  - `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-upload-partial-2026-06-16-before-timeout-fix.json`
  - `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-upload-partial-2026-06-16-s2400-timeout.json`
  - `tmp/full-text-pdf-browser-session-2026-06-16/second-updated-search-full-text-pdf-upload-partial-2026-06-16-s2962-timeout.json`

## Notes

- `AGENTS.md` now includes a standing instruction that audits, backlogs, manifests, reports, and tracking files must use descriptive names and opening summaries that identify the search/import wave, stage, date, and whether the file is a queue, dry run, upload log, unresolved backlog, or final audit.
- The retrieval script was patched during this session to add body-download timeout handling and an explicit `--skip-study-id=` option for pathological DOI routes.
