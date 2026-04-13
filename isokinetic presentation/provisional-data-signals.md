# Provisional Data Signals

This note summarizes directional signals from:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/all-studies-export-2026-04-03T20-52-31-100Z.csv`

These are planning signals only. They must be rechecked against the cleaned analysis dataset before any final talk claims are locked.

## Snapshot On April 3, 2026

- The export contains 1,014 rows and 570 paper IDs.
- Status labels are mixed, including `extracted` (740 rows), `american_data` (81), `flagged` (71), `systematic_review` (58), and `uefa` (40).
- Core metadata are still incomplete in part of the export. For example, 822 rows have populated title and lead-author fields, while many others remain partially blank.

## Directional Signals Safe To Use For Planning

- The current populated discipline rows are dominated by association football:
  - 712 association-football rows
  - 42 futsal or indoor rows
  - 9 para-football or 5-a-side rows
  - 4 beach-soccer rows
- Male-coded rows materially outnumber female-coded rows in the raw labels:
  - 541 male rows
  - 117 female rows
  - additional mixed or combined-sex labels are present
- Professional or elite settings dominate the populated level-of-play labels, with smaller amateur and youth/college representation.
- Injury measures are much more available than illness measures in the current export:
  - 264 paper IDs have a populated `injuryIncidenceOverall`
  - 38 paper IDs have a populated `injuryBurden`
  - 8 paper IDs have a populated `illnessIncidenceOverall`
- Recent publication years are reasonably represented in the populated metadata, especially from 2020 through 2024.

## What These Signals Support In The Talk

- A coverage-gap message: the evidence base is still heavily centred on association football and male/professional settings.
- A comparability message: even within the current export, reporting completeness varies substantially across outcomes and subgroups.
- A feasibility message: the project is already capturing the fields needed for subgroup summaries, reporting-quality discussions, and future dashboard filters.

## What These Signals Do Not Support

- Final pooled incidence or burden claims.
- Definitive comparisons between football disciplines.
- Locked prevalence or illness conclusions.
- Exact study counts for the final conference deck without rechecking the cleaned analysis dataset.
