# Output Schema

Write recommendations as JSON:

```json
{
  "criteriaVersion": "fifa-gbi-title-abstract-v1-2026-04-25",
  "generatedAt": "2026-04-25T12:00:00.000Z",
  "recommendations": [
    {
      "recordId": "screening-record-uuid",
      "studyId": "GBI-0001",
      "title": "Paper title",
      "decision": "include",
      "reason": "Plausibly reports football injury epidemiology and should move to full text if reviewers include it.",
      "exclusionReason": null,
      "sourceQuote": null,
      "sourceLocation": null,
      "confidence": 0.72,
      "targetTag": null,
      "tags": ["football", "injury"],
      "auditNotes": "Lenient title/abstract include."
    }
  ]
}
```

## Constraints

- `decision` must be `include`, `exclude`, or `undecided`.
- `confidence` must be between `0` and `1`.
- `include` recommendations must have `sourceQuote: null`, `sourceLocation: null`, and `exclusionReason: null`.
- `undecided` recommendations must have `sourceQuote: null`, `sourceLocation: null`, and `exclusionReason: null`.
- `exclude` recommendations must have non-empty `exclusionReason`, `sourceQuote`, and `sourceLocation`.
- `targetTag` must be `null` or `systematic_review`.
- Systematic reviews, scoping reviews, evidence syntheses, and meta-analyses relevant to football/soccer injury or illness should use `decision: "include"` and `targetTag: "systematic_review"`.
- `sourceQuote` for exclusions must come from the record metadata provided in the export, not from an inferred or external source.
