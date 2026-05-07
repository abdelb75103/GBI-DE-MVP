# Translated Papers Covidence Extraction Status Audit

Date: 2026-05-07

Review: Covidence `603597`

Purpose: identify which translated non-English records are currently in Covidence Extraction and which translated records are not yet extractable.

## Source Set

The source set is the `29` translated non-English records listed in:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/non-english-translations/manifest.csv`

These records have uploaded English translation PDFs documented in:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/research/non-english-covidence-upload-log-2026-04-30.md`

## Covidence Check Method

Each translated Covidence number was searched exactly in the signed-in Covidence review using the global `Search studies` box from the Extraction area. The resulting Covidence URL/page state was recorded as:

- `Extraction`: Covidence opened an `/extraction/...` URL and showed the matching article in the Extraction list with `View full text`.
- `Excluded`: Covidence opened `/review_studies/excluded?...`.
- `Full text review conflict`: Covidence opened `/review_studies/select?...` from the full-text conflict queue.
- `Full text review`: Covidence opened `/review_studies/select?...` without a conflict-specific confirmation.
- `Title/abstract screening`: Covidence opened `/review_studies/screen?...`.

No Covidence decisions, uploads, tags, or extraction records were changed during this check.

## Result

Translated papers currently in Covidence Extraction: `18`

- `#50` Becker 2006
- `#245` Fromm 2018
- `#720` Fromm 2018
- `#53` Can 2006
- `#626` Cohen 1997
- `#719` MartinsdeSouzaFilho 2018
- `#733` Zanuto 2010
- `#734` ApprobatoSelistre 2009
- `#855` TeixeiraOsorio 2022
- `#113` Noya 2012
- `#412` RafaelCorrea 2013
- `#815` Garcia-Tamez 2012
- `#835` Pangrazio 2016
- `#547` Paus 2004
- `#249` vanBeijsterveldt 2018
- `#252` vanBeijsterveldt 2014
- `#752` Hinge 1984
- `#744` Engebretsen 1987

Translated papers confirmed excluded: `8`

- `#605` Riepenhof 2018
- `#565` Duque-Arias 2024
- `#357`
- `#710` Reyes 2023
- `#798` Rochcongar 2004
- `#418` Schneider 2013 - full-text conflict resolved as excluded on 2026-05-07
- `#646` Schneider 2013 - full-text conflict resolved as excluded on 2026-05-07
- `#722` Hirschmuller 2015 - full-text conflict resolved as excluded on 2026-05-07

Translated papers not in Extraction and not confirmed excluded: `3`

- `#721` Full text review
- `#854` Full text review
- `#757` Title/abstract screening

## Remaining To Check

Current to-do as of 2026-05-07:

- Check `#721` in full-text review / vote-required queue and make the final include/exclude decision.
- Check `#854` in full-text review / vote-required queue and make the final include/exclude decision.
- Check `#757` in title/abstract screening / vote-required queue before it can proceed to full-text review or be excluded.

Additional user-confirmed conflict exclusion outside this translated-PDF manifest:

- `#760` was also in full-text conflict and was excluded on 2026-05-07. It is not present in `exports/non-english-translations/manifest.csv`, so it is not counted in the translated-PDF source set above.

## Extraction Queue

The translated-paper extraction queue is the `18` records currently in Extraction. Use the cleaned local extraction-ready PDFs under:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/outputs/extraction-ready-translations/2026-05-07/pdfs`

The confirmed excluded translated records should not be extracted unless Covidence decisions change later.

## Important Correction

The earlier local extraction-ready PDF batch has `29` PDFs because it was generated for all translated records with local originals and English text. That number is not the same as the Covidence Extraction queue. The current translated-paper extraction queue is `18`.
