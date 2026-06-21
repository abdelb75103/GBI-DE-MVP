export const SCREENING_CRITERIA_VERSION = 'fifa-gbi-full-text-v4-2026-06-21';

export const FULL_TEXT_SCREENING_CRITERIA = `
FIFA GBI full-text screening criteria:

Include studies that report original injury or illness epidemiology in competitive association football, futsal, beach soccer, or eligible para-football, with football-specific data and a usable denominator such as exposure hours, player matches, player seasons, athletes at risk, or another clearly reported population/time base.

Do not exclude solely because an analysis is described as retrospective, or because data pass through a registry, insurance, league, or reporting database. Prospectively collected current-participant surveillance remains eligible when clubs, team medical staff, physicians, or equivalent competition reporters recorded injuries or illnesses prospectively and a registry, insurer, or league platform is only the reporting channel.

Season-long club or team medical, dental, biomarker, or monitoring records from current players do not by themselves supply an eligible denominator. If a paper reports only player counts, injury counts, percentages, correlations, or associations without exposure hours, athlete-exposures, match-exposures, a published study-specific rate, or exact derivation inputs, exclude for no usable denominator rather than for retrospective/cross-sectional wording alone.

Use slightly more leeway for football/soccer mental-health and psychological-health full texts because these studies are sparse. Direct quantitative participant-health outcome papers remain eligible when they report football-specific prevalence, counts, rates, burden, repeated measurements, or validated symptom scale results that can be extracted, even when the design is cross-sectional and the denominator is the responding football participant cohort. Do not use this leniency for attitude, awareness, perception, service-use, support, or broad wellness papers that do not report direct extractable participant-health outcomes.

Exclude wrong sport, non-competitive/recreational-only contexts that do not meet the project definition, records without football-specific subgroup data, records with counts or proportions but no usable denominator, public-source-only datasets such as Transfermarkt/public media datasets, hospital-record-only or claims-only datasets, registry/database studies whose underlying outcomes were not prospectively reported from current participating players/referees, purely biomechanical/performance/intervention papers without usable epidemiology, and retrospective/cross-sectional designs when they do not meet the current project policy.

Systematic reviews, narrative reviews, and literature reviews are not primary extraction studies. They may be retained outside the primary extraction stream for reference-list checking, but the full-text screening decision requested here must be Include only for primary eligible records and Exclude otherwise.

If the evidence is insufficient to decide, choose Exclude only when a concrete exclusion reason is supported by the text. Otherwise use the most conservative decision supported by the PDF and explain uncertainty in the reason.
`.trim();
