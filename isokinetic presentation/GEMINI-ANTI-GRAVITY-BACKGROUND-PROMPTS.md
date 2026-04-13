# Gemini Anti-Gravity Background Prompts

Use this file when generating the reusable slide background plates in Gemini / Anti-Gravity with Nano Bana Pro.

## Reference Inputs

- Attach this screenshot for Prompt 1: `assets/reference/title-slide-background-reference.jpg`
- Attach the approved blue master for Prompt 2: `assets/backgrounds/slide-bg-blue.png`

## Target Outputs

- `assets/backgrounds/slide-bg-blue.png`
- `assets/backgrounds/slide-bg-white.png`

## Workflow

1. Run Prompt 1 with the screenshot attached.
2. Review the blue master for layout fidelity.
3. Run Prompt 2 with the approved blue master attached.
4. Overlay the real UCD crest afterward if exact logo fidelity is needed: `assets/branding/ucd-logo.png`

## Prompt 1

```text
I am attaching a screenshot reference. Use that screenshot as the exact composition reference for this task.

Create a single reusable 16:9 background image for a presentation deck in 1920x1080 PNG.

Important: I do NOT want you to recreate the full slide with title text and presenter text. I only want the background system and header shell from the screenshot, so that I can overlay my own slide content on top later.

What to match exactly from the screenshot:
- The overall background composition and proportions
- The deep teal / blue gradient atmosphere
- The top header band
- The thin divider line under the header
- The centred header branding area
- The large subtle FIFA watermark in the upper middle-right area
- The subtle football pitch line motif in the background
- The clean open content area on the left and center of the slide

What I want included:
- The full background treatment
- The header shell
- The small left header text area and small right header text area as part of the background system
- A reserved centred space for the UCD crest so I can overlay the real logo later if needed
- The FIFA watermark and pitch motif exactly in this visual language

What I do NOT want:
- No large main title
- No presenter name
- No affiliation text in the main body
- No extra icons, photos, people, charts, or new decorative elements
- No redesign or reinterpretation of the layout
- No alternative composition

Quality bar:
- This should feel as close as possible to the screenshot, not loosely inspired by it
- Academic, premium, restrained, clean
- Low-noise background so slide content can sit on top clearly
- Keep the content-safe area open and readable

Return only one finished blue background image.
```

## Prompt 2

```text
Use the approved blue background image as the master reference for geometry, spacing, and placement.

Create a second reusable 16:9 background image in 1920x1080 PNG that is the exact white-theme twin of the blue version.

Important: this should NOT be a new design. It should be the same background, same layout, same header, same watermark position, same pitch motif placement, same spacing, and same reserved crest area, but with the colors reversed into a white-theme version.

What to keep exactly the same:
- Header band structure
- Divider line placement
- Reserved centred crest position
- FIFA watermark position and scale
- Football pitch motif position and scale
- Overall geometry and composition
- Open content-safe area for overlay text

Color transformation required:
- Convert the dark blue background into a white / near-white background
- Convert structural accents into FIFA blue and soft blue tints
- Keep the FIFA watermark, but render it as a refined subtle blue gradient on the white background
- Keep the pitch motif visible in blue, not grey and not removed

What I do NOT want:
- No new layout
- No new graphic elements
- No main title text
- No presenter text
- No extra content
- No loose interpretation

Quality bar:
- It must match the blue version perfectly as its inverted twin
- Clean, controlled, scientific, high-end presentation background
- Ready for consistent use across all white slides

Return only one finished white background image.
```

## Notes

- The screenshot is the source-of-truth reference for composition.
- The reusable background should keep the header shell but remove slide-specific body content.
- The UCD crest is intentionally left for manual overlay so the official logo stays sharp and consistent.
