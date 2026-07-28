# FIFA GBI Design System

Approved design system for the FIFA GBI workspace. Everything here is a **specification**, not shipped code. The application has not been migrated yet.

Approved by Abdel on 2026-07-28 after reviewing `FIFA-GBI-design-proposal.pdf`.

## The rule everything follows

**Colour means decision state, never category, never decoration.**

FIFA navy is the only accent, used for the primary action, active navigation, focus rings, links and selection. Green, red and amber are reserved for what a reviewer decided, and they mean the same thing in title and abstract screening, full-text screening and data extraction. Source families and exclusion reasons are categories, so they use a separate low-chroma tint set that never borrows a decision colour.

## Files

| File | What it is |
| --- | --- |
| `tokens.css` | The token layer. Colour ramps, state colours, surfaces, ink, radius, elevation, focus, motion, type. Light and dark derived from the same variables. Port this into `src/app/globals.css`. |
| `components.css` | Reference implementation of every component. Each class maps to one React component to build. Use it as the spec for the Tailwind classes, not as a stylesheet to ship. |
| `component-library.html` | The living library. Open it in a browser to see every component in light and dark. |
| `before-after.html` | Source of the review PDF. Each component as it renders today against the proposal. |
| `legacy-before.css` | Faithful recreations of current app styles, taken from real class strings. Only used by `before-after.html`. |
| `icons-sprite.svg` | Phosphor subset used in the library previews. **Production must use the `@phosphor-icons/react` package**, not this sprite. |
| `FIFA-GBI-design-proposal.pdf` | The 36 page approved proposal. The authority if anything here is ambiguous. |
| `reference-shots/` | Screenshots. `before-*.png` are the live app before migration. The rest are the approved components. |

## Locked decisions

1. **Accent**: FIFA navy `#0b3a70`. One accent, no exceptions.
2. **State colours**: positive `#0f766e`, negative `#b3261e`, attention `#c98a00`, neutral slate. Validated for red-green colour blindness on every pair, and AA on every ink and button pairing. Every state also carries an icon and a word, so colour is never the only signal.
3. **Category tags**: Option B, fully tinted at low chroma (`.tag--tint` plus a `cat-*` class). Option A, the colour-edge variant, was rejected and removed.
4. **Stat tiles**: the tinted tile look is kept. What changes is that there is one implementation instead of five, and the tone comes from what the metric means (`stat--total`, `--positive`, `--attention`, `--negative`, `--neutral`), not from where the tile sits in a row. Single hue per tile, value in ink.
5. **Typeface**: Geist for UI, Geist Mono for study IDs and any figure that lines up in a column. Replaces Inter. Numbers are tabular everywhere.
6. **Radius**: tags 4, controls 8, cards 12, page header and modal 16, status pills full. No other values.
7. **Elevation**: two levels. `--e1` for everything, `--e2` for overlays.
8. **Page header copy**: "AbdelRahman's Data Extraction" and "Welcome back, AbdelRahman" become the name of the thing on screen ("Your extraction queue").
9. **Navigation**: one fixed link set on every page. The current three per-page sets are a bug.
10. **Dials**: variance 2, motion 2, density 6. This is a product surface. Motion is 120 to 200ms on state change only. No scroll animation anywhere.

## Verification that has already been run

- State palette validated with the `dataviz` colour validator: all pairs pass CVD separation and the normal-vision floor.
- WCAG AA confirmed on every ink and button pairing. Primary button is 11.3:1.
- Component library checked at 1440px and 390px, light and dark. No horizontal overflow, touch targets meet 44px on coarse pointers.
- AI-tells lint: PASS.

Do not re-derive these. Re-run them only if you change a token value.
