# S4860 and S2699 local-only extraction-gate preparation

Prepared 2026-07-30. This directory is a proposal only. It does not apply Supabase changes, write a backlog row, change screening state, or attach/replace a file.

## Governing exception

`docs/full-text-ai-one-human-bridge-amendment-2026-07-30.md` authorises an AI-plus-one-authoritative-human bridge for exactly six named records, including S4860 and S2699. It does not create a second reviewer vote. The full-text record remains pending and all human votes, `manual_*`, `promoted_*`, resolution and title/abstract fields remain protected. The only permitted screening mutation at a later apply is the namespaced `metadata.extractionBridge20260730` audit object.

Before any apply, re-check every amendment guard against the current row: exact repaired-cohort membership, `stage = full_text`, completed include AI at `fifa-gbi-full-text-v8-2026-06-23`, exactly one relational human include, no exclude/conflict/consensus vote, null `manual_decision` and `promoted_paper_id`, matching readable primary-PDF hash, and no paper/file study-ID or hash duplicate. Use current-row compare-and-swap predicates and a fresh snapshot/journal.

## Contents

- `s4860-stage-a-tabs-1-10-proposal.json`: ready-to-review primary-study proposal. It uses only soccer-specific, directly reported values or the explicitly documented sum of direct mechanism subrows.
- `s2699-reference-check-only-proposal.json`: systematic-review handling. No Tabs 1-10, extraction, population, or derived meta-analysis values are proposed.

## Important boundary

S4860’s proposed live status is `processing`, only if the exception gate passes. S2699’s proposed live status is `systematic_review`; it is retained to check references, not as a primary epidemiology extraction. Both proposed Backlog 2 rows are `⏲️ pending_review` because this preparation is not a human-completed review.
