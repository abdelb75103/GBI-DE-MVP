# Second Updated Search Full-Text AI Recommendations Audit

Date: 2026-06-17
Workflow stage: full-text screening AI recommendation
Run type: sequential batch write to database after second updated search PDF upload
Scope: the 138 full-text records from the second updated search that received newly uploaded local/database PDFs on 2026-06-16 and did not already have completed AI recommendations.

## Source Inputs

- Pending manifest: `tmp/full-text-ai-recommendations-second-updated-search-2026-06-16/second-updated-search-newly-uploaded-full-text-ai-pending-manifest.json`
- Packet directory: `tmp/full-text-ai-recommendations-second-updated-search-2026-06-16/packets/`
- Batch directory: `tmp/full-text-ai-recommendations-second-updated-search-2026-06-16/model-batches/`
- Review output directory: `tmp/full-text-ai-recommendations-second-updated-search-2026-06-16/review-batches/`
- Database verification: `tmp/full-text-ai-recommendations-second-updated-search-2026-06-16/second-updated-search-full-text-ai-recommendations-database-verification-2026-06-17.json`

## Method

- Used the `fifa-full-text-screening-review` skill criteria version `fifa-gbi-full-text-v1-2026-04-24`.
- Processed 23 batches sequentially.
- Batches 1-18 already had recommendation JSON from the earlier run and were rendered, dry-run validated, then written one batch at a time.
- Batches 19-23 were recommended in Codex chat from the extracted full-text packets, then rendered, dry-run validated, and written one batch at a time.
- Database writes updated only `screening_records.ai_*` fields.
- Human votes, resolver decisions, manual decisions, full-text placeholders, files, and audit events were not modified.
- Applied model label: `codex-in-chat-full-text-screening-skill`.

## Database Results

- Expected records from manifest: 138
- Found database rows: 138
- Completed AI recommendations after write: 138
- Incomplete AI recommendations after write: 0
- Missing database rows: 0
- Criteria version in database: `fifa-gbi-full-text-v1-2026-04-24` for all 138 records

Decision distribution:

| AI recommendation | Count |
|---|---:|
| Include | 116 |
| Exclude | 19 |
| Unsure | 3 |

The three completed records with no `ai_suggested_decision` are intentional `unsure` recommendations:

| Study ID | Record ID | Title |
|---|---|---|
| S1457 | `32255697-b715-44ea-97f3-8f525ded7bbb` | EFFECT OF MATURATION ON OVERUSE KNEE INJURY PREVALENCE: A CROSS-SECTIONAL STUDY OF YOUTH FOOTBALL PLAYERS IN JAPAN |
| S2555 | `66b1fc0b-babd-479b-98b8-a96924dbc63d` | Prevalence and characteristics of overuse injuries in female college soccer and volleyball players: a pilot study. |
| S2945 | `69a57907-bdac-4f41-b8c1-bfee6170159a` | ¿Influye la categoría y posición de juego en las lesiones deportivas en fútbol? |

## Validation

- Rendered normalized JSON, Markdown, and HTML outputs for all 23 batches.
- Confirmed 23 recommendation files and 23 normalized review files.
- Confirmed 138 normalized recommendations.
- Validation warnings: 0.
- Confirmed Supabase has 138 completed AI reviews for the exact manifest records.

## Notes

- Several included studies were marked with `manual_check_needed` in `ai_raw_response.tags` where the study was eligible but had a narrower caveat, such as multi-sport subgroup extraction, prediction-model focus, exposure-focused heading surveillance, or weaker rate denominators.
- Referee mental-health studies were treated as football-specific illness/mental-health epidemiology because they reported prevalence in defined football referee populations.
