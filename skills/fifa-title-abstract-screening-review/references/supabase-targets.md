# Supabase Targets

The title/abstract AI pass writes recommendations to the existing `screening_records` AI columns for rows where `stage = 'title_abstract'`.

## Mapping

- `recommendation.decision` -> `ai_suggested_decision`
- `recommendation.reason` -> `ai_reason`
- `recommendation.sourceQuote` -> `ai_evidence_quote`
- `recommendation.sourceLocation` -> `ai_source_location`
- `recommendation.confidence` -> `ai_confidence`
- `criteriaVersion` -> `ai_criteria_version`
- recommendation object -> `ai_raw_response`

## Safety

- Dry-run is the default.
- The script refuses invalid include/exclude quote rules.
- Completed AI records are skipped unless `--force` is passed.
- Reviewer decisions, manual decisions, conflict resolution, and promotion fields are never edited.
