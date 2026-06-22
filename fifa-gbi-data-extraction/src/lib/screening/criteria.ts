export const SCREENING_CRITERIA_VERSION = 'fifa-gbi-full-text-v8-2026-06-22';

export const FULL_TEXT_SCREENING_CRITERIA = `
FIFA GBI full-text screening criteria:

Include studies that report original injury or illness epidemiology in competitive association football, futsal, beach soccer, or eligible para-football, with football-specific data and a usable denominator such as exposure hours, player matches, player seasons, athletes at risk, or another clearly reported population/time base. Direct football-specific mental-health, psychological-health, or repeated well-being papers of current participants may also be included for the project's mental-health handling lane when the participant-health outcome itself is the primary focus, even without exposure-based denominators.

Do not exclude solely because an analysis is described as retrospective, or because data pass through a registry, insurance, league, or reporting database. Prospectively collected current-participant surveillance remains eligible when clubs, team medical staff, physicians, or equivalent competition reporters recorded injuries or illnesses prospectively and a registry, insurer, or league platform is only the reporting channel.

At full-text screening, direct football-specific injury-specific, illness-specific, or case-only cohorts still need a usable at-risk denominator. Do not keep them in stream for later no_exposure handling when they only report case distributions, mechanisms, characteristics, burden, recovery outcomes, counts, or proportions without exposure hours, athlete-exposures, match-exposures, a published study-specific rate, or exact derivation inputs.

Season-long club or team medical, dental, biomarker, or monitoring records from current players do not by themselves supply an eligible denominator. If a paper is otherwise an eligible direct football injury/illness cohort but reports only player counts, injury counts, sample counts, percentages, correlations, associations, season labels, or selected analytic subsets without exposure hours, athlete-exposures, match-exposures, a published study-specific rate, or exact derivation inputs, exclude it for no usable denominator rather than using a retrospective/cross-sectional shortcut.

Use slightly more leeway for football/soccer mental-health and psychological-health full texts because these studies are sparse. Direct football mental-health, psychological-health, coping/help-seeking, or repeated well-being papers remain eligible when the paper's primary focus is the current football participant-health outcome itself, even when the design is qualitative, interview-based, service-use focused, or cross-sectional and the denominator is only the responding football cohort, repeated questionnaire frame, or clearly defined interview sample. Direct quantitative participant-health outcome papers remain eligible when they report football-specific prevalence, counts, rates, burden, repeated measurements, or validated symptom scale results that can be extracted. Do not exclude these direct mental-health papers merely for lacking exposure hours, athlete-exposures, or match-exposures.

Do not use this leniency for personality, perfectionism, motivation, performance, talent-pathway, or broad wellness/load-monitoring papers where distress, anxiety, or well-being appears only as an indirect correlate, predictor, or background theme rather than the paper's primary football participant-health outcome.

Footballers compared with non-football or non-athlete controls remain eligible when the football subgroup is clearly separable and the paper reports extractable validated symptom or psychological scale results for that football subgroup.

Exclude wrong sport, non-competitive/recreational-only contexts that do not meet the project definition, records without football-specific subgroup data, records with counts or proportions but no usable denominator, public-source-only datasets such as Transfermarkt/public media datasets, hospital-record-only or claims-only datasets, registry/database studies whose underlying outcomes were not prospectively reported from current participating players/referees, purely biomechanical/performance/intervention papers without usable epidemiology, and retrospective/cross-sectional designs when they do not meet the current project policy.

Systematic reviews, narrative reviews, and literature reviews are not primary extraction studies. They may be retained outside the primary extraction stream for reference-list checking, but the full-text screening decision requested here must be Include only for primary eligible records and Exclude otherwise.

Cited reviews, meta-analyses, or review language that appears only in background discussion, comparison text, or the reference list do not make the current paper a review. Judge review status from the paper's own study design, methods, and results, with priority on the title, abstract, and methods sections.

If the evidence is insufficient to decide, choose Exclude only when a concrete exclusion reason is supported by the text. Otherwise use the most conservative decision supported by the PDF and explain uncertainty in the reason.
`.trim();
