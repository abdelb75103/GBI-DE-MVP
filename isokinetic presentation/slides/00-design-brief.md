# Isokinetic 2026 Presentation Design Brief

## Purpose

This brief defines the visual system for the FIFA GBI Living Systematic Review conference talk at Isokinetic 2026. It translates the rules in `03-execution-brief.md` into practical design decisions for slide build, Remotion scene design, and script alignment.

The presentation must read as a scientific keynote, not a product launch, dashboard demo, or software walkthrough.

## Non-negotiable design rules

- Stay within Phase 1 throughout.
- White or near-white background on every slide.
- High contrast text at all times.
- FIFA blue is the primary accent colour.
- UCD and FIFA branding should appear consistently across the deck.
- Isokinetic branding does not need to appear on every slide.
- One idea per slide.
- Motion must clarify structure, not decorate.
- Motion quality should feel premium, polished, and high-control rather than generic or decorative.
- Build slides to support staged reveals tied to speech cues or click cues.
- Slides must be readable in a large auditorium: do not rely on small text, tiny labels, or delicate emphasis elements.
- When something matters, make it large, clear, and immediately legible from the back of the room.
- Any provisional-data slide must carry a persistent preliminary-data footer.
- Keep the project's value proposition visible throughout the deck: a living, centralised evidence system for the global burden of injury and illness in football, not just another review.
- A preferred value line for slides and narration is: "It turns scattered football health evidence into standardised, comparable, continuously updating evidence."
- When the story needs scale language, it is acceptable to frame FIFA GBI as the biggest systematic review of its kind, but only in support of the infrastructure argument.
- When modelling/analytics are mentioned, frame them as an enabled capability of the centralised system: it can support estimation across sexes, ages, places, and, where appropriate, over time, with explicit uncertainty.
- Preliminary visuals should help the audience understand why this system matters and what it makes visible.
- Use European / Irish-English spelling across slide copy, prompts, notes, and labels.
- Prefer `s` spellings rather than `z` spellings where applicable, for example `standardised`, `centralised`, `harmonisation`, and `visualisation`.
- Any slide that uses a paper's quote, figure, table result, or numerical claim must include a clear source note at the bottom of the slide.
- Source notes should feel elegant, tidy, and integrated into the slide footer rather than bolted on awkwardly.
- Citations must still be readable on projection: do not hide them in tiny footnote text.
- Do not render, preview, inspect screenshots, or run visual checks unless the user explicitly asks.

## Core visual direction

The visual tone should feel academic, contemporary, and controlled.

- Background: alternate between deep blue theme slides and white theme slides
- Primary text: near-black or deep charcoal
- Accent: FIFA blue
- Supporting neutral: cool grey for rules, labels, footers, and secondary metadata
- Layout: generous whitespace, clean alignment, minimal ornament
- Style: institutional, credible, calm, high-signal

This deck should feel like a global research keynote with brand discipline, not like a startup pitch deck.

## Slide alternation system

The deck should alternate visual temperature from slide to slide to keep attention and pacing active.

- Odd-numbered slides: blue-theme slides
- Even-numbered slides: white-theme slides
- This alternation is the default unless a specific slide has a strong reason to break the pattern

### Blue-theme slides

- Use the existing deep teal / FIFA-blue background treatment
- White or very light text
- FIFA-blue and Isokinetic-cyan accents can remain subtle within the blue field
- Keep the current title-slide atmosphere as the reference for blue slides
- Use `BlueBackgroundShell.tsx` as the implementation source of truth for blue-slide background behaviour

### White-theme slides

- Use a white or near-white background
- Use dark text for maximum contrast
- Keep blue icons, blue chart fills, blue dividers, and blue pitch graphics
- The pitch motif should invert into blue on white, not disappear
- Use `WhiteBackgroundShell.tsx` as the implementation source of truth for white-slide background behaviour

The aim is not to make every slide look different. The aim is to create a controlled two-state system:

- dark, immersive blue
- bright, clean white

## Isokinetic theme reference

The Isokinetic conference poster should inform the deck's mood, not become persistent slide chrome.

- Use the poster to guide accent tone, contrast balance, and title-slide atmosphere.
- Do not place the full Isokinetic poster or event artwork on every slide.
- Use Isokinetic visual influence primarily on Slide 1 and possibly section-divider moments only if needed.
- Keep the main deck lighter, cleaner, and more academic than the poster.

## Proposed design tokens

Use these as the starting system for Remotion styles and shared slide components.

- Background: `#FFFFFF`
- Surface tint: `#F7F9FC`
- Primary text: `#111827`
- Secondary text: `#4B5563`
- Divider / rule: `#D7DFEA`
- Preliminary footer text: `#5B6678`
- FIFA blue primary: `#0057B8`
- FIFA blue dark: `#003D82`
- FIFA blue tint: `#EAF2FF`
- Isokinetic deep teal reference: `#0E3447`
- Isokinetic gold reference: `#B79A5B`
- Isokinetic cyan reference: `#1EA7F2`

Note: the exact FIFA brand hex still needs confirmation before final render lock.

## Typography direction

Use a modern sans-serif with strong legibility and clean numerals. The type system should support a calm keynote look rather than expressive editorial styling.

Recommended structure:

- Title style: bold, large, compact line height
- Section title style: semibold, high contrast, short phrases
- Body style: medium weight, large enough for conference readability
- Data labels: direct labelling, no tiny legends
- Metadata style: smaller, muted, still readable on projection
- Prefer fewer, larger, clearer elements over many small ones

Working font recommendation for build:

- Primary: `Inter`
- Alternate if needed: `Source Sans 3`

## Slide chrome

Every slide should use the same baseline frame so the branding is present without becoming noisy.

### Header zone

- Keep a consistent top header on every slide
- Center the UCD and FIFA logos in the header band as a paired branding lockup
- Keep the paired logos visually centred on the page
- Keep the logos aligned to each other vertically so the header feels seamless
- Keep `Isokinetic 2026` in the header as supporting event context
- The logos should be present on every slide, not just the title slide
- Keep the header height consistent across the full deck
- Use the same header structure, spacing, and logo treatment on every slide by default
- Do not redesign the header slide by slide unless there is a very strong reason
- Treat the header as locked by default: never move, resize, recolour, restyle, or reinterpret it unless explicitly instructed

### Header behaviour

- The centred UCD/FIFA logo pair is now the default header system for the full deck
- The logos should feel like a quiet premium brand strip, not a dominant banner
- Supporting header text should stay restrained so the logos remain the visual anchor
- Do not let logos cross divider lines or sit awkwardly between header and content zones
- The current title-slide header should be treated as the baseline reference for all later slides
- Later slides should inherit that same header language rather than inventing new header variants
- Background polishing and slide-specific redesign should happen beneath the header rather than altering the header itself
- The current `TitleSlide.tsx` and `TeamSlide.tsx` implementations are the source-of-truth examples for shell usage and centred logo overlay placement
- The UCD crest should remain overlaid in the same centred header position and at the same scale used in the current slide implementations unless explicitly changed

### Footer zone

- Do not show slide numbers in the deck footer
- Keep the footer visually quiet and structural only unless a slide has a specific approved footer need
- When a slide uses evidence, quotes, or figures from a paper, use the footer zone for a clean bottom-of-slide citation
- Keep citation styling restrained and seamless, but readable enough for an auditorium setting
- If the talk accumulates multiple cited papers, add a bibliography / references slide at the end as needed

Brand marks should be clean, aligned, and visually subordinate to the main content even when centred in the header.

## Persistent pitch motif

The football pitch motif should stay present across the deck as a recurring visual anchor.

- On blue slides, keep the pitch motif in a darker or low-contrast blue treatment
- On white slides, keep the same pitch motif in FIFA blue or a softer blue tint
- The pitch motif should sit quietly in the composition, usually toward the right or lower-right
- It should support continuity, not compete with the slide message

This motif is part of the presentation language and should be considered by default on every slide build.

### Brand behaviour

- Use monochrome or single-colour brand marks where possible
- Prefer blue or neutral brand rendering over full-colour logo clutter
- Keep opacity and size restrained so the slide still reads as content-first
- Do not let logos compete with titles, charts, or conclusion statements
- Isokinetic can be referenced in top metadata or title-slide event text rather than as a persistent footer logo
- The one exception is the UCD logo, which can remain in full colour when it improves clarity and institutional presence

## Layout system

Build a single reusable slide shell in Remotion with content slots.

Recommended structure:

1. Safe outer margin
2. Slim top metadata band
3. Main content frame
4. Optional support caption or source note band
5. Branded footer band

Suggested layout proportions for 16:9 slides:

- Outer margin: 72 to 96 px
- Header band: 72 px
- Footer band: 88 to 100 px
- Main content area: everything between header and footer

## Content rules by slide type

### Title slide

- Strong title block
- Subtitle with `Phase 1 Only`
- Presenter, affiliation, and event details
- Branding in footer
- Visual accent can draw from the Isokinetic poster: deep teal field, restrained gold detail, and a cleaner adaptation of the poster's classical-athletic mood
- The title slide may incorporate the Isokinetic event mark or a cropped thematic image treatment if it remains secondary to the talk title
- The title slide should remain a blue-theme slide

### Statement slides

- One dominant sentence or claim
- Large type
- Minimal supporting text
- Strong whitespace discipline
- Follow the deck alternation system unless there is a compelling composition reason not to

### Process slides

- Use simple node-based systems
- FIFA blue for active path
- Neutral grey for support structure
- Animate with draw-on and sequential highlights
- White-theme process slides are preferred unless a section transition benefits from a blue-theme slide

### Data slides

- White background
- Direct labels on bars or marks
- Horizontal bar charts preferred
- No legends unless unavoidable
- No pie charts
- Whole numbers only on provisional slides
- Persistent preliminary footer whenever provisional data appears
- White-theme slides are the default for data slides unless a specific exception is justified

### Closing takeaway slides

- One sentence only or one sentence plus a small supporting line
- Heaviest typographic emphasis in the deck
- Branding remains present but quiet
- Either theme can work here, but the final choice should respect the alternating rhythm unless the closing slide is intentionally made blue for emphasis

## Remotion motion rules

Motion should support comprehension and pacing.

- Preferred transitions: opacity fades, horizontal wipes, line draw-ons, staged reveals
- Avoid: bounce, overshoot, 3D movement, flashy parallax, aggressive morphs
- Key claims: slower, more deliberate timing
- Data builds: moderate pacing with direct reveals
- Section changes: clean tempo shift, not spectacle

### Scene behaviour

- Each slide should have one primary motion idea
- Each slide should also have a loose mini-script and reveal plan mapped to speaking beats
- Animations should never imply stronger evidence than the slide supports
- Results visuals build in place rather than morphing across categories
- Persistent elements like footer branding and preliminary labels should remain stable across scenes
- Prefer layered reveal structure: base frame first, then the main claim, then evidence/visual structure, then secondary emphasis, then the closing line or takeaway
- Design the static composition and the reveal order together rather than adding animation after layout is complete
- Emphasis elements should enlarge and clarify the argument, not become smaller or denser during a reveal

## Brand application rules

### FIFA blue usage

Use FIFA blue for:

- section headings
- chart fills
- active timeline nodes
- key sentence emphasis
- structural lines and dividers in selected slides

Do not use FIFA blue as a full-slide fill or heavy background.

### UCD, FIFA, and Isokinetic presence

UCD and FIFA should be present consistently.

- UCD: institutional affiliation anchor
- FIFA: project ownership and research program credibility
- Isokinetic: event context, primarily through title-slide treatment and metadata

The correct approach is consistency, not prominence.

## Team slide rule

When building the team slide:

- Do not title it `Authors and affiliations`
- Use a cleaner presentation title such as `The team` or `Project team`
- Present the team in a way that feels like an academic keynote slide, not a manuscript block
- The full author-and-affiliation source text can inform the slide, but it should be reformatted for elegance and readability

## Preliminary data treatment

All results-oriented slides in Section D must include:

- A persistent footer label: `Preliminary data - current extraction, under cleaning`
- Muted but readable styling
- No decimals
- No locked epidemiological claims

The label should sit above or within the footer band and remain visually consistent across all relevant slides.

## Asset requirements

These assets need to be provided or confirmed before final visual build:

- Isokinetic logo or event mark file
- Final presenter name and affiliation line
- Final co-author list for the acknowledgments slide
- Confirmed FIFA blue brand hex if strict brand compliance matters

Preferred asset format:

- `SVG` first
- `PNG` with transparency if SVG is unavailable

Current local assets already prepared in `assets/branding/`:

- `ucd-logo.png`
- `fifa-logo.png`
- `fifa-brand-panel.jpg`

Store all approved assets in `assets/branding/`.

## Recommended folder use

- `slides/`: per-slide build docs and scene specs
- `speaker-notes/`: per-slide script
- `assets/branding/`: logos and lockups
- `assets/charts/`: exported or generated chart assets if needed
- `assets/maps/`: geography visuals or map layers

## Build sequence

1. Confirm and collect branding assets
2. Build a base Remotion slide shell
3. Build title slide
4. Build each content slide one by one
5. Write the matching script in parallel
6. Rehearse timing and cut optional slides if needed

## Render policy

- Default to code edits only
- Do not render Remotion stills unless the user explicitly asks
- Do not inspect screenshots or run visual QA unless the user explicitly asks
- Assume visual verification is opt-in, not automatic

## Immediate next step

After this brief, the next artifact should be a reusable slide shell spec or Slide 1 build doc, depending on whether you want to lock the design system in code before content production.
