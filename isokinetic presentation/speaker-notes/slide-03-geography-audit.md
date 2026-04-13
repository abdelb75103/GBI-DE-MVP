# Slide 3 Geography Audit

## Purpose

This note records the current geography logic used for Slide 3 so the provisional map figures can be traced and rechecked later.

## Source

Export used:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/all-studies-export-2026-04-03T20-52-31-100Z.csv`

Counting unit:

- unique `paper_id`

## Status Counts

- Total unique papers: `570`
- `american_data`: `81`
- `uefa`: `40`
- Combined `american_data + uefa`: `121`
- Remaining papers outside those two statuses: `449`

## Geography Logic

The current slide uses a hybrid geography layer:

1. Specific-country dots where a paper can be placed at country level
2. A broad `Europe` regional bucket for `uefa` papers
3. A broad `Americas` regional bucket for `american_data` papers

### Specific-country mapping

Papers are counted into specific-country dots only when the `country` field resolves to a usable country label.

Normalisations applied:

- `USA`, `US`, `U.S.`, `U.S.A.` → `United States`
- lower-case label cleanups such as `germany`, `japan`, `korea`
- `Hong Kong` normalized consistently

Broad labels excluded from specific-country mapping:

- `Europe`
- `10 European countries`
- `International`
- `Worldwide`
- `Multiple`
- `Multinational`
- `Not reported`
- `Unknown`
- labels containing `countries`
- labels containing `confederation`

## Geography Counts

- Papers with any non-empty `country` field: `355`
- Papers mappable to specific countries after cleaning: `340`
- Unique specific-country labels after cleaning: `72`
- Paper-country pairs after splitting multi-country rows: `388`

Important note:

- None of the current `american_data` papers contribute to the specific-country dot layer under this logic
- Current `uefa` rows only contain broad geography labels such as `Europe` or `10 European countries`, so they do not contribute to the specific-country dot layer either

## Regional Buckets

- `Europe` bucket from `uefa`: `40` papers
- `Americas` bucket from `american_data`: `81` papers
- Combined regional buckets: `121` papers

## Previous Geography Figure

The previous geography-layer framing represented:

- `340` papers via specific-country dots
- `121` papers via the two regional buckets

So:

- `340 + 121 = 461`
- `461 / 570 = 80.9%`

Interpretation:

- `80.9%` of all studies are represented by the current geography layer
- `19.1%` of all studies are not yet geographically placed under this logic

This means:

- `109` studies remain outside the current geography layer

## Current Two-Stage Slide Logic

### Stage 1: Broad concentration view

Use the union of:

- top-5 country papers
- `american_data`
- `uefa`

Counts:

- top-5 country papers: `141`
- `american_data`: `81`
- `uefa`: `40`
- overlap between these three sets in the current export: `0`
- union total: `262`

So:

- `262 / 570 = 46.0%`

Safe wording:

- `46.0% of all studies`
- `5 countries + American and UEFA surveillance buckets`

### Stage 2: Remove dominant American / UEFA buckets

Remove:

- `american_data` (`81`)
- `uefa` (`40`)

Counts after removal:

- remaining studies: `449`
- top-5 country papers still present: `141`
- total country labels remaining: `72`
- other countries after removing the top 5: `67`
- studies in the other 67 countries: `199`
- studies not yet geographically placed in this reduced subset: `109`

So:

- `141 / 449 = 31.4%`
- `199 / 449 = 44.3%`
- `109 / 449 = 24.3%`

Safe wording:

- `31.4% of the remaining studies`
- `31.4% in just 5 countries`
- `44.3% across the other 67`
- `24.3% not yet placed`

## Top Country Concentrations

Current leading country counts:

- Spain: `39`
- United States: `33`
- England: `26`
- Sweden: `25`
- Germany: `22`

## Safe Slide Wording

Safe wording for the slide or script:

- `46.0% of all studies`
- `5 countries + American and UEFA surveillance buckets`
- `31.4% of the remaining studies`
- `44.3% across the other 67`

Avoid saying:

- that the remaining `19.1%` are spread across other countries
- that the current slide is a final country count
- that `Europe` or `Americas` are country labels
- that there are `72 other countries` after removing the top 5

## Update Rule

If any of these figures change during the proper analysis pass, update all linked locations together:

1. slide code / on-slide copy
2. speaker notes
3. this audit note
4. any prompts or implementation notes that mention these figures

Do not update one location and leave conflicting numbers elsewhere.

## Provisional Warning

These figures are provisional and depend on:

- the current export state
- current status labels
- the current country-field cleaning logic
- the decision to use regional overlays for `uefa` and `american_data`

They should be rechecked before final deck lock.
