# Local Stage A preparation, S683 and S2761

This directory contains local-only, source-backed Stage A extraction proposals for the two specified studies. It contains no Supabase, storage, paper, population, status, assignment, or Backlog write.

## Gate and conversion precondition

Both records remain screening records, not extraction papers. The latest local read-only gate snapshot (`../blocked-gate-snapshot-2026-07-30T18-16-12-749Z.json`) shows a `pending` screening resolution, no promoted `paperId`, and an unsupported promotion gate because each record has only one authoritative human include. The proposals therefore deliberately use `paperId: null` and are not runnable by `apply-second-search-extraction-json.mjs`.

Before any conversion or apply, obtain a supported promotion, re-run the full-text gate audit, verify the resulting `papers.assigned_study_id`, current blank/nonblank extraction fields, assignment, file hash, and population state. Apply only additive fields that remain blank. Preserve the system-assigned `studyId`.

## Source coverage

- S683: title/abstract, Methods, Tables 1-3, Results, Discussion, and references were checked. The proposal is limited to the directly separable futsal subgroup.
- S2761: title/abstract, Methods, Tables 1-6, and Figures 2-6 were checked. Figure-only values that could not be read directly were not inferred.

The proposals include all ten tabs. A missing value means source-checked and intentionally absent, incompatible, ambiguous, or not schema-mappable. Each proposal supplies exact page/table evidence, additive-only candidate fields, population-line layout, direct versus derived treatment, caveats, and a future Backlog note.

## Stage A outcome

S683 is a sparse, futsal-only extraction with season-specific incidence and counts. S2761 is a richer professional-football extraction with a `Total / Goalkeeper / Defenders / Midfielders / Forwards` layout for directly reported Table 4 location counts. S2761 has material internal count/rate inconsistencies, which remain visible in its proposal and require reviewer attention before any live apply.
