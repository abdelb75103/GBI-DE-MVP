# Field Completeness And Status Rules

Use this reference when checking core metadata, participant fields, definitions, exposure, assignment, or live status.

## Assignment And Status

- Before selecting any paper for a new batch, verify `assigned_to`.
- Default assignment profile is `AbdelRahman Babiker` (`00000000-0000-0000-0000-000000000001`).
- Assign every paper selected for extraction, translated-paper processing, or batch review to AbdelRahman Babiker unless the user states another profile.
- Do not treat a paper as available if another profile is assigned, unless the user explicitly asks to reassign that paper or batch to AbdelRahman Babiker.
- If a paper was selected by mistake despite an existing assignment, record the audit issue and do not use it as future queue precedent.
- A paper touched during extraction or exclusion work should be assigned to `AbdelRahman Babiker` when it is unassigned or explicitly included in the current user-approved reassignment scope.
- Papers awaiting user review should normally remain `processing`.
- Do not normalize exclusion statuses such as `american_data`, `systematic_review`, `uefa`, or `referee` to `processing`.
- Only UEFA Elite Club study-family papers should be tagged `uefa`; do not use `uefa` for all UEFA-branded competitions.

## Study Details

- Always verify `leadAuthor`, `title`, `yearOfPublication`, `journal`, `doi` if present, and `studyDesign`.
- Format `leadAuthor` as `Surname Initials`, not surname only.
- Preserve `studyId` as the app-assigned value; when writing directly to Supabase, restore it to `papers.assigned_study_id` if needed.
- For `studyDesign`, keep retrospective observational/cohort wording when the paper uses it; if the underlying collection was prospective, append `[prospective data]`.

## Participants

- Treat Tab `2` as a completeness-checked tab, not a light pass.
- Check `country`, `fifaDiscipline`, `levelOfPlay`, `ageCategory`, `sex`, `sampleSizePlayers`, `numberOfTeams`, `meanAge`, and `observationDuration`.
- Do not leave obvious participant context blank when the paper clearly gives one country, code, play level, study window, team structure, or cohort sex.
- Standardize `fifaDiscipline` to the supported schema value.
- For `meanAge`, scan the abstract, methods, results prose, tables, and footnotes, not only the baseline participant table.
- If age is reported as a range or another non-mean expression, store that direct expression rather than leaving the field blank.
- Preserve season/year wording in `observationDuration`, e.g. `2009-2010 competitive season`, not just `1 season`.
- In subgroup papers, keep shared participant fields on the first row only unless row labels would become ambiguous.
- Exception: for subgroup sex rows, use labels such as `female - control` or `male - U17` when a plain global sex value would obscure the row mapping.

## Definitions And Exposure

- Treat Tabs `3-4` as mandatory extraction work.
- Check `injuryDefinition`, `illnessDefinition`, `incidenceDefinition`, `burdenDefinition`, `severityDefinition`, `recurrenceDefinition`, `mechanismReporting`, `seasonLength`, `numberOfSeasons`, `exposureMeasurementUnit`, `totalExposure`, `matchExposure`, and `trainingExposure`.
- Normalize `injuryDefinition` to one label: `physical complaint`, `all complaints`, `time loss`, or `medical attention`.
- Put qualifying scope in brackets after the label, e.g. `time loss [>3 days]` or `time loss [hamstring injuries only]`.
- If injury-definition wording is ambiguous but defensible, choose the closest canonical label and record the ambiguity in the backlog.
- `incidenceDefinition` must state the denominator frame whenever incidence, rate, prevalence, or burden is extracted.
- Prefer concise denominator text such as `per 1000 player-hours`, `per 1000 athlete-exposures`, `per 100 players`, `per player-season`, or `per training day`.
- `mechanismReporting` should name the reporter category, such as `medical staff`, `former staff`, `coach`, or `player self-report`; do not use a named person or replace it with the exposure logger.
- Athlete-exposures remain an accepted direct denominator. By user adjudication on 2026-07-27, athlete-years, player-/athlete-days, and projected exposure hours are not accepted as stand-alone denominators for this review. If one of those is the only denominator, use `flagged` only while the exclusion is awaiting adjudication; once confirmed, classify the paper as `no_exposure`, clear the temporary flag, and record the final exclusion in the backlog. If an accepted denominator is also reported, retain the accepted denominator and document the excluded measure.

## Sparse And Companion Papers

- If a paper appears to be a companion sub-study of an already extracted cohort, flag it before routine extraction.
- Sparse, headline-only, or abstract-level extraction is acceptable only when source limitations are explicit in the backlog.
- If a field is checked and genuinely not reported, leave it `not_reported`; do not silently skip it.
