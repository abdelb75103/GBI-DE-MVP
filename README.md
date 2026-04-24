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

## Obsidian Vault Sync

From `fifa-gbi-data-extraction/`:

```bash
npm run kb:sync
npm run kb:synthesize
npm run kb:check
```

Defaults:

- sync target: `~/Desktop/Obsidian Vault/FIFA GBI Knowledge Vault`
- included papers: all live papers except `archived`, `no_exposure`, and `retrospective_substudy_analysis`
- query-first artifacts: `query-card.md`, `citation.md`, `_indexes/by-author-all.md`, `_indexes/by-title-keyword.md`, `_indexes/by-journal.md`
- synthesis artifacts: `_syntheses/topics/<topic>/index.md`, `evidence-table.md`, `claims.md`, `gaps.md`, `figures.md`

Optional overrides:

```bash
OBSIDIAN_VAULT_PATH="/abs/path/to/vault" npm run kb:sync
npm run kb:synthesize -- --topic concussion
npm run kb:sync -- --paper S123
```

Query guidance:

- use `_indexes/by-author-all.md`, `_indexes/by-doi.md`, `_indexes/by-title-keyword.md`, and `_indexes/by-journal.md` before searching raw full text
- use `papers/S###/query-card.md` and `papers/S###/citation.md` before `fulltext.md` and `chunks/`
- for cross-paper questions, use `_syntheses/index.md` and the relevant `_syntheses/topics/<topic>/` folder before manually opening multiple paper files
- papers with ambiguous author parsing are listed in `_indexes/review/author-extraction-uncertain.md` and excluded from the confident coauthor index
