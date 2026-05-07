# Translated Non-English Papers

Use this reference when a paper is a translated non-English full text or belongs to the 2026-05-07 translated extraction batch.

## Source Priority

- Prefer cleaned extraction-ready PDFs under `outputs/extraction-ready-translations/` plus the original source PDF.
- Do not extract from earlier plain-text translation PDFs when a cleaned extraction-ready version exists.
- For the 2026-05-07 included translated batch, prefer live rows `S643`-`S660`.
- For local file inspection, prefer merged PDFs under `outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/pdfs`.
- These merged files place the English translated/smart-appendix pages first and the original source PDF second.
- Use translated English pages first for comprehension, then verify table-derived counts, denominators, incidence values, subgroup labels, figure-derived values, unusual definitions, and footnotes against the original-language pages.
- If translation and original disagree, the original source controls and the discrepancy must be recorded in the backlog.

## Appendices And Merged PDFs

- When translated papers need rendered tables/figures before extraction, use the `gbi-translated-pdf-appendix` skill and `scripts/build_smart_extraction_appendices.py`.
- Recreated translated tables and figure source pages are extraction aids, not independent source data.
- Before relying on a recreated translated table, check the matching paper audit for source-table detections and `needs_table_spot_check`.
- If flagged, inspect the named original PDF pages before extracting table values.

## Provenance Notes

- Every translated-paper extraction must add a live paper note stating source language, translation date, translation model/workflow, and that extraction used the merged translated-first/original-second PDF.
- For the 2026-05-07 batch, use:

```text
Translated from <language> on 2026-05-07 using Codex GPT-5 workflow; extracted from merged PDF with English translation first and original source second.
```

- Update `<language>` from metadata or the manifest.

## Backlog Detail

- When Tabs `7-8` are filled from recreated translated tables, name the extraction-ready PDF, original PDF page/table source, and paper audit status in the backlog note.
- Do not call a translated paper sparse or table-limited until the matching audit and original PDF table pages have been checked.
