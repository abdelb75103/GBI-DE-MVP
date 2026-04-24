# Slide 3 Geography Audit

## Purpose

This note records the current geography logic used for Slide 3 so the provisional map figures can be traced and rechecked later.

## Source

Master sheet used:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/Data Analysis/Data Cleaning/outputs/master/master-analysis-sheet.csv`

Counting unit:

- unique `paper_id`

## Status Counts

- Total unique papers: `499`
- `american_data`: `84`
- `uefa`: `38`
- Combined `american_data + uefa`: `122`
- Remaining papers outside those two statuses: `377`

## Geography Logic

The current slide now uses two separate geography layers:

1. Stage 1 combines:
   - the five highest-count country placements
   - the broad `UEFA ECIS` regional bucket from `uefa`
   - the broad `American (NCAA & RIO)` regional bucket from `american_data`
2. Stage 2 removes the two broad status buckets and keeps only country-level placements
3. Any remaining broad regional wording is treated as `not yet placed` in the country-only stage

### Specific-country mapping

Papers are counted into specific-country dots only when the `country_standardized` value resolves to a usable country label.

Broad labels excluded from the country-only stage include anything that still describes regions rather than countries, for example:

- `Europe`
- `10 European countries`
- `International`
- `Worldwide`
- `Multinational`
- `Southern Africa`
- `Asia (international tournaments)`
- labels containing `countries`
- labels containing `confederation`

## Geography Counts

- Papers with any populated country field in the master sheet: `496`
- Papers mappable to specific countries after cleaning: `431`
- Unique specific-country labels after cleaning: `50`

Important note:

- `american_data` and `uefa` are shown only as broad stage-1 overlays
- They are intentionally removed from the stage-2 country-only breakdown

## Regional Buckets

- `UEFA ECIS` bucket from `uefa`: `38` papers
- `American (NCAA & RIO)` bucket from `american_data`: `84` papers
- Combined regional buckets: `122` papers

## Current Two-Stage Slide Logic

### Stage 1: Broad concentration view

Use the union of:

- top-5 country papers
- `american_data`
- `uefa`

Counts:

- top-5 country papers: `146`
- `american_data`: `84`
- `uefa`: `38`
- overlap between these three sets in the current export: `0`
- union total: `268`

So:

- `268 / 499 = 53.7%`

Safe wording:

- `53.7% of all studies`
- `5 countries + American and UEFA surveillance buckets`

### Stage 2: Remove dominant American / UEFA buckets

Remove:

- `american_data` (`84`)
- `uefa` (`38`)

Counts after removal:

- remaining studies: `377`
- top-5 country papers still present: `146`
- total specific-country labels remaining: `50`
- other countries after removing the top 5: `45`
- studies in the other 45 countries: `201`
- studies not yet geographically placed in this reduced subset: `30`

So:

- `146 / 377 = 38.7%`
- `201 / 377 = 53.3%`
- `30 / 377 = 8.0%`

Safe wording:

- `38.7% of the remaining studies`
- `38.7% in just 5 countries`
- `53.3% across the other 45`
- `8.0% not yet placed`

## Top Country Concentrations

Current leading country counts:

- Spain: `41`
- United States: `34`
- Sweden: `28`
- Germany: `24`
- England: `23`

## Safe Slide Wording

Safe wording for the slide or script:

- `53.7% of all studies`
- `5 countries + American and UEFA surveillance buckets`
- `38.7% of the remaining studies`
- `53.3% across the other 45`

Avoid saying:

- that the remaining papers are all cleanly placeable at country level
- that the current slide is a final country count
- that `Europe` or `Americas` are country labels
- that there are `50 other countries` after removing the top 5

## Update Rule

If any of these figures change during the proper analysis pass, update all linked locations together:

1. slide code / on-slide copy
2. speaker notes
3. this audit note
4. any prompts or implementation notes that mention these figures

Do not update one location and leave conflicting numbers elsewhere.

## Provisional Warning

These figures are provisional and depend on:

- the current master-sheet state
- current status labels in the master sheet
- the current country-field cleaning logic
- the decision to use regional overlays for `uefa` and `american_data`

They should be rechecked before final deck lock.
