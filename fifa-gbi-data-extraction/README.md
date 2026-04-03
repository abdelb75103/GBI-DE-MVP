## FIFA GBI Data Extraction App

Main Next.js application for the GBI extraction workflow.

### Common Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:verify-setup
npm run covidence:import-pdfs -- --manifest <csv> --references <csv> --files-dir <dir> [--apply]
```

### Environment

Create `.env.local` in this directory with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Gemini API keys are stored per profile in the database rather than in `.env.local`.

### Key Directories

- `src/app/` - App Router pages and API routes
- `src/components/` - UI components
- `src/lib/` - DB access, extraction logic, exporters, and shared types
- `scripts/` - app-specific operational scripts

### Related Repo-Level Assets

- `../docs/setup/` - setup and launch docs
- `../docs/implementation/` - implementation notes and summaries
- `../sql/` - setup and admin SQL scripts
