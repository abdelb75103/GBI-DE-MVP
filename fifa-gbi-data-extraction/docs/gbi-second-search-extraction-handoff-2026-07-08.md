# GBI Second Search Extraction Handoff

Date: 2026-07-08

Scope: operational handoff for extracting records from `Second search - Ishanka - 2026-05-26` after completion of two-human full-text screening.

## Current Rule

The temporary AI-plus-one-human extraction bridge is closed. Full-text screening has now been completed by two human reviewers, and legitimate includes have been promoted to the live extraction phase.

When Abdel asks for the `next batch`:

1. Use `docs/second-search-extraction-review-backlog-2026-07-03.md` (Backlog 2).
2. Select any five unprocessed records currently in the live extraction phase; either an attached PDF or other available full text is acceptable.
3. Confirm each record is unprocessed and not assigned to another reviewer.
4. Assign it to AbdelRahman Babiker and set its live status to `processing` before extraction.
5. Follow the `gbi-live-extraction` workflow through extraction and the review gate.
6. Keep the live status as `processing`, append the records to the next numbered Backlog 2 batch, and mark them `⏲️ pending_review`.

Do not use the old AI-plus-one-human bridge manifests, provisional screening state, or study-ID order to choose new work. If a selected record is already processed or clearly ineligible, skip it and replace it with another unprocessed live extraction-phase record.
