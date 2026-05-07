# Non-English Extraction-Ready PDF Audit

Date: 2026-05-07

Scope: the `18` translated non-English records confirmed for Covidence Extraction in review `603597`.

Included Covidence records:

`#50`, `#245`, `#720`, `#53`, `#626`, `#719`, `#733`, `#734`, `#855`, `#113`, `#412`, `#815`, `#835`, `#547`, `#249`, `#252`, `#752`, `#744`

## Final Retained Outputs

Final local package:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18`

Final merged PDFs:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/pdfs`

Audit files:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/MERGED_TRANSLATED_ORIGINAL_AUDIT.md`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/SUPABASE_UPLOAD_AUDIT.md`

Machine-readable manifests:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/merged-translated-original-manifest.csv`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/supabase-upload-manifest.csv`

Reusable workflow scripts:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/scripts/build_extraction_ready_translations.py`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/scripts/build_smart_extraction_appendices.py`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/scripts/merge_translated_with_originals.py`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/scripts/upload_merged_translated_pdfs_to_supabase.mjs`

Saved workflow skill:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/skills/gbi-translated-pdf-appendix/SKILL.md`

## Merge Rule

Each retained PDF uses this page order:

1. Formatted English translated PDF with smart extraction appendix.
2. Local original source PDF from `exports/non-english-translations/manifest.csv`.

The merged PDFs are the source files that were uploaded to Supabase for live extraction.

## Supabase Upload

The merged PDFs were uploaded directly to the live Supabase-backed extraction database on 2026-05-07.

Upload details:

- Storage bucket: `papers`
- Storage prefix: `translated-merged/<covidence-number>/`
- Upload action: direct extraction paper upload; no pending upload queue.
- Live status: `uploaded`

Because local translated records could not be safely matched one-to-one to existing live `papers` rows, the upload created dedicated translated-merged extraction paper rows rather than overwriting existing records. Each row has a primary file, a `paper_files` row, storage metadata, `metadata.translatedCovidenceNumber`, page counts, original local path, merged local path, and merge order.

Assigned study IDs:

| Covidence | Study ID | Paper ID |
| --- | --- | --- |
| `#50` | `S643` | `7f6dd91d-8f16-4f33-ae3f-18ffd95668ad` |
| `#245` | `S644` | `8c7416bd-d89b-434a-adfa-cc8551c75852` |
| `#720` | `S645` | `d0abda7a-7758-477d-9182-b0f13528bb73` |
| `#53` | `S646` | `26076714-6dbe-4d58-9a11-d307e14ee3e1` |
| `#626` | `S647` | `0b6087dc-6c28-42ae-bda7-8e2048adedb6` |
| `#719` | `S648` | `31fb01a8-8ae1-46e2-b26e-ea0603eac632` |
| `#733` | `S649` | `e96e1c32-9ede-4f5d-b2c5-254900441088` |
| `#734` | `S650` | `cfe9d7bf-d28c-4569-b6f6-a380ff5d1262` |
| `#855` | `S651` | `c92ba4dc-4363-4388-af33-d29f221bac77` |
| `#113` | `S652` | `8cefd278-b107-4d65-9827-236616224e0c` |
| `#412` | `S653` | `81f20d65-9749-4069-b979-e5c2a8a91c5e` |
| `#815` | `S654` | `769ef6ad-4209-49ae-b5cb-b91653803dd5` |
| `#835` | `S655` | `c5f6743d-faef-4dd0-aed9-ef5e2fb4ed8a` |
| `#547` | `S656` | `4a8950e7-a4d6-4c0a-ba32-b37dd83d3134` |
| `#249` | `S657` | `7eb8a03d-d0b2-48e4-a14b-cb061c7b00f0` |
| `#252` | `S658` | `5a27527c-4af7-40cd-b1a1-2de66525fd61` |
| `#752` | `S659` | `c55b2996-df72-45f1-9850-79bed005f08c` |
| `#744` | `S660` | `7e4b2106-32b8-40d4-ba5f-ea04a99cc645` |

## Verification

Post-upload verification confirmed:

- `18` `papers` rows exist for `S643` through `S660`.
- All `18` rows have expected `metadata.translatedCovidenceNumber`.
- All `18` rows have `status = uploaded`.
- All `18` rows have `primary_file_id` and `storage_object_path`.
- All `18` primary file IDs have matching `paper_files` rows.
- A signed URL was successfully generated for the first uploaded storage object.

Script checks passed:

```bash
python3 -m py_compile scripts/merge_translated_with_originals.py
node --check scripts/upload_merged_translated_pdfs_to_supabase.mjs
```

## Cleanup

Surplus intermediate artifacts were deleted after final upload and verification:

- 29-record base formatted PDF batch outputs.
- Base per-paper table audits and preview PNGs.
- Separate `#245` sample appendix output.
- Superseded 17-record smart appendix batch.
- All-18 smart appendix staging batch.
- Exploratory and sample-only scripts:
  - `scripts/append_translation_tables_figures_example.py`
  - `scripts/build_translated_inline_example.py`
  - `scripts/build_visual_extraction_pdfs.py`
  - `scripts/match_translated_papers_to_supabase.mjs`

Historical Covidence decision docs were retained because they document how the final `18` included records were identified.

## Extraction Rule

For these translated non-English papers, extract from the live Supabase rows `S643`-`S660` or the matching retained merged PDFs. The English translated pages and appended tables/figures are extraction aids; verify table-derived values against the original source pages included in the second half of each merged PDF.

## Live Extraction Applied

On 2026-05-07, extraction data was entered directly into the live Supabase-backed extraction records for all `18` translated included studies, `S643` through `S660`.

- Batch grouping: `065` = `S643`-`S647`, `066` = `S648`-`S652`, `067` = `S653`-`S657`, `068` = `S658`-`S660`.
- Status after entry: `processing` / pending reviewer QA.
- The app-assigned `studyId` field was preserved for every record.
- Each paper received a live translation provenance note with source language, translation date `2026-05-07`, and Codex GPT-5 workflow.
- Population-group extraction was applied before field entry so directly reported subpopulations are represented as separate rows and pooled-only values remain on the total row.
- The live review backlog was updated in `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/docs/review-backlog.md`.
