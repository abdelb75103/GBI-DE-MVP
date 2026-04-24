# Covidence PDF Retrieval Summary

This file captures the operational context from the March 2026 Covidence PDF retrieval/import run so it can be resumed or referenced without the original chat.

## Goal

Pull missing PDFs from Covidence without changing anything in Covidence, save them locally, and then import the retrieved PDFs into the live FIFA GBI extraction site without creating duplicates.

## Safety Constraints Used

- Covidence was treated as read-only.
- Retrieval was done from the Covidence `Extraction` area, not `Full text review`.
- No decisions, approvals, uploads, or workflow-state edits were made in Covidence.
- Browser automation only opened search results, opened study pages, and fetched PDF links.

## Repo Scripts Added For This Workflow

- `scripts/covidence-pdf-workflow.mjs`
  - `prepare`: reconcile the Covidence CSV against a local PDF folder and create a missing queue.
  - `collect`: move manually downloaded files from Downloads into the run output folder.
- `scripts/chrome-active-tab.mjs`
  - inspect the active Chrome tab URL/title and evaluate JS in the focused tab.
- `scripts/covidence-download-from-active-tab.mjs`
  - drive the active Covidence extraction tab, search for papers, open the study page, locate the PDF, and download it.
- `fifa-gbi-data-extraction/scripts/import-covidence-pdfs.mjs`
  - import downloaded PDFs into the live Supabase-backed app while preventing duplicates by file hash and paper matching.

## Key Preconditions

- Google Chrome had to be signed into Covidence.
- The active tab had to be on the target review's extraction page.
- Chrome needed `Allow JavaScript from Apple Events` enabled.

## Concrete Paths Used In This Run

- Reference CSV:
  - `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/review_603597_included_csv_20260312035153.csv`
- Existing local PDF library:
  - `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/Full Text - Data Extraaction`
- Reconciliation/output root:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-11`
- Clean final downloaded PDF folder:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-11/files-final-3`
- Final download manifest:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-03-11/files-final-3/covidence-download-manifest.csv`
- Live import results:
  - `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/covidence-import-results.csv`

## Reconciliation Counts

- Reference CSV rows: `520`
- Local existing matches before Covidence retrieval: `339`
- Ambiguous local matches: `22`
- Missing queue sent to Covidence retrieval: `159`

Notes:
- The `339` existing count came from matching the local PDF library, not from the live website DB.
- The `22` ambiguous items were not auto-resolved by the reconciliation step.

## Covidence Download Results

Final results from `files-final-3/covidence-download-manifest.csv`:

- `145` downloaded
- `6` `no_button`
- `1` `search_not_found`
- `7` `study_page_mismatch`

Total unresolved from the Covidence run: `14`.

## Unresolved Papers From Covidence

### `no_button`

- `#204` Rekik 2018: *ACL injury incidence, severity and patterns in professional male soccer players in a Middle Eastern league.*
- `#207` Rossler 2016: *Soccer Injuries in Players Aged 7 to 12 Years: A Descriptive Epidemiological Study Over 2 Seasons.*
- `#440` Rosenbaum 2009: *Variation in injury risk over the course of a two-day youth club soccer tournament*
- `#449` Childers 2024: *Reported Anterior Cruciate Ligament Injury Incidence in Adolescent Athletes is Greatest in Female Soccer Players and Athletes Participating in Club Sports: A Systematic Review and Meta-Analyses.*
- `#528` Sanmiguel-Rodríguez 2021: *Injuries in High-Performance Football: A Systematic Review.*
- `#778` Pulici 2023: *Injury Burden in Professional European Football (Soccer): Systematic Review, Meta-Analysis, and Economic Considerations*

### `search_not_found`

- `#795` Ruiz-Perez 2021: *Epidemiology of injuries in elite male and female futsal: a systematic review and meta-analysis*

### `study_page_mismatch`

- `#11` Raya-Gonzalez 2020: *Injury Profile of Elite Male Young Soccer Players in a Spanish Professional Soccer Club: A Prospective Study During 4 Consecutive Seasons*
- `#299` Peek 2023: *Injury-Reduction Programs Containing Neuromuscular Neck Exercises and the Incidence of Soccer-Related Head and Neck Injuries*
- `#384` Kinalski 2020: *Prospective analysis of craniofacial soccer incidents during FIFA competitions: an observational study.*
- `#430` Moses 2012: *Systematic review: Annual incidence of ACL injury and surgery in various populations*
- `#433` Carling 2011: *A four-season prospective study of muscle strain reoccurrences in a professional football club*
- `#434` Walden 2011: *The epidemiology of anterior cruciate ligament injury in football (soccer): A review of the literature from a gender-related perspective*
- `#868` Vilamitjana 2013: *The influence of match frequency on the risk of injury in professional soccer.*

## Live Import Results

The downloaded PDFs were imported into the live Supabase-backed database using `fifa-gbi-data-extraction/scripts/import-covidence-pdfs.mjs`.

Final import result counts:

- `143` new live papers created and attached
- `2` skipped because the exact file hash already already existed live

Skipped by duplicate file hash:

- `#730` *Effects of ground-surface change on sports injuries among college soccer players: Comparison between a soil ground and an artificial turf ground.*
- `#785` *Injury prevalence and risk factors in a Greek team's professional football (soccer) players: a three consecutive seasons survey*

## Website Count Explanation

Verified live database counts after import:

- `508` total papers in the DB
- `482` visible on the dashboard

Why the dashboard shows `482`:

- The dashboard hides `archived` papers.
- There are `26` archived papers.
- `508 - 26 = 482`

Relevant code:

- `fifa-gbi-data-extraction/src/app/dashboard/page.tsx`
- `const visiblePapers = papers.filter((paper) => paper.status !== 'archived');`

## Resume Notes

- Use `files-final-3` as the authoritative final download folder for this run.
- Earlier `files`, `files-final`, and `files-final-2` folders were partial or aborted runs.
- If this workflow is repeated, do a new `prepare` pass first instead of reusing stale missing queues.
- If unresolved items remain after a first download pass, build a second-pass unresolved queue with `npm run covidence:unresolved` and rerun `npm run covidence:download` only on those rows.
- For the current post-second-pass manual residue, see `docs/covidence-pdf-followup-todo.md`.
- If a user asks for the exact March 2026 retrieval workflow again, invoke the `covidence-pdf-retrieval` skill and start from the paths listed above.

## April 7, 2026 Update

The counts above are the March 2026 state and are no longer the live website totals.

Current verified live database counts on April 7, 2026:

- `629` studies in the latest Covidence included export
- `626` total papers in the live DB
- `586` visible on the dashboard
- `40` papers in the live DB currently have status `archived`

Current count interpretation:

- The true raw DB gap versus Covidence is now `3` papers: `629 - 626 = 3`.
- The dashboard gap is larger because archived papers are hidden from the standard dashboard view: `626 - 40 = 586`.
- That means the visible dashboard gap versus Covidence is `43`, but `40` of those are explained by archived records and only `3` are explained by the raw DB count gap.

Current April 7 retrieval/import pass:

- New Covidence included export compared against the previous included export: `34` newly added studies
- Reconciliation against the local PDF library: `3` existing, `1` ambiguous existing, `30` missing
- Covidence download run: `29` downloaded, `1` unresolved `no_button`
- Live import result: `28` new papers created and attached, `1` skipped because the exact file hash already existed live

Current unresolved/manual item from the April 7 pass:

- `#524` Rogan 2013: *Static stretching of the hamstring muscle for injury prevention in football codes: a systematic review.*
  - Covidence status during retrieval: `no_button`
  - Meaning: the study opened in Covidence Extraction, but there was no downloadable PDF or usable full-text control exposed for automation

Working explanation for the remaining raw count gap on April 7:

- Treat `#524` Rogan 2013 as a known current missing-live record.
- The remaining raw gap after Rogan is `2` papers.
- User context from the April 6, 2026 work suggests those `2` papers were intentionally deleted because they did not match what should have been included.
- That means the current `629` Covidence vs `626` DB count is provisionally explained as:
  - `1` known unresolved Covidence paper (`#524` Rogan 2013)
  - `2` intentionally removed live DB papers from the April 6 cleanup

Known intentionally removed paper from the April 6 cleanup:

- `S097` — *Technology and inclusivity*

Current confidence note:

- This explains the arithmetic cleanly, but the exact titles of the `2` intentionally deleted papers are not recorded in this file yet.
- One of the two intentionally deleted papers is now confirmed: `S097` — *Technology and inclusivity*.
- If needed later, confirm them from the April 6 chat or any Supabase audit/history source rather than inferring from count math alone.

Important caveat for count comparisons:

- The live DB and the current Covidence included export do not map `1:1` by count alone.
- Some live DB records are legacy or project-specific records that do not appear in the current Covidence included export.
- Some newly added Covidence records were reconciled to local files rather than imported in the April 7 pass, and one new record remains unresolved in Covidence.
- Because of that, the `3`-paper raw count gap should be treated as a live inventory gap, not as a complete title-level explanation by itself.

Concrete files for the April 7 pass:

- Reference CSV:
  - `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/review_603597_included_csv_20260408005101.csv`
- Reconciliation/output root:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-04-07`
- Final combined manifest:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-04-07/files-final/combined-manifest.csv`
- Unresolved queue:
  - `/Users/abdelbabiker/Downloads/covidence-missing-pdfs-2026-04-07/unresolved.csv`
- Live import results:
  - `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/covidence-import-results.csv`

## April 15-16, 2026 Full Text Review Upload Update

This was a separate manual Covidence `Full text review` upload pass, not part of the earlier Extraction-side retrieval workflow.

Desktop source used:

- `/Users/abdelbabiker/Desktop/refifagbioriginalsearch`
- `/Users/abdelbabiker/Desktop/refifagbioriginalsearch/refifagbioriginalsearch (2)`
- Reference list PDF: `/Users/abdelbabiker/Desktop/refifagbioriginalsearch/Covidence Missing Full Texts found.pdf`

What changed in Covidence during this pass:

- Verified local PDFs were matched against Covidence records by reading the PDF title/author pages and then uploaded directly into Covidence Full text review.
- Existing link-only records `#550`, `#757`, and `#811` were converted into records with attached PDFs as well.
- Newly attached during the April 15-16 pass:
  - `#13`, `#36`, `#63`, `#69`, `#83`, `#95`
  - `#361`, `#364`, `#387`, `#388`, `#425`
  - `#550`, `#568`, `#628`, `#637`
  - `#752`, `#757`, `#760`
  - `#801`, `#802`, `#811`, `#847`, `#869`

Current residue after the second pass:

- Confirmed not present in the desktop folder set:
  - `#368`, `#375`, `#617`, `#727`, `#859`
- Still unresolved because no safe full-article local PDF could be matched:
  - `#370`, `#378`, `#744`, `#748`, `#758`

Follow-up source of truth for this residue:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/covidence-pdf-followup-todo.md`

Practical next steps from this point:

- Decide whether `#370` is acceptable as link-only in Covidence.
- Source new PDFs externally for `#368`, `#375`, `#617`, `#727`, `#744`, `#748`, and `#859`.
- Re-check `#378` for any mislabeled or non-OCR local copy before requesting it externally.
- Keep `#758` unresolved unless the real article PDF is found; the current local file looks like a citation/abstract page rather than full text.
