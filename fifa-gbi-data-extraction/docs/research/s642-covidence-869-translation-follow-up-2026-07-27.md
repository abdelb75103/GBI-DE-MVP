# S642 / Covidence #869 Translation Follow-up

Date: 2026-07-27

## Outcome

- Target system: FIFA GBI web app extraction.
- Records uploaded: `1`.
- Record: `S642`, Covidence `#869`, Edama 2012.
- Source language: Japanese.
- Uploaded file: `Covidence_869_English_translation_first_original_second.pdf`.
- Merge order: 5 English translation pages first, all 8 original source pages second.
- Merged SHA-256: `4fe55d8ee95d30d6dceb55e232ae7d18e0ff3456397ed260251ae6d960744257`.
- Preserved original SHA-256: `570810025830c4572860888bf9ff61218fddd5c8e55a4bdbfd172ee93f1af2fc`.
- Storage target: `papers/translated-merged/869/2026-07-27-4fe55d8ee95d-Covidence_869_English_translation_first_original_second.pdf`.
- Screening decisions, human votes, resolver state, promotion state, and Covidence decisions changed: no.

## Extraction Review

Tabs `1-10` were checked against the English translation and original source. The live population layout is:

`All years (2002-2009) / Before active water supply (2002-2004) / After active water supply (2005-2009)`

Direct outcome rows include acute match injuries `126 / 44 / 82` and incidence `162.9 / 205.7 / 154.3` per 1000 player-hours of match exposure. The source's `45 / 17 / 28` consequential-injury subset was not forced into time-loss fields because its definition combines next-day treatment with inability to play.

Original p.302 Figures `1-2` were checked for tissue/type and location data. Their rounded percentages each total `101%`, and the largest location category combines ankle/foot, so incompatible Count fields were left blank rather than estimated.

## Audit Artifacts

- `fifa-gbi-data-extraction/data/translation-follow-up/2026-07-27-s642-covidence-869/s642-covidence-869-pre-apply-live-snapshot-2026-07-27.json`
- `fifa-gbi-data-extraction/data/translation-follow-up/2026-07-27-s642-covidence-869/s642-covidence-869-apply-events-2026-07-27.jsonl`
- `fifa-gbi-data-extraction/data/translation-follow-up/2026-07-27-s642-covidence-869/s642-covidence-869-translation-upload-audit-2026-07-27.csv`
- `fifa-gbi-data-extraction/data/translation-follow-up/2026-07-27-s642-covidence-869/s642-covidence-869-translation-extraction-audit-2026-07-27.json`
- `fifa-gbi-data-extraction/data/translation-follow-up/2026-07-27-s642-covidence-869/s642-covidence-869-translation-extraction-audit-2026-07-27.md`

Remaining decision: human extraction review. The translation blocker is cleared, but the Batch 064 row remains `⏲️ pending_review` and is not marked `reviewed_complete`.
