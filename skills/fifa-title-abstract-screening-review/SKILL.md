# FIFA Title/Abstract Screening Review

Use this skill when reviewing title/abstract screening records for FIFA GBI before full-text retrieval. It produces advisory AI recommendations only; reviewer votes remain decisive.

## Workflow

1. Export candidate records from Supabase:

   ```bash
   node skills/fifa-title-abstract-screening-review/scripts/export_title_abstract_records.mjs --output /tmp/title-abstract-records.json
   ```

2. Review each record against `references/eligibility.md`.
   - Be lenient at title/abstract stage.
   - Recommend `include` when the record plausibly may contain eligible football injury/illness epidemiology data or when the abstract is incomplete.
   - Recommend `exclude` only when the title/abstract/citation metadata clearly rules the paper out.

3. Save recommendations using the schema in `references/output-schema.md`.

4. Dry-run the Supabase update:

   ```bash
   node skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs --input /tmp/title-abstract-recommendations.json
   ```

5. Apply when the dry-run looks correct:

   ```bash
   node skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs --input /tmp/title-abstract-recommendations.json --apply
   ```

## Decision Rules

- `include`: likely or possibly relevant. Provide a short rationale. Do not provide a source quote.
- `exclude`: clearly ineligible. Provide a concise exclusion reason plus a direct quote from the title, abstract, DOI/source metadata, or citation fields that supports exclusion.
- Missing abstract: default to `include` unless the title/citation alone clearly excludes it.
- AI recommendations never create reviewer votes, never resolve conflicts, and never promote records.

## Supabase Fields

The apply script only updates:

- `ai_status`
- `ai_suggested_decision`
- `ai_reason`
- `ai_evidence_quote`
- `ai_source_location`
- `ai_confidence`
- `ai_model`
- `ai_criteria_version`
- `ai_raw_response`
- `ai_error`
- `ai_reviewed_at`
- `updated_at`

See `references/supabase-targets.md` for field details.
