# Covidence PDF Workflow

This workflow is local-only and read-only with respect to Covidence.

## Prepare the queue

```bash
node scripts/covidence-pdf-workflow.mjs prepare \
  --references /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/review_603597_included_csv_20260312035153.csv \
  --existing "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/Full Text - Data Extraaction" \
  --output /Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-11
```

This writes:

- `reconciliation.csv`: every reference with `existing`, `ambiguous_existing`, or `missing`
- `missing-papers.csv`: only the queued missing papers
- `session.json`: session start time plus Downloads snapshot
- `summary.json`: aggregate counts

## Download from Covidence

1. Sign in to Covidence in Google Chrome.
2. Open the review's full text review page.
3. Download only the missing PDFs you want from Covidence.
4. Do not rename files in Downloads during the session.

## Collect the downloaded PDFs

```bash
node scripts/covidence-pdf-workflow.mjs collect \
  --output /Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-11
```

This moves PDFs created in the session from `~/Downloads` into the output folder and writes `downloaded-files.csv`.
