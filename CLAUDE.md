# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a monorepo. The main Next.js application lives in `fifa-gbi-data-extraction/`. Supporting extraction/automation workflows live in `skills/` and `scripts/`. See `README.md` for the full `docs/` and `sql/` breakdown.

```
fifa-gbi-data-extraction/   # Main app (Next.js + Supabase + AI extraction)
skills/                     # Reusable workflows (each has SKILL.md)
  gbi-live-extraction/             # Terminal-first manual extraction (primary workflow)
  covidence-pdf-retrieval/         # Reconcile/download Covidence PDFs
  covidence-translation-upload/    # Upload English translations to Covidence
  fifa-title-abstract-screening/   # Advisory AI title/abstract screening review
  gbi-translated-pdf-appendix/     # Build appendix PDFs for translated papers
scripts/                    # Root-level Node.js Chrome/Covidence + Python automation
sql/                        # setup/ + admin/ SQL scripts
docs/                       # setup, implementation, product, research notes
supabase/                   # DB config + migrations
```

There are **two** `package.json` files: the app's (`fifa-gbi-data-extraction/`) and a root-level one for Covidence/Chrome automation (`npm run covidence:*`, `chrome:*` from the repo root).

## Commands

All commands run from `fifa-gbi-data-extraction/`:

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build (uses --webpack flag)
npm run lint       # ESLint check
npm run covidence:import-pdfs   # Import PDFs from Covidence
npm run second-search:import    # Import second-search reference batch (data/imports/)
npm run second-search:audit     # Audit the second-search import
npm run kb:sync                 # Sync papers to Obsidian vault (see README for kb:synthesize / kb:check)
```

No automated test suite / runner exists. Verify DB setup from `fifa-gbi-data-extraction/`: `npm run db:verify-setup`. Ad-hoc `*.test.mjs` files under `tests/` are run directly with `node`.

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TailwindCSS v4, Supabase (Postgres + Storage), Google Gemini AI, TypeScript strict mode.

**Path alias:** `@/*` → `src/*`

### Data Flow

1. PDFs uploaded → stored in Supabase Storage → `files` table
2. Upload approval workflow (`upload_queue`) → papers enter `uploaded` status
3. Extractor opens a paper → session locked (`papers.assigned_to`)
4. AI extraction via Gemini → `extraction_results` (tab snapshots) + `extraction_fields` (field-level values with `updated_by` profile ID)
5. Human review/edit → same tables, `updated_by` = reviewer profile ID
6. Export → CSV/JSON via `export_jobs`

### Key Directories

- `src/app/api/` — REST API routes (extract, papers, uploads, exports, admin)
- `src/app/paper/[paperId]/` — Extraction workspace
- `src/app/dashboard/` — Papers list, upload approvals, dedup, AI metrics
- `src/components/` — React components; `extraction-tabs-panel.tsx` is the main extraction UI
- `src/lib/db/` — Supabase query functions (one file per domain: papers, extractions, files, exports, duplicates)
- `src/lib/extraction/` — Gemini integration: `service.ts` (orchestration), `schema.ts` (200+ field definitions across 10 tabs), `prompt.ts`, `gemini-client.ts`
- `src/lib/types.ts` — Core TypeScript types (Paper, ExtractionFieldResult, PaperStatus, ExtractionTab, etc.)

### Extraction Tabs (10 total)

`studyDetails` → `participantCharacteristics` → `definitions` → `exposure` → `injuryOutcome` → `illnessOutcome` → `injuryTissueType` → `injuryLocation` → `illnessRegion` → `illnessEtiology`

### AI Extraction

The in-app extraction engine is Gemini, but **do not run Gemini** for AI screening/extraction/review unless the user explicitly asks (see `AGENTS.md`). Default to running AI functions locally with GPT-5.5 (medium reasoning) and applying results to the DB from that local workflow; record the model used and explain any substitution.

App-side Gemini integration (when explicitly requested):
- Primary/fallback Gemini model selection with rate-limit handling in `service.ts`
- `jsonrepair` used to handle malformed AI JSON responses
- Gemini API key is stored per-user in the `settings` table, loaded via `use-gemini-api-key.ts` hook

### AI Screening Integrity

Human screening votes are immutable audit records. When re-reviewing title/abstract AI recommendations or applying updated criteria, update only the AI recommendation fields through the project workflow; do not edit `metadata.titleAbstractDecisions`, reviewer votes, resolver decisions, manual-review fields, or full-text promotion records.

AI-vs-human disagreements are legitimate conflicts unless Abdel explicitly asks to resolve/adjudicate the exact records and approves the intended resolver decision. Never convert a conflict into a resolver decision just because the AI recommendation changed.

### Auth / Profiles

No traditional auth — profile-based local identity. `ActiveProfileProvider` holds the active session context. Profile ID (UUID string) is stored as `updated_by` on extraction fields, not an enum.

## Live Extraction Skill

For terminal-based manual extraction (the primary workflow), use the `gbi-live-extraction` skill (`skills/gbi-live-extraction/SKILL.md`). Key rules:
- Default to **manual extraction**, not Gemini AI passes
- Do not overwrite non-blank extraction values unless the user explicitly asks
- Preserve app-assigned `studyId` — never rewrite or clear it
- Track review state in `fifa-gbi-data-extraction/docs/review-backlog.md`

## Working-Style Rules (`AGENTS.md`)

`AGENTS.md` at the repo root holds binding user preferences. Highlights:
- **AI models:** default to local GPT-5.5; do not use Gemini unless explicitly asked (see above).
- **Dev servers:** do not kill/restart running local servers unless asked; reuse the existing one.
- **Commits:** do not create/amend/push commits unless the user explicitly asks for commit work.
- **External/plugin actions** (email, shared docs, Covidence uploads, PR merges, calendar, permissions): present exactly what will change and who is affected, then act only after explicit approval.
- **Cosmetic tweaks:** make the focused edit and report changed files; skip extended verification unless asked.
- **Spreadsheets:** don't auto-open files after edits; don't add subtitles/helper text unless asked.

## Environment

`.env.local` (inside `fifa-gbi-data-extraction/`) requires:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Gemini API key is stored in DB per user, not in `.env`

## Database Notes

- `extraction_fields.updated_by` is TEXT (profile ID UUID), not an enum
- `papers.assigned_study_id` stores human-readable IDs (S001, S002, …)
- Session concurrency controlled via `papers.assigned_to`
- Deduplication tracked in `paper_duplicates` table before extraction begins

## User Preference: Local Dev Servers

Do not kill, stop, or restart local dev servers unless Abdel explicitly asks for that in the current request. If a local verification step needs a fresh server and one is already running, use the existing server when possible or report the stale-server limitation instead of terminating it.

## User Preference: External Plugin Actions

For any external plugin or connector action where other people could see the result or be affected, do not perform the action unless Abdel has explicitly reviewed and approved the exact action in the current request.

This includes, but is not limited to, sending emails or messages, posting comments, editing shared documents, creating or modifying calendar invites, granting or changing permissions, submitting forms, publishing content, merging pull requests, or making changes in systems used by other people.

Before taking one of these actions, present what will be changed or sent, who can see it or who is affected, and the exact target account, file, thread, recipient, or permission. Proceed only after Abdel clearly confirms approval.

## User Preference: Commits

Do not create, amend, rewrite, or push commits unless Abdel explicitly asks for commit or push work in the current request. Code edits, file changes, and verification do not imply permission to commit.

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
