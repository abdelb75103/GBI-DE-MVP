# Isokinetic Presentation Handoff

This folder is the cleaned handoff packet for a fresh chat/context window.

It now also contains the active working area for building the presentation deliverables.

The workflow is:

1. Run the research layer with `$web-research-packet`
2. Run the first `$gotenks` pass to create the planning brief
3. Review and refine
4. Run the second `$gotenks` pass to create the execution brief
5. Only then build slides, speaker notes, and Remotion scenes

Do not pre-build the slide structure before the first Gotenks brief exists.

Review order:

1. `START-HERE.md`
2. `01-research-packet.md`
3. `02-planning-brief.md`
4. `03-execution-brief.md`

Files:

- `00-working-summary.md`: current working summary, open questions, and next inputs needed
- `plan.md`: the workflow and decision rules
- `context.md`: the project scope and content constraints
- `scope-notes.md`: text-only synthesis of the project-plan documents
- `sources.md`: required local sources and primary references
- `provisional-data-signals.md`: safe planning summary of the current CSV export
- `planning-prompt.md`: prompt for the first Gotenks run
- `execution-prompt.md`: prompt for the second Gotenks run
- `GEMINI-ANTI-GRAVITY-BACKGROUND-PROMPTS.md`: prompt pack for generating reusable blue/white slide background plates from the title-slide reference
- `commands.md`: exact command templates for the fresh window
- `START-HERE.md`: quickest path to the final artifacts
- `01-research-packet.md`: top-level alias of the research packet
- `02-planning-brief.md`: top-level alias of the final planning brief
- `03-execution-brief.md`: top-level alias of the final execution brief

Generated artifact folders:

- `research/`: research packet and run metadata
- `planning-brief/`: completed Gotenks planning run artifacts
- `execution-brief/`: completed Gotenks execution run artifacts

Working folders:

- `slides/`: slide-by-slide structure, outlines, and final deck source files
- `assets/`: charts, exports, images, logos, and supporting media
- `drafts/`: rough outlines, alternative storylines, and working text
- `speaker-notes/`: presentation notes keyed to the final slide flow

Archived fallback material:

- `archive/manual-fallback/`: earlier manual drafts kept for reference
