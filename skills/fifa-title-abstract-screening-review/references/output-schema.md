# Output Schema

Write recommendations as JSON:

These recommendations are AI review outputs only. They are not human votes, resolver decisions, or conflict adjudications.

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
- All recommendations must have `sourceQuote: null` and `sourceLocation: null`.
- `include` and `undecided` recommendations must have `exclusionReason: null`.
- `exclude` recommendations must have a non-empty, criteria-based `exclusionReason`.
- `targetTag` must be `null` or `systematic_review`.
- Systematic reviews, scoping reviews, evidence syntheses, and meta-analyses relevant to football/soccer injury, illness, health-problem, or mental-health surveillance/epidemiology reference checking should use `decision: "include"` and `targetTag: "systematic_review"`.
- Recommendation files must not contain human reviewer vote edits, resolver decisions, manual decision fields, or promotion instructions.
