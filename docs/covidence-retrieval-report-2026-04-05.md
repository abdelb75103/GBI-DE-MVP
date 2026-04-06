# April 5, 2026 Covidence Retrieval Report

This report summarizes the April 5, 2026 UCD/DCU/open-source full-text retrieval work for the non-foreign papers still missing attached PDFs in Covidence. After validation and language correction, the first pass recovered 1 real non-foreign PDF. A previously counted Tummala file proved to be an HTML page saved with a `.pdf` extension, not a valid PDF. Two other April 5 recoveries, `#53` Can 2006 and `#357` Pereira 2003, were moved out of this report after confirmation that they are Turkish and Spanish respectively and are now logged in the foreign-language section of the cleanup file. A selective second pass then retried the highest-upside targets and ran an evidence-first sweep across the unresolved papers. The second pass did not add any new valid PDFs, but it did assign every remaining non-foreign paper a concrete outcome and evidence URL.

## Counts

- Starting non-foreign missing queue from the cleanup snapshot: `33`
- Full texts recovered in the first pass: `1`
- Additional full texts recovered in the second pass: `0`
- Attempted but still unresolved after both passes: `32`
- Foreign-language unresolved papers: excluded from this pass by design

## Recovered PDFs

| Covidence ID | Citation | Retrieval source | Saved file |
| --- | --- | --- | --- |
| `#801` | McFadyen 1999, *Orofacial injuries in youth soccer* | Open-access AAPD PDF | `downloads/library-fulltexts-2026-04-05/McFadyen-1999.pdf` |

## Second-Pass Result

The selective second pass produced no additional valid PDFs. The high-upside retry set ended in one of three states: PDF endpoint redirected back to the abstract page, publisher PDF route was blocked by a browser challenge, or the article exposed a nominal PDF route but still blocked passive access. The remaining modern papers were confirmed as closed-online rather than missed by search, and the older papers were reduced to repository records without files, catalog-only traces, or citation/abstract-only evidence. During validation, the previously counted Tummala file was removed because it was HTML, not a PDF.

## Unresolved Summary

### Subscription blocked

These papers reached the publisher page through the library route, but the institution subscription did not include the article.

- `#13` Lopes 2023
- `#36` Grassi 2022
- `#568` Paliobeis 2021

### Purchase-only or closed publisher page

These papers have identifiable publisher pages, but the available route exposed only purchase-only or otherwise closed full-text access rather than a usable PDF.

- `#69` Pellegrini 2021
- `#95` Tourny 2014
- `#387` Sieland 2020
- `#425` Gatterer 2012
- `#802` Thiebat 2021
- `#811` Eirale 2013
- `#847` Olumide 2016

### Repository or catalog record with no attached file

These papers had a public record, repository page, or catalog entry, but no accessible full-text file was attached.

- `#364` McHardy 2001
- `#628` Volpi 1992
- `#727` Ouyang 2001
- `#757` Blaser 1992

### Abstract/citation only or no digitized full text found

These papers were traceable as citations, abstracts, or older catalog references, but no digitized full text was found after the search pass.

- `#368` Volpi 2000
- `#370` Juma 1998
- `#375` Green Jr. 1997
- `#378` Mackay 1996
- `#388` Latella 1992
- `#550` Watson 1997
- `#617` Gamez 2006
- `#637` Kristiansen 1983
- `#744` Engebretsen 1987
- `#748` Perdriel 1975
- `#752` Hinge 1984
- `#758` Goldberg 1988
- `#760` McPHEE 1947
- `#859` Mtshali 2015
- `#869` Edama 2012

### Browser, rate-limit, or bot-wall interference

These papers had plausible next-step endpoints but could not be closed out cleanly in this passive pass because the remaining route depended on browser-gated access or anti-bot protection.

- `#63` Jaber 2022
- `#361` Ostenberg 2000

## Full Story for Older Papers

The older unresolved papers are not all the same case. Some are clearly modern paywalled articles. Some have publisher pages but only purchase-only access. Some have repository or catalog records with no file attached. Others appear to survive only as citation or abstract records, which strongly suggests that a digitized full text may not be openly available online. In short, the unresolved set is a mix of closed-online articles, undigitized older records, and citation-only traces rather than one single “abstract only” failure mode.

## Retrieval Status Table

| Covidence # | Citation | Bucket | Best evidence URL | Outcome | Next action |
| --- | --- | --- | --- | --- | --- |
| `#13` | Lopes 2023 | subscription blocked | `https://doi.org/10.1097/JSM.0000000000001142` | Library-authenticated publisher route still outside subscription | Stop |
| `#36` | Grassi 2022 | subscription blocked | `https://doi.org/10.1097/JSM.0000000000000879` | Library-authenticated publisher route still outside subscription | Stop |
| `#83` | Tummala 2018 | invalid prior capture; no verified PDF | `https://login.ucd.idm.oclc.org/login?qurl=https://ucd.summon.serialssolutions.com/search?l=en&q=%22Hip%20and%20Groin%20Injuries%20Among%20Collegiate%20Male%20Soccer%20Players%22` | Prior saved file was HTML rather than a PDF; no validated full text remains on disk | Retry only with a live authenticated browser session |
| `#63` | Jaber 2022 | browser-blocked PDF route | `https://www.thieme-connect.de/products/ejournals/abstract/10.1055/a-1516-4139` | Direct PDF endpoint redirects back to abstract; no passive retrieval | Manual browser retry only if needed |
| `#69` | Pellegrini 2021 | closed-online; no repository file | `http://hdl.handle.net/11380/1281354` | Repository handle exists but has no file; publisher route remains closed | Stop |
| `#95` | Tourny 2014 | closed-online publisher page | `https://pubmed.ncbi.nlm.nih.gov/25034555` | PubMed points to Minerva route; no open copy found | Stop |
| `#361` | Ostenberg 2000 | browser or bot-wall interference | `https://onlinelibrary.wiley.com/doi/pdf/10.1034/j.1600-0838.2000.010005279.x` | PDF route still returns Cloudflare challenge | Manual browser retry only if needed |
| `#364` | McHardy 2001 | repository record with no file | `https://researchers.mq.edu.au/en/publications/injury-associated-with-soccer-a-review-of-epidemiology-and-etiolo/` | Record exists; no attached full text | Stop |
| `#368` | Volpi 2000 | abstract or citation only | `https://www.safetylit.org/citations/index.php?fuseaction=citations.viewdetails&citationIds[]=citjournalarticle_75762_38` | Citation located; no digitized full text found | Stop |
| `#370` | Juma 1998 | abstract or citation only | `https://pubmed.ncbi.nlm.nih.gov/10085609` | PubMed or Europe PMC abstract only | Stop |
| `#375` | Green Jr. 1997 | abstract or citation only | `https://pubmed.ncbi.nlm.nih.gov/9068228` | PubMed abstract only | Stop |
| `#378` | Mackay 1996 | no reliable trace beyond citation metadata | `https://scholar.google.com/scholar?q=%22Pre-season+injuries+in+Scottish+football%3A+A+prospective+study%22` | No usable full-text or repository copy surfaced in retry | Stop |
| `#387` | Sieland 2020 | closed-online publisher page | `https://doi.org/10.23736/S0022-4707.20.10886-7` | DOI resolves to closed Minerva route; no repository copy found | Stop |
| `#388` | Latella 1992 | abstract or citation only | `https://www.safetylit.org/citations/index.php?fuseaction=citations.viewdetails&citationIds[]=citjournalarticle_75695_11` | Citation located; no digitized full text found | Stop |
| `#425` | Gatterer 2012 | closed-online publisher page | `https://pubmed.ncbi.nlm.nih.gov/22327090` | Full-text path leads to closed Minerva route | Stop |
| `#550` | Watson 1997 | catalog record only | `https://natlib-primo.hosted.exlibrisgroup.com/primo-explore/fulldisplay?vid=NLNZ&docid=INNZ7114516320002837&context=L&search_scope=INNZ` | Catalog record found; no digital full text found | Stop |
| `#568` | Paliobeis 2021 | subscription blocked | `https://doi.org/10.1097/BCO.0000000000001012` | Library-authenticated publisher route still outside subscription | Stop |
| `#617` | Gamez 2006 | abstract or index only | `https://www.cabdirect.org/cabdirect/abstract/20063214109` | Indexed abstract only; no full text found | Stop |
| `#628` | Volpi 1992 | repository or catalog record with no file | `https://moh-it.pure.elsevier.com/en/publications/epidemiological-survey-of-injuries-during-the-1st-under-17-world-` | Record exists; no attached full text | Stop |
| `#637` | Kristiansen 1983 | print holding or catalog only | `https://jyu.finna.fi/Record/arto.014449264` | Library record located; no digital full text found | Stop |
| `#727` | Ouyang 2001 | repository or catalog record with no file | `https://pesquisa.bvsalud.org/portal/resource/pt/wpr-582558?lang=en#` | Bibliographic record found; no attached full text | Stop |
| `#744` | Engebretsen 1987 | no reliable trace beyond citation metadata | `https://scholar.google.com/scholar?q=%22Fotballskader+og+kunstgress%22` | Retry found no stable digital record with full text | Stop |
| `#748` | Perdriel 1975 | no reliable trace beyond citation metadata | `https://scholar.google.com/scholar?q=%22Traumatismes+orbitaires+dans+la+pratique+du+football%22` | Retry found no stable digital record with full text | Stop |
| `#752` | Hinge 1984 | no reliable trace beyond citation metadata | `https://scholar.google.com/scholar?q=%22Fodboldskader+hos+old+boys+fodboldspillere%22` | Retry found no direct digital record with full text | Stop |
| `#757` | Blaser 1992 | repository record with no file | `https://edoc.unibas.ch/entities/publication/67539b92-c888-4172-a727-3eb61ec7111a` | Repository record exists but attached file is not the article PDF | Stop |
| `#758` | Goldberg 1988 | browser or bot-wall interference | `https://publications.aap.org/pediatrics/article-pdf/81/2/255/1036206/255.pdf` | Direct PDF route still returns Cloudflare challenge | Manual browser retry only if needed |
| `#760` | McPHEE 1947 | abstract or citation only | `https://pubmed.ncbi.nlm.nih.gov/20248309` | PubMed citation only; no digitized full text found | Stop |
| `#802` | Thiebat 2021 | closed-online publisher page | `https://doi.org/10.23736/S0022-4707.20.11157-5` | DOI resolves to closed Minerva route; no repository copy found | Stop |
| `#811` | Eirale 2013 | closed-online or rate-limited publisher page | `https://pubmed.ncbi.nlm.nih.gov/23584327` | Minerva confirmation route remained blocked; no open copy found | Stop |
| `#847` | Olumide 2016 | closed-online publisher page | `https://pubmed.ncbi.nlm.nih.gov/26112818` | Full-text path leads to closed Minerva route | Stop |
| `#859` | Mtshali 2015 | browser or cart-gated PDF route | `https://www.ajol.info/index.php/ajpherd/article/view/121462` | Article exposes a PDF route, but passive PDF endpoints still fail | Manual browser retry only if needed |
| `#869` | Edama 2012 | catalog record only | `https://cir.nii.ac.jp/crid/1520572357681407360` | Bibliographic record found; no attached full text | Stop |

## Only Remaining Manual-Value Targets

After the passive second pass, only a few papers still have meaningful upside for a future manual retry:

- `#83` Tummala 2018
- `#63` Jaber 2022
- `#361` Ostenberg 2000
- `#758` Goldberg 1988
- `#859` Mtshali 2015

All other unresolved non-foreign papers now look better classified as paywalled, purchase-only, repository-without-file, catalog-only, or citation-only.

## Related Documents

- [Covidence cleanup snapshot](/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/covidence-cleanup.md)
- [March retrieval summary](/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/covidence-pdf-retrieval-summary.md)
- [Manual follow-up residue](/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/covidence-pdf-followup-todo.md)
