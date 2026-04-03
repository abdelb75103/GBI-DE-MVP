# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a monorepo. The main Next.js application lives in `fifa-gbi-data-extraction/`. Supporting extraction workflows live in `skills/` and `scripts/`.

```
fifa-gbi-data-extraction/   # Main app (Next.js + Supabase + Gemini)
skills/
  gbi-live-extraction/      # Terminal-first manual extraction skill
  covidence-pdf-retrieval/  # PDF retrieval from Covidence
scripts/                    # Node.js Chrome/Covidence automation utilities
supabase/                   # DB config
```

## Commands

All commands run from `fifa-gbi-data-extraction/`:

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build (uses --webpack flag)
npm run lint       # ESLint check
npm run covidence:import-pdfs  # Import PDFs from Covidence
```

No automated test suite exists. Manual verification from `fifa-gbi-data-extraction/`: `npm run db:verify-setup`.

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

- Primary/fallback Gemini model selection with rate-limit handling in `service.ts`
- `jsonrepair` used to handle malformed AI JSON responses
- Gemini API key is stored per-user in the `settings` table, loaded via `use-gemini-api-key.ts` hook

### Auth / Profiles

No traditional auth — profile-based local identity. `ActiveProfileProvider` holds the active session context. Profile ID (UUID string) is stored as `updated_by` on extraction fields, not an enum.

## Live Extraction Skill

For terminal-based manual extraction (the primary workflow), use the `gbi-live-extraction` skill (`skills/gbi-live-extraction/SKILL.md`). Key rules:
- Default to **manual extraction**, not Gemini AI passes
- Do not overwrite non-blank extraction values unless the user explicitly asks
- Preserve app-assigned `studyId` — never rewrite or clear it
- Track review state in `fifa-gbi-data-extraction/docs/review-backlog.md`

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
