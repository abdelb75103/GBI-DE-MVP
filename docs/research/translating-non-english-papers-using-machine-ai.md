# Translating Non-English Papers Using Machine / AI Translation

Date: 2026-04-24

Status updates: 2026-04-27, 2026-04-30

## Direction for This Review

For non-English papers identified during screening, the preferred direction is to use machine translation or AI-assisted translation as a practical support tool for eligibility screening, while keeping the screening decision with the review team.

This means:

- Machine translation or AI translation can be used to understand titles, abstracts, and full texts for screening.
- The tool should not be described as making the inclusion or exclusion decision.
- If a paper is clearly irrelevant after translation, it can be excluded with the translation method documented.
- If a paper is potentially eligible, unclear, or the exclusion depends on nuanced terminology, study design, outcome wording, population detail, or methods, it should be checked by a bilingual reviewer, native speaker, or translator where possible.
- If a paper is included and will contribute data extraction, risk-of-bias assessment, GRADE, or interpretation of results, human verification is preferred. A full professional translation is not always required, but some competent human language check is more defensible than relying only on raw machine output.
- If adequate translation or checking cannot be obtained, the study should be listed as awaiting classification rather than excluded solely because of language.

## April 27, 2026 Project Output

The non-English full-text translation batch for Covidence review `603597` is complete for every locally available/downloadable non-English PDF identified in the project tracking folder.

Primary output folder:

- `/Users/abdelbabiker/Desktop/non-english-translations`

Repo mirror:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/non-english-translations`

Tracking files:

- `/Users/abdelbabiker/Desktop/non-english-translations/manifest.csv`
- `/Users/abdelbabiker/Desktop/non-english-translations/TRANSLATION_AUDIT.md`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/non-english-translations/manifest.csv`
- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/non-english-translations/TRANSLATION_AUDIT.md`

Current counts:

- `43` non-English records tracked.
- `29` English translation PDFs completed.
- `0` downloaded PDFs pending translation.
- `14` records remain without a downloadable PDF found in Covidence or local tracking.

Translation method:

- Translations were performed locally by Codex from extracted PDF text.
- No third-party translation service or translation API was used.
- The local Codex CLI rejected `gpt-5.5`; the completed workflow used `gpt-5.4`. This is documented in the per-paper `translation-notes.md` files and in the audit file.
- Original PDFs, extracted text, translated text, English PDFs, and translation notes are stored in Covidence-numbered folders.

Full-text screening recommendation packet:

- Folder: `/Users/abdelbabiker/Desktop/non-english-translations/screening-review`
- PDF: `/Users/abdelbabiker/Desktop/non-english-translations/screening-review/non-english-fulltext-screening-recommendations.pdf`
- Markdown: `/Users/abdelbabiker/Desktop/non-english-translations/screening-review/non-english-fulltext-screening-recommendations.md`
- Structured JSON: `/Users/abdelbabiker/Desktop/non-english-translations/screening-review/non-english-fulltext-screening-recommendations.normalized.json`

Screening packet counts:

- `43` records reviewed.
- `26` preliminary include recommendations.
- `3` preliminary exclude recommendations.
- `14` unsure recommendations because no downloadable full text was available.

The screening recommendation packet used criteria version `fifa-gbi-full-text-v1-2026-04-24` and is advisory only. Reviewers still make final screening decisions.

April 30 corrections:

- `#710` had been missed in the April 27 translation loop because its local source path existed in `#710/source-path.txt`, but the manifest row still said `no_downloadable_pdf_in_covidence`.
- The PDF was recovered from `/Users/abdelbabiker/Downloads/Dialnet-EstudioDescriptivoDeLasLesionesDeLigamentoCruzadoE-9062439.pdf`.
- `#710` is now translated and the manifest/audit/screening recommendation packet have been updated.
- `#854` was also missed because the manifest row said `no_pdf_in_covidence`; a later local filename audit found the exact matching Portuguese PDF at `/Users/abdelbabiker/Downloads/Dialnet-EpidemiologiaDeLesoesEmJovensAtletasDeFutebolDasCa-7599370.pdf`.
- `#854` is now translated, rendered as an English PDF, and moved from `unsure` to a preliminary `include` recommendation in the screening packet.

April 30 Covidence upload completion:

- All `29` completed English translation PDFs were uploaded to their matching Covidence review-reference records in review `603597`.
- Upload audit folder: `/Users/abdelbabiker/Desktop/non-english-translations/covidence-upload-pdfs`
- Upload audit files:
  - `/Users/abdelbabiker/Desktop/non-english-translations/covidence-upload-pdfs/UPLOAD_AUDIT.md`
  - `/Users/abdelbabiker/Desktop/non-english-translations/covidence-upload-pdfs/UPLOAD_AUDIT.csv`
  - `/Users/abdelbabiker/Desktop/non-english-translations/covidence-upload-pdfs/UPLOAD_AUDIT.json`
- Repo backlog/log copy: `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/docs/research/non-english-covidence-upload-log-2026-04-30.md`
- Upload status: `29/29` successful Covidence document records.
- Uploaded source-language counts: German `8`, Portuguese `7`, Spanish `7`, Dutch `2`, French `2`, Danish `1`, Norwegian `1`, Turkish `1`.
- The reusable workflow has been saved as the repo skill `skills/covidence-translation-upload`.

## Practical Screening Hierarchy

1. Clearly irrelevant after machine or AI translation:
   Exclude, record the reason, and document that machine or AI translation was used.

2. Possibly eligible or unclear after translation:
   Seek bilingual or human checking before final exclusion or inclusion.

3. Included for extraction, effect estimates, risk of bias, or certainty assessment:
   Use bilingual review, human-checked translation, or professional translation if needed.

4. Translation not adequate or not available:
   Record as awaiting classification, not excluded because of language.

## Suggested Methods Wording

> Non-English full texts were translated using machine translation and/or AI-assisted translation for eligibility screening. Screening decisions were made by the review authors, not by the translation tool. Records that appeared eligible or unclear after translation were checked by a reviewer with relevant language competence or, where unavailable, retained as awaiting classification until adequate translation could be obtained. Use of translation tools was documented for transparency.

Alternative shorter wording:

> Non-English records were translated using machine translation or AI-assisted translation to support screening. Where translation indicated that a record was potentially eligible or unclear, human language checking was sought before final eligibility decisions, data extraction, or risk-of-bias assessment.

## Rationale

The rationale is to avoid unnecessary English-language restriction while acknowledging that machine translation is imperfect. The evidence supports machine translation as a useful way to reduce language bias and support screening, but it is weaker for nuanced data extraction and risk-of-bias work. Therefore, machine or AI translation is acceptable as a screening aid, but human verification is preferred for uncertain or included studies.

## Evidence and Guidance to Cite

- Cochrane Handbook guidance recommends avoiding language restrictions where possible because restrictions can introduce language or indexing bias. It also advises seeking translation help when needed and classifying reports as awaiting classification if the team cannot extract the relevant information. Source: Cochrane Handbook, Chapter 4, "Searching for and selecting studies": https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04

- Balk et al. evaluated Google Translate for extracting data from non-English trials. Translation usually required few resources and had potential to reduce language bias, but extraction from translated articles was less accurate than extraction from English articles, with accuracy varying by language. Source: Balk EM, Chung M, Hadar N, et al. Accuracy of Data Extraction of Non-English Language Trials With Google Translate. AHRQ Methods Research Report, 2012: https://www.ncbi.nlm.nih.gov/books/NBK95238/

- Jackson et al. reported peer-reviewed evidence in Annals of Internal Medicine on Google Translate for abstracting data from non-English trials for systematic reviews. Source: Jackson JL, Kuriyama A, Anton A, et al. The accuracy of Google Translate for abstracting data from non-English-language trials for systematic reviews. Ann Intern Med. 2019;171(9):677-679. doi:10.7326/M19-0891. Citation page: https://pure.johnshopkins.edu/en/publications/the-accuracy-of-google-translate-for-abstracting-data-from-non-en/

- Busse et al. assessed whether English-speaking reviewers could identify eligible foreign-language full-text articles for a systematic review. English-speaking reviewers using a structured approach achieved good sensitivity and specificity, supporting structured screening approaches while still recognizing the value of native-language reference judgements. Source: Busse JW, et al. An efficient strategy allowed English-speaking reviewers to identify foreign-language articles eligible for a systematic review. J Clin Epidemiol. 2014;67(5):547-553. https://www.sciencedirect.com/science/article/abs/pii/S0895435613005180

- Robson et al. reviewed methodological studies on study selection, data abstraction, and quality appraisal in systematic reviews. The review found limited evidence overall, but supported experienced reviewers and use of Google Translate when screening non-English articles. Source: Robson RC, et al. Few studies exist examining methods for selecting studies, abstracting data, and appraising quality in a systematic review. J Clin Epidemiol. 2019. https://www.sciencedirect.com/science/article/abs/pii/S0895435618301653

- Emerging evidence suggests ChatGPT and other large language models can support medical translation tasks, but the evidence base is less direct for systematic-review full-text screening than it is for Google Translate/machine translation studies. Use ChatGPT as an AI-assisted translation support, not as the decision maker. Example source: Grimm DR, Lee YJ, Hu K, et al. The utility of ChatGPT as a generative medical translator. Eur Arch Otorhinolaryngol. 2024. https://pubmed.ncbi.nlm.nih.gov/38705894/

## Bottom Line

For this review, the preferred approach is:

Use machine translation or AI translation to support non-English screening; document the tool and process; escalate uncertain or potentially eligible papers to human language checking; use human-checked translation for included studies before extraction, risk-of-bias assessment, or interpretation.
