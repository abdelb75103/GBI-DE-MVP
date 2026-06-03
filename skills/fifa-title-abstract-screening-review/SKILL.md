# FIFA Title/Abstract Screening Review

Use this skill when reviewing title/abstract screening records for FIFA GBI before full-text retrieval. It produces advisory AI recommendations only; reviewer votes remain decisive.

## Model Rule

Do not use Gemini for this workflow unless Abdel explicitly asks for Gemini in the current request.

Run the screening locally from the current workspace and write recommendations to Supabase from the local workflow. Default to GPT-5.5 with medium reasoning when available. If GPT-5.5 medium is not available, use the closest suitable local Codex/OpenAI terminal model with explicit reasoning, record the model used, and explain the substitution before applying results.

## Workflow

### Preferred End-to-End Runner

Use the single local runner for bulk screening. It fetches eligible records, calls the model in sequential internal batches, validates every recommendation, applies deterministic guardrails from `scripts/title_abstract_screening_rules.mjs`, checkpoints to disk, and writes each completed batch to Supabase when `--apply` is set. Do not split the work across chat messages or subagents unless Abdel explicitly asks for that again.

```bash
node skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs \
  --apply \
  --provider codex-cli \
  --model gpt-5.5 \
  --reasoning medium \
  --batch-size 80 \
  --output /tmp/second-search-title-abstract-ai-codex.json
```

Notes:

- `--provider codex-cli` is required. Direct API routing, auto routing, and Gemini are disabled for this project unless Abdel explicitly asks otherwise.
- The command is resumable. Re-running it skips Supabase-completed records and uses the checkpoint file.
- Keep console output minimal; use `--quiet` for long unattended runs.
- Use `gpt-5.5` medium when available. If it is unavailable, use the closest suitable local Codex/OpenAI terminal model with explicit reasoning, record the substitution in the audit output, and explain it before applying results.

Check progress with:

```bash
node skills/fifa-title-abstract-screening-review/scripts/report_second_search_ai_progress.mjs
```

For targeted re-review of known screening records, use the same runner with `--force` and `--study-ids` rather than a custom wrapper:

```bash
node skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs \
  --apply \
  --force \
  --provider codex-cli \
  --model gpt-5.5 \
  --reasoning medium \
  --study-ids 4149,5325 \
  --output /tmp/target-title-abstract-ai-codex.json
```

Numeric study IDs are normalized to `S####`. Use `--record-ids` only when targeting raw `screening_records.id` UUIDs.

### Manual Fallback

Use this only for small audits or recovery from malformed model output.

1. Export candidate records from Supabase:

   ```bash
   node skills/fifa-title-abstract-screening-review/scripts/export_title_abstract_records.mjs --output /tmp/title-abstract-records.json
   ```

2. Review each record against `references/eligibility.md` and `references/runtime-criteria.md`.
   - Be lenient at title/abstract stage.
   - Recommend `include` when the record plausibly may contain eligible football injury/illness epidemiology data.
   - If the abstract is missing or too incomplete to support a title/abstract decision, recommend `undecided` unless the title/citation alone clearly supports inclusion or exclusion.
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
- Title-only decisions are allowed when the title/citation is decisive. For example, clear American football or another wrong sport can be excluded, and a clear football/soccer injury surveillance title can be included or left `undecided` depending on how much evidence is present.
- AI recommendations never create reviewer votes, never resolve conflicts, and never promote records.

## Validation and Audit

Use the Rayyan first-batch validation runner only when changing criteria, prompts, or deterministic rules. It is a benchmark against known human pass-through decisions, not the live screening workflow.

```bash
node skills/fifa-title-abstract-screening-review/scripts/validate_first_batch_rayyan_ai.mjs \
  --sample-rate 0.1 \
  --sample-index 0 \
  --provider codex-cli \
  --model gpt-5.5 \
  --reasoning medium
```

Both the live runner and validation runner read `references/runtime-criteria.md` and use `scripts/title_abstract_screening_rules.mjs`; keep those shared files as the source of truth for reusable screening behavior.

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
