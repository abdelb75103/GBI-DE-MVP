## User Preference: Local Dev Servers

Do not kill, stop, or restart local dev servers unless Abdel explicitly asks for that in the current request. If a local verification step needs a fresh server and one is already running, use the existing server when possible or report the stale-server limitation instead of terminating it.

## User Preference: External Plugin Actions

For any external plugin or connector action where other people could see the result or be affected, do not perform the action unless Abdel has explicitly reviewed and approved the exact action in the current request.

This includes, but is not limited to, sending emails or messages, posting comments, editing shared documents, creating or modifying calendar invites, granting or changing permissions, submitting forms, publishing content, merging pull requests, or making changes in systems used by other people.

Before taking one of these actions, present what will be changed or sent, who can see it or who is affected, and the exact target account, file, thread, recipient, or permission. Proceed only after Abdel clearly confirms approval.

## User Preference: Commits

Do not create, amend, rewrite, or push commits unless Abdel explicitly asks for commit or push work in the current request. Code edits, file changes, and verification do not imply permission to commit.

## GitHub/Vercel Auto-Deploy Identity

Commits intended for GitHub/Vercel deployment must use the GitHub-linked author `abdelb75103 <210773581+abdelb75103@users.noreply.github.com>`. Before committing, verify the repository-local `git config user.name` and `git config user.email`; set those exact repository-local values if they differ.

Pushes to `main` should trigger the production deployment, while other branches should trigger previews. After pushing, verify that GitHub associates the commit author with `abdelb75103` and that the commit receives a Vercel status. The GitHub integration currently reports deployments from `abdelrahmans-projects/fifa-gbi-data-extraction`; this checkout's `fifa-gbi-data-extraction/.vercel/project.json` points to the separate `abdel-babikers-projects` project, so do not use that local link to judge or trigger the GitHub production deployment.

If Vercel reports `Git author ... must have access to the project`, treat it as GitHub-author/Vercel-team access failure rather than a build failure. Confirm the commit maps to `abdelb75103` and that this account can access the connected `abdelrahmans-projects` Vercel project; do not work around it by deploying through the checkout's separate local Vercel link.

## User Preference: Small Cosmetic Changes

For very small cosmetic changes, such as font color, copy, spacing, labels, or similarly low-risk visual tweaks, do not run extended verification or deployment checks unless Abdel explicitly asks for verification. Make the focused edit and report the changed files so Abdel can review manually.

## User Preference: Frontend Claude Handoff Scope

Do not hand every frontend fix or UI change to terminal Claude. Handle routine frontend work directly in Codex, including bug fixes, modals, forms, copy, spacing, filters, scrolling, workflow adjustments, and constrained component polish.

Use terminal Claude for larger frontend design work where a second design pass is materially useful, such as landing pages, new screens, major redesigns, brand or visual direction, complex interaction design, or broad UX polish.

## User Preference: Spreadsheet Editing

Do not automatically open Excel or spreadsheet files after every workbook change unless Abdel explicitly asks to open the file in the current request. Make the edit, run only the necessary checks, and report the changed files.

## User Preference: Spreadsheet Subtitles

Do not add explanatory sublines, subtitles, helper text, or instructional text inside spreadsheet sheets unless Abdel explicitly asks for them in the current request.

## User Preference: AI Screening and Extraction Models

Do not use Gemini for AI screening, AI extraction, AI review, or other project AI functions unless Abdel explicitly asks for Gemini in the current request.

Run project AI functions locally from the current workspace and apply results to the database from that local workflow. Default to GPT-5.5 with medium reasoning when available. If that exact model is unavailable, use the closest suitable local Codex/OpenAI terminal model with explicit reasoning, record the model used, and explain the substitution before applying results.

## User Preference: Full-Text Derivable Denominators

For full-text screening, treat a denominator as `paper_derivable` when the paper reports cohort-level inputs that can be multiplied into a study total without extra assumptions, such as mean match minutes times explicit participant count, as long as the numerator is cohort-wide and the at-risk frame is clear.

When using this rule, record the exact reported inputs and note if the implied total is approximate because the published mean is rounded. Do not exclude solely because the paper reports a cohort mean instead of the multiplied total.

## User Preference: AI Screening Decision Integrity

Human screening votes are immutable audit records. Never change, replace, remove, or "restore" a human vote by editing `metadata.titleAbstractDecisions`, reviewer decision arrays, reviewer IDs/names, vote timestamps, or manual-review fields unless Abdel explicitly asks for that exact human-vote repair in the current request.

When Abdel asks to update title/abstract AI screening decisions, re-review conflicts, apply updated criteria, or update AI recommendations, treat that as an AI recommendation update only. Use the project AI screening workflow to update `ai_*` fields and criteria/model audit fields. Do not add `resolver_decision` entries, do not resolve conflicts, do not promote to full text manually, and do not delete or create full-text placeholders unless Abdel explicitly approves the exact record-level resolver or promotion action.

Legitimate AI-vs-human disagreements should remain conflicts. Report them as conflicts with the human vote, AI recommendation, and criteria-based reason. Only resolve conflicts when Abdel explicitly says to resolve/adjudicate the specific records and approves the exact intended decision for each affected record.

When Abdel asks to update AI recommendations and the local workflow produces corrected recommendation artifacts, do not stop at local JSON/Markdown or local review outputs unless he explicitly asks for a local-only or dry-run result. Carry the same AI recommendation update through the live project apply path as well, updating the web app/database AI fields and then verifying the written values. This applies only to AI recommendation fields and does not permit manual-vote, resolver, or human-decision edits.

## User Preference: Local Corrections Must Reach Live Records

When Abdel asks to correct, replace, refresh, or re-review a paper or screening record that already backs the live app/website, do not stop at a local file swap, local JSON, local Markdown, or local review note unless he explicitly says `local-only`, `dry-run`, or otherwise asks to stop short.

By default, carry the correction through to the live record in the same task. This includes the matching live PDF/storage object when the paper file itself was corrected, and the matching live `ai_*` fields when the AI recommendation was corrected. After writing live changes, verify the stored file hash/path and the written AI fields.

This default does not permit changing human votes, resolver decisions, or other protected manual-review fields without explicit approval for that exact action.

## User Preference: Follow Skills End-to-End

When a repo or local skill clearly applies, follow that skill through its full default workflow instead of stopping at an intermediate artifact. If the skill includes later steps such as upload, database apply, audit logging, verification, or handoff, complete those steps unless Abdel explicitly asks to stop short.

This does not override the approval rules above for visible external actions. If a skill includes an external upload or change that still needs explicit approval, pause only for that approval; otherwise, carry the skill to completion.

## User Preference: Second Search Title/Abstract Freeze

Title/abstract screening for the second search batch `Second search - Ishanka - 2026-05-26` is complete and should not be altered unless Abdel explicitly asks to reopen that stage.

Do not rerun or update second-search title/abstract AI recommendations, criteria/model audit fields, offline packs, conflict handling, resolver state, or promotion state by default. If a new rule or edge case comes up for that batch, apply it in full-text screening instead unless Abdel explicitly says to change title/abstract screening.

## User Preference: Descriptive Audit and Backlog Tracking

When creating or updating audits, backlogs, manifests, reports, or tracking files, make the scope and source context explicit in the file name and opening summary. Include the search/import wave when relevant, such as `original search`, `second search`, or `second updated search`, plus the workflow stage, date, and whether the file is a queue, dry run, upload log, unresolved backlog, or final audit.

Do not use vague names like `new papers`, `missing PDFs`, or `current audit` unless the surrounding path and first lines make the exact dataset unambiguous. Tracking should clearly distinguish already uploaded/found records, records previously searched without success, newly promoted records still needing a first search, and records skipped because they already have a local or database PDF.
