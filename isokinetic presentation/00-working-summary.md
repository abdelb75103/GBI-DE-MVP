# Isokinetic Presentation Working Summary

## Current status

This project is now in an active **slide-by-slide review and export phase**.

The live Remotion deck remains the source of truth for visuals:

- `/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation`

The active review workspace for readable notes and workflow lives in the Desktop Obsidian vault:

- `/Users/abdelbabiker/Desktop/Obsidian Vault/Isokinetic 2026 Presentation`

The desktop PowerPoint deck for final assembly is:

- `/Users/abdelbabiker/Desktop/Isokinetic V5BI 2026.pptx`

The emergency stills-only backup deck is:

- `/Users/abdelbabiker/Desktop/Isokinetic V5BI 2026 Stills Backup.pptx`

The slide asset export folder is:

- `/Users/abdelbabiker/Desktop/Isokinetic V5BI 2026 Assets`

## What is already in place

- Remotion Studio is used to review the live slides visually.
- A full Obsidian workspace was created with:
  - master speaker notes
  - numbered per-slide notes
  - master audience Q&A
  - animation/export workflow note
  - slide review tracker
  - compact source context
- Slide 1 and Slide 2 have already been:
  - reviewed
  - exported into the desktop PowerPoint
  - given presenter notes inside PowerPoint
- Slide 1 and Slide 2 currently use **native high-resolution still exports** at `7680 x 4320`.

## Current deck workflow

For each slide:

1. Review the live visual in Remotion Studio.
2. Revise the per-slide note in Obsidian.
3. **Also update `00 - Master Speaker Notes.md` whenever any slide note changes.**
4. Keep speaker notes in PowerPoint as **short cue bullets only**, not long paragraphs.
5. For static slides, export one crisp still.
6. For animated slides, use a fixed `3-slide` pattern from now on:
   - opening still
   - one animation video
   - ending still
   - exception only when a slide needs a real speaking pause before a final emphasis state:
     - opening still
     - one animation video
     - frozen still
     - final emphasis still
7. Keep PowerPoint notes on the still slides only.
8. Add the exported asset(s) to the desktop PowerPoint deck(s).
9. Add concise presenter notes into the PowerPoint notes pane.
10. Update the review tracker in Obsidian.

## Export rules learned so far

- PowerPoint quality matters a lot for text-heavy slides.
- The initial 1920x1080 stills looked too soft in PowerPoint.
- For Slides 1 and 2, native Remotion stills with `--scale=4` produced `7680x4320` PNGs and looked materially sharper.
- File size is still manageable at this stage, but this should be balanced slide by slide rather than applied blindly to the whole deck.
- For future slides:
  - prefer the highest practical quality that remains manageable
  - use native high-resolution exports rather than post-upscaling when possible
  - keep an eye on cumulative PowerPoint size
- Do not use GIFs for transition playback.
- Do not use multi-step video fragments by default for animated slides.
- Do not embed oversized ProRes `.mov` files directly into the active main `.pptx`.
- The main deck previously grew to `2.18 GB` and triggered a PowerPoint repair prompt.
- Keep the active main deck in a PowerPoint-safe size range by using high-quality `.mp4` motion embeds for the current working deck.
- For animated slides:
  - export the opening and ending frames as native high-resolution PNG stills
  - export one motion clip for the animated portion of the slide
  - keep the opening frame of the motion clip identical to the opening still
  - add a short cloned-frame start hold and a longer cloned-frame end hold inside the rendered video
  - use `tpad=start_duration=0.4:start_mode=clone:stop_duration=1:stop_mode=clone` to avoid black-frame flashes at playback start while keeping the post-animation linger short
  - the older `stop_duration=3` tail-hold exports are now deprecated and should not be reused
- Keep the active deck set as:
  - main deck = working presentation deck
  - stills backup = emergency no-motion fallback
- Ignore the separate compatibility deck for now.
- This `opening still -> one animation video -> ending still` structure is now the standard export workflow for animated slides.
- Approved exception:
  - Slide 07 `Eligibility` now uses `opening still -> pre-highlight video -> frozen full-criteria still -> highlighted-two-points still`
  - this exception is only for slides that need a real speaking pause before a final emphasis state
- Active timing rule:
  - motion slides should auto-advance to their following still about `1 second` after the visual animation completes
  - PowerPoint `advTm` should match the actual rebuilt media duration, with no extra PPT-only delay layered on top
- Current repair state:
  - the main deck was rebuilt cleanly on `2026-04-15`
  - PowerPoint now opens `/Users/abdelbabiker/Desktop/Isokinetic V5BI 2026.pptx` without a repair dialog
  - the stills backup deck remained clean and readable throughout

## Speaker notes rules learned so far

- Obsidian notes can stay fuller for drafting.
- PowerPoint presenter notes should be **minimal speaking cues** only.
- Presenter notes should be:
  - short
  - scannable
  - label-led where useful, for example:
    - `PROJECT:`
    - `TOPIC:`
    - `MESSAGE:`
- Do **not** paste long roadmap paragraphs into PowerPoint notes.

## Slide status

- Slide 01 `Title`:
  - reviewed
  - exported to PowerPoint
  - PowerPoint presenter notes added
- Slide 02 `Project Team`:
  - reviewed
  - exported to PowerPoint
  - PowerPoint presenter notes added
- Slide 03 `Problem Framing - Surveillance`:
  - rebuilt as the opening half of the split problem-framing sequence
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - cue-only PowerPoint notes added on the still slides
- Slide 04 `Problem Framing - Literature`:
  - rebuilt as the second half of the split problem-framing sequence
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - cue-only PowerPoint notes added on the still slides
- Slide 05 `GBI Intro`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck variant built
  - stills backup updated
  - cue-only PowerPoint notes added on still slides
- Slide 06 `Methods System`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - cue-only PowerPoint notes added on still slides
- Slide 07 `Bayesian Approach`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - cue-only PowerPoint notes added on still slides
- Slide 08 `Eligibility`:
  - reviewed
  - revised as a controlled exception to the default animated export rule
  - exported to PowerPoint using `still -> video -> still -> still`
  - main deck sequence updated with a freeze before the final highlight beat
  - stills backup updated with separate frozen and highlighted states
  - PowerPoint notes updated to distinguish the broad-criteria pause from the two-point emphasis pause
- Slide 09 `Search and Screening`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - cue-only PowerPoint notes added on still slides
- Slide 10 `Extraction Breakdown`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - cue-only PowerPoint notes added on still slides
- Slide 11 `Extraction Framework`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 12 `Extraction Challenges`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 13 `Papers Timeline - Overall`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 14 `Papers Timeline - Excluded Overlay`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 15 `Women Timeline`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 16 `Discipline Breakdown`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 17 `Injury Definition Use`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 18 `Distribution of Evidence`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 19 `Closing - What We Need`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 20 `Closing - Next Steps`:
  - reviewed
  - exported to PowerPoint using `still -> video -> still`
  - main deck sequence added
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 21 `Thank You`:
  - reviewed
  - exported to PowerPoint as a still slide
  - main deck appended
  - stills backup updated
- Slide 22 `Appendix Surveillance Programme Counting`:
  - reviewed
  - exported to PowerPoint as a still slide
  - main deck appended
  - stills backup updated
  - PowerPoint notes upgraded to three short, informative bullets
- Slide 10 onward:
  - exported through Slide 22 in the current slide-by-slide export pass
- Animated slide timing refresh:
  - the animated slide sequences in the active main deck were rebuilt on `2026-04-15` to shorten the cloned end hold from about `3s` to about `1s`
  - the stills backup deck was left unchanged because it has no video dependency

## Important content rules

- Stay within **Phase 1** of the FIFA Global Burden of Injury and Illness in Football project.
- Keep the talk focused on the living systematic review.
- Keep the dashboard secondary.
- Treat provisional data as provisional.
- The surveillance-map paper is framing context, not the main topic.
- Keep terminology consistent:
  - living systematic review
  - living evidence system
  - standardised
  - centralised
  - comparability

## Immediate next step

Use the current **animated-slide three-slide sequence** as the active model:

- opening still
- one animation video
- ending still
- cue-only notes on the still slides

Exceptions already in use:

- Slide 08 `Eligibility` uses:
  - opening still
  - pre-highlight video
  - frozen full-criteria still
  - highlighted-two-points still

Appendix handling:

- Slide 22 remains a still appendix slide with concise notes in both PowerPoint files
