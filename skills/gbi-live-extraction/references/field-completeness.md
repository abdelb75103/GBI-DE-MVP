# Field Completeness And Status Rules

Use this reference when checking core metadata, participant fields, definitions, exposure, assignment, or live status.

## Assignment And Status

- Before selecting any paper for a new batch, verify `assigned_to`.
- Do not treat a paper as available if another profile is assigned.
- If a paper was selected by mistake despite an existing assignment, record the audit issue and do not use it as future queue precedent.
- A paper touched during extraction or exclusion work should be assigned to `AbdelRahman Babiker` only if it is truly unassigned and legitimately part of the current queue.
- Papers awaiting user review should normally remain `processing`.
- Do not normalize exclusion statuses such as `american_data`, `systematic_review`, `uefa`, or `referee` to `processing`.
- Only UEFA Elite Club study-family papers should be tagged `uefa`; do not use `uefa` for all UEFA-branded competitions.

## Study Details

- Always verify `leadAuthor`, `title`, `yearOfPublication`, `journal`, `doi` if present, and `studyDesign`.
- Format `leadAuthor` as `Surname Initials`, not surname only.
- Preserve `studyId` as the app-assigned value; when writing directly to Supabase, restore it to `papers.assigned_study_id` if needed.

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
- Normalize `injuryDefinition` to `physical complaint`, `medical attention`, or `time-loss` when defensible.
- Preserve combined definitions as short combinations, such as `medical attention or time-loss`.
- If injury-definition wording is ambiguous but defensible, choose the closest canonical label and record the ambiguity in the backlog.
- `incidenceDefinition` must state the denominator frame whenever incidence, rate, prevalence, or burden is extracted.
- Prefer concise denominator text such as `per 1000 player-hours`, `per 1000 athlete-exposures`, `per 100 players`, `per player-season`, or `per training day`.
- `mechanismReporting` should name the injury reporter role, such as `Medical Staff`, `Coach`, or `Player-selfreported`; do not replace it with the exposure logger.
- If the paper reports non-hour denominators such as athlete-exposures, player-months, player-days, or match-minutes, still fill exposure using the direct denominator and set `exposureMeasurementUnit` to the closest supported value or `other`.

## Sparse And Companion Papers

- If a paper appears to be a companion sub-study of an already extracted cohort, flag it before routine extraction.
- Sparse, headline-only, or abstract-level extraction is acceptable only when source limitations are explicit in the backlog.
- If a field is checked and genuinely not reported, leave it `not_reported`; do not silently skip it.
