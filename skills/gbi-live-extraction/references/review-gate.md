# Single-Pass Completeness And Live Integrity Gate

The batch agent runs both stages. Stage A happens while building the payload; Stage B happens immediately after apply. This replaces routine cross-agent extraction review.

## Model Rule

- Use the task's batch agent at medium reasoning by default.
- Escalate reasoning inside the same agent only for ambiguous subgroup mapping, derived values, conflicting tables, or unclear eligibility.
- Do not spawn another reviewer or invoke a second model for routine extraction batches. Human review follows this gate.

## Stage A — Source-To-Payload Completeness (Before Apply)

Complete this during the original source sweep, not as a later reread:

- Confirm the strongest directly reported population split and newline alignment.
- Check Tabs `1-4`: citation, design, participants, canonical definitions, incidence denominator, and exposure.
- Sweep every results table and usable figure once for totals, match/training, incidence, burden, severity, CIs, recurrence, mechanism/contact, common diagnosis/location/type, and illness metrics.
- For every compatible tissue/type and location row, check count, incidence, burden, severity, diagnosis, and CI—not only prevalence.
- Confirm match/training orientation against the source table.
- Record why a structured family is blank: absent, incompatible denominator, unreadable figure, no clean value, or no schema mapping.
- Validate field IDs and reject unsupported prose in numeric fields.
- For translated-paper uploads, preflight the exact `papers` row and single `paper_files` row, verify the current original object hash, and stage a recoverable pointer snapshot before uploading.

Fix blockers in the staged payload before dry-run/apply.

## Stage B — Focused Live Integrity (After Apply)

Verify the live write, without re-reviewing the paper:

- Exact fixed batch membership; no missing, extra, or replacement IDs.
- Correct assignment and status (`processing` for human-review-ready papers; true exclusion status where applicable).
- `studyId` equals `papers.assigned_study_id`.
- Source file remains attached; translated-paper provenance is present when applicable.
- For a translated extraction attachment, exactly one active `paper_files` row points to the verified merged file, the `papers` primary pointer matches it, and the preserved original metadata path still downloads with the original SHA-256.
- Population labels/count and multiline order match the staged payload.
- Written fields equal the staged payload; no unknown or unexpectedly skipped fields.
- Structured `population_values` and newline-aligned `extraction_fields` have zero mismatches.
- Protected human votes, resolver state, and promotion state were not changed.
- The matching backlog row reflects status, population layout, source coverage, derivations, and reviewer caveats.

## Findings

Classify each issue:

- `blocker`: must fix before human review readiness.
- `needs reviewer attention`: defensible live data, but the human reviewer should see the caveat.
- `no action`: checked and ready.

Fix blockers before saying the extraction is ready for human review. If Stage B requires a correction, apply it and rerun Stage B only for the changed paper.

Do not mark a paper `reviewed_complete` during this gate. The gate output is only `ready for human review` unless the user explicitly asks to complete the batch.

## Coordinator Closeout For Parallel Batches

Run one query for batch membership, assignment, status, population labels/count, and backlog-row presence. Trust successful batch-agent gates for source completeness, field equality, dual writes, file integrity, and protected metadata. Do not add a cross-agent review or repeat Stage A.
