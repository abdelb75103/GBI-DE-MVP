# FIFA GBI Web App Instructions

## Scope

Use this file for Next.js application work under `src/` and, when routed from the repository root, for app configuration such as `package.json`, `next.config.ts`, Tailwind, TypeScript, and app-specific scripts. Screening and live-extraction data work must also load the matching semantic branch named by the root `AGENTS.md`.

## Stack And Architecture

- Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, and Supabase/Postgres/Storage.
- Alias: `@/*` maps to `src/*`.
- `src/app/api/`: REST routes for extraction, papers, uploads, exports, screening, profiles, and admin flows.
- `src/app/paper/[paperId]/`: extraction workspace.
- `src/app/dashboard/`: paper list, upload approval, dedupe, and AI metrics.
- `src/components/extraction-tabs-panel.tsx`: main extraction UI.
- `src/lib/db/`: domain-specific Supabase access.
- `src/lib/extraction/`: schema, prompt, client, and extraction orchestration.
- `src/lib/types.ts`: core application types.

The ten extraction tabs are `studyDetails`, `participantCharacteristics`, `definitions`, `exposure`, `injuryOutcome`, `illnessOutcome`, `injuryTissueType`, `injuryLocation`, `illnessRegion`, and `illnessEtiology`.

## Data Contracts

1. PDFs are attached through `paper_files` and Supabase Storage.
2. Approved uploads create or update `papers` records.
3. `papers.assigned_to` controls extraction-session ownership.
4. Tab records live in `extractions`; field values live in `extraction_fields`.
5. Structured population data are dual-written through `population_groups` and `population_values`.
6. `extraction_fields.updated_by` is text containing the profile UUID.
7. `papers.assigned_study_id` is the human-readable `S###` identifier and must remain stable.

Do not change API response shapes or extraction/population contracts without updating every consumer in the same pass.

## Profiles And AI

There is no traditional user auth. `ActiveProfileProvider` supplies local profile identity; profile UUIDs are written to extraction fields.

The app contains Gemini integration, but do not execute Gemini screening, extraction, or review unless Abdel explicitly requests Gemini. Gemini keys are stored per profile in the database. Maintaining the integration code does not authorize running it against live records.

## Commands

Run from `fifa-gbi-data-extraction/`:

```bash
npm run dev
npm run lint
npm run build
npm run db:verify-setup
```

There is no unified automated test runner. Run relevant `tests/*.test.mjs` files directly with `node`. Match verification to risk; do not restart an existing dev server unless Abdel asks.

## Environment

`.env.local` requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for service-role scripts. Never expose their values.

## UI Work

Use the global responsive and design-skill rules. Check desktop and mobile widths for UI changes, keep wide content inside its own scroll container, and preserve 44px touch targets.

## GitHub And Vercel Deployment

The private GitHub repository is `abdelrahmans-projects/fifa-gbi-data-extraction`. Its production Git integration targets Vercel team `AbdelRahman's projects` (`team_kOe7GN58FtvUNS0tsG7aGYww`). The local `.vercel/project.json` and CLI login `abdelbabiker-3247` point to a different team, `abdel-babikers-projects`; do not use that local link to judge or trigger production deployment.

Deployment commits must use repository-local author `abdelb75103 <210773581+abdelb75103@users.noreply.github.com>`, mapped to Vercel owner account `abdelbabiker-7113` (`abdel.babiker@ucd.ie`). Private-repository test commit `2fdd3cb` verified this identity triggers production deployment. Before a requested deployment commit, verify repository visibility, local git identity, GitHub author mapping, and the mapped user's required production-team membership/ownership. Pushes to `main` should produce production deployments; other branches produce previews. After a requested push, verify GitHub's Vercel status. If it reports that the Git author lacks project access, report the access problem rather than deploying through the unrelated local Vercel project.
