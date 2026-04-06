# No Exposure Review Workflow

Use this workflow when reviewing papers listed in the flagged-papers review summary under exposure-related concerns.

## Goal

Decide whether a paper should:

- stay `extracted`
- be retagged to `no_exposure`
- be repaired as an `extracted` paper using a clearly documented derived denominator

The key rule is consistency: use exposure-time denominators when they are directly reported or can be derived defensibly. If they cannot be derived defensibly, do not force them.

Important distinction:
- exposure collected in the study methods does not automatically make a paper usable for extraction
- the paper must publish usable exposure totals, a time-based incidence/burden result, or enough reported information for a defensible derivation
- if exposure was only collected operationally but not reported in a usable way in the paper, treat it as `no_exposure`

## Step-by-Step Procedure

1. Open the live paper record.
   - Check `status`
   - Check `flag_reason`
   - Check paper notes
   - Check current extraction fields, especially:
     - `incidenceDefinition`
     - `exposureMeasurementUnit`
     - `totalExposure`
     - `matchExposure`
     - `trainingExposure`
     - `injuryIncidenceOverall`
     - `injuryIncidenceMatch`
     - `injuryIncidenceTraining`

2. Check the source paper directly.
   - Do not rely only on the old flag note.
   - Confirm what denominator the paper actually reports:
     - per `1000 player-hours`
     - per `1000 athletes`
     - per player-season
     - per squad-season
     - percentage of players injured
     - average exposure only
     - no denominator at all
   - Separate these two questions:
     - Was exposure-time data collected in the study?
     - Does the published paper report usable exposure-time values or a time-based incidence result?
   - Only the second question determines whether the paper can remain `extracted`.

3. Classify the paper into one of three buckets.

### A. Direct exposure-time paper

Use this when the paper directly reports usable exposure-time denominators or direct incidence per time.

Examples:
- total/match/training exposure in hours
- incidence per `1000` hours
- burden per `1000` player-hours

Not enough on its own:
- a methods statement saying exposure minutes or hours were collected, if the results do not publish usable totals or time-based incidence

Action:
- keep or restore status to `extracted`
- clear `flag_reason`
- fix any mixed-denominator fields
- add a note stating what denominator the paper reports

### B. Defensible derived exposure-time paper

Use this when the paper does not directly print every exposure field, but a defensible derivation is possible from reported data or stable public competition structure.

Allowed only when all of the following are true:
- the derivation is simple and transparent
- the denominator frame is unambiguous
- the standard football exposure formula is appropriate
- the result can be explained in one sentence

Examples:
- match exposure derived from official match counts using `11 x 1.5 x 2` player-hours per match
- total exposure derived from direct injury count and direct incidence where the unit is clearly stated

Action:
- keep or restore status to `extracted`
- clear `flag_reason`
- store only the derived fields that are truly defensible
- leave non-derivable fields blank
- add a note that the value was derived and from what source/frame

Important:
- do not derive training exposure from vague “average weekly exposure” language unless the paper gives enough information to reconstruct it cleanly
- do not mix player-based percentages into exposure-time incidence fields

### C. No-exposure paper

Use this when the paper does not provide a usable exposure-time denominator and no defensible derivation is possible.

Common examples:
- incidence per `1000 athletes`
- incidence per player-season
- incidence per squad-season
- percentage of players injured
- average exposure only
- counts only with no denominator
- methods say exposure was collected, but the paper does not publish usable totals, player-hours, or a time-based incidence result

Action:
- retag the paper to `no_exposure`
- clear `flag_reason`
- add a note stating exactly what denominator the paper reports
- update the flagged-papers review summary markdown

## Field Rules

1. Never leave mixed denominators in the same incidence block.
   - If `injuryIncidenceOverall` is actually `% injured players`, clear it.
   - Keep only the fields that match the exposure-time denominator standard.

2. If only match exposure is derivable:
   - fill `matchExposure`
   - fill `injuryIncidenceMatch` if defensible
   - leave `totalExposure`, `trainingExposure`, and `injuryIncidenceOverall` blank if they are not defensible

3. If the paper reports athlete-based risk and time-based match incidence:
   - store the time-based incidence fields only
   - move the athlete-based wording into `incidenceDefinition` or a note

4. If the paper has subgroup rows and pooled rows:
   - prefer the denominator frame that supports the cleanest internally consistent extraction
   - if needed, collapse to a pooled row rather than keeping subgroup rows with incompatible denominator frames

## Required Cleanup After Every Review

After every paper review:

1. Set the final `status`
2. Clear `flag_reason` if the paper is no longer actively flagged
3. Add a paper note summarizing:
   - what the paper reports
   - what was kept
   - what was cleared
   - whether anything was derived
4. Update `exports/flagged-papers-review-summary-2026-04-06.md`
   - append `✅ Reviewed and dealt with`
   - state the actual reported denominator
   - state whether the paper stayed `extracted` or was moved to `no_exposure`
   - if exposure was collected but not published in a usable way, say that explicitly so the next review does not mistake it for an exposure-time paper

## Default Decision Rule

If there is doubt, do not force an exposure-time denominator.

- Clear and direct derivation: include it and document it.
- Unclear or assumption-heavy derivation: do not include it; tag `no_exposure`.
