# Stage A local proposal: S3931 and S4859

This directory is local-only. It contains no live database, storage, or backlog mutation.

`stage-a-proposal.json` uses the `papers[].studyId`, `populationLabels`, `fields`, and `note` shape expected by `scripts/apply-second-search-extraction-json.mjs`. Its additional evidence, intentional-blank, caveat, and Stage A keys are for human review only.

## Source and proposal coverage

| Study | Population layout | Source sweep | Main staged outcome coverage |
| --- | --- | --- | --- |
| S3931 | D + LCS group / NHE group | Full 14-page PDF, Methods §§2.1-2.8, Tables 1-4, results, discussion and limitations | Arm-specific players, exposure, one training hamstring injury, total injury rate, 18 time-loss days, muscle/thigh/right-side structured rows |
| S4859 | Total | Full 9-page PDF, abstract, methods, Table 1, Table 2, Figure 1, results, discussion and limitations | Cohort, match-only count and reported rate, direct or percentage-to-count type/location rows, contact/non-contact counts |

## Required reviewer attention

- S3931 has a prose-level arm-label reversal. Table 4 is authoritative for the staged arm-aligned exposure, count and rate values.
- S4859 directly reports two incompatible incidence values: 24.9 per 1,000 match-hours in the abstract, results and discussion, and 6.52 per 1,000 h in limitations. The proposal stages the repeated 24.9 source statement and leaves exposure blank. It does not infer a correction.

## Validation run

- Both local PDFs SHA-256-match the verified screening attachments.
- `jq empty` parses the proposal successfully.
- The current extraction schema recognises all 34 S3931 and 44 S4859 field IDs, and both papers provide all Tabs 1-10 keys.
- No live apply or dry-run was run. A future apply needs a fresh live preflight, current paper IDs, additive-only comparison, and the Stage B integrity gate.
