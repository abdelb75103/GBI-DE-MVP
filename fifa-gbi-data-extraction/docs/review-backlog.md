# Review Backlog

This file tracks papers extracted or tagged by Codex that still need human review.

Review state:
- `⏲️ pending_review`: extracted/tagged live, still needs manual check
- `✅ reviewed_complete`: you reviewed it and it is done
- `needs_follow_up`: reviewed, but something still needs changing

How we use this:
- Codex adds new papers in batches.
- You tell me when a paper is reviewed or complete.
- I update this file so we keep a running backlog.

## Batch 001

Created: 2026-03-07

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S318 | uploaded | ✅ reviewed_complete | Extracted live | Sparse paper. Mostly abstract-level only. Saved study metadata, participant basics, `84` injuries, mean time-loss/duration `16.6`, most common type `muscle/tendon`, most common location `lower limb`. Many fields intentionally left blank. |
| S328 | uploaded | ✅ reviewed_complete | Extracted live | Saved metadata, cohort basics, definitions, match exposure `31,443` hours, and injury outcome fields from the reported competitive-match dataset. Overall/match incidence stored as `22.23`, derived from `699 / 31,443 h`. Review this derivation first. |
| S331 | american_data | ✅ reviewed_complete | Tagged excluded live | US High School RIO paper. Not extracted. Review should just confirm exclusion/tag is correct. |
| S332 | american_data | ✅ reviewed_complete | Tagged excluded live | US High School RIO paper. Not extracted. Review should just confirm exclusion/tag is correct. |
| S334 | uploaded | ✅ reviewed_complete | Extracted live | Multiline population mapping used across saved fields: `1 = Extended Knee Control`, `2 = Adductor programme`, `3 = Comparison group`. Saved tabs 1-4, injury outcome, and key injury-location rows. Some counts were derived from reported IR x exposure totals, so review this one carefully first. |

## Batch 002

Created: 2026-03-08

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S145 | uploaded | ✅ reviewed_complete | Extracted live | Reopened from the incorrect `American Data` tag and extracted as an in-scope soccer subgroup. Saved soccer-only study details, participant characteristics, definitions, exposure, injury outcome, and knee/ankle location counts from the reported values. Training exposure was left blank because the paper reported total AEs and game AEs but not practice AEs directly. |
| S219 | uploaded | ✅ reviewed_complete | Extracted live | Untouched before this pass. Multiline population mapping used throughout extracted fields: `1 = U14`, `2 = U15`. Saved tabs 1-4, injury outcome, and structured injury tissue/location rows that mapped cleanly from the paper. `Pelvis` and `thorax/abdomen` were not forced into structured location rows. |
| S220 | uploaded | ✅ reviewed_complete | Extracted live | Untouched before this pass. Multiline population mapping used throughout extracted fields: `1 = boys`, `2 = girls`. Saved tabs 1-4, injury outcome, and reported traumatic injury tissue/location rows. Match/training counts come from the traumatic injury table; overall counts include all injuries, so check that distinction first during review. |
| S231 | uploaded | ✅ reviewed_complete | Extracted live | Reopened from the incorrect `American Data` tag and expanded beyond kidney-only data. Saved boys’ and girls’ soccer injury totals plus the reported soccer kidney, head/neck/spine, knee, and MTBI/concussion values exactly as reported. Separate medical-attention and time-loss count fields were left blank because the paper did not report them separately. |

## Batch 003

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S165 | american_data | ✅ reviewed_complete | Tagged excluded live | NCAA / US collegiate paper. It had partial live study-details fields already, but per the exclusion rule it is now tagged `American Data` and should not be extracted further. |
| S208 | uploaded | ✅ reviewed_complete | Added missing tabs live | This paper already had study details and participant fields live. I added definitions, exposure, injury outcome, injury tissue/type, and injury location. Line mapping remains `1 = male`, `2 = female`. Review the `time-loss` split first because only overall time-loss counts were reported separately. |
| S256 | uploaded | ✅ reviewed_complete | Extracted live | Multi-tournament FIFA surveillance paper extracted at the overall level rather than tournament-by-tournament lines. All injuries were match injuries by definition. Review the aggregate-only approach first. |
| S260 | uploaded | ✅ reviewed_complete | Added missing tabs live | This paper already had core setup tabs live. I added definitions and injury outcome. Line mapping used for saved multiline values is `1 = intervention`, `2 = control`. Training and overuse values are the main things to verify first. |
| S314 | american_data | ✅ reviewed_complete | Tagged excluded live | NCAA paper. It had partial live study-details fields already, but per the exclusion rule it is now tagged `American Data` and should not be extracted further. |

## Batch 004

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S221 | uploaded | ✅ reviewed_complete | Added missing tabs live | Single-team Japanese university cohort. I updated `studyDesign` to `prospective cohort` and added participant characteristics, definitions, exposure, injury outcome, and overall injury-location rows. This is intentionally sparse: no overall injury incidence, no match/training totals, and no tissue-type table were saved because the paper did not report those cleanly enough without inference. Review the repeated `total` values in medical-attention/time-loss counts first, because that follows the current workflow rule rather than a separately reported subset. |
| S225 | uploaded | ✅ reviewed_complete | Added sparse football-only extraction live | Multisport Indian Ocean Island Games surveillance paper. I switched it from `flagged` to a sparse football-only extraction using the explicit Table 1 football counts only: `38` football injuries and `7` football illnesses. The rest remains blank because the paper does not report football-specific cohort size, exposure, location, or tissue breakdown. |
| S234 | systematic_review | ✅ reviewed_complete | Tagged excluded live | Systematic review / review article. Not extracted as a primary study. Review only needs to confirm the exclusion tag is correct. |

## Batch 005

Created: 2026-03-08

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S007 | uefa | ✅ reviewed_complete | Tagged excluded live | UEFA Elite Club Injury Study substudy on thigh muscle injuries. Tagged `uefa` and assigned to AbdelRahman Babiker, not extracted. Review confirmed exclusion tag is correct. |
| S008 | uploaded | ✅ reviewed_complete | Extracted live | Norwegian women’s premier league `#ReadyToPlay` cohort. Reviewed and completed with additive follow-up: structured tissue/type rows were filled from Table 2, including concussion and ACL diagnosis coverage, and median time-loss was documented where used instead of mean severity. |
| S010 | uploaded | ✅ reviewed_complete | Extracted live | 2014 FIFA World Cup match-injury surveillance paper. Saved tabs 1-4, injury outcome, tissue/type counts, and location counts. `Time-loss` counts were saved because they were reported separately; `medical attention` counts were left blank because the paper did not report them as a separate count field. |
| S012 | uploaded | ✅ reviewed_complete | Extracted live | Male/female multiline extraction. Line mapping is `1 = male`, `2 = female`. Reviewed and completed with additive follow-up: injury location/type total days lost and days-lost-per-injury fields were filled from Table 4 without median labels, per review decision. |
| S013 | uploaded | ✅ reviewed_complete | Extracted live | Elite Belgian youth academy cohort. Saved tabs 1-4, injury outcome, and structured prevalence rows for reported injury types and locations. No incidence values were entered because the paper reported exposure but did not publish injury incidence figures, and we are not calculating them during extraction. |

## Batch 006

Created: 2026-03-08

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S014 | uploaded | ✅ reviewed_complete | Extracted live | Young male professional football on artificial turf. Saved tabs 1-4 plus injury outcome and selected structured location/type rows. Review the total exposure first: the paper OCR is inconsistent between sections, and I used the detailed results total `83,360` hours because it matches the reported incidences. |
| S015 | uploaded | ✅ reviewed_complete | Extracted live | Hong Kong male professional league cohort. Saved tabs 1-4 and injury outcome. I used `7` participating teams because the methods clearly say seven of ten teams joined; the abstract wording is noisy in the PDF. |
| S262 | uploaded | ✅ reviewed_complete | Extracted live | Elite female futsal cohort. Saved tabs 1-4, injury outcome, and structured prevalence rows from the published tables. `Most common location` is kept broad because the paper highlights both quadriceps and ankle rather than a single clean schema row. |
| S263 | uploaded | ✅ reviewed_complete | Added sparse extraction live | Old adolescent tournament paper. I kept this intentionally sparse: bibliographic fields, participant context, and the reported boys/girls incidence lines plus common type/location only. The paper text extraction is poor and does not cleanly expose all table counts. |
| S264 | uploaded | ✅ reviewed_complete | Extracted live | Spanish professional futsal preseason study. Saved tabs 1-4, injury outcome, and structured prevalence rows from Table 1. Match/training incidence is reported directly, but exposure totals were not entered because the paper excerpt available here did not provide clean aggregate hours without derivation. |

## Batch 007

Created: 2026-03-09

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S265 | extracted | ✅ reviewed_complete | Added sparse extraction live | US high school and collegiate concussion epidemiology paper. Corrected prior exclusion because it is American data but not NCAA, Rio, or Datalys-linked. Saved a sparse manual extraction for the soccer subgroup only with line mapping `male / female`; counts and incidences come from Table 3 rather than the pooled seven-sport totals. |
| S266 | extracted | ✅ reviewed_complete | Extracted live | Saudi Professional League cohort. Saved tabs 1-4 plus injury outcome, illness outcome, and structured injury/illness rows from the paper. Review the diagnosis/tissue rows first because several counts come from the detailed results tables and need a quick plausibility check. |
| S267 | extracted | ✅ reviewed_complete | Added sparse extraction live | Swedish elite male youth first-league cohort. Saved tabs 1-4 and injury outcome only: total injuries `61`, match `18`, training `43`, incidences `6.8` overall / `15.5` match / `5.6` training, with `muscle strain` and `hip and groin` captured as the most common type/location. Structured tissue and location rows were completed from Figures 2 and 3 in follow-up review. |
| S268 | extracted | ✅ reviewed_complete | Added sparse extraction live | New Zealand community-level cohort. Male/female line mapping was corrected in follow-up review, and structured injury location/type rows plus a combined `Sprain or strain` diagnosis row were added from Table 2 and Table 3, with pooled exposure rows retained because sex-specific exposure totals were not reported directly. |
| S270 | mental_health | ✅ reviewed_complete | Tagged excluded live | Common mental disorders paper. Tagged `mental_health` and assigned to AbdelRahman Babiker, not extracted. Review confirmed the exclusion tag is correct. |

## Batch 008

Created: 2026-03-09

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S271 | processing | ✅ reviewed_complete | Added sparse extraction live | Argentine professional club cohort over `12` seasons. Gemini was rate-limited, so I saved a sparse manual pass from the paper text: study metadata, participant/exposure context, and injury outcome headline values only. Key saved values are total injuries `797`, overall incidence `4.2`, training incidence `2.3`, match incidence `20.5`, injury burden `90`, and most common type `muscular`. |
| S272 | processing | ✅ reviewed_complete | Added sparse extraction live | Copa América 2011 tournament surveillance paper. Saved core metadata plus sparse injury outcome values reported directly in the paper: total injuries `63`, players `276`, teams `12`, match injuries `63`, match incidence `70.7`, most common diagnosis/type `bruise`, and most common location `thigh`. Review should confirm the severity wording because the paper’s reported grade labels are tournament-specific. |
| S273 | processing | ✅ reviewed_complete | Added sparse extraction live | Brazilian professional football shoulder-injury paper. This is intentionally scoped to the published shoulder-only dataset rather than all football injuries. Saved core metadata plus sparse injury outcome values: total shoulder injuries `107`, overall incidence `0.847`, mean time-loss `22.37` days, recurrence rate `14.95%`, and most common diagnosis `glenohumeral dislocation`. |
| S274 | american_data | ✅ reviewed_complete | Tagged excluded live | US high school athletes paper. Tagged `american_data` and assigned to AbdelRahman Babiker, not extracted. Review confirmed the exclusion tag is correct. |
| S275 | american_data | ✅ reviewed_complete | Tagged excluded live | US high school soccer surveillance paper. Tagged `american_data` and assigned to AbdelRahman Babiker, not extracted. Review confirmed the exclusion tag is correct. |

## Batch 009

Created: 2026-03-09

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S276 | american_data | ✅ reviewed_complete | Tagged excluded live | This paper is youth American football from two Michigan communities, not association football. Tagged `american_data` and assigned to AbdelRahman Babiker, not extracted. Review confirmed the exclusion tag is correct. |
| S277 | processing | ✅ reviewed_complete | Added sparse extraction live | World Cup 2002 tournament surveillance paper. Extracted manually from the PDF without Gemini. Saved core metadata plus headline injury outcome values only: total injuries `171`, medical-attention injuries `171`, match injuries `171`, match incidence `81.0`, contact `122`, non-contact `45`, most common diagnosis/type `contusion`, and most common location `thigh`. |
| S278 | american_data | ✅ reviewed_complete | Tagged excluded live | NCAA soccer/basketball ACL paper. Tagged `american_data` and assigned to AbdelRahman Babiker, not extracted. Review confirmed the exclusion tag is correct. |
| S279 | processing | ✅ reviewed_complete | Added sparse extraction live | Middle-school female association-football concussion cohort from Washington State. Corrected the prior `american_data` exclusion and saved a sparse live extraction: tabs 1-4, injury outcome, plus structured `concussion` and `head` rows. Key saved values: `351` players, `33` teams, `43,742` total hours, `59` concussions, match/training `51 / 8`, overall incidence `1.3` (`95% CI 1.0-1.7`), match/training incidence `5.3 / 0.2`, median/mean symptom duration `4.0 / 9.4` days, and `57` contact concussions. |
| S281 | processing | ✅ reviewed_complete | Added sparse extraction live | Danish elite football hamstring cohort. Extracted manually from the PDF without Gemini. Saved core metadata, participant/exposure context, and sparse injury outcome values: total hamstring injuries `54`, match `28`, training `14`, match incidence `1.82`, training incidence `0.12`, mean time-loss `21.5` days, recurrent injuries `8`, recurrence rate `25%`, and broad location/type as `posterior thigh` / `hamstring strain`. |

## Batch 010

Created: 2026-03-10
Completed: 2026-03-12

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S282 | american_data | ✅ reviewed_complete | Tagged excluded live | NCAA Injury Surveillance Program paper on collegiate athletes in the United States. Tagged `american_data`, not extracted. Review confirmed the exclusion tag is correct. |
| S283 | processing | ✅ reviewed_complete | Updated live extraction to 4 age groups | English elite male academy cohort from one club over one season. I replaced the pooled injury outcome lines with `U13 / U14 / U15 / U16` rows. Saved split values: exposure `3873 / 1797 / 1376 / 1797` hours, injuries `23 / 16 / 10 / 4`, incidence `5.9 / 8.9 / 7.3 / 2.22`, mean severity `36 / 17 / 48 / 14` days, and burden `213.8 / 148.0 / 347.4 / 31.2`, each with the reported 95% CIs. Review confirmed the age-group split should replace the earlier pooled line. |
| S284 | processing | ✅ reviewed_complete | Fully revised live extraction from source PDF | Swedish/Norwegian male professional cohort across `32` clubs over two seasons. I rebuilt the record from `775.full.pdf` using `artificial turf home venue / natural grass home venue` as the line mapping. Saved directly reported or simple-sum values only: sample size `361 / 683`, mean age `25.2 / 25.0`, teams `11 / 21`, total football exposure `103,733 / 214,303` hours (sum of directly reported AT and NG exposure within each club group), total time-loss injuries `831 / 1356`, acute match injuries `292 / 493`, acute training injuries `213 / 355`, match incidence `17.9 / 15.1`, training incidence `2.5 / 1.9`, overuse/repetitive-gradual injuries `326 / 508`, most common severity `moderate`, and structured tissue/type prevalence plus incidence rows for bone, ligament-joint, muscle-tendon, superficial tissues/skin, nervous, and non-specific tissue, with the incidence cells now storing the reported bracketed `95% CI` inline. I left `injuryIncidenceOverall` blank because the paper does not report a direct all-injury overall rate for the home-venue split, and I left `injuryLocation` blank because the paper only gives overuse-location rows rather than total-location rows. Review confirmed the home-venue split and rejected back-calculated exposure subfields. |
| S285 | american_data | ✅ reviewed_complete | Tagged excluded live | U.S. high school athlete surveillance paper on exertional heat illness. Tagged `american_data`, not extracted. Review confirmed the exclusion tag is correct. |
| S286 | american_data | ✅ reviewed_complete | Tagged excluded live | Collegiate and high school student-athlete non-time-loss injury paper using NCAA and NATION/Datalys surveillance data. Tagged `american_data`, not extracted. Review confirmed the exclusion tag is correct. |

## Batch 011

Created: 2026-03-11
Completed: 2026-03-13

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S287 | processing | ✅ reviewed_complete | Expanded live extraction from Tables 2-4 | Elite Aspire Academy youth cohort from Qatar over `4` seasons. The sparse pass was too thin, so I added the directly reported Table 2-4 values live. Injury outcome now also includes contact/non-contact `632 / 933` and most common severity `medical attention`. Structured type rows now include ligament-joint `208`, muscle-tendon `399`, bone `82`, cartilage/synovium/bursa `12`, concussion `11`, and laceration `4`. Structured location rows now include lower limb overall `1308`, upper limb overall `124`, head `22`, neck `10`, ankle `196`, knee `225`, thigh `391` (clean aggregate of hamstring, quadriceps, adductor, and thigh rows), lower leg `177` (lower leg plus calf/Achilles), and foot `139`. I still left ambiguous combined categories blank rather than forcing them into narrower schema rows. RED FLAG: come back to this paper because it does not report direct exposure hours, so denominator handling still needs explicit follow-up review. |
| S288 | processing | ✅ reviewed_complete | Expanded sparse extraction with structured tables | Korea women’s national team paper over `5` years. I corrected the earlier sparse pass by adding the directly reportable structured rows from Tables `3`, `5`, and `6`. Live fields now include lower limb / upper limb prevalence `714 / 72`, structured type rows for concussion `2`, bone `2`, ligament-joint `143`, cartilage/synovium/bursa `28`, superficial contusion `200`, and superficial tissues/skin `7`, plus most common severity `minimal`. I intentionally left `head/trunk` and the broad muscle-diagnosis mix out of structured location/tissue rows because those categories do not map cleanly to the schema. RED FLAG: come back to this paper and follow up with the author because the paper does not state a clean formal injury definition. |
| S289 | processing | ✅ reviewed_complete | Corrected live extraction to intervention/control split | Kosovo youth cluster-RCT of the `FUNBALL` prevention programme. The earlier pooled pass was incorrect for a two-arm trial with a clean arm-level table. Live rows now map to `intervention` and `control`, with directly reported Table `2` and `3` values: players `524 / 503`, teams `23 / 22`, mean age `15.2 / 15.3`, total exposure `53,454 / 52,938`, match exposure `9,017 / 8,666`, training exposure `44,437 / 44,272`, total injuries `132 / 187`, injured players `124 / 172`, training/match injuries `67 / 96` and `65 / 91`, overall incidence `2.46 / 3.53`, match incidence `7.20 / 10.50`, training incidence `1.50 / 2.16`, and injury burden `40 / 74`. |
| S290 | processing | ✅ reviewed_complete | Corrected live extraction to intervention/control split | US female youth soccer ACL-prevention paper. This remains in scope because it is association-football data and not NCAA, Rio, or Datalys-linked. The earlier pooled ACL-only pass was too thin for a controlled comparison. Live rows now map to `intervention` and `control` using the paper’s directly reported combined two-season arm totals: sample size `1885 / 3818`, total athlete-exposure `67,860 / 137,448`, ACL tears `6 / 67`, overall ACL incidence `0.09 / 0.49` per `1000` athlete-exposures, and diagnosis row `Anterior cruciate ligament injury` for both arms. |
| S291 | processing | ✅ reviewed_complete | Expanded sparse extraction with Tables 5-6 | English Championship multi-site professional men’s cohort. I corrected the earlier outcome-only pass by adding the directly reportable structured rows from Tables `5` and `6`. Live fields now include location prevalence for head `1`, shoulder `2`, thigh `47`, knee `17`, lower leg `15`, ankle `19`, foot `9`, forearm `1`, wrist `1`, and hand `1`, plus structured type rows for concussion `1`, bone `6`, muscle-tendon `51`, ligament-joint `25`, cartilage/synovium/bursa `3`, nervous `3`, and superficial contusion `22`. I kept total exposure blank because Table `2` reports mean player exposure rather than a directly reported pooled cohort-hours denominator, and I left contact / non-contact blank because Table `4` is a mechanism table that does not classify those rows directly into the schema. |

## Batch 012

Created: 2026-03-12

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S293 | processing | ⏲️ pending_review | Added pooled sparse extraction live | Spanish youth intervention paper over two seasons. Saved pooled tabs 1-4, injury outcome, and key structured tissue/location rows rather than forcing intervention-vs-control line mapping into the live fields. Key saved values: `219` players, `57,455.5` player-hours, `222` injuries, pooled overall incidence `3.86`, contact/non-contact/overload `53 / 126 / 43`, muscle-tendon `108`, ligament-joint `86`, ankle `61`, thigh `49`, and knee `28`. Review should confirm the pooled-across-seasons approach first. |
| S294 | american_data | ⏲️ pending_review | Tagged excluded live | NATION / Datalys high-school concussion surveillance paper across `27` sports in the United States. Tagged `american_data` and assigned to AbdelRahman Babiker, not extracted. Review only needs to confirm the exclusion tag is correct. |
| S295 | processing | ⏲️ pending_review | Audited sparse extraction, no direct structured expansion | Dana Cup youth tournament cohort from Denmark across three tournaments. I rechecked this paper after the `S287` correction sweep and left it sparse on purpose. The paper gives clean headline totals and pooled proportions, but the remaining detail is mostly subgroup-specific incidence comparisons rather than directly reportable pooled structured counts for type/location rows. Training exposure remains blank because the paper states it was not registered. |
| S366 | processing | ⏲️ pending_review | Added structured sparse extraction live | Brazilian elite women’s football cohort across `4` clubs in `2022`. Saved tabs 1-4, injury outcome, and structured tissue/location rows from Tables 1-2. Key saved values: `133` players, `4` teams, `22,292` total hours, `112` time-loss injuries, overall incidence `5.0`, non-contact `54`, gradual onset `18`, recurrent injuries `20` (`18%`), muscle-tendon `53`, ligament-joint `37`, bone `11`, lower limb `107`, knee `33`, thigh `32`, and ankle `19`. Review should check the choice to leave match/training incidence blank because the paper reports those splits only for sudden-onset injuries. |
| S367 | processing | ⏲️ pending_review | Added ultra-sparse football-only extraction live | Multisport Spanish adolescent cohort. I scoped this to the clean football subgroup signal only and saved tabs 1-4 plus the reported soccer injury incidence `7.21`. I left football-specific counts, exposure, and denominator fields blank because the paper does not report a clean soccer-only player denominator or exposure total directly in the text/table excerpt used for this pass. |

## Batch 013

Created: 2026-03-12

| Study ID | Paper status live | Review state | Action taken | Notes |
| --- | --- | --- | --- | --- |
| S368 | uefa | ⏲️ pending_review | Tagged excluded live | UEFA Elite Club Injury Study paper on isolated syndesmotic ankle injuries. Tagged `uefa` and assigned to AbdelRahman Babiker, not extracted. Review only needs to confirm the exclusion tag is correct. |
| S369 | american_data | ⏲️ pending_review | Tagged excluded live | US high school soccer ACL paper using the National High School Sports-Related Injury Surveillance Study / High School RIO system. Tagged `american_data` and assigned to AbdelRahman Babiker, not extracted. Review only needs to confirm the exclusion tag is correct. |
| S370 | referee | ⏲️ pending_review | Tagged excluded live | Spanish elite football referee cohort. Tagged `referee` and assigned to AbdelRahman Babiker rather than extracted as a player cohort. Review should confirm that referee-only studies belong in this exclusion/status bucket. |
| S371 | processing | ⏲️ pending_review | Expanded sparse extraction with Table 2 body-location rows | German professional men’s football surveillance across the Bundesliga and 2. Bundesliga over `3` seasons. I corrected the earlier sparse pass by parsing Table `2` fully and adding the directly reported location prevalence and mean time-loss values for neck `76 / 6.09`, upper limb overall `645 / 7.87`, shoulder `248 / 12.8`, upper arm `12 / 9.00`, elbow `66 / 5.94`, forearm `35 / 3.38`, wrist `89 / 1.94`, hand `195 / 4.82`, trunk overall `460 / 4.06`, lower limb overall `5843 / 11.4`, thigh `1768 / 10.5`, knee `1139 / 22.5`, lower leg `805 / 8.07`, and ankle `957 / 10.1`. I also added most common severity `slight` from the paper’s overall severity distribution. I left head/face and hip/groin out of the structured rows because those source categories are broader than the schema fields. |
| S372 | processing | ⏲️ pending_review | Added season-split sparse extraction live | French male professional club cohort comparing a regular season with the Covid-affected season. I used the season split as the live line mapping: `regular season (S1)` and `Covid season (S2)`. Saved directly reported values only: match exposure `29,315 / 27,445` hours, total injuries `1465 / 1261`, match injuries `761 / 610`, training injuries `704 / 651`, match incidence `25.96 / 22.23`, and most common type `muscle strain`. I left player counts, total exposure, training incidence, and structured type/location rows blank because those were not directly reported for the same season-level denominator in the table excerpt used here. |
