# Title/Abstract Eligibility Guidance

Use the same project eligibility frame as full-text screening, but apply it more leniently because title/abstract records may omit denominator, study design, sport subgroup, or outcome detail.

## Recommend Include

Recommend `include` when any of these are plausible from the title/abstract/citation:

- Football/soccer players, teams, match play, training, tournaments, academies, or leagues are studied.
- Injury, illness, concussion, epidemiology, incidence, prevalence, burden, surveillance, risk factors, or return-to-play outcomes are reported.
- The abstract suggests player-level data that may contain a usable denominator after full-text review.
- The article is mixed-sport or unclear, but the title/abstract/citation provides a concrete signal that football-specific subgroup data may exist.
- The abstract is very sparse but still indicates a plausible football/soccer injury or illness record.

## Recommend Exclude

Recommend `exclude` only when clearly supported by the title/abstract/citation:

- Not football/soccer and no plausible football subgroup.
- Recreational-only, non-competitive context with no eligible player population.
- Editorial, commentary, narrative review, protocol, conference abstract/poster, case report, biomechanical-only, performance-only, or intervention-only paper with no eligible injury/illness epidemiology outcome.
- Public-source-only media dataset with no player-level denominator.
- Clearly not human players.
- Clearly unrelated medical, social, or engineering topic.

## Recommend Include With Target Tag

Recommend `include` with `targetTag: "systematic_review"` when the record is a systematic review, scoping review, umbrella review, evidence synthesis, or meta-analysis relevant to football/soccer injury or illness.

These records are included for Abdel's separate systematic-review handling, not as standard primary extraction papers.

## Recommend Undecided

Recommend `undecided` when the abstract is missing and the title/citation alone does not clearly support exclusion.

## Evidence Requirement

For every `exclude`, include:

- a short exclusion reason,
- one direct quote copied from the title, abstract, journal/citation, or source metadata,
- a source location such as `Title`, `Abstract`, `Journal`, or `Citation metadata`.

For every `include`, keep the rationale short and leave quote/source fields empty.

For every systematic-review include, add `targetTag: "systematic_review"` and include `systematic_review` in `tags`.

For every `undecided`, explain that the abstract is missing or insufficient and leave quote/source fields empty.
