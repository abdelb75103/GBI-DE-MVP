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
