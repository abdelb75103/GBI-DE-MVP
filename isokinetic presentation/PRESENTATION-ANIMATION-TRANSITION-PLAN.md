# Presentation Animation Transition Plan

## Purpose

This note defines how slide animation should be built going forward so the final deck works in PowerPoint as a presenter-controlled talk, not as a single autoplay video.

The key requirement is:

- each reveal must stop cleanly at a speaking cue
- the presenter must be able to click forward through the animation beats
- the exported Remotion assets must support PowerPoint delivery

## Core Rule

Do **not** treat each slide as one continuous animation that plays from start to finish.

Instead, treat each slide as a sequence of:

1. hold states
2. transition clips
3. next hold states

Each speaking beat should have a clean pause point.

## Recommended Slide Structure

For every animated slide, define:

1. `State 0`  -  base frame
2. `Transition 0→1`
3. `State 1`  -  first hold
4. `Transition 1→2`
5. `State 2`  -  second hold
6. `Transition 2→3`
7. `State 3`  -  third hold

Continue only as needed.

This means the animation is authored around reveal steps, not around one linear playback timeline.

## PowerPoint Constraint

PowerPoint is reliable when the presenter advances through discrete assets or discrete slide states.

It is **not** the right environment for one long video that must automatically stop at exact speaking moments over and over.

Therefore:

- do not depend on one full-slide video pausing perfectly at every cue
- do not assume bookmark-driven pausing will be robust enough for the final talk
- build presentation assets so each reveal can be advanced manually

## Best Export Workflow

The most reliable workflow is:

### Option A  -  Preferred

Export:

- one still image for each hold state
- one short transition clip between each hold state

PowerPoint then advances:

- still
- transition clip
- still
- transition clip
- still

This is the safest option for presenter control.

### Option B  -  Acceptable

Export one short clip per reveal step, where each clip:

- starts from the previous stable state
- ends on the next stable state
- is advanced by click in PowerPoint

This is workable, but less flexible than keeping stills and transitions separate.

## Authoring Rules For Remotion

When building future slides:

- define the reveal beats before animating
- map each reveal to a speaking cue
- make each reveal land on a stable final frame
- keep persistent layout elements perfectly aligned between beats
- avoid camera motion or large layout shifts that make still-to-video or beat-to-beat transitions feel discontinuous
- keep narration separate from the exported visual assets

## Design Rules For Clickable Animation

Animated slides should:

- feel premium and high-quality
- use motion to clarify structure
- pause cleanly at meaningful argument points
- avoid revealing too many things at once
- support presenter timing rather than forcing presenter timing

Good animation types:

- fades
- subtle motion in
- line draw-ons
- map point reveals
- highlight transitions
- emphasis glows

Avoid:

- long autoplay sequences
- overly continuous motion with no hold points
- effects that only make sense when watched straight through
- transitions that cannot freeze cleanly

## Planning Template Per Slide

For each future slide, document:

- `Slide objective`
- `Reveal 1`
- `Reveal 2`
- `Reveal 3`
- `Hold states needed`
- `Export assets needed`

Suggested export naming:

- `slide-03-state-0.png`
- `slide-03-transition-0-1.mp4`
- `slide-03-state-1.png`
- `slide-03-transition-1-2.mp4`
- `slide-03-state-2.png`

## Tomorrow’s Implementation Rule

When implementing the deck for PowerPoint export:

- convert each animated slide into discrete clickable beats
- do not export final presentation slides as one uninterrupted movie per slide
- prioritize stable hold states and short transition assets
- test the logic against actual speaking rhythm, not just visual timing

## Summary

The deck should be built as a click-stepped presentation system, not a passive animation reel.

The presenter should control:

- when a reveal starts
- when a reveal ends
- how long the audience sits with each state

That means Remotion should generate modular presentation assets, not one long baked playback sequence.
