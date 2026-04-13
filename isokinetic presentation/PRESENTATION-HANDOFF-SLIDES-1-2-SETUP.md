# Isokinetic Presentation Handoff Summary

## Current state

This presentation workspace now contains:

- individual Remotion slide compositions
- a combined deck composition
- reusable blue and white Remotion background shells
- a design brief that defines the recurring slide system
- the local branding assets currently in use

The presentation is being built inside:

- `isokinetic presentation/`

## Existing slide compositions

- `slides/TitleSlide.tsx`
- `slides/TeamSlide.tsx`
- `slides/BlueBackgroundShell.tsx`
- `slides/WhiteBackgroundShell.tsx`
- `slides/HeaderBrandLockup.tsx`

## Existing combined deck

- `Deck.tsx`

The Remotion root currently exposes:

- `TitleSlide`
- `TeamSlide`
- `Deck`

## Active visual rules

- Alternate slide themes by default: blue slide, then white slide, then blue slide
- Keep the football pitch motif across the deck
- On white slides, render the pitch motif in blue
- On blue slides, keep the current deep teal / FIFA-blue language
- Keep the header consistent across the deck
- Use the title-slide header as the baseline header reference
- Keep the UCD and FIFA logos centred in the top header on every slide
- The header is locked: do not move it, resize it, restyle it, recolour it, or reinterpret it on individual slides unless explicitly instructed
- Treat `BlueBackgroundShell.tsx` and `WhiteBackgroundShell.tsx` as the source of truth for all background builds
- Treat `TitleSlide.tsx` and `TeamSlide.tsx` as the source-of-truth examples for how those shells are used in real slides
- Keep the UCD logo overlaid in the same centred header position and at the same size used in the current title and team slides
- Do not place slide numbers in the bottom right corner or anywhere else in the deck
- From slide 3 onward, animation quality should be very high: clean, polished, impressive, and academically controlled
- Build slides in reveal layers so elements can appear on speech cues / click cues rather than everything landing at once
- Each new slide should have a loose mini-script and a staged reveal plan aligned to speaking beats
- Prioritize auditorium readability at all times: avoid small unreadable elements, especially for emphasis points, labels, and key figures
- Any element carrying the main message should be large, clear, and visible from the back of a large room
- Any slide using paper-derived evidence, quotes, or figures must carry a clear and tidy bottom-of-slide reference
- References should be integrated elegantly into the footer area, not dropped in as awkward tiny footnotes
- If needed, the deck can end with a bibliography / references slide for full citations
- Use European / Irish-English spelling throughout the deck and all supporting notes
- Prefer spellings with `s` rather than `z` where applicable, for example `standardised`, `centralised`, and `harmonisation`

## Important workflow rule

Do not render, preview, inspect screenshots, or verify visual output unless the user explicitly asks.

Default behaviour for future slide work:

- edit the code directly
- do not run `remotion still`
- do not open rendered images
- do not do visual verification passes unless requested

## Current assets in use

- `assets/branding/ucd-logo.png`
- `assets/branding/fifa-logo.png`
- `assets/branding/fifa-brand-panel.jpg`
- `assets/branding/from-pptx/ppt/media/image1.jpg`

## Recommended next slide

According to the execution brief, the next slide after the team slide should be the mismatch / problem-framing slide:

- football is global
- the evidence base is not yet globally integrated

That corresponds to the execution-brief logic for early Group A.

## Current working narrative structure

The current intended story flow for the next problem-to-solution run is:

- Slide 3: use the FIFA surveillance-map paper to show that surveillance activity is real, but patchy and incomplete; then show that the prospective literature reflects the same concentration pattern
- Slide 4: compare the FIFA paper and the literature again across structural dimensions such as sex, age/level, and outcome coverage so the audience sees that the imbalance is systemic, not only geographic
- Slide 5: pivot into the value proposition of FIFA GBI  -  a standardised, centralised, living evidence system for the global game

For the value proposition, keep two points clear:

- immediate value: a standardised, centralised evidence base for injury and illness in football
- preferred value line: "It turns scattered football health evidence into standardised, comparable, continuously updating evidence."
- scale/value framing: this can be presented as the biggest systematic review of its kind when that helps the audience understand the scale of what FIFA GBI is building
- system framing: present it as a central knowledge base for the global burden of injury and illness in football, not just another review output
- analytical value: once the evidence is structured centrally, stronger hierarchical / Bayesian modelling becomes possible in sparse settings, with explicit uncertainty
- enabled estimation framing: this system can eventually support estimation across sexes, ages, places, and, where appropriate, over time

Important framing:

- do not oversell modelling as a substitute for real surveillance
- present it as something the evidence system enables while surveillance capacity remains uneven
- keep bringing the talk back to this value proposition so the preliminary evidence feels purposeful rather than disconnected

## Key reference files for a fresh chat

- `slides/00-design-brief.md`
- `slides/01-presenter-and-team.md`
- `03-execution-brief.md`
- `Root.tsx`
- `Deck.tsx`
- `slides/BlueBackgroundShell.tsx`
- `slides/WhiteBackgroundShell.tsx`
- `slides/HeaderBrandLockup.tsx`
- `slides/TitleSlide.tsx`
- `slides/TeamSlide.tsx`

## Notes for the next agent

- Preserve the current header language unless the user explicitly wants it changed
- Treat the header as untouchable by default: never move, resize, restyle, recolour, or redesign it unless the user explicitly asks
- Preserve the blue/white alternation system unless the user overrides it
- Use the existing blue and white shell components as the background source of truth rather than rebuilding slide backgrounds ad hoc
- Reuse the current centred UCD-over-FIFA header lockup positioning and scale unless the user explicitly changes it
- Do not add slide numbers to slides
- Add new slides both as individual compositions and into `Deck.tsx`
- Avoid reintroducing raw manuscript-style layouts for content slides
- When building a slide, plan the reveal order with the speaking structure first, then implement the animation
- Default reveal sequence: base frame, main claim, primary visual/evidence, secondary emphasis/annotation, final takeaway line
- If an element matters to the argument, scale it up rather than shrinking it to fit
- Keep a visible value-throughline: the problem slides must clearly set up why FIFA GBI matters
- If a piece of information does not help the audience understand the problem, the value, or the transition between them, it should not be on the slide
- If a slide takes a figure, quote, or claim from a paper, cite that paper clearly at the bottom of the slide and keep the citation styling neat and readable
- Keep reminding the audience that the preliminary signals are there to demonstrate the need for this living evidence system and what it can make visible
