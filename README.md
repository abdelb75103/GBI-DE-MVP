# GBI DE MVP Repository

Repository layout is split by responsibility:

- `fifa-gbi-data-extraction/` - main Next.js application
- `docs/setup/` - setup, launch, and testing guides
- `docs/implementation/` - implementation notes and fix summaries
- `docs/product/` - PRD and MVP specs
- `docs/planning/` - planning artifacts
- `docs/reports/` - review and checklist docs
- `sql/setup/` - setup and launch SQL scripts
- `sql/admin/` - one-off admin SQL utilities
- `scripts/` - root-level automation helpers
- `scripts/admin/` - operational one-off Node scripts
- `skills/` - reusable extraction skills
- `supabase/` - migrations

Typical workflow:

1. Read `docs/setup/`.
2. Run the required SQL from `sql/setup/`.
3. Work in `fifa-gbi-data-extraction/`.

Generated exports, temp files, and local data dumps should stay out of the tracked repo layout.
