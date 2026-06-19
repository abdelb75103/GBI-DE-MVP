# FIFA Title/Abstract Screening Review

Use this skill when reviewing title/abstract screening records for FIFA GBI before full-text retrieval. It writes the AI recommendation used as the first title/abstract decision; one human reviewer vote is the second decision.

## Decision Integrity Rule

Human reviewer votes are immutable audit records. This skill updates AI recommendations; it does not change human votes.

Never edit, remove, replace, or "restore" entries in `metadata.titleAbstractDecisions` for human votes. Never add `action: "resolver_decision"` entries, manually resolve conflicts, manually promote title/abstract records to full-text screening, or delete full-text placeholders unless Abdel explicitly asks to adjudicate the exact records and approves the exact resolver/promotion action in the current request.

When updated criteria change the AI view of a record, update the `ai_*` recommendation fields and leave any AI-vs-human disagreement as a conflict. Report the conflict with the human vote, AI recommendation, and criteria-based rationale.

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

Targeted re-review is still AI-only. It must not be implemented with a custom Supabase script that edits `metadata.titleAbstractDecisions`, `manual_decision`, resolver decisions, or promotion metadata.

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

Manual fallback applies AI recommendations only. If it creates or leaves conflicts, keep them as conflicts and report them; do not append resolver decisions.

## Decision Rules

- Always keep the extraction endpoint in view: the goal is to send forward papers that may provide actual extractable FIFA GBI outcomes under the full inclusion criteria, including injury, illness, health-problem, and mental-health/psychological-health prevalence, incidence, burden, counts, rates, frequencies, exposure denominators, repeated measurements, validated symptom/risk scale results, or comparable surveillance data. Do not narrow this to injury only, but do exclude records that do not plausibly provide extractable project outcomes.
- `include`: likely or possibly relevant. Provide a short rationale.
- `include` with `targetTag: "systematic_review"`: systematic review, scoping review, evidence synthesis, or meta-analysis specifically relevant to football/soccer injury, illness, health-problem, or mental-health surveillance/epidemiology reference checking, kept for Abdel's systematic-review handling rather than standard primary extraction. Do not include a review just because it is a systematic/scoping review; broad mixed-topic/mixed-sport reviews and reviews about prevention exercises, headgear/protective equipment, RTP criteria, rehabilitation exercises, performance tests, risk factors without epidemiology, head-acceleration proxies, mechanisms, imaging, or other non-extractable topics should be excluded.
- `exclude`: clearly ineligible. Provide a concise, criteria-based exclusion reason. Do not provide a source quote or source location.
- Self-reported data are not automatically ineligible. Include or leave undecided when the record plausibly uses prospective or repeated player-reported injury/health surveillance, such as weekly OSTRC-style reporting. Exclude one-time retrospective injury-history recall or cross-sectional injury-history association studies when they lack eligible surveillance, incidence, prevalence, burden, rate, or exposure-denominator data.
- Retrospective analysis is allowed only when the supplied record clearly shows the underlying injury/illness/health-problem data were prospectively collected from current participating players/referees through team/competition surveillance. Exclude hospital-only, registry-only, national injury database, public-source, media-source, public-database, and retrospective league/database studies even when they report incidence, prevalence, epidemiology, or injury rates.
- Mixed-sport and generic sport/athlete primary records are not automatically ineligible when football/soccer subgroup data may be extractable. Do not exclude solely because soccer/football is not explicitly named. If the record is not clearly a wrong sport/code and is not otherwise clearly ineligible, leave it `undecided`. Exclude broad mixed-topic reviews and downstream consequence records, such as imaging, biomarker, neurocognitive, behavioral, or long-term sequelae studies, when they do not report prevalence, incidence, burden, or rates of actual injuries/illnesses.
- Exclude public-media/public-source-only datasets, hospital-only datasets, registry-only datasets, national injury databases, retrospective public/league/database datasets, economic/financial/return-on-investment models, policy/editorial pieces, and performance/body-composition/biomechanics/measurement-only studies when they are not standalone sources of prospectively collected project outcomes.
- Exclude treatment, surgery, rehabilitation, return-to-play, or return-to-function cohorts that select players because they already have an injury and only report clinical, functional, complication, healing, reinjury-risk, or RTP outcomes.
- Exclude cohorts selected because players have a prior, recent, current, or surgically treated injury, such as ACL reconstruction/rupture, rerupture, acute tears, fractures, dislocations, or chronic pain, unless the injury subgroup is clearly nested in prospective surveillance of a current participating cohort.
- Exclude video-only public-video, broadcast-footage, match-footage, or video-analysis event/proxy records without an actual prospective injury dataset, including potential head injuries, suspected concussions, head collisions, headers, visible signs, medical-assessment behavior, injury mechanisms, and event characteristics, even when they report potential-event rates per match-hour. Also exclude head-impact proxy, biomarker, imaging, cognitive-function, cardiac-troponin, head-acceleration, and similar downstream/consequence records when they do not report actual injury, illness, health-problem, or mental-health prevalence, incidence, burden, rates, frequencies, or surveillance denominators.
- Include football/soccer distress, anxiety, depression, burnout, eating-disorder, injury-anxiety, or comparable psychological-health records when they plausibly contain actual extractable participant-health outcome data, even if they are not injury-specific. Do not include broad motivation, passion, wellness, sleep, menstrual-performance, quality-of-life, imaging, biomarker, or general health-status records unless the health issue is defined with consensus football injury/illness/all-health-problem definitions or is clearly mappable to football health-problem surveillance and supplies extractable data.
- Missing abstract: default to `undecided` unless the title/citation alone clearly excludes it.
- Title-only decisions are allowed when the title/citation is decisive. For example, clear American football or another wrong sport can be excluded, and a clear football/soccer injury surveillance title can be included or left `undecided` depending on how much evidence is present.
- AI recommendations never create, change, or delete human reviewer votes. Matching AI+human outcomes may be finalized by the approved app/workflow, and disagreement creates a conflict. A conflict remains a conflict until Abdel explicitly approves record-level adjudication.

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

The AI recommendation workflow writes:

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

Approved finalization code may update resolution/manual status for matching AI+human outcomes. It must not add resolver decisions or edit human vote entries. Custom scripts must not touch reviewer decisions, resolver decisions, or promotion metadata for AI re-review tasks.

See `references/supabase-targets.md` for field details.
