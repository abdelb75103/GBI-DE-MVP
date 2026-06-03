# Title/Abstract AI Screening Validation Audit - 2026-06-02

## Scope

This audit records the local validation and calibration of the FIFA GBI title/abstract AI screening workflow against the archived first-batch Rayyan human pass-through decisions.

This was prompt/workflow calibration, not model-weight training or fine-tuning. No model weights were changed. The first-batch validation runs did not write to the database. Later on 2026-06-02, Abdel provided scoped teaching corrections for three second-search records; those corrections updated AI recommendation columns only and are documented below.

## Source Set

- Source CSV: `/Users/abdelbabiker/Desktop/FIFA/ENTitle and Abstract Screening Results .csv`
- Parsed source rows: `882`
- Human comparator: Rayyan records that reached full-text consideration; all are treated as known-positive pass-through records for this validation.
- Primary metric: known-positive safety, where model `include` and `undecided` count as aligned, and model `exclude` or missing counts as a false exclusion.
- Sampling: deterministic SHA-256 key sample windows at `10%` each.
- Sample window overlap check: sample indexes `0`, `1`, and `2` had `0` overlapping records.

## Execution Policy

- Provider: local `codex-cli`
- Direct OpenAI API routing: disabled
- Gemini routing: disabled
- First-batch validation database writes: `false`
- Live reviewer/manual/full-text promotion data changes: none
- Final model command used for the latest validation:

```bash
node skills/fifa-title-abstract-screening-review/scripts/validate_first_batch_rayyan_ai.mjs \
  --phase optimized-v14d-10pct-window3 \
  --sample-rate 0.1 \
  --sample-index 2 \
  --batch-size 150 \
  --concurrency 1 \
  --model gpt-5.5 \
  --reasoning medium \
  --timeout-ms 1200000 \
  --force
```

## Criteria Versions

| Version | Change summary |
| --- | --- |
| `fifa-gbi-title-abstract-v1-2026-05-27` | Baseline prompt against initial 10% sample. |
| `fifa-gbi-title-abstract-v1.1-2026-06-02` | Tuned eligibility language for football/soccer injury and illness surveillance pass-through. |
| `fifa-gbi-title-abstract-v1.2-2026-06-02` | Second non-overlapping 10% validation window. |
| `fifa-gbi-title-abstract-v1.3-2026-06-02` | Referee/match-official records explicitly included and tagged. |
| `fifa-gbi-title-abstract-v1.4-2026-06-02` | Local Codex-only optimized workflow; compact runtime criteria; deterministic pre-triage; compact model output; comprehensive project criteria added; title/abstract-stage safety rule clarified; referee inclusion, return-to-play limits, post-injury functional-outcome exclusions, mental-health leeway, attitude-only survey exclusions, and title-only missing-abstract decisions captured. |

Criteria files:

- Full human-readable guidance: `skills/fifa-title-abstract-screening-review/references/eligibility.md`
- Compact runtime criteria injected into model prompts: `skills/fifa-title-abstract-screening-review/references/runtime-criteria.md`
- Shared deterministic guardrails and output normalization: `skills/fifa-title-abstract-screening-review/scripts/title_abstract_screening_rules.mjs`

## Workflow Architecture

The reusable screening workflow is intentionally split into shared rules, live screening, and validation:

- `references/runtime-criteria.md` is the model-facing criteria card and should be treated as the prompt source of truth.
- `references/eligibility.md` is the fuller human-readable criteria/audit guide.
- `scripts/title_abstract_screening_rules.mjs` contains shared deterministic pre-triage, reason-code labels, quote validation, compact recommendation expansion, and output normalization.
- `scripts/run_second_search_ai_screening_codex.mjs` is the live local runner. Despite the legacy filename, it accepts `--batch-label` and is the bulk screening runner for current/future title/abstract batches.
- `scripts/validate_first_batch_rayyan_ai.mjs` is only a benchmark/audit harness against the archived Rayyan first-batch human pass-through decisions. It is not called by the live runner.

## Comprehensive Criteria Captured

The final criteria explicitly record:

- Eligible designs: prospective cohort/descriptive/risk-factor surveillance, RCTs with eligible epidemiology outcomes, OSTRC or similar panel designs, regular seasons, short-term tournaments, club/national/international tournaments, all languages.
- Eligible participants: competitive association football/soccer, futsal, beach soccer, para football, men's and women's football, all age groups, all competitive levels, all locations.
- Referee studies: included and marked/tagged separately.
- Mental-health and injury-anxiety records: apply a safer title/abstract threshold when quantitative participant-health data may be present; exclude pure attitude/knowledge/perception surveys when they lack direct injury, illness, mental-health, prevalence, incidence, burden, counts, rates, frequency, or denominator data.
- Systematic reviews: retained during screening for reference-list checks.
- Exclusions: wrong football code/sport, non-competitive football, walking football, narrative reviews/commentaries/editorials/protocols/case reports, retrospective cross-sectional/case-control unless prospectively collected surveillance may be present, register-only/hospital-record-only studies, public-media-only data sources, non-project injury definitions, counts/proportions only without rates/exposure at full text, mortality/catastrophic-outcome-only studies.
- Post-injury functional-outcome exclusions: studies selecting only previously injured football/soccer players or patients are excluded when they report function, symptoms, rehabilitation/treatment response, imaging, or return-to-function outcomes rather than surveillance incidence, prevalence, burden, counts, rates, frequency, or denominator data.
- Title/abstract safety rule: do not apply full-text denominator exclusions too early; pass plausible football/soccer injury or illness surveillance records to full text when uncertainty remains.
- Missing-abstract/title-only rule: missing abstracts are not automatic `undecided`; make clear include/exclude decisions from decisive titles or citation metadata, while keeping thin ambiguous titles as `undecided`.
- Return-to-play rule: pure RTP/RTS records are excluded unless they plausibly contain injury/illness surveillance data, counts, rates, incidence, burden, prevalence, exposure denominators, or similar extractable quantitative outcomes.

## Validation Timeline

| Phase | Sample index | Records | Criteria | Safety | False excludes | Include | Undecided | Exclude | Notes |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `baseline-10pct` | `0` | `88` | `v1` | `87.5%` | `11` | `77` | `0` | `11` | Baseline blind Codex run. |
| `tuned-10pct` | `0` | `88` | `v1.1` | `96.6%` | `3` | `84` | `1` | `3` | Same sample after eligibility tuning. |
| `tuned-10pct-window2` | `1` | `88` | `v1.2` | `90.9%` | `8` | `80` | `0` | `8` | Fresh non-overlapping 10% sample exposed referee gap. |
| `tuned-10pct-window2-referee-v13` | `1` | `88` | `v1.3` | `97.7%` | `2` | `86` | `0` | `2` | Referee studies explicitly included/tagged. |
| `optimized-v14-10pct-window3` | `2` | `88` | `v1.4` | `93.2%` | `6` | `78` | `4` | `6` | First optimized pre-triage was too aggressive. |
| `optimized-v14b-10pct-window3` | `2` | `88` | `v1.4` | `95.5%` | `4` | `80` | `4` | `4` | Deterministic exclusion rules tightened. |
| `optimized-v14c-10pct-window3` | `2` | `88` | `v1.4` | `97.7%` | `2` | `82` | `4` | `2` | Added title/abstract safety rule for denominators and mixed-sport metadata. |
| `optimized-v14d-10pct-window3` | `2` | `88` | `v1.4` | `98.9%` | `1` | `82` | `5` | `1` | Final fresh-window validation after mixed-sport football metadata correction. |

## Final Optimized Validation

Final phase: `optimized-v14d-10pct-window3`

- Generated: `2026-06-02T10:22:30.763Z`
- Model: `gpt-5.5`
- Reasoning: `medium`
- Provider: `codex-cli`
- Source rows: `882`
- Sampled rows: `88`
- Sample index: `2`
- Deterministic decisions: `84`
- Model-reviewed records: `4`
- Model calls: `1`
- Retry count: `0`
- Elapsed seconds: `19.69`
- Records/minute: `268.16`
- Seconds/model call: `19.66`
- Decision counts: `82 include`, `5 undecided`, `1 exclude`
- Known-positive safety: `98.9%`
- False-exclusion rate: `1.1%`
- Database writes: `false`

Remaining mismatch:

- `rayyan-10438773` - `Scaphoid fractures in soccer goalkeepers`
- Human label: `Conflict Included (Resolver Decision)`
- Model decision: `exclude`
- Model reason: case report/series of three scaphoid fractures, not surveillance epidemiology.
- Audit interpretation: this is a residual title/abstract validation mismatch, but the exclusion is defensible under the comprehensive criteria because case reports are excluded. The workflow was not loosened to include case reports.

## Second-Search Teaching Corrections

On 2026-06-02, Abdel provided teaching examples from the live second-search title/abstract records. These were applied only to AI recommendation columns in `screening_records`; reviewer/manual decisions, full-text promotion fields, and extraction data were not changed.

Correction payload:

- `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/second-search-manual-teaching-corrections-2026-06-02.json`

Applied corrections:

| Study ID | AI decision after correction | Rationale |
| --- | --- | --- |
| `S5492` | `exclude` | Cross-sectional/post-injury functional outcome study in soccer players after ACL reconstruction; not surveillance incidence, prevalence, burden, counts, rates, or denominator data. |
| `S5491` | `include` | Professional male soccer players with sports injury anxiety/mental-health related outcome; mental-health/injury-anxiety records get a safer title/abstract threshold when quantitative participant-health data may be present. |
| `S2575` | `exclude` | Knowledge/attitudes/behaviors questionnaire about menstruation; not direct injury, illness, or mental-health surveillance outcome numbers for extraction. |
| `S5498` | unchanged | Abdel did not request a correction; the prior AI recommendation remains unchanged. |

Database apply command:

```bash
node skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs \
  --input outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/second-search-manual-teaching-corrections-2026-06-02.json \
  --force --apply
```

Post-apply verification query confirmed:

- `S2575`: `exclude`, criteria `fifa-gbi-title-abstract-v1.4-2026-06-02`
- `S5491`: `include`, criteria `fifa-gbi-title-abstract-v1.4-2026-06-02`
- `S5492`: `exclude`, criteria `fifa-gbi-title-abstract-v1.4-2026-06-02`
- `S5498`: unchanged at prior criteria `fifa-gbi-title-abstract-v1-2026-05-27`

## Audit Artifacts

Primary final artifacts:

- Final report: `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/optimized-v14d-10pct-window3-validation-report.md`
- Blind predictions: `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/optimized-v14d-10pct-window3-blind-predictions.json`
- Revealed comparison: `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/optimized-v14d-10pct-window3-revealed-comparison.csv`
- False-exclude review: `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/optimized-v14d-10pct-window3-false-excludes.csv`
- Source manifest: `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/optimized-v14d-10pct-window3-source-manifest.json`
- Event log: `outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/optimized-v14d-10pct-window3-events.jsonl`

Earlier comparison artifacts are retained in the same output directory for reproducibility.

## Verification

Checks run after implementation:

```bash
for f in fifa-gbi-data-extraction/tests/title-abstract-*.test.mjs fifa-gbi-data-extraction/tests/first-batch-rayyan-validation.test.mjs; do node --experimental-strip-types "$f" || exit 1; done
node skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs --self-test
node skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs --input outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/second-search-manual-teaching-corrections-2026-06-02.json --force
node skills/fifa-title-abstract-screening-review/scripts/apply_recommendations_to_supabase.mjs --input outputs/title-abstract-validation/first-batch-rayyan-2026-06-02/second-search-manual-teaching-corrections-2026-06-02.json --force --apply
git diff --check
node --check skills/fifa-title-abstract-screening-review/scripts/title_abstract_screening_rules.mjs
node --check skills/fifa-title-abstract-screening-review/scripts/validate_first_batch_rayyan_ai.mjs
node --check skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs
npm run lint
```

Verification result:

- Title/abstract tests: passed.
- First-batch Rayyan validation tests: passed.
- Second-search runner self-test: passed.
- Correction payload dry-run: passed for 3 recommendations, skipped 0.
- Correction payload apply: updated 3 recommendations, skipped 0.
- Post-apply Supabase verification: S2575/S5491/S5492 updated to `v1.4`; S5498 unchanged.
- Syntax checks: passed.
- Shared-rule architecture check: live runner imports `title_abstract_screening_rules.mjs` and no longer imports the Rayyan validation harness.
- Diff whitespace check: passed.
- Lint: passed with one unrelated pre-existing warning in `fifa-gbi-data-extraction/scripts/populate-uefa-master-anchor-extractions.mjs` for `manualWecisFields`.
- Process check: no lingering `validate_first_batch_rayyan_ai`, `gbi-first-batch-validation`, or `codex exec` processes.

## Governance Notes

- This validation supports workflow confidence for title/abstract screening, especially false-exclusion safety.
- It should not be described as supervised model training or fine-tuning.
- The tuned workflow still requires human full-text screening for included/undecided records.
- The audit trail is local and reproducible from the listed CSV, criteria files, scripts, reports, manifests, predictions, comparison CSVs, and event logs.
