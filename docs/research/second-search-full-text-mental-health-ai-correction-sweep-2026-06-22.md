# Second Search Full-Text Mental-Health AI Correction Sweep - 2026-06-22

Scope: `Second search - Ishanka - 2026-05-26` full-text AI recommendations with stale mental-health or psychology-adjacent `fifa-gbi-full-text-v4-2026-06-19` excludes.

Source context: `tmp/full-text-ai-rereview-all-current-2026-06-19`

## Why this sweep was needed

- `S1934` was stored live as an AI `exclude` for `E-PRX-01`, but the paper reports direct cross-sectional anxiety/aggression scale results for a separable football subgroup versus non-football controls.
- `S1920` was stored live as an AI denominator failure, but the paper is actually a bibliometric/database literature analysis and should be excluded for publication type.
- `S5482` surfaced as a useful provenance check: despite mental-health outcomes and an existing human include vote, the AI exclusion remains correct because the outcomes come from nationwide registers, hospital/outpatient records, prescriptions, and death certificates rather than current-player surveillance.

## Reviewed stale cluster

- `S1892`: retained AI exclude. Comparative youth football/futsal paper using self-reported injury survey and psychological-performance characteristics; not prospective surveillance.
- `S1920`: AI exclude retained, but reason corrected to `E-PUB-01 Ineligible publication type`.
- `S1925`: retained AI exclude. Online psychological monitoring/tool-utility paper; not direct football epidemiology.
- `S1934`: AI recommendation corrected from exclude to include.
- `S2988`: retained AI exclude. Injury-count paper across competition levels using club records/questionnaires without an eligible surveillance denominator.
- `S4372`: retained AI exclude. School/leisure football engagement and adolescent mental-health profiles; not an eligible competitive football epidemiology setting.
- `S5482`: AI exclude retained under provenance rule. Human include vote remains a visible conflict and was not changed.

## Preventive patch applied

- Updated [fifa-gbi-data-extraction/src/lib/screening/criteria.ts](/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/src/lib/screening/criteria.ts) to `fifa-gbi-full-text-v7-2026-06-22`.
- Added an explicit rule that separable football-vs-control mental-health comparisons with validated symptom/psychological scales remain eligible.
- Added a regression test in [fifa-gbi-data-extraction/tests/full-text-ai-criteria.test.mjs](/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/tests/full-text-ai-criteria.test.mjs).
- Updated the installed full-text review skill reference at `/Users/abdelbabiker/.codex/skills/fifa-full-text-screening-review/references/eligibility.md` with three clarifications:
  - separable football subgroup mental-health comparisons are eligible;
  - bibliometric/scientometric/database literature analyses are `E-PUB-01`;
  - nationwide register/hospital/prescription/death-certificate mental-health outcomes remain `E-SRC-01` unless they come from current-player surveillance reporters.

## Live AI-field update plan

- Apply verified AI-field corrections for:
  - `S1920`
  - `S1934`
  - `S5482`
- Do not edit human full-text votes, resolver state, or promotion state.
- Re-query each updated row after apply and verify:
  - `ai_suggested_decision`
  - `ai_reason`
  - `ai_evidence_quote`
  - `ai_source_location`
  - `ai_confidence`
  - `ai_model`
  - `ai_criteria_version`
  - `ai_raw_response`

## Expected state after apply

- `S1934`: AI include.
- `S1920`: AI exclude with publication-type rationale.
- `S5482`: AI exclude with explicit ineligible-provenance rationale; human include remains unresolved and visible as a conflict.
