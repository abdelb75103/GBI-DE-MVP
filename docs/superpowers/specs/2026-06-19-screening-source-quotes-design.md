# Screening Source Quotes Design

## Decision

Remove AI source quotes from full-text and title/abstract screening. A copied passage can be verbatim yet irrelevant to the recommendation, so exact-match validation cannot make the quote trustworthy. The concise AI rationale remains the reviewer-facing explanation.

## Scope

- Do not render `aiEvidenceQuote` or `aiSourceLocation` in the full-text workspace, title/abstract workspace, or offline title/abstract pack.
- Future full-text reviews return and store `null` for evidence quote and source location, and the AI response contract no longer requires either field.
- Future title/abstract recommendation application stores `null` for evidence quote and source location. Exclusions continue to require a structured exclusion reason, but not quote/source fields.
- Preserve existing database columns and historical values for schema compatibility and audit history.
- Do not alter human votes, AI decisions, conflict state, promotion behavior, or eligibility criteria.

## Verification

- Add contract tests that prevent the three screening renderers from displaying source-quote fields.
- Add full-text parser/prompt tests showing exclusions succeed without quote fields and are normalized to `null`.
- Update title/abstract workflow tests to require exclusions without source-quote fields and verify database payloads clear those fields.
- Run focused tests, lint on edited application files, and TypeScript/build checks that do not require restarting a dev server.
