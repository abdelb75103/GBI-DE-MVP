# AIDE Presentation Master Script

## Slide 1

Today I'm presenting AIDE, the AI-Assisted Data Extraction Web App for FIFA's Global Burden of Injury and Illness project. The purpose of this tool is simple: reduce the time and inconsistency involved in extracting study data from football injury and illness papers, while keeping the process academically rigorous and fully traceable.

- Most important part: AIDE solves slow, inconsistent data extraction
- Key wording: AI-assisted, not AI-only
- Key wording: traceable and rigorous

## Slide 2

The core problem is that manual extraction from published PDFs is slow, repetitive, and vulnerable to human error. On top of that, studies use different definitions, formats, and reporting styles, which makes it difficult to build one clean dataset across hundreds of papers.

- Most important part: manual extraction is too slow and error-prone
- Key wording: inconsistent definitions
- Key wording: hard to aggregate across studies

## Slide 3

The tool is designed for three main users: extractors, reviewers, and admins. Extractors need speed and guidance, reviewers need quality control and defensibility, and admins need visibility over progress, consistency, and final export readiness.

- Most important part: three users, three different needs
- Key wording: extractors, reviewers, admins
- Key wording: speed, quality control, oversight

## Slide 4

AIDE's solution is a structured web app with an integrated PDF viewer and guided extraction forms. The AI pre-fills study information and key values, but the human remains in control by reviewing, correcting, and confirming every important field.

- Most important part: AI pre-fills, humans verify
- Key wording: structured web app
- Key wording: human-in-the-loop

## Slide 5

The workflow begins when a user uploads a PDF. The system checks for duplicates, extracts the first four tabs automatically, presents the paper beside the form for verification, and then allows clean export into CSV or JSON in the exact schema order required by the FIFA extraction sheet.

- Most important part: upload to export in one workflow
- Key wording: dedupe, extract, verify, export
- Key wording: exact schema order

## Slide 6

A key strength of AIDE is that it protects methodological rigor. It does not replace researcher judgement. Instead, it standardizes definitions, keeps an audit trail, and makes every extracted value traceable back to the source paper, which is essential for defensibility and reproducibility.

- Most important part: rigor is built into the system
- Key wording: audit trail
- Key wording: traceable to source

## Slide 7

For the MVP, we focus on the highest-value features first: PDF upload, deduplication, auto-extraction for the first four tabs, structured data storage, and export. Advanced features like full role-based auth and more complex dashboards are intentionally out of scope for now so the team can ship something usable quickly.

- Most important part: focused MVP, not overbuilt
- Key wording: first four tabs
- Key wording: ship usable value quickly

## Slide 8

The expected impact is substantial. The tool should cut extraction time significantly, improve consistency across reviewers, reduce missed fields, and generate an analysis-ready dataset faster. In practical terms, it helps the team move from manual document handling toward a repeatable, scalable evidence pipeline.

- Most important part: faster, cleaner, more scalable
- Key wording: time reduction
- Key wording: analysis-ready dataset

## Slide 9

Compared with tools like Covidence and Rayyan, AIDE is narrower but more specialized. It does not try to replace the full systematic review workflow. Instead, it focuses specifically on the extraction stage for FIFA GBI, with a schema, controls, and outputs tailored to this project's exact methodological needs.

- Most important part: specialized beats generic for this use case
- Key wording: purpose-built for FIFA GBI
- Key wording: focused on extraction

## Slide 10

The main takeaway is that AIDE is not just a productivity tool. It is a research infrastructure tool. It supports faster extraction, stronger consistency, and better scientific traceability, which makes the final dataset more reliable and more useful for FIFA's evidence and decision-making work.

- Most important part: this is research infrastructure
- Key wording: faster, consistent, reliable
- Key wording: better evidence for decision-making
