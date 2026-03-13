---
name: covidence-pdf-retrieval
description: Use the read-only Covidence Extraction workflow to reconcile a Covidence reference export against local PDFs, download missing PDFs from the signed-in Chrome session, and optionally import the retrieved PDFs into the live FIFA GBI database without changing Covidence records.
---

# Covidence PDF Retrieval

Use this when the user wants missing PDFs pulled from Covidence with no edits to Covidence itself.

Read `../../docs/covidence-pdf-retrieval-summary.md` only when the user wants the March 2026 run details, exact paths, counts, or unresolved-paper list.

## Defaults

- Treat Covidence as read-only.
- Use the Covidence `Extraction` area, not `Full text review`, unless the user explicitly says otherwise.
- Do not click approval, inclusion, exclusion, or status-changing controls in Covidence.
- Do not make matching decisions silently when a study page looks wrong; record the mismatch and move on.

## Preconditions

- The reference export CSV exists locally.
- Any already-owned PDF library folder is available locally.
- Google Chrome is already signed into Covidence.
- Chrome has `View > Developer > Allow JavaScript from Apple Events` enabled.
- The active Chrome tab is on the correct Covidence review extraction page before browser automation starts.

## Preferred Workflow

1. Prepare the missing queue from the CSV and the local PDF folder:

```bash
npm run covidence:prepare -- \
  --references /abs/path/review.csv \
  --existing "/abs/path/existing pdf folder" \
  --output /abs/path/output-dir
```

2. Verify Chrome is on the intended Covidence extraction tab:

```bash
npm run chrome:url
```

3. Download directly from the active Covidence extraction tab into a clean output folder:

```bash
npm run covidence:download -- \
  --missing-csv /abs/path/output-dir/missing-papers.csv \
  --output /abs/path/output-dir/files-final \
  --manifest /abs/path/output-dir/files-final/covidence-download-manifest.csv
```

4. Use the manifest as the source of truth while the run is active. The downloader is resumable because it rewrites the manifest after each paper.

5. If the user wants the downloaded PDFs made live on the website, run the import from `fifa-gbi-data-extraction/`:

```bash
cd fifa-gbi-data-extraction
node import-covidence-pdfs.mjs \
  --manifest /abs/path/output-dir/files-final/covidence-download-manifest.csv \
  --references /abs/path/review.csv \
  --files-dir /abs/path/output-dir/files-final \
  --apply
```

## Manifest Status Meanings

- `downloaded`: PDF retrieved successfully.
- `no_button`: Covidence study page had no visible PDF or full-text button.
- `search_not_found`: Search did not return a usable study page.
- `study_page_mismatch`: Search opened a study page that did not match the intended paper closely enough.

## Safety

- Never upload into Covidence.
- Never change Covidence study decisions or workflow state.
- Stop if Chrome shows a prompt that requires a user choice.
- Prefer the manifest and import results over memory when reporting counts.
