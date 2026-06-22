export const SCREENING_CRITERIA_VERSION = 'fifa-gbi-full-text-v5-2026-06-22';

export const FULL_TEXT_SCREENING_CRITERIA = `
FIFA GBI full-text screening criteria:

Include studies that report original injury or illness epidemiology in competitive association football, futsal, beach soccer, or eligible para-football, with football-specific data and a usable denominator such as exposure hours, player matches, player seasons, athletes at risk, or another clearly reported population/time base.

Do not exclude solely because an analysis is described as retrospective, or because data pass through a registry, insurance, league, or reporting database. Prospectively collected current-participant surveillance remains eligible when clubs, team medical staff, physicians, or equivalent competition reporters recorded injuries or illnesses prospectively and a registry, insurer, or league platform is only the reporting channel.

Published study-specific injury rates or incidence results can themselves supply the usable denominator frame even when the paper does not also print every raw exposure total. Do not misclassify league or MLS injury-surveillance papers as denominator failures when the paper reports football-specific rates from current-player surveillance.

Season-long club or team medical, dental, biomarker, or monitoring records from current players do not by themselves supply an eligible denominator. If a paper reports only player counts, injury counts, percentages, correlations, or associations without exposure hours, athlete-exposures, match-exposures, a published study-specific rate, or exact derivation inputs, exclude for no usable denominator rather than for retrospective/cross-sectional wording alone.

Use slightly more leeway for football/soccer mental-health and psychological-health full texts because these studies are sparse. Direct quantitative participant-health outcome papers remain eligible when they report football-specific prevalence, counts, rates, burden, repeated measurements, or validated symptom scale results that can be extracted, even when the design is cross-sectional and the denominator is the responding football participant cohort. Do not use this leniency for attitude, awareness, perception, service-use, support, or broad wellness papers that do not report direct extractable participant-health outcomes.

Exclude wrong sport, non-competitive/recreational-only contexts that do not meet the project definition, records without football-specific subgroup data, records with counts or proportions but no usable denominator, public-source-only datasets such as Transfermarkt/public media datasets, hospital-record-only or claims-only datasets, registry/database studies whose underlying outcomes were not prospectively reported from current participating players/referees, purely biomechanical/performance/intervention papers without usable epidemiology, and retrospective/cross-sectional designs when they do not meet the current project policy.

If the available PDF or linked source is only a conference abstract, supplement abstract, or citation/abstract page rather than a real full text, exclude for Abstract instead of forcing another exclusion reason.

Systematic reviews, narrative reviews, and literature reviews are not primary extraction studies. They may be retained outside the primary extraction stream for reference-list checking, but the full-text screening decision requested here must be Include only for primary eligible records and Exclude otherwise.

Cited reviews, meta-analyses, or review language that appears only in background discussion, comparison text, or the reference list do not make the current paper a review. Judge review status from the paper's own study design, methods, and results, with priority on the title, abstract, and methods sections.

If the evidence is insufficient to decide, choose Exclude only when a concrete exclusion reason is supported by the text. Otherwise use the most conservative decision supported by the PDF and explain uncertainty in the reason.
`.trim();
