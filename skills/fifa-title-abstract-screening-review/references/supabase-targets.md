# Supabase Targets

The title/abstract AI pass writes recommendations to the existing `screening_records` AI columns for rows where `stage = 'title_abstract'`.

This workflow is AI-only. It must never mutate human reviewer votes, replace historical reviewer decisions, or add resolver decisions.

## Mapping

- `recommendation.decision` -> `ai_suggested_decision`
- `recommendation.reason` -> `ai_reason`
- `null` -> `ai_evidence_quote`
- `null` -> `ai_source_location`
- `recommendation.confidence` -> `ai_confidence`
- `criteriaVersion` -> `ai_criteria_version`
- recommendation object -> `ai_raw_response`

## Safety

- Dry-run is the default.
- The script requires a criteria-based exclusion reason and clears quote/source fields.
- Completed AI records are skipped unless `--force` is passed.
- `metadata.titleAbstractDecisions` is an audit trail for human/resolver votes. Do not edit it during AI re-review.
- Do not add `action: "resolver_decision"` entries during AI re-review. A changed AI recommendation can create or preserve a conflict; that is expected.
- Do not manually edit `manual_decision`, `manual_reason`, `manual_decided_by`, `manual_decided_at`, promotion metadata, or full-text placeholders from a custom AI re-review script.
- The approved workflow may run finalization after writing AI fields so matching AI+human decisions are reflected consistently. That finalization must not be confused with adjudication: it must not create resolver votes or alter the original human vote.
- Conflict resolution/adjudication requires Abdel's explicit approval for the exact record IDs and intended resolver decisions.
