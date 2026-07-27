# Independent T4 review

Date: 27 July 2026
Result: **PASS**
Must-fix findings: **None**

## Findings

- `S3218` → `S319` is supported by the same 2019 Finnish cohort of 236 players and 12 teams. `S3218` is surface-specific and was already flagged `Exclude - S319 Substudy`.
- `S5061` → `S1665` is supported by the same 2023 Malaysian single-club cohort. `S5061` is the 72-player hip-strength subset of the 81-player anchor cohort.
- `S606` → `S625` is supported by the same 2005 Norwegian female U17 trial of 2,020 players and 109 teams. The `S606` source explicitly identifies the parent trial.
- The write path is limited to merged `papers.metadata.analysisSourceTreatment` values and additive `paper_notes`.
- Statuses, assignments, flags, files, extraction data, populations and screening state are protected and hash-checked.
- The three child papers remain `retrospective_substudy_analysis`; no status write is implemented.
- Metadata writes use paper ID plus `updated_at` optimistic concurrency.
- The pre-apply snapshot contains prior metadata, staged note bodies, paper IDs, protected state and category hashes.
- Rollback is explicitly marked destructive and unauthorised. The apply path contains no deletion or destructive mutation.
- Static syntax and input/snapshot consistency checks passed.

## Residual risk

The six metadata and note pairs are applied sequentially rather than transactionally. A mid-run failure could leave a partial batch, but operations are idempotent on rerun and the pre-apply rollback evidence is sufficient to reconcile it.

Confidence: high.
