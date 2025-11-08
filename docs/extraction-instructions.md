# Extraction Instructions (Researchers)

> Draft for the MVP app. AI assistance is advisory only. All entries require human review before saving.

## Audience
- Researchers performing extractions in the MVP app.
- Reviewers who validate entries and approve completion.

## Before You Start
- Open the dashboard and review the Project Overview.
- Ensure the API is configured and connected for this project.
- Confirm you have the correct paper assignment or selection criteria.

## Step‑By‑Step Flow

1) Open Dashboard and Prepare
- From the dashboard, scan the Project Overview to understand scope and definitions.
- Verify API setup is complete and the connection is healthy.

2) Pick a Paper
- Go to Available Papers.
- Click a paper to begin extraction; it moves into your My Papers.
- Open the paper to enter the Workspace.

3) Choose Workspace Layout
- Select your preferred reading/editing layout: Accordion, Focus, or Full Screen.
- You can change layout at any time (it doesn’t affect the export).

4) Assisted Extraction: First Four Tabs
- The first four tabs support AI suggestions (Gemini). These are suggestions only.
- Required: Manually review every suggested field before saving. Edit or overwrite as needed.
- Multiple values in a single field (e.g., populations, age groups, tournaments):
  - Enter one value per line by pressing Enter after each value.
  - Each new line becomes a separate row in the export for that paper.
  - Keep row alignment consistent across related fields. Example: if “U19 Boys” is the 3rd line for Population, then all fields related to U19 Boys must also be entered on the 3rd line in their respective inputs.
- If the AI misses or misinterprets items, correct it manually. Treat AI as an assistant, not a source of truth.

5) Manual Entry: Injury and Illness Sections
- Injury and Illness tabs are manual entry only (no AI suggestions).
- Work through each tab and fill out all data points present in the paper.
- It is normal for many papers to lack some data points; leave fields blank when not reported.

6) Notes, Flags, and Status
- Notes: Use for context, uncertainties, or explanations of decisions.
- Flag: Use when you do not know how to proceed with a paper or it needs help/triage. Add a brief note explaining the issue.
- Status: If a paper should not be extracted, change its status instead of extracting. Save afterward.
  - Do not extract: UEFA ECIS papers, NCAA papers, RIO papers, and Mental Health papers. Assign the appropriate status label and save.
  - You may leave Notes without Flagging if you attempted extraction but remain unsure about specific items.

7) Save Changes
- Any change made in the Workspace must be saved to persist.
- Recommended cadence: save after completing each tab or major edit.

8) Final Review and Handoff
- Confirm row alignment across all multi‑value fields (line‑by‑line consistency).
- Spot‑check critical fields against the paper (titles, populations, exposures, outcomes).
- If anything is unclear, add a Note or Flag before moving on.

## Do’s and Don’ts
- Do verify every AI‑suggested value before saving.
- Do enter one value per line when multiple groups exist; keep line positions aligned across related fields.
- Do leave fields blank if the paper doesn’t report a value.
- Don’t extract for excluded categories (UEFA ECIS, NCAA, RIO, Mental Health); set status instead and save.
- Don’t rely on AI to make final decisions.

## Common Scenarios
- Multiple populations/ages/tournaments: list each on its own line; maintain consistent line order for all related fields.
- Ambiguous or missing data: leave blank and add a Note describing what you checked.
- Poor scans or OCR issues: Flag with a note if you cannot reliably extract.

## Review Checklist (Quick)
- AI‑assisted tabs: manually checked and corrected.
- Manual tabs (Injury/Illness): completed where data exists; blanks left where not reported.
- Multi‑value fields: one value per line; row alignment preserved across tabs.
- Status and Notes/Flags set appropriately; changes saved.

## Appendix (Fill‑In Later)
- Exact names of the first four AI‑assisted tabs.
- Full list of status values and their definitions.
- Where the Save button is located in each layout (Accordion/Focus/Full Screen).
