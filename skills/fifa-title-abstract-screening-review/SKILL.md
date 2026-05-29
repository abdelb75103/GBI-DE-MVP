# FIFA Title/Abstract Screening Review

Use this skill when reviewing title/abstract screening records for FIFA GBI before full-text retrieval. It produces advisory AI recommendations only; reviewer votes remain decisive.

## Model Rule

Do not use Gemini for this workflow unless Abdel explicitly asks for Gemini in the current request.

Run the screening locally from the current workspace and write recommendations to Supabase from the local workflow. Default to GPT-5.5 with medium reasoning when available. If GPT-5.5 medium is not available, use the closest suitable local Codex/OpenAI terminal model with explicit reasoning, record the model used, and explain the substitution before applying results.

## Workflow

### Preferred End-to-End Runner

Use the single local runner for bulk screening. It fetches eligible records, calls the model in sequential internal batches, validates every recommendation, checkpoints to disk, and writes each completed batch to Supabase when `--apply` is set. Do not split the work across chat messages or subagents unless Abdel explicitly asks for that again.

```bash
node skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs \
  --apply \
  --provider auto \
  --model gpt-5.4 \
  --reasoning medium \
  --batch-size 80 \
  --output /tmp/second-search-title-abstract-ai-codex.json
```

Notes:

- `--provider auto` uses the OpenAI Responses API when `OPENAI_API_KEY` is available, otherwise local `codex exec`.
- The command is resumable. Re-running it skips Supabase-completed records and uses the checkpoint file.
- Keep console output minimal; use `--quiet` for long unattended runs.
- Use `gpt-5.4` medium for straightforward title/abstract screening unless Abdel requests another model or QA shows quality problems. Use `gpt-5.5` medium when higher judgment is needed.

Check progress with:

```bash
node skills/fifa-title-abstract-screening-review/scripts/report_second_search_ai_progress.mjs
```

### Manual Fallback

Use this only for small audits or recovery from malformed model output.

1. Export candidate records from Supabase:

   ```bash
   node skills/fifa-title-abstract-screening-review/scripts/export_title_abstract_records.mjs --output /tmp/title-abstract-records.json
   ```

2. Review each record against `references/eligibility.md`.
   - Be lenient at title/abstract stage.
   - Recommend `include` when the record plausibly may contain eligible football injury/illness epidemiology data.
   - If the abstract is missing or too incomplete to support a title/abstract decision, recommend `undecided` unless the title/citation alone clearly excludes it.
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
- `include` with `targetTag: "systematic_review"`: systematic review, scoping review, evidence synthesis, or meta-analysis relevant to football/soccer injury or illness, kept for Abdel's systematic-review handling rather than standard primary extraction.
- `exclude`: clearly ineligible. Provide a concise exclusion reason plus a direct quote from the title, abstract, DOI/source metadata, or citation fields that supports exclusion.
- Missing abstract: default to `undecided` unless the title/citation alone clearly excludes it.
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
