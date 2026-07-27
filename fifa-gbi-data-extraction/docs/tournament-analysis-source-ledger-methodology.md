# Tournament analysis source-ledger methodology

**Status:** reviewer-facing methodology for the FIFA and international tournament source-family reconciliation, 27 July 2026.

## Purpose

This methodology defines how tournament surveillance sources are represented for analysis without double-counting a tournament denominator. It operationalises the decision recorded in the [source ledger](../data/tournament-family-reconciliation/2026-07-27/fifa-international-tournament-source-ledger-2026-07-27.md): preserve source provenance in existing paper records, select one denominator-owning anchor per tournament, and retain valid overlapping publications as supplements or audit context.

It is an analytical representation rule. It does not replace screening, extraction, clinical interpretation, or source appraisal.

## Roles and records

| Role | Meaning | Permitted analytical use |
| --- | --- | --- |
| **Anchor** | The one source, or one explicitly identified row of a multi-tournament source, that owns an eligible tournament denominator. | Supplies the tournament's denominator and primary outcome record. |
| **Supplement** | A source using the same tournament cohort or a nested subset, but adding disjoint detail such as mechanism, diagnosis, location, severity, burden, phase or score-state analysis. | Adds source-labelled detail only. It cannot create another tournament denominator. |
| **Row ledger** | A paper with distinguishable tournament-level rows. | Can supply anchors for different tournaments, subject to the one-anchor rule. |
| **Audit-only source** | A source with no eligible denominator, or an inconsistent or non-surveillance denominator. | Remains visible with its provenance, but is excluded from denominator aggregation. |

Existing `papers.metadata.analysisSourceTreatment` records the analytical treatment of a paper. Additive `paper_notes` record the rationale, overlap relationships, exclusions and reviewer-facing provenance. These fields complement, rather than replace, source extraction.

## Anchor selection

Select one anchor for each named tournament or defined competition series. Prefer a direct, tournament-specific medical-surveillance source with an eligible denominator. A discipline-specific source takes precedence over a broader ledger when both cover the same event. Where no stronger standalone source exists, an identified row in a multi-tournament paper may be the anchor.

The decision must be explicit in the source ledger and traceable to the paper and row. A paper can be an anchor for more than one distinct tournament only through separately identified rows. It cannot supply multiple anchors for the same tournament.

## Overlap handling

### Whole-paper overlap

A pooled review or broad trend paper that includes one or more anchored tournaments is retained as a family-level supplement. Its pooled counts, matches, exposures and rates are excluded from tournament-denominator aggregation. It may support interpretation of cross-tournament patterns when labelled with its source and pooling scope.

For example, S256 is a pooled FIFA and Olympic trend source. It is not summed with individual tournament anchors or row-ledger anchors.

### Partial-row overlap

Multi-tournament papers require row-level treatment. Each row is assessed against the anchor for that tournament:

- a row without a stronger anchor may own that tournament denominator;
- a row that overlaps a stronger anchor is excluded from denominator aggregation, while remaining available as provenance or context;
- a discipline-specific row can displace a broader row for the same event;
- disjoint rows for different tournaments remain independently eligible.

This allows sources such as S037, S064, S078, S109, S391 and S5338 to remain useful without treating the paper as all-or-nothing.

### Pooled reviews and nested analyses

Pooled reviews do not become a synthetic master paper. Shared-dataset analyses, subgroup analyses and one-team subsets are supplements, even when they report detailed results. Examples include S039 and S096 for the 2002, 2006 and 2010 World Cups, and S640 for a single 2010 World Cup team. They may contribute source-level fields but never a second tournament denominator.

## Multi-tournament ledgers and exceptions

The source ledger is the authoritative map of tournament, anchor, supplements and counting rule. It must keep source identifiers, event names, period, row identity where applicable, and the reason for any exclusion.

Some records are intentionally separate from the national-team tournament family. In particular, ECIS club-season sources remain in the UEFA ECIS workflow. A reference to a World Cup season does not make a club-season cohort a FIFA World Cup tournament cohort. Similarly, club competition surveillance, referee cohorts, domestic or school comparators, public/video audits without an eligible medical-surveillance denominator, and commentary are not silently reframed as tournament anchors.

## Live write boundary

This phase is limited to additive analytical metadata: `papers.metadata.analysisSourceTreatment` and `paper_notes`. It does not change screening decisions or votes, extraction values, paper status, assignments, resolver state, source files or population data. It does not create a synthetic paper or rebuild existing records.

Any proposed correction outside these fields is a separate, explicitly scoped workflow. Existing extracted values remain their own source record and are not overwritten to harmonise the ledger.

The pre-apply snapshot is the recovery reference for this metadata phase. A rollback, if separately approved, would restore the prior metadata for the 28 named papers and remove only the exact notes inserted by this batch. Rollback is intentionally not automatic because deleting live notes or replacing metadata is destructive.

## Export behaviour

Analytical exports must provide two linked outputs:

1. a denominator-ready tournament dataset containing only the selected anchor record or eligible anchor row for each tournament; and
2. a source-level audit export containing anchors, supplements, pooled sources, partial-row exclusions and audit-only sources, with treatment, exclusion reason and provenance note.

An export must exclude both whole-paper pooled overlaps and overlapping rows within otherwise eligible multi-tournament papers from denominator aggregation. Exclusion does not erase the source from the audit export. Source-level detail from supplements may be displayed only when its non-denominator role is explicit.

CSV rows include their source population position, source label and source-verified tournament or series key. For partially excluded ledgers, the analysis JSON omits raw multiline extraction arrays because those arrays still contain source-only rows; the filtered and normalised `populations` collection is the denominator-ready representation. Source-scope exports retain the unfiltered raw extraction arrays for audit.

## Provenance and integrity gates

Every treatment decision should retain enough provenance for a reviewer to reconstruct it: source ID, tournament or row, treatment, anchor relationship, denominator eligibility, exclusion rationale and link to the current ledger. Derived values must be labelled as derived and retain the stated calculation basis. Do not reverse-engineer counts from a rate where the denominator is ambiguous.

Before a ledger or export is accepted, verify that:

- each included tournament has exactly one denominator-owning anchor;
- each non-anchor overlapping source or row has an explicit treatment and reason;
- no pooled, nested or duplicate denominator contributes to aggregation;
- multi-tournament sources distinguish eligible and excluded rows;
- audit-only sources remain visible but excluded;
- protected screening, extraction, status, assignment and value fields are unchanged by this phase; and
- audit export records agree with the ledger and the stored treatment and notes.

## Future audit and reframing

Future source discovery, correction or a better tournament-specific paper can trigger a review of the relevant anchor decision. The review must preserve the previous decision, evidence and reason in the audit trail, then document whether the new source replaces an anchor, becomes a supplement, or remains audit-only.

Reframing a source family is not automatic. It requires an explicit methodological decision, documented scope, and a new audit of affected tournament denominators before any analytical export is regenerated.

## Implementation artefacts

The staged paper treatments, source relationships and exclusions are in `data/tournament-family-reconciliation/2026-07-27/analysis-source-treatment-input-2026-07-27.json`. Source-verified row identities are in `analysis-tournament-row-treatment-input-2026-07-27.json`. The matching pre-apply snapshots, final live audits and post-apply verification files in the same directory record the protected-state hashes and live checks.
