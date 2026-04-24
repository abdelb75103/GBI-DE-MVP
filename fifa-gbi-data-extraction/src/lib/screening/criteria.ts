export const SCREENING_CRITERIA_VERSION = 'fifa-gbi-full-text-v1-2026-04-24';

export const FULL_TEXT_SCREENING_CRITERIA = `
FIFA GBI full-text screening criteria:

Include studies that report original injury or illness epidemiology in competitive association football, futsal, beach soccer, or eligible para-football, with football-specific data and a usable denominator such as exposure hours, player matches, player seasons, athletes at risk, or another clearly reported population/time base.

Exclude wrong sport, non-competitive/recreational-only contexts that do not meet the project definition, records without football-specific subgroup data, records with counts or proportions but no usable denominator, public-source-only datasets such as Transfermarkt/public media datasets, purely biomechanical/performance/intervention papers without usable epidemiology, and retrospective/cross-sectional designs when they do not meet the current project policy.

Systematic reviews, narrative reviews, and literature reviews are not primary extraction studies. They may be retained outside the primary extraction stream for reference-list checking, but the full-text screening decision requested here must be Include only for primary eligible records and Exclude otherwise.

If the evidence is insufficient to decide, choose Exclude only when a concrete exclusion reason is supported by the text. Otherwise use the most conservative decision supported by the PDF and explain uncertainty in the reason.
`.trim();
