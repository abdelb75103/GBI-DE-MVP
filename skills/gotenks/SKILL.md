---
name: gotenks
description: Blend Codex and Claude into one polished markdown deliverable. Use when Codex needs to produce a high-quality report, brief, memo, summary, plan, or prose-first spec from a user prompt plus optional local text files and optional shared web research. Prefer this skill when the writing quality matters enough to justify dual-model drafting and consensus-first synthesis. Do not use it for code generation, repo mutation, or binary document processing.
---

# Gotenks

Use Gotenks when one polished markdown deliverable matters more than raw speed. The workflow builds one shared context packet, runs a Codex draft, runs a Claude draft, synthesizes them into one merged markdown file, and then runs a final humanizer pass before returning the deliverable.

If web research is needed, prefer stacking `$web-research-packet` first and then pass the resulting `research.md` into Gotenks with `--research-file`. Keep `--web` as a fallback for one-command runs.

## Workflow

1. Build the shared packet.
   Save `prompt.md`. If the user supplies `--source`, ingest readable UTF-8 text files only and write `context.md`. If the user asks for web research, run one Codex research prepass and save `research.md`.
2. Draft independently.
   Run Codex with `gpt-5.4` and `high` reasoning by default. Run Claude with `opus` and `medium` effort by default. Keep both runs non-mutating.
3. Synthesize consensus-first.
   Use a fresh Claude reviewer pass with `claude-opus-4-6` and `high` effort by default to merge both drafts into one seamless markdown deliverable. Prefer shared conclusions first, but preserve the strongest structure from either draft. Save this artifact as `merged.md`.
4. Humanize the merged draft.
   Run a final Claude pass with `claude-opus-4-6` and `high` effort by default. Apply the humanizer guidance while keeping the meaning, citations, and markdown structure intact. Write the result to `final.md`.
5. Preserve artifacts.
   Every run should keep `prompt.md`, optional `context.md`, optional `research.md`, `codex.md`, `claude.md`, `merged.md`, `final.md`, and `run.json`.

The humanizer stage is bundled with this repo via `../humanizer-main` and should be installed into `~/.codex/skills/humanizer` by `./scripts/install_local.sh` so Gotenks can use the same custom humanizer from any working directory.

## Commands

Draft from a prompt only:

```bash
python3 scripts/run_gotenks.py "Write a decision memo from these notes."
```

Draft from prompt plus local sources:

```bash
python3 scripts/run_gotenks.py --source notes.md --source research/ "Turn this material into a launch brief."
```

Layer a separate research skill before Gotenks:

```bash
python3 ../web-research-packet/scripts/run_research_packet.py --research-mode deep --source notes.md "Research this topic into a reusable packet."
python3 scripts/run_gotenks.py --research-file ../path/to/research.md --source notes.md "Write a cited research memo."
```

Use the built-in web fallback only when you want one command:

```bash
python3 scripts/run_gotenks.py --web --research-mode deep --research-timeout 420 --source notes.md "Write a cited research memo."
```

Skip the humanizer pass when you want the raw merged draft for debugging or benchmarking:

```bash
python3 scripts/run_gotenks.py --skip-humanizer "Write a decision memo from these notes."
```

Install the skill into the auto-discovery path:

```bash
./scripts/install_local.sh
```

Run the benchmark harness:

```bash
python3 scripts/run_benchmark.py
```

## Boundaries

- Use Gotenks for prose-first markdown deliverables only.
- Keep sources to readable UTF-8 text files and directories that mostly contain text.
- Do not use Gotenks for code generation, code edits, migrations, or binary file workflows.
- Prefer a prebuilt `--research-file` from `$web-research-packet` when research quality matters.
- When the built-in `--web` flag is used, treat the Codex research prepass as the shared source of truth for both draft models.
- Use `--research-mode deep` when web accuracy matters more than latency. Use `--research-timeout` if the shared research pass still needs more time in your environment.
- The final pass uses `$humanizer` by default. Use `--skip-humanizer` if you explicitly want the raw consensus merge instead.
- By default, the synthesis reviewer and finalizer both run on `claude-opus-4-6` with `high` effort.

## Resources

- `scripts/run_gotenks.py`: main dual-model runner.
- `scripts/run_benchmark.py`: benchmark harness for `gotenks`, `codex-only`, and `claude-only`.
- `scripts/install_local.sh`: creates or refreshes the symlinks in `~/.codex/skills/gotenks` and `~/.codex/skills/humanizer`.
- `references/benchmark-rubric.md`: rubric and human review guidance for benchmark runs.
- `benchmarks/prompts.json`: seeded nine-prompt benchmark corpus with fixture-backed tasks.
