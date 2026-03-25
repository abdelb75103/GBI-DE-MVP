# Covidence PDF Manual Follow-Up

This file is the manual follow-up list for unresolved Covidence PDF retrieval work across the March 2026 sessions.

Use this when asking:
- which PDFs still need manual work
- which papers failed in Covidence
- what to do next inside Covidence

## What Was Already Tried

- Reconciled each Covidence export against the local PDF library first.
- Downloaded from the Covidence `Extraction` area only.
- Used the signed-in Chrome Covidence session.
- Retried the March 23 run after a mid-run stall and reprocessed the final unresolved subset separately.

At this point, the remaining unresolved items are not simple rerun candidates. They need manual checking in Covidence.

## Manual Action Rules

### `no_button`

Meaning:
- Covidence opened the intended study page, but there was no usable PDF or `View full text` path exposed for automation.

Manual action:
- Open the study in Covidence Extraction.
- Check whether the entry actually has a stored full text.
- If there is a visible `View full text` or embedded PDF that automation missed, download it manually.
- If there is no full text attached, this paper remains unresolved and will need a source outside this automation flow.

### `search_not_found`

Meaning:
- Covidence search did not return a usable study page for the paper.

Manual action:
- In Covidence Extraction, search manually by:
  - exact title fragment
  - lead author surname
  - year
  - Covidence number if visible in the list
- If you find the correct study, open it and download the PDF manually.
- If it does not appear in search but does exist in the extraction list, navigate from the list directly.

### `study_page_mismatch`

Meaning:
- Covidence search opened a study page, but the page content did not match the intended paper closely enough to trust an automatic download.

Manual action:
- Search manually in Covidence Extraction.
- Open the likely candidate study page.
- Confirm title, author, and year match the target paper.
- If it is the correct paper, download the PDF manually.
- If the page is clearly a different study, leave it unresolved and move on.

## Session 1: March 11, 2026

Run context:
- `520` references in export
- `145` downloaded
- `14` unresolved

### `no_button`

- `#204` Rekik 2018
  - *ACL injury incidence, severity and patterns in professional male soccer players in a Middle Eastern league.*
- `#207` Rossler 2016
  - *Soccer Injuries in Players Aged 7 to 12 Years: A Descriptive Epidemiological Study Over 2 Seasons.*
- `#440` Rosenbaum 2009
  - *Variation in injury risk over the course of a two-day youth club soccer tournament*
- `#449` Childers 2024
  - *Reported Anterior Cruciate Ligament Injury Incidence in Adolescent Athletes is Greatest in Female Soccer Players and Athletes Participating in Club Sports: A Systematic Review and Meta-Analyses.*
- `#528` Sanmiguel-Rodríguez 2021
  - *Injuries in High-Performance Football: A Systematic Review.*
- `#778` Pulici 2023
  - *Injury Burden in Professional European Football (Soccer): Systematic Review, Meta-Analysis, and Economic Considerations*

### `search_not_found`

- `#795` Ruiz-Perez 2021
  - *Epidemiology of injuries in elite male and female futsal: a systematic review and meta-analysis*

### `study_page_mismatch`

- `#11` Raya-Gonzalez 2020
  - *Injury Profile of Elite Male Young Soccer Players in a Spanish Professional Soccer Club: A Prospective Study During 4 Consecutive Seasons*
- `#299` Peek 2023
  - *Injury-Reduction Programs Containing Neuromuscular Neck Exercises and the Incidence of Soccer-Related Head and Neck Injuries*
- `#384` Kinalski 2020
  - *Prospective analysis of craniofacial soccer incidents during FIFA competitions: an observational study.*
- `#430` Moses 2012
  - *Systematic review: Annual incidence of ACL injury and surgery in various populations*
- `#433` Carling 2011
  - *A four-season prospective study of muscle strain reoccurrences in a professional football club*
- `#434` Walden 2011
  - *The epidemiology of anterior cruciate ligament injury in football (soccer): A review of the literature from a gender-related perspective*
- `#868` Vilamitjana 2013
  - *The influence of match frequency on the risk of injury in professional soccer.*

## Session 2: March 23, 2026

Run context:
- new export size: `595`
- new references since prior export: `75`
- new references already covered locally: `9`
- truly new-and-missing queue: `66`
- downloaded from that queue: `42`
- unresolved from that queue: `24`

### `no_button`

- `#29` Whalan 2019
  - *The incidence and burden of time loss injury in Australian men's sub-elite football (soccer): A single season prospective cohort study*

### `search_not_found`

- `#601` Lu 2022
  - *The relationship between team-level and league-level injury rate, type and location in a professional football league*
- `#763` Gashi et al. 2023
  - *Predicting Risk Factors of Lower Extremity Injuries in Elite Women's Football: Systematic Review and Meta-Analysis.*
- `#781` Lu 2020
  - *Injury epidemiology in Australian male professional soccer*

### `study_page_mismatch`

- `#78` Lewin 1989
  - *The incidence of injury in an English professional soccer club during one competitive season*
- `#110` Walden 2013
  - *Regional differences in injury incidence in European professional football*
- `#392` DeLoes 1988
  - *Incidence rate of injuries during sport activity and physical exercise in a rural Swedish municipality: Incidence rates in 17 sports*
- `#453` Andrade 2023
  - *Impact of the COVID-19 pandemic on the psychological aspects and mental health of elite soccer athletes: a systematic review.*
- `#465` Kasinska 2022
  - *Sports Injuries Among Players of The Polish National Team in Amputee Football in The Annual Training Cycle.*
- `#474` Confectioner 2021
  - *Help-seeking behaviours related to mental health symptoms in professional football.*
- `#492` Hagglund 2016
  - *Injury recurrence is lower at the highest professional football level than at national and amateur levels: does sports medicine and sports physiotherapy deliver?*
- `#498` Grimm 2015
  - *Anterior Cruciate Ligament and Knee Injury Prevention Programs for Soccer Players: A Systematic Review and Meta-analysis*
- `#501` Mufty 2015
  - *Injuries in male versus female soccer players: epidemiology of a nationwide study*
- `#533` KASIĘSKA 2017
  - *Determinants of sports injuries in amputee football: initial analysis.*
- `#543` M 2013
  - *Sports Injuries in Brazilian Blind Footballers.*
- `#592` Krtinic 2019
  - *A Prospective Cohort Study on Injuries Among Intensely Physically Active High School Students*
- `#624` Drawer 2002
  - *Evaluating the level of injury in English professional football using a risk based assessment process*
- `#627` Watson 1993
  - *Incidence and nature of sports injuries in Ireland. Analysis of four types of sport*
- `#644` Nordstrom 2014
  - *Sports-related concussion increases the risk of subsequent injury by about 50% in elite male football players*
- `#680` Tirabassi 2016
  - *Epidemiology of High School Sports-Related Injuries Resulting in Medical Disqualification: 2005-2006 Through 2013-2014 Academic Years*
- `#690` Fowler 2015
  - *Effects of regular away travel on training loads, recovery, and injury rates in professional Australian soccer players*
- `#715` Whalan 2020
  - *Do Niggles Matter? - Increased injury risk following physical complaints in football (soccer).*
- `#784` Ekstrand 2020
  - *Time before return to play for the most common injuries in professional football: a 16-year follow-up of the UEFA Elite Club Injury Study*
- `#817` Hartmut 2010
  - *Injuries in Women,s soccer: A 1-year all players prospective field study of the Women's bundesliga (German Premier League)*

## Session 3: March 23, 2026 Second Pass

Run context:
- target queue: the prior unresolved `38` from Sessions 1 and 2
- sanity sample before full run: `3/3` downloaded (`#29`, `#78`, `#601`)
- full second-pass run: `33` downloaded, `5` still unresolved
- combined final second-pass result after folding in the confirmed `#601` sanity download:
  - `34` downloaded
  - `2` `waiting_for_pdf`
  - `1` `no_button`
  - `1` `search_not_found`

### Remaining manual queue after second pass

#### `waiting_for_pdf`

- `#449` Childers 2024
  - *Reported Anterior Cruciate Ligament Injury Incidence in Adolescent Athletes is Greatest in Female Soccer Players and Athletes Participating in Club Sports: A Systematic Review and Meta-Analyses.*
  - Covidence opens the correct extraction study and shows `Hide full text`, but no downloadable PDF link is exposed in the DOM.
  - Visible reference URL is present on the page.
- `#528` Sanmiguel-Rodríguez 2021
  - *Injuries in High-Performance Football: A Systematic Review.*
  - Covidence opens the correct extraction study and shows `Hide full text`, but no downloadable PDF link is exposed in the DOM.
  - Visible reference URL is present on the page.

#### `no_button`

- `#778` Pulici 2023
  - *Injury Burden in Professional European Football (Soccer): Systematic Review, Meta-Analysis, and Economic Considerations*
  - Covidence opens the correct study page, but there is no visible `View full text` or direct PDF link.

#### `search_not_found`

- `#781` Lu 2020
  - *Injury epidemiology in Australian male professional soccer*
  - Exact-number search still did not resolve to a usable study page in the second pass.

## Totals Still Requiring Manual Work

- Manual queue before second pass: `38`
- Recovered by second pass: `34`
- Remaining manual queue now: `4`

## Key Files

- Session 1 final manifest:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-11/files-final-3/covidence-download-manifest.csv`
- Session 2 final combined manifest:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-23/files-final-66/combined-manifest.csv`
- Session 3 second-pass manifest:
  - `/Users/abdelbabiker/Downloads/covidence-unresolved-second-pass-2026-03-23/files-final-38/combined-manifest.csv`
- Session 3 remaining manual queue:
  - `/Users/abdelbabiker/Downloads/covidence-unresolved-second-pass-2026-03-23/remaining-manual-4.csv`
- Session summary:
  - `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/covidence-pdf-retrieval-summary.md`
