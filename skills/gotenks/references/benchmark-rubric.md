# Gotenks Benchmark Rubric

Use the same rubric for every benchmark prompt and every variant:

1. Faithfulness: Does the output answer the actual request and stay grounded in the provided context?
2. Completeness: Does it cover the important points without obvious gaps?
3. Structure: Is the markdown organized, easy to scan, and fit for the requested format?
4. Clarity: Is the writing precise, readable, and free of unnecessary filler?
5. Actionability: Does the output help the reader make a decision or take the next step?
6. Citation Quality: Score only when the prompt uses shared web research. Prefer direct links, accurate attribution, and citations attached to consequential claims.

Automated judges should score each dimension on a 0-10 scale, produce an overall score on the same scale, and name a single winner.

Human spot-checks should review:

- The three highest-priority prompts in the corpus.
- Any prompt where the Codex and Claude judges disagree on the winner.
- Any prompt where the normalized average score spread between first and second place is under 0.05.
