# Full-Text AI Plus One Human Bridge Amendment

Version: `full-text-ai-one-human-bridge-2026-07-30-v1`

Approved by Abdel on 2026-07-30 after review of the unsupported-gate checkpoint.

## Scope

This amendment reopens the retired AI-plus-one-human extraction bridge for exactly these six full-text screening records:

- `S683`
- `S2699`
- `S2761`
- `S3931`
- `S4859`
- `S4860`

No other screening record is eligible under this amendment.

## Gate

Every target must still have, at apply time:

- membership in the exact 2026-07-30 repaired full-text cohort;
- `stage = full_text`;
- `ai_status = completed`;
- `ai_suggested_decision = include`;
- `ai_criteria_version = fifa-gbi-full-text-v8-2026-06-23`;
- exactly one authoritative relational human full-text include;
- zero human excludes, conflicts or consensus votes;
- `manual_decision = null`;
- `promoted_paper_id = null`;
- a readable primary PDF whose downloaded SHA-256 matches the screening row;
- no global `papers` or `paper_files` duplicate by study ID or file hash.

The apply path must use current-row compare-and-swap guards. A failed or partial apply remains visible and resumable. It must not delete partially created rows automatically.

## Screening integrity

This amendment does not create or imitate a second reviewer vote. It does not change:

- relational `screening_votes`;
- `manual_*` fields;
- `promoted_*` fields;
- `fullTextDecisions`;
- `fullTextDecisionAudit`;
- `fullTextResolution`;
- title/abstract decisions;
- resolver or conflict state.

The full-text record remains pending the second human reviewer. The only screening mutation permitted by this amendment is a namespaced `metadata.extractionBridge20260730` reservation/completion audit object.

## Extraction handling

Five records are primary studies and may receive the normal manual Tabs 1–10 extraction workflow:

- `S683`
- `S2761`
- `S3931`
- `S4859`
- `S4860`

`S2699` is a retained systematic review/meta-analysis. Promote it only as `systematic_review` for reference checking. Do not create Tabs 1–10 extraction rows for it.

All six remain awaiting Abdel's review in Backlog 2. The five primary studies use live status `processing`; S2699 preserves `systematic_review`.

## S845

S845 is outside this amendment. Its `american_data` exception, reference-only poster, `extractionSource: false` metadata, cleared primary pointers and required warning must remain unchanged.

## Rollback

Every apply requires a fresh exact pre-write snapshot and step journal. Screen-row audit metadata can be restored with guarded updates from that snapshot.

Deleting created papers, paper files, extractions, fields, populations or notes is destructive. Do not perform that rollback without explicit approval of the exact rows and commands.
