# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Remotion presentation for the FIFA GBI Living Systematic Review talk at Isokinetic 2026. Target: 16-21 slides, ~18-minute academic keynote. All compositions are 1920×1080 at 30fps.

## Commands

All commands run from `isokinetic presentation/`:

```bash
npx remotion preview          # Live preview in browser
npx remotion still <CompId>   # Export single frame of a composition
npx remotion render <CompId>  # Render video
```

Composition IDs registered in `Root.tsx`: `TitleSlide`, `TeamSlide`, `Deck`, `BlueBackgroundShell`, `WhiteBackgroundShell`. New slides must be added to both `Root.tsx` (as a `Composition`) and `Deck.tsx` (as a `Sequence`).

## Architecture

### Shell System

Two reusable background shells provide the alternating blue/white visual rhythm:

- **`BlueBackgroundShell`**  -  deep teal (`#061B28`) with layered radial gradients, right-anchored football pitch SVG motif in low-opacity strokes. Used for odd-numbered slides.
- **`WhiteBackgroundShell`**  -  white (`#FFFFFF`) with soft blue radial washes, pitch motif inverted to blue at very low opacity. Used for even-numbered slides.

Both shells accept `centerOverlay` (header branding) and `children` (slide content). They handle all background rendering, header chrome, and the pitch motif. Never rebuild backgrounds ad hoc outside these shells.

### Header and Brand Lockup

- **`HeaderBrandLockup`**  -  renders the centred UCD logo. Takes a `theme` prop (`"blue"` | `"white"`). Passed as `centerOverlay` to shells.
- The shells render the full header internally: left-aligned "FIFA Global Burden of Injury & Illness in Football Project" text, centred UCD logo slot, right-aligned "Isokinetic 2026", all above a rule divider.
- **Every slide** uses the same header. Do not redesign it per-slide.

### Layout Constants (inherited from shells)

- Header scale: `0.75` applied to base sizes
- Header height: `78px` (104 × 0.75)
- Side padding: `96px`
- Top padding: `54px` (72 × 0.75)
- Bottom padding: `88px`
- Font: `Inter, "Source Sans 3", sans-serif`

### Slide Composition Pattern

```tsx
<WhiteBackgroundShell centerOverlay={<HeaderBrandLockup theme="white" />}>
  <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
    {/* Title area */}
    {/* Main content (flex: 1) */}
    {/* Optional footer */}
  </div>
</WhiteBackgroundShell>
```

Each slide is a standalone React component using inline styles. Colors are defined as a `const` object at the top. New slides follow this same pattern  -  pick the appropriate shell, pass the lockup, compose content in the children slot.

### Adding a New Slide

1. Create `slides/NewSlide.tsx` following the shell pattern above
2. Add a `Composition` entry in `Root.tsx` (150 frames default per slide)
3. Add a `Sequence` entry in `Deck.tsx` at the correct position
4. Update `SLIDE_DURATION` math if needed

## Design System

### Color Tokens

| Token | Hex | Use |
|-------|-----|-----|
| FIFA blue | `#0057B8` | Primary accent, headings, chart fills, dividers, structural elements |
| FIFA blue dark | `#003D82` | Darker emphasis |
| FIFA blue tint | `#EAF2FF` | Light backgrounds |
| Primary text | `#111827` | Body text on white slides |
| Secondary text | `#4B5563` | Captions, affiliations, metadata |
| Isokinetic teal | `#0E3447` | Blue-slide backgrounds |
| Isokinetic cyan | `#1EA7F2` | Accent on blue slides |
| Isokinetic gold | `#B79A5B` | Restrained accent (title slide only) |

### Slide Alternation

- **Odd slides** (1, 3, 5…): `BlueBackgroundShell`  -  white text, light accents
- **Even slides** (2, 4, 6…): `WhiteBackgroundShell`  -  dark text, blue accents

This is the default rhythm. Break it only when a specific slide has a strong compositional reason.

## Non-Negotiable Rules

- **No slide numbers** anywhere in the deck
- **Do not render, preview, or visually verify** unless the user explicitly asks
- **Phase 1 only**  -  no Phase 2/3 content
- **Provisional data slides** must carry a persistent footer: "Preliminary data  -  current extraction, under cleaning"
- **One idea per slide**
- Preserve the existing centred UCD/FIFA header lockup treatment on every slide
- Keep the pitch motif present across the deck (it's built into the shells)
- Motion should clarify structure, not decorate. Prefer opacity fades, staged reveals, line draw-ons. Avoid bounce, overshoot, 3D, parallax.

## Key Reference Files

- `slides/00-design-brief.md`  -  comprehensive design system rules and visual direction
- `03-execution-brief.md`  -  slide-by-slide build spec, narrative arc, talk structure (sections A-E)
- `PRESENTATION-HANDOFF-SLIDES-1-2-SETUP.md`  -  setup state and active visual rules
- `slides/01-presenter-and-team.md`  -  team slide source content

## Assets

Store in `assets/branding/`. Current: `ucd-logo.png`, `fifa-logo.png`, `fifa-brand-panel.jpg`. Prefer SVG, fall back to transparent PNG. The shells reference assets via `require()` with absolute paths.
