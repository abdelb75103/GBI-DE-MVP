# Implementation notes

What the shipped code does that `README.md`, `tokens.css` and `components.css` do not say. The approved spec stays the authority; this file records where implementation needed a decision the spec did not cover.

Written during the Phase 0 and Phase 1 migration.

## Additions to the system

| Addition | Why |
| --- | --- |
| `Button` variants `onNavy`, `onNavySecondary` | Buttons inside a `PageHead` sit on navy. Tailwind orders utilities by its own rules, so a `className` colour override cannot be relied on to beat the variant's. These have to be variants. |
| `Button` variant `dangerSoft` | An engaged destructive *toggle* (a paper is flagged) is not a destructive *action*. Solid `danger` overstated it. |
| `ButtonLink` and `buttonClasses()` | Navigation styled as a button must stay an anchor so it is middle-clickable and copyable. Sharing the recipe keeps the two in sync. |
| `Chip` / `ChipLink` prop `onNavy` | Same reason as the button variants: the batch filters render inside the page header. |
| `Checkbox` props `hideLabel`, `indeterminate` | Table select-all needs the indeterminate DOM property, which has no HTML attribute. Row checkboxes need an accessible name without a visible label. |
| `statusTone()` in `status-pill.tsx` | A record row's left rail and its status pill are derived from one map, so they can never contradict each other. |
| `Meter` `role="meter"` with value/label | The spec described the visual only. Progress that is not announced is not finished. |

## Decisions the spec left open

**Assignment is not a decision.** "Available", "Yours", "Assigned to X" and "Duplicate" describe who holds a paper, not what a reviewer concluded, so they render as neutral `Tag`s. The Status column beside them carries the decision colour. "You're working on this" was shortened to "Yours" because it repeated on every row of a dense table.

**`qa_review` is `info`, not `attention`.** `processing` and `qa_review` are both mid-pipeline, but they mean different things: work underway versus work handed to a reviewer. Giving both amber would have made the column unreadable. This matches the approved `final-tags.png`, where QA review is blue.

**Dark values for `--navy-50` and `--n-50`.** `tokens.css` gives every state tint a dark value but leaves the navy and neutral ramps light, because `PageHead` is navy in both themes and reads from them. Rather than change the ramps underneath the header, the two `StatTile` tones that draw on them (`total`, `neutral`) carry their own dark tint locally. Same reason `Button`'s `onNavy` hover uses a literal `#eff4fa`.

**`.extraction-workspace-page` was removed.** It pinned light colours regardless of theme. With a real token layer the workspace follows the theme like everything else.

## Known conflict in the assets

`reference-shots/final-tags.png` shows the ten source families as identical neutral grey tags. `README.md` locked decision 3, the `components.css` comment ("SHIPPING VARIANT (Option B, chosen)") and the handoff all specify the fully tinted `.tag--tint` plus `cat-*` treatment. The code follows the three that agree. If the screenshot is in fact the later artefact, `Tag` needs its `category` prop dropped at the call sites, which is a small change.

## Temporary state

**The legacy compatibility shim** at the bottom of `src/app/globals.css` maps eleven old custom properties onto tokens so unmigrated screens stay presentable mid-migration. **Delete it at the end of Phase 4.**

**Dark mode is built but not exposed.** The theme toggle is not rendered and `layout.tsx` hard-codes `light`, so a previously stored `dark` preference cannot strand anyone in an unverified theme. Both places carry a comment naming what to restore.

## House rules the migration follows

- Colour means decision state, never category, never decoration.
- Motion is state change only, 120 to 200ms, on explicitly named properties. No `transition-all`, no scroll-triggered animation, no lift-on-hover.
- Overlays use transitions rather than keyframes so a retriggered overlay retargets instead of restarting. Modals scale from centre; menus scale from their trigger.
- Every form control has a real label, via `Field`.
- Wide content scrolls inside its own container. The page body never scrolls sideways.
- `/design-system` renders the real primitives. A component added to `src/components/ui/` belongs on that page.
