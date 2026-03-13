# Direct vs Derived Values

Read this file whenever a field looks recoverable by calculation but is not explicitly reported.

## Default Rule

- Do not back-calculate exposure, counts, burden, or other fields from reported rates, counts, or ratios.
- If a value is not reported directly, leave it blank unless it is a simple sum of directly reported compatible subrows.

## Allowed Arithmetic

- Transparent aggregation of directly reported compatible values is allowed.
- Example: summing directly reported exposure subrows within the same subgroup into one broader total.
- Example: summing directly reported subtype counts into a broader structured row when they share the same denominator and the schema row clearly represents that combined category.

## Not Allowed

- Rate-to-count calculations
- Count-to-exposure calculations
- Burden-to-days calculations
- Any back-calculation from rate ratios, odds ratios, or regression outputs

## What To Do Instead

- Leave the live field blank.
- Mention the calculation opportunity in the review summary or backlog note if it is likely useful for later review.

## Related Field Rules

- Do not treat the use of a medical-attention or time-loss definition alone as evidence that separate medical-attention and time-loss count fields should be filled.
- Only fill those separate count fields when the paper reports separate counts.
- Treat acute/traumatic onset as `injuryModeAcuteSudden` and overuse onset as `injuryModeRepetitiveGradual` only when the paper explicitly frames the mechanisms that way.
