# 2026-07-30 Full-Text to Extraction Gate Audit

Status: `complete_pending_human_reviews`

This is a resumable, read-only checkpoint for the exact 27-record full-text cohort created by `outputs/title-abstract-promotion-repair-2026-07-30/apply-result.json`.

## Exact factual predicate set

The following records currently have a completed AI full-text include under `fifa-gbi-full-text-v8-2026-06-23`, exactly one authoritative human full-text include, no human exclude or conflict, a verified primary PDF, no existing promotion, and no duplicate extraction paper or file hash:

- `S683`
- `S2699`
- `S2761`
- `S3931`
- `S4859`
- `S4860`

Every source object downloaded successfully and matched the SHA-256 stored on its live screening row. The full hashes and exact live rows are in the dated `blocked-gate-snapshot-*.json` file in this directory.

`S2699` is a retained systematic review/meta-analysis. It is reference-check material, not a routine primary-study extraction.

`S845` is excluded from this set. Its separately approved `american_data` exception remains promoted with no primary extraction PDF. Its retained poster is reference-only and has `extractionSource: false`.

## Gate amendment and completed outcome

The base full-text screening contract does not permit AI plus one human promotion:

- `src/lib/screening/reviewer-decisions.ts` returns `pending` for fewer than two human votes and `ready_for_extraction` only for two human includes, or an include consensus resolution after conflict.
- `src/lib/db/screening.ts` promotes only after `getScreeningResolution(record) === 'ready_for_extraction'`.
- `docs/gbi-second-search-extraction-handoff-2026-07-08.md` and Backlog 2 state that the temporary AI-plus-one-human bridge is closed.

Abdel subsequently approved the exact-six, versioned amendment
`full-text-ai-one-human-bridge-2026-07-30-v1`. Its contract is documented in
`docs/full-text-ai-one-human-bridge-amendment-2026-07-30.md`. The amendment
does not change the base gate, fabricate a vote, or resolve the pending
second-human review.

The guarded bridge promoted the exact six records. Five primary studies
(`S683`, `S2761`, `S3931`, `S4859`, `S4860`) now have complete Tabs 1-10
manual extractions, `processing` status and Backlog 2 `pending_review` rows.
`S2699` is `systematic_review`, has a verified paper attachment and reference
note, and has zero extraction or population rows. It is also awaiting Abdel’s
review in Backlog 2.

The final live readback passed for all paper/file links and SHA-256 hashes, 50
tab rows, 276 canonical fields, 14 population groups, 181 structured
population values, protected screening state, unchanged votes, S845’s
reference-only contract and zero detected out-of-scope writes.

The tightened audit found that S845's paper note had lost its required reference-only warning after the earlier verifier passed. One guarded live note update restored the warning that the poster is not the exact 2024 journal full text and is not an extraction source. The repair preserved the prior note in the pre-write snapshot, changed no screening, vote, paper or file row, and passed the S845-only read-back check. See the dated `s845-reference-note-*.json` audit files in this directory.

## Resume path

No automated work remains in this batch. Human follow-up is:

1. Abdel reviews Backlog 2 Batches 036 and 037 without treating them as already final.
2. A second authoritative human completes full-text screening through the supported vote path.
3. Any second-review conflict is resolved through the normal resolver workflow.

If a failed or partially reverted item must be resumed, use these immutable
inputs and readbacks:

1. Pre-write snapshot: `blocked-gate-snapshot-2026-07-30T18-16-12-749Z.json`.
2. Promotion dry run: `bridge-dry-run-2026-07-30T18-40-28-792Z.json`.
3. Promotion apply and journal: `bridge-apply-2026-07-30T18-41-37-593Z.json` and its matching `.ndjson`.
4. Extraction payload: `bridge-extraction-payload-2026-07-30.json`.
5. Extraction dry run: `extraction-dry-run-2026-07-30T18-50-47-789Z.json`.
6. Extraction apply and journal: `extraction-apply-2026-07-30T18-51-35-703Z.json` and its matching `.ndjson`.
7. Final verification: `bridge-final-verification-2026-07-30T18-56-04-643Z.json`.

## Rollback

No rollback is required. All inserted IDs are recorded. Extraction,
population and note IDs are deterministic; promotion paper/file IDs are
preserved in the bridge reservation metadata and dated apply audit. Screening
metadata can be restored from the pre-write snapshot using exact current-state
guards. Removing inserted papers, files, notes, extraction rows or population
rows is destructive and requires explicit approval. No such deletion was
performed.
