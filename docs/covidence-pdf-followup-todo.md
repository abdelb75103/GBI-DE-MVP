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

## Session 4: April 15-16, 2026 Full Text Review Upload Pass

Run context:
- Source list: the highlighted records in `/Users/abdelbabiker/Desktop/refifagbioriginalsearch/Covidence Missing Full Texts found.pdf`
- Local files checked recursively in:
  - `/Users/abdelbabiker/Desktop/refifagbioriginalsearch`
  - `/Users/abdelbabiker/Desktop/refifagbioriginalsearch/refifagbioriginalsearch (2)`
- Matching rule: read the first page of the candidate PDF and, when needed, the second or third page before uploading in Covidence Full text review

### PDFs successfully attached in Covidence during this pass

- `#13`, `#36`, `#63`, `#69`, `#83`, `#95`
- `#361`, `#364`, `#387`, `#388`, `#425`
- `#550`, `#568`, `#628`, `#637`
- `#752`, `#757`, `#760`
- `#801`, `#802`, `#811`, `#847`, `#869`

### April 27, 2026 additional full text

- `#744` Engebretsen 1987
  - *Fotballskader og kunstgress.*
  - PDF now available: `/Users/abdelbabiker/Downloads/8385453620007966.pdf`
  - Language/status: Norwegian article; mark as `has PDF` and `non-English paper`.
  - Evidence: delivery note identifies *Tidsskrift for den Norske Laegeforening*, 1987, volume `107/26`, pages `2215-2217`, article title *Fotballskader og kunstgress*, authors Lars Engebretsen and Trygve Kase.

### April 27, 2026 website import of newly included full texts

These records came from the April 24 full-text screening decision report and were imported into the data extraction website from local PDFs. All imported records have PDFs attached.

| Covidence # | Website ID | Website status | Paper |
| --- | --- | --- | --- |
| `#13` | `S629` | `uploaded` | *Epidemiology of Injuries in Elite Male Futsal Players* |
| `#63` | `S630` | `uploaded` | *Injury Profile among Elite Youth Male Football Players in a German Academy* |
| `#69` | `S631` | `uploaded` | *Injury Analysis of a Professional Female Soccer Team* |
| `#83` | `S632` | `uploaded` | *Hip and Groin Injuries Among Collegiate Male Soccer Players* |
| `#364` | `S633` | `uploaded` | *Injury Associated with Soccer: A Review of Epidemiology and Etiology* |
| `#387` | `S634` | `uploaded` | *Injuries and Functional Performance Status in Young Elite Football Players* |
| `#388` | `S635` | `uploaded` | *The Epidemiology and Mechanisms of Soccer Injuries* |
| `#425` | `S636` | `uploaded` | *FIFA "11" Injury Prevention Program in Italian Amateur Soccer* |
| `#628` | `S637` | `uploaded` | *Epidemiological Survey of Injuries During the 1st Under 17 World Football Championship* |
| `#637` | `S638` | `uploaded` | *Association Football Injuries in School Boys* |
| `#802` | `S639` | `uploaded` | *Incidence of Injuries in Young Soccer Players* |
| `#811` | `S640` | `uploaded` | *Injuries and Rehabilitation Workload in a National Team During the 2010 World Cup* |
| `#847` | `S641` | `uploaded` | *Injuries Among Adolescent Players in an Amateur Soccer Tournament in Nigeria* |
| `#869` | `S642` | `uploaded` | *Medical Support for an All-Star Youth Soccer Team in Niigata* |

Import files:
- Manifest/results: `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/tmp/covidence-new-inclusions-2026-04-27`
- Source report: `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/covidence-uploaded-23-full-text-screening-review.html`

Related already-live record:
- `#361` Ostenberg 2000 was already present as `S216` with status `extracted`, so it was not re-imported.

### Remaining unresolved after the second pass

#### Confirmed not found in the desktop folder set

- `#368` Volpi 2000
  - *Soccer injury epidemiology*
- `#375` Green Jr. 1997
  - *Scaphoid fractures in soccer goalkeepers*
- `#617` Gamez 2006
  - *Epidemiology of beach volleyball and beach soccer*
- `#727` Ouyang 2001
  - *The prevention and treatment of injuries in Chinese female football players.*
- `#859` Mtshali 2015
  - *Football injuries during a South African university sport tournament.*

#### Still need a separate source or manual verification

- `#370` Juma 1998
  - *Outline of sport injuries in the V World Youth Championship for FIFA Cup in Saudi Arabia*
  - Covidence already has a full-text link, but no verified local PDF was found for attachment.
- `#378` Mackay 1996
  - *Pre-season injuries in Scottish football: A prospective study*
  - No verified local PDF was found in the desktop folder set.
- `#748` Perdriel 1975
  - *Traumatismes orbitaires dans la pratique du football.*
  - No verified local PDF was found in the desktop folder set.
- `#758` Goldberg 1988
  - *Injuries in youth football.*
  - The only local hit was `1-s2.0-0022437589900182-main.pdf`, which is a citation/abstract-style page, not the full article PDF.

### Next actions

- Work item 1: resolve whether `#370` can remain link-only
  - Open the Covidence record and decide if the existing external full-text link is acceptable for the review workflow.
  - If not, source and upload a real PDF later.
- Work item 2: request/source missing PDFs externally for `#368`, `#375`, `#617`, `#727`, `#748`, and `#859`
  - Preferred order: library access, publisher site, interlibrary loan, then manual web search.
- Work item 3: manually re-check `#378`
  - Look for alternate filenames, scans without OCR text, or local copies stored outside the April 15-16 desktop folders.
- Work item 4: manually re-check `#758`
  - Confirm whether the local `1-s2.0-0022437589900182-main.pdf` can ever be treated as sufficient.
  - Current recommendation: treat it as insufficient and keep `#758` unresolved until the real article PDF is found.

### Completion target for this queue

- Accept `#370` as resolved if link-only is allowed.
- Source and upload real PDFs for `#368`, `#375`, `#617`, `#727`, `#748`, and `#859`.
- Either find a valid full article for `#378` and `#758` or explicitly mark them as unavailable after final manual checking.

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
