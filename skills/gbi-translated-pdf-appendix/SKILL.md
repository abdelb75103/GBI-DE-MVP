---
name: gbi-translated-pdf-appendix
description: Use when preparing extraction-ready appendix PDFs for translated non-English FIFA GBI papers, especially after Covidence include/exclude decisions identify the included translated records. Builds smart appendices on the formatted 2026 extraction-ready PDFs with relevant English tables, figure source pages, English captions, previews, and audit trails.
---

# GBI Translated PDF Appendix

## Overview

Use this skill to prepare translated non-English papers for manual extraction when the formatted English translation PDF needs rendered tables and visible figure context.

The workflow is conservative:
- Use only records confirmed as included/in Covidence Extraction.
- Use the formatted 2026-05-07 PDFs under `outputs/extraction-ready-translations/2026-05-07/pdfs` as the base.
- Do not rebuild or retranslate the body of the translated paper.
- Append extraction aids at the end.
- Render relevant translated tables as clean English grids.
- Include full original source pages for relevant figures, with English translated captions underneath, so figures are not cut off.

## Included Record Set

The currently confirmed included translated records are:

`#50`, `#245`, `#720`, `#53`, `#626`, `#719`, `#733`, `#734`, `#855`, `#113`, `#412`, `#815`, `#835`, `#547`, `#249`, `#252`, `#752`, `#744`

Do not batch excluded or unresolved records unless Covidence status changes and the audit is updated.

## Batch Command

Run from the repository root:

```bash
python3 scripts/build_smart_extraction_appendices.py
```

Default behavior processes the other included translated records while leaving the already approved `#245` sample separate.

To include all 18 records in one standardized batch:

```bash
python3 scripts/build_smart_extraction_appendices.py --include-sample
```

To process specific included IDs:

```bash
python3 scripts/build_smart_extraction_appendices.py --target '#720' --target '#719'
```

## Outputs

Default output folder:

`outputs/extraction-ready-translations/2026-05-07/smart-appendix-batch`

Expected outputs:
- `pdfs/extraction-ready-#ID-with-smart-appendix.pdf`
- `appendices/smart-appendix-#ID.pdf`
- `paper-audits/smart-appendix-audit-#ID.md`
- `previews/#ID-smart-page-*.png`
- `smart-appendix-manifest.csv`
- `SMART_APPENDIX_BATCH_AUDIT.md`

## Merge With Original PDFs

After smart appendices are created and approved for the included set, create merged extraction PDFs so reviewers can work from one file. The merge order must always be:

1. Translated smart-appendix PDF.
2. Original source PDF.

Run from the repository root:

```bash
python3 scripts/build_smart_extraction_appendices.py --include-sample --out-dir outputs/extraction-ready-translations/2026-05-07/smart-appendix-batch-all18
python3 scripts/merge_translated_with_originals.py
```

Expected merged outputs:
- `outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/pdfs/merged-translated-first-original-second-#ID.pdf`
- `outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/merged-translated-original-manifest.csv`
- `outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/MERGED_TRANSLATED_ORIGINAL_AUDIT.md`

The merge script uses the original PDF paths from `exports/non-english-translations/manifest.csv`. Do not merge against browser downloads or ad hoc local copies unless the manifest is updated and audited.

## Supabase Upload

When the user asks to upload the merged files for live extraction, use:

```bash
node scripts/upload_merged_translated_pdfs_to_supabase.mjs
```

Expected upload outputs:
- `outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/supabase-upload-manifest.csv`
- `outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/SUPABASE_UPLOAD_AUDIT.md`

Upload behavior:
- Uploads files to Supabase Storage bucket `papers`.
- Uses storage prefix `translated-merged/<covidence-number>/`.
- Creates or reuses extraction `papers` rows keyed by `metadata.translatedCovidenceNumber`.
- Creates `paper_files` rows and sets each paper's `primary_file_id`.
- Stores merge order, page counts, source paths, and Covidence number in metadata.

If existing live paper matching is uncertain, prefer creating dedicated translated-merged extraction rows rather than overwriting an existing paper. Record the assigned study IDs in the audit file and in `docs/research/non-english-extraction-ready-pdf-audit-2026-05-07.md`.

## Selection Logic

The script includes tables and figures only when their captions or rows match extraction concepts:

`population`, `exposure`, `incidence`, `prevalence`, `risk`, `injury type`, `severity`, `location`, `mechanism`, `diagnosis`, `timing`, `match`, `training`, `team`, `season`, `age`, `sex`, `height`, `weight`.

For tables, it renders translated rows as English PDF tables.

For figures, it maps translated `Fig.`/`Figure` captions back to original source pages by searching original PDF text for labels such as `Fig.`, `Abb.`, `Figura`, `Gráfico`, `Figuur`, or `Figur`. It renders the full source page rather than a cropped figure to avoid cutoffs.

## Verification

After running the batch:

1. Open `SMART_APPENDIX_BATCH_AUDIT.md` and check processed count, table count, figure count, and statuses.
2. Inspect several preview PNGs, prioritizing papers with figure captions or many tables.
3. Confirm generated PDFs use the 2026 formatted base PDF paths, not older `exports/.../english-translation-#ID.pdf` files.
4. After merging, open `MERGED_TRANSLATED_ORIGINAL_AUDIT.md` and confirm all `18` records have translated pages first, original pages second, and nonzero total pages.
5. After upload, verify all uploaded `papers` rows have `status = uploaded`, `primary_file_id`, `storage_object_path`, matching `paper_files` rows, and `metadata.translatedCovidenceNumber`.
6. Update `docs/research/non-english-extraction-ready-pdf-audit-2026-05-07.md` with the batch output folder, merge summary, upload summary, and assigned study IDs.

## Extraction Rule

The appended tables and figure source pages are extraction aids, not independent source data. During live extraction, verify table-derived values against the original PDF and translated text, and cite the smart appendix audit/source page in the backlog note when using translated tables or figure pages.
