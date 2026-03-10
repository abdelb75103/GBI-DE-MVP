---
name: gbi-live-extraction
description: Use the terminal-first workflow for staged manual-tab extraction in the FIFA GBI repo. Use this when a user wants help extracting tabs 5-10 from a paper PDF, reviewing the draft in chat, and applying approved values to the live Supabase-backed site without touching the UI.
---

# GBI Live Extraction

Run all commands from `fifa-gbi-data-extraction/`.

## Default Interpretation

- When the user says to "update" the process or instructions after a paper review, treat that as a request to update this skill/workflow guidance, not the app's user-facing extraction instructions.
- Prefer additive-only live data updates. Do not overwrite nonblank extraction values unless the user explicitly asks for a correction.
- When this skill is invoked for extraction work, default to the terminal-first manual extraction workflow. Do not call Gemini or use AI suggestions unless the user explicitly asks for that.

## Workflow

1. Start with `bash -lc './scripts/terminal-extract.sh prep --paper <paperId|studyId>'`.
2. Ask the user which population or subgroup to target if the paper is ambiguous.
3. Run `bash -lc './scripts/terminal-extract.sh extract --paper <paperId|studyId> --tab <manual-tab> --guidance "<user instruction>"'`.
4. Read the staged review file or run `bash -lc './scripts/terminal-extract.sh review --paper <paperId|studyId>'`.
5. Summarize the proposed changes and wait for explicit approval.
   - In that review summary, explicitly state:
     - the line mapping being used for the paper,
     - whether the proposed update is additive-only or includes corrections,
     - any structured rows that were aggregated from compatible subrows,
     - any severity values that were labeled as median rather than mean,
     - any intentionally blank fields that were left blank because the paper did not report a compatible value.
6. Only after approval, run `bash -lc './scripts/terminal-extract.sh apply --paper <paperId|studyId>'`.
7. Do not change the paper status to `extracted` as part of the default extraction workflow. Leave status changes to the user unless the user explicitly asks for a status update.
8. Use `--mark-complete` only when the user has explicitly confirmed the paper is ready for `extracted`.

## Safety

- Never use `apply` without explicit user approval.
- Do not pass `--allow-empty-overwrite` unless the user explicitly wants blank values to replace existing data.
- If a staged draft already exists, do not overwrite it with `prep --force` unless the user wants to discard the local draft.
- If the live paper already contains manual edits, preserve them. Fill blank fields only unless the user explicitly approves changing populated values.
- Do not update the live paper status during extraction or review unless the user explicitly asks for that status change.
- For papers that are still awaiting user review, prefer the live status `processing` rather than `extracted`. The user will mark papers as `extracted` manually when ready.
- Do not add notes to the live paper on the website unless the user explicitly asks for a live note. Put review commentary, rationale, caveats, and proposed notes in the backlog by default.
- Exception: a short live note is acceptable when it is needed to preserve an important field-mapping convention inside the record itself, such as coding a combined reported category under a specific schema row (for example, `hip/groin` recorded under `hip`).

## Review Heuristics

- American data is not excluded by default. Extract it unless the paper is clearly NCAA, Rio, or Datalys-linked, or unless it is not association football at all.
- If a paper mixes football with other sports but reports a clean football subgroup, extract the football subgroup only and say that explicitly in the review summary or note.
- For `injuryDefinition`, keep the extracted value tight. Prefer `medical attention`, `time-loss`, or `physical complaint`. Only keep longer free text if the paper genuinely does not fit one of those three labels.
- For who reported the data, keep the value concise. Prefer `Medical Staff`, `Coach`, or `Player-selfreported` rather than copying the full sentence.
- Before finalizing a paper, check whether the source reports mechanism or contact splits. If those are given only as percentages, save the reported percentages instead of leaving the fields blank.
- Before finalizing a paper, check whether the source reports total days lost or absence days overall. Save those values into the corresponding injury/illness outcome fields when present.
- Before finalizing a paper, check whether the source reports days lost by injury type or by anatomical location. If yes, populate the matching `severityTotalDays` structured rows in `injuryTissueType` and `injuryLocation`.
- Before finalizing a paper, check whether a structured injury tissue/type or location table contains directly fillable compatible rows. Fill all compatible rows rather than stopping after only the broadest categories.
- Do the same figure-by-figure check for structured injury tissue/type and location rows. If a paper reports usable counts in figures rather than tables, fill the cleanly mappable structured rows from the figure instead of leaving them blank.
- When figure categories are broader or combined in a way that does not map cleanly to the schema, fill only the rows that are clearly justified and note which combined categories were intentionally not forced into narrower rows.
- If multiple reported subrows clearly belong to the same structured location or tissue/type category and share the same denominator, aggregate them into the matching structured category.
- If the paper explicitly reports key diagnoses such as concussion or anterior cruciate ligament (ACL) injury, populate the matching structured row or diagnosis row instead of leaving it blank.
- Do not duplicate a diagnosis in the free-text `injury diagnosis` row when that same condition is already captured in a structured row. For example, if `concussion` is already filled in the concussion row, do not repeat `concussion` in the diagnosis row unless the paper reports a separate more specific diagnosis that is not otherwise captured.
- If the source reports days lost per injury or severity by injury type or location, populate the matching severity field using the statistic actually reported.
- If the source reports mean days, enter the plain value. If the source reports median days, label it clearly in the value and mention that in the review summary or note.
- Do not treat the use of a medical-attention or time-loss definition alone as evidence that separate medical-attention and time-loss count fields should be filled. Only fill those separate count fields when the paper reports separate counts.
- Treat acute/traumatic onset as `injuryModeAcuteSudden` and overuse onset as `injuryModeRepetitiveGradual` only when the paper explicitly frames the mechanisms that way.
- If the source only supports a sparse pass, save the clearly justified headline values and leave the rest blank rather than forcing uncertain mappings.
- For older or OCR-poor papers, prefer direct text-supported rows only. Note limitations in the backlog entry.
- Re-check exclusions carefully. "Football" in older papers can mean American football; do not assume association football from the title alone.

## Manual Tabs

- `injuryOutcome`
- `illnessOutcome`
- `injuryTissueType`
- `injuryLocation`
- `illnessRegion`
- `illnessEtiology`
