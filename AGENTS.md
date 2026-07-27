# FIFA GBI Repository Instructions

## Instruction Routing

This root file applies to every task. Load only the task branch that matches the work; do not preload all branches.

| Task | Additional instructions |
| --- | --- |
| Next.js UI, API, database code, app configuration, or deployment | `fifa-gbi-data-extraction/src/AGENTS.md` |
| Title/abstract screening, full-text screening, AI recommendations, criteria, conflicts, or promotion state | `agent-instructions/screening/AGENTS.md` plus the matching screening skill |
| Manual extraction, extraction QA/apply, population layouts, Backlog 2, or extraction status | `agent-instructions/extraction/AGENTS.md` plus `skills/gbi-live-extraction/SKILL.md` |
| Covidence PDF retrieval | `skills/covidence-pdf-retrieval/SKILL.md` |
| Translation upload | `skills/covidence-translation-upload/SKILL.md` |
| Translated-PDF appendix work | `skills/gbi-translated-pdf-appendix/SKILL.md` |

`fifa-gbi-data-extraction/src/AGENTS.md` is discovered automatically for files under `src/`. The screening and extraction branches are semantic, so read them explicitly even when the files being changed live under `scripts/`, `data/`, or `docs/`. If a task spans domains, load only the branches it truly touches. Task-specific branches override generic repository guidance where they are more specific; global safety and approval rules still apply.

## Repository Map

- `fifa-gbi-data-extraction/`: Next.js application, app-specific scripts, tests, live-workflow data, and review backlogs.
- `skills/`: reusable screening, extraction, retrieval, and translation workflows.
- `scripts/`: root Covidence/Chrome automation.
- `docs/`: setup, implementation, product, planning, reports, and research notes.
- `sql/`: setup and administrative SQL.
- `supabase/`: database configuration and migrations.
- `agent-instructions/`: semantic task branches that should not be loaded for unrelated work.

There are two Node workspaces: the repository root for Covidence/Chrome automation and `fifa-gbi-data-extraction/` for the application.

## Shared Live-Data Safety

The application and local operational scripts can access live Supabase data. A task-specific screening or extraction request authorizes only the writes defined by its routed branch and skill. It does not authorize unrelated paper, vote, resolver, permission, storage, or deployment changes.

Human screening votes are immutable unless Abdel requests the exact vote repair. Never infer permission to change reviewer IDs, decisions, timestamps, resolver entries, or manual-review state from a request to update AI recommendations or extraction data.

Preserve existing worktree changes and generated audit history. Do not commit or push unless Abdel asks in the current request.

## Root Automation

Run root Covidence/Chrome commands from the repository root. Common scripts include `npm run covidence:prepare`, `covidence:collect`, `covidence:download`, `covidence:query`, and `chrome:*`. These may interact with signed-in or shared systems; follow the applicable skill and external-action approval rules.

## Instruction Maintenance

Keep the root as a router and shared safety layer. Put app implementation details in `fifa-gbi-data-extraction/src/AGENTS.md`, screening rules in the screening branch, and extraction rules in the extraction branch. Keep each sibling `CLAUDE.md` as exactly `@AGENTS.md`.
