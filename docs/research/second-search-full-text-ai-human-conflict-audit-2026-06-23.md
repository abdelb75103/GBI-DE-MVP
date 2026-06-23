# Second Search Full-Text AI-Human Conflict Audit - 2026-06-23

Scope: `Second search - Ishanka - 2026-05-26` live full-text screening records where the AI recommendation conflicted with AbdelRahman Babiker's full-text profile vote.

Source context: live `screening_records` with `stage = full_text`; PDF/text audit cache at `fifa-gbi-data-extraction/tmp/full-text-ai-conflicts-2026-06-23`.

## Summary

- Initial conflicts reviewed: `21` of `397` full-text records.
- Initial direction: `11` AI include / human exclude; `10` AI exclude / human include.
- Live AI-field corrections applied: `7`.
- Remaining conflicts after corrections: `14`.
- Remaining direction: `8` AI include / human exclude; `6` AI exclude / human include.

## Live AI Corrections Applied

- `S1019`: AI corrected from exclude to include. Relevant injury systematic review/meta-analysis retained for reference checking, not primary extraction.
- `S1758`: AI corrected from include to exclude. The attached source is a conference/supplement abstract, so `Abstract` is the correct full-text exclusion.
- `S1235`: AI corrected from include to exclude. Soccer ball-to-head contact review is a proxy/wrong-outcome review, not injury/illness/mental-health epidemiology.
- `S2762`: AI corrected from include to exclude. Cross-sectional study with retrospective injury history from the most recent season; the human exclusion was supported.
- `S4793`: AI corrected from exclude to include. MLS Injury Surveillance Database is a league surveillance channel and the paper publishes football-specific hamstring injury-rate results.
- `S4778`: AI corrected from exclude to include. Same MLS surveillance/rate issue for ACL injuries.
- `S2079`: AI corrected from exclude to include. Direct sport-anxiety/self-esteem scale results in active football players fit the mental-health leniency rule.

No human votes, resolver state, promotions, or extraction records were changed.

## Model/Skill Changes

- Updated app criteria to `fifa-gbi-full-text-v8-2026-06-23`.
- Aligned app prompt criteria with the installed full-text screening skill:
  - relevant systematic/scoping/umbrella reviews and meta-analyses are retained for reference checking;
  - systematic reviews limited to prevention, rehabilitation, RTP, performance, mechanisms, imaging, or proxy outcomes are excluded;
  - derivable denominators must define the complete at-risk frame without screening-time calculation;
  - case-only/specific-injury cohorts without an at-risk denominator are excluded at full text.

## Themes Learned

- Systematic reviews were the biggest rule mismatch. The current full-text skill retains relevant review papers for reference checking, while stale app criteria said to exclude all reviews. This caused avoidable conflicts.
- Human exclusions for `Abstract` and proxy-outcome reviews were correct. The AI should not route abstract-only files or head-contact proxy reviews through the review-retention path.
- MLS/league surveillance papers should not be excluded as public/database records when the database is the league surveillance channel and the paper reports football-specific injury-rate results.
- Mental-health leniency should include direct quantitative psychological-health scales in football players/referees, even when cross-sectional, but not tool-utility, satisfaction, engagement, bibliometric, or register-only mental-health papers.
- Denominator leniency should stay bounded. Fully specified schedules, completed repeated-surveillance observations, published rates, and explicit cohort mean exposure inputs can qualify; vague season labels, selected cases, and injury-only samples should not.

## Remaining Conflicts Kept Visible

- `S4615`: AI include / human exclude. Relevant football injury systematic review; under `v8`, retain for reference checking. Push back on human `Wrong study design` if the intent is to keep relevant reviews.
- `S2669`: AI exclude / human include. Prospective weekly OSTRC hamstring study; likely include-leaning, but the current AI reason reflects a denominator concern. Needs a cleaner denominator quote before overwriting.
- `S1101`: AI include / human exclude. FC Barcelona multisport hamstring paper reports sport-specific athlete-year rates, but the paper also notes denominator limitations for subgroups. Leave as real judgment conflict.
- `S3912`: AI include / human exclude. Football referee PTSD/stress/burnout survey; AI aligns with mental-health leniency. Push back on automatic cross-sectional exclusion.
- `S1906`: AI include / human exclude. Football-player anxiety before/after match; AI aligns with mental-health leniency, but extraction usefulness may be marginal.
- `S1956`: AI include / human exclude. Prospective cohort with weekly follow-up and soccer training/match time at risk; human denominator exclusion appears too strict.
- `S1914`: AI exclude / human include. Personality/performance paper with injury history, not primary prospective injury surveillance; AI exclusion remains defensible.
- `S5482`: AI exclude / human include. Nationwide register/hospital/prescription/death-certificate outcomes; AI exclusion remains defensible despite mental-health topic.
- `S1381`: AI include / human exclude. Weekly OSTRC groin-problem follow-up with incidence-rate ratios; human denominator exclusion appears too strict.
- `S3888`: AI include / human exclude. Systematic review on high-speed running and soccer injury risk; keep as a review-route judgment conflict.
- `S1920`: AI exclude / human include. Bibliometric/database literature analysis, not a primary football cohort; AI exclusion remains defensible.
- `S1925`: AI exclude / human include. Online psychological assessment/tool-utility and satisfaction monitoring, not direct mental-health epidemiology; AI exclusion remains defensible.
- `S2205`: AI include / human exclude. Intervention cohort with fully specified season schedule, group sizes, activity minutes, and injury counts; AI inclusion is defensible under bounded derivability.
- `S4372`: AI exclude / human include. School football engagement/depression association study; AI exclusion remains defensible because competition context is not clearly eligible and the topic is engagement rather than direct surveillance.
