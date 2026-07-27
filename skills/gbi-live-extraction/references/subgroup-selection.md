# Subgroup Selection

Read this file when the paper could be extracted either as a pooled line or as multiple subgroup rows.

## Default Rule

- Prefer the most explicit reported subgroup structure over a pooled headline row when the subgroup split is directly usable in the schema.
- If a paper reports both pooled totals and a clean subgroup table, do not default to the pooled line unless the subgroup denominators are incomplete or incompatible with the live fields.
- Build the population row layout before filling fields.
- If the source reports pooled values and subgroups, use `Total / subgroup 1 / subgroup 2 ...` unless the source table clearly uses a more defensible order.
- If the source reports subgroup-only values and no pooled total, do not invent a `Total` row.
- If the source prints a distinct overall count plus subgroup rows and the totals disagree, retain both: store the printed overall on `Total`, store compatible subgroup rows separately, and document the discrepancy instead of reconciling it by inference.
- Keep subgroup rows only for fields where the paper actually reports or implies subgroup differences.

## Trial Arm Rule

- For randomised, cluster-randomised, controlled, or comparative intervention studies, default the live line mapping to the reported study arms when the paper gives direct arm-level tables.
- Use `intervention` and `control` labels unless the paper uses a more specific arm label that should be preserved.
- Do not keep a pooled row for a two-arm trial when the paper directly reports arm-level exposure, counts, incidences, burden, or other primary outcomes.
- Only keep a pooled row if the arm-level data are incomplete or incompatible with the schema, and state that reason explicitly in the review summary or backlog note.

## Season Split Rule

- If a paper reports a clean `All seasons` or pooled row plus per-season rows for counts, incidence, burden, exposure, location, tissue/type, or severity, default to `All seasons / season 1 / season 2...`.
- Use the paper's exact season labels when printed, such as `2017-18 season`.
- Keep pooled-only values on `All seasons`; do not copy them into season rows.
- If a season-split table conflicts internally with a pooled prose value, store the direct pooled value on `All seasons`, split only the direct season cells, and note the inconsistency.

## Common Preferred Splits

- Age groups such as `U13` / `U14` / `U15` / `U16`
- Intervention vs control
- Male vs female
- Seasons when the paper reports direct season-specific rows
- Playing surface comparisons when the paper truly compares exposure or injuries on those surfaces
- Club home-venue surface comparisons such as `artificial turf home venue` vs `natural grass home venue`

## Row Alignment Rule

- Shared/global values go on the first row only; leave later subgroup lines blank.
- Subgroup-specific values go on the matching subgroup rows.
- Pooled-only metrics stay on the first `Total` row; do not copy pooled values downward.
- Subgroup-only metrics keep a leading blank if the first live row is `Total`; do not shift subgroup values upward.
- Apply this across all tabs, including study details, participant fields, definitions, exposure metadata, headline outcomes, and structured tabs.
- Only keep multiline values when row-specific values exist or blank spacer lines are needed to preserve alignment.

## Sex-Split Rule

- If boys/girls or male/female results are actual study rows, do not leave the paper as pooled `mixed`.
- Use `Total / Boys / Girls` or `Total / Male / Female` when pooled totals also exist.
- Use only `Boys / Girls` or `Male / Female` when no pooled total is reported.
- If a subgroup split is shown live and global sex would hide row identity, label sex rows with the subgroup names.

## Home-Venue vs Playing-Surface Rule

- Treat `home venue`, `home pitch`, `AT clubs`, and `NG clubs` as meaningful subgroup labels in their own right.
- If the source table is framed around club home-venue surface, keep the extraction on that axis rather than mixing it with player-level `playing on AT vs playing on NG` rows from a different table.

## Sample Size Rule

- For `sampleSizePlayers`, prefer the directly reported number of players or participants.
- If the paper gives a direct total plus direct subgroup proportions, you may split `sampleSizePlayers` by those proportions when the arithmetic is transparent.
- Example: total players plus `71% boys / 29% girls` can support `sampleSizePlayers` for `male / female`.
- When you do this, note explicitly that the sample sizes are proportion-derived.
- Do not use `player seasons`, `athlete-exposures`, or similar repeat-participation denominators as player sample size unless the schema field explicitly calls for that unit.

## Sparse Papers

- If the source only supports a sparse pass, save the clearly justified headline values and leave the rest blank rather than forcing uncertain subgroup mappings.
- If a paper mixes football with other sports but reports a clean football subgroup, extract the football subgroup only and say that explicitly in the review summary or backlog note.
