#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

DEFAULT_CODEX_MODEL = "gpt-5.4"
DEFAULT_CODEX_EFFORT = "high"
DEFAULT_CLAUDE_MODEL = "opus"
DEFAULT_CLAUDE_EFFORT = "medium"
DEFAULT_REVIEWER_MODEL = "claude-opus-4-6"
DEFAULT_REVIEWER_EFFORT = "high"
DEFAULT_FINAL_MODEL = "claude-opus-4-6"
DEFAULT_FINAL_EFFORT = "high"
DEFAULT_HUMANIZER_SKILL = "humanizer"
DEFAULT_RUN_ROOT = Path(".gotenks/runs")
MAX_SOURCE_FILE_BYTES = 64 * 1024
MAX_SOURCE_TOTAL_BYTES = 256 * 1024
DEFAULT_COMMAND_TIMEOUT_SECONDS = 120
DEFAULT_RESEARCH_MODE = "standard"
RESEARCH_TIMEOUTS = {
    "standard": 180,
    "deep": 420,
}
WRITING_KEYWORDS = {
    "report",
    "brief",
    "summary",
    "memo",
    "plan",
    "spec",
    "proposal",
    "update",
    "outline",
    "analysis",
}
CODE_KEYWORDS = {
    "code",
    "function",
    "class",
    "refactor",
    "bug",
    "endpoint",
    "migration",
    "component",
    "script",
    "test suite",
    "unit test",
    "typescript",
    "python",
    "javascript",
    "sql",
    "html",
    "css",
}


@dataclass
class StageError(Exception):
    stage: str
    message: str
    command: Sequence[str] | None = None
    stderr: str | None = None


@dataclass
class SourceIngestionResult:
    markdown: str
    included: list[dict[str, Any]]
    skipped: list[dict[str, str]]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(text: str, fallback: str = "run", max_length: int = 48) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not normalized:
        normalized = fallback
    return normalized[:max_length].strip("-") or fallback


def resolve_path(raw_path: str, cwd: Path) -> Path:
    path = Path(raw_path).expanduser()
    return path if path.is_absolute() else (cwd / path).resolve()


def path_for_display(path: Path, cwd: Path) -> str:
    try:
        return str(path.relative_to(cwd))
    except ValueError:
        return str(path)


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, content: str) -> None:
    ensure_parent(path)
    path.write_text(content, encoding="utf-8")


def shell_join(command: Sequence[str]) -> str:
    return shlex.join(command)


def normalize_subprocess_output(value: str | bytes | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore").strip() or None
    return value.strip() or None


def default_research_timeout_seconds(mode: str) -> int:
    return RESEARCH_TIMEOUTS[mode]


def read_prompt(args: argparse.Namespace) -> str:
    provided_inputs = 0
    if args.prompt_file:
        provided_inputs += 1
    if args.prompt:
        provided_inputs += 1
    stdin_text = None
    if not sys.stdin.isatty():
        stdin_text = sys.stdin.read()
        if stdin_text.strip():
            provided_inputs += 1
        else:
            stdin_text = None

    if provided_inputs == 0:
        raise StageError("input", "Provide a prompt with stdin, positional text, or --prompt-file.")
    if provided_inputs > 1:
        raise StageError("input", "Use exactly one prompt input method per run.")

    if args.prompt_file:
        path = resolve_path(args.prompt_file, Path.cwd())
        return path.read_text(encoding="utf-8").strip()
    if args.prompt:
        return " ".join(args.prompt).strip()
    assert stdin_text is not None
    return stdin_text.strip()


def read_research_file(raw_path: str | None, cwd: Path) -> tuple[str | None, str | None]:
    if not raw_path:
        return None, None
    path = resolve_path(raw_path, cwd)
    try:
        content = path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise StageError("input", f"Could not read research file: {path}") from exc
    if not content:
        raise StageError("input", f"Research file is empty: {path}")
    return content + "\n", str(path)


def is_obviously_code_request(prompt: str) -> bool:
    prompt_lower = prompt.lower()
    writing_hits = sum(1 for keyword in WRITING_KEYWORDS if keyword in prompt_lower)
    code_hits = sum(1 for keyword in CODE_KEYWORDS if keyword in prompt_lower)
    return code_hits >= 2 and writing_hits == 0


def candidate_source_files(source_paths: Sequence[str], cwd: Path) -> tuple[list[Path], list[dict[str, str]]]:
    files: list[Path] = []
    skipped: list[dict[str, str]] = []
    seen: set[Path] = set()
    for raw_source in source_paths:
        path = resolve_path(raw_source, cwd)
        display = path_for_display(path, cwd)
        if not path.exists():
            skipped.append({"path": display, "reason": "Path does not exist."})
            continue
        if path.is_file():
            if path not in seen:
                files.append(path)
                seen.add(path)
            continue
        if path.is_dir():
            for child in sorted(path.rglob("*")):
                if child.is_file() and child not in seen:
                    files.append(child)
                    seen.add(child)
            continue
        skipped.append({"path": display, "reason": "Unsupported source type."})
    return files, skipped


def decode_source(path: Path) -> str | None:
    try:
        sample = path.read_bytes()
    except OSError:
        return None
    if b"\0" in sample:
        return None
    try:
        sample[: min(len(sample), 8192)].decode("utf-8")
    except UnicodeDecodeError:
        return None
    return sample.decode("utf-8", errors="ignore")


def collect_source_context(source_paths: Sequence[str], cwd: Path) -> SourceIngestionResult:
    files, skipped = candidate_source_files(source_paths, cwd)
    included: list[dict[str, Any]] = []
    total_bytes = 0
    lines = [
        "# Local Context",
        "",
        "This packet was assembled before drafting so both models see the same local source material.",
        "",
    ]

    if source_paths:
        lines.append("## Included Files")
        lines.append("")

    for path in files:
        display = path_for_display(path, cwd)
        decoded = decode_source(path)
        if decoded is None:
            skipped.append({"path": display, "reason": "Skipped non-UTF-8 or binary content."})
            continue
        raw_bytes = decoded.encode("utf-8")
        if total_bytes >= MAX_SOURCE_TOTAL_BYTES:
            skipped.append({"path": display, "reason": "Skipped because the run hit the total source byte budget."})
            continue
        allowed_bytes = min(len(raw_bytes), MAX_SOURCE_FILE_BYTES, MAX_SOURCE_TOTAL_BYTES - total_bytes)
        snippet = raw_bytes[:allowed_bytes].decode("utf-8", errors="ignore").rstrip()
        truncated = allowed_bytes < len(raw_bytes)
        total_bytes += len(snippet.encode("utf-8"))
        included.append(
            {
                "path": display,
                "characters": len(snippet),
                "excerpt": snippet,
                "truncated": truncated,
            }
        )
        truncation_note = " (truncated)" if truncated else ""
        lines.append(f"- `{display}`: {len(snippet)} chars{truncation_note}")
        lines.append("")

    if included:
        lines.extend(["## Documents", ""])
        for item in included:
            path = item["path"]
            lines.extend(
                [
                    f"### `{path}`",
                    "",
                    "```text",
                    item["excerpt"],
                    "```",
                    "",
                ]
            )
    else:
        lines.extend(
            [
                "No readable UTF-8 text sources were included.",
                "",
            ]
        )

    if skipped:
        lines.extend(["## Skipped Entries", ""])
        for item in skipped:
            lines.append(f"- `{item['path']}`: {item['reason']}")
        lines.append("")

    summary = [
        {
            "path": item["path"],
            "characters": item["characters"],
            "truncated": item["truncated"],
        }
        for item in included
    ]
    return SourceIngestionResult(markdown="\n".join(lines).strip() + "\n", included=summary, skipped=skipped)


def build_research_payload(user_prompt: str, context_markdown: str | None, research_mode: str) -> str:
    if research_mode == "deep":
        mode_guidance = [
            "Research deeply and take the time needed to verify important claims before concluding.",
            "Use enough web searches to cross-check contested points, but stop once the answer is well-supported.",
            "Aim for 5-10 strong sources when the topic warrants it, and prioritize primary sources and official documentation.",
        ]
    else:
        mode_guidance = [
            "Research efficiently and stop once you have enough high-signal sources to answer accurately.",
            "Prefer 3-6 strong sources over a broad literature sweep unless the prompt clearly requires deeper coverage.",
            "Prioritize primary sources and official documentation.",
        ]
    sections = [
        "# GOTENKS_RESEARCH_TASK",
        "",
        "Research the user's writing task with live web search and return a compact markdown research packet.",
        "Use recent, authoritative sources when recency matters.",
        *mode_guidance,
        "Return these sections only:",
        "## What To Answer",
        "## Key Findings",
        "## Risks And Unknowns",
        "## Source List",
        "",
        "In `## Source List`, use markdown bullets with direct links and one short relevance note per source.",
        "",
        "## User Request",
        user_prompt,
    ]
    if context_markdown:
        sections.extend(["", "## Local Context Packet", context_markdown.strip()])
    return "\n".join(sections).strip() + "\n"


def build_draft_payload(user_prompt: str, context_markdown: str | None, research_markdown: str | None, model_name: str) -> str:
    sections = [
        "# GOTENKS_DRAFT_TASK",
        "",
        f"You are drafting one independent markdown deliverable for the Gotenks workflow as the {model_name} pass.",
        "Write a polished markdown response that directly answers the user's request.",
        "Use headings when they improve clarity. State assumptions when material details are missing.",
        "Do not mention Gotenks, Codex, Claude, or the fact that another model will also draft this task.",
        "Return the deliverable itself, not commentary about the deliverable or notes that the answer is above.",
        "Return markdown only.",
        "",
        "## User Request",
        user_prompt,
    ]
    if context_markdown:
        sections.extend(["", "## Shared Local Context", context_markdown.strip()])
    if research_markdown:
        sections.extend(["", "## Shared Research Packet", research_markdown.strip()])
    return "\n".join(sections).strip() + "\n"


def build_synthesis_payload(
    user_prompt: str,
    context_markdown: str | None,
    research_markdown: str | None,
    codex_draft: str,
    claude_draft: str,
) -> str:
    sections = [
        "# GOTENKS_SYNTHESIS_TASK",
        "",
        "You are synthesizing two writing drafts into one final markdown deliverable.",
        "Follow a consensus-first policy:",
        "1. Prefer points both drafts support.",
        "2. Keep stronger unique material only when it improves clarity, completeness, or usefulness without introducing contradiction.",
        "3. Preserve the strongest structure from either draft instead of flattening both into generic prose.",
        "4. If one draft has a clearer outline, better headings, better scannability, or stronger section ordering, keep that structure and improve it.",
        "5. For research memos, briefs, reports, and decision documents, prefer explicit sections such as summary, key findings, risks, recommendations, or practical guidance when they fit the task.",
        "6. Preserve bullets, tables, and section breaks when they materially improve readability.",
        "7. Produce one seamless final deliverable, not a compare-and-contrast memo.",
        "8. Preserve citations when the research packet provides them and they remain relevant.",
        "",
        "The goal is not just agreement. The goal is the best final document shape plus the best supported content.",
        "",
        "## User Request",
        user_prompt,
    ]
    if context_markdown:
        sections.extend(["", "## Shared Local Context", context_markdown.strip()])
    if research_markdown:
        sections.extend(["", "## Shared Research Packet", research_markdown.strip()])
    sections.extend(
        [
            "",
            "## Draft A",
            codex_draft.strip(),
            "",
            "## Draft B",
            claude_draft.strip(),
        ]
    )
    return "\n".join(sections).strip() + "\n"


def build_humanizer_payload(user_prompt: str, merged_draft: str, humanizer_skill: str) -> str:
    sections = [
        "# GOTENKS_HUMANIZER_TASK",
        "",
        f"Use ${humanizer_skill} to edit the merged markdown deliverable so it reads more naturally and less like generic AI output.",
        "Keep the core meaning, factual claims, citations, headings, bullets, tables, and markdown structure intact unless a small structural change clearly improves readability.",
        "Do not collapse sectioned writing into long unbroken paragraphs.",
        "If the draft already has a good structure, preserve it and improve sentence-level flow inside that structure.",
        "Do not add new facts. Do not mention the humanizer skill, Gotenks, Codex, Claude, or the editing process.",
        "Return the polished final deliverable only.",
        "",
        "## Original User Request",
        user_prompt,
        "",
        "## Merged Draft",
        merged_draft.strip(),
    ]
    return "\n".join(sections).strip() + "\n"


def run_codex_command(
    *,
    codex_bin: str,
    cwd: Path,
    model: str,
    effort: str,
    output_path: Path,
    prompt_text: str,
    search: bool = False,
    timeout_seconds: int = DEFAULT_COMMAND_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    command = [codex_bin]
    if search:
        command.append("--search")
    command.extend(
        [
            "exec",
            "--skip-git-repo-check",
            "-C",
            str(cwd),
            "-s",
            "read-only",
            "-c",
            f'model="{model}"',
            "-c",
            f'model_reasoning_effort="{effort}"',
            "-o",
            str(output_path),
        ]
    )
    ensure_parent(output_path)
    try:
        completed = subprocess.run(
            command,
            input=prompt_text,
            text=True,
            cwd=str(cwd),
            capture_output=True,
            check=False,
            timeout=timeout_seconds,
        )
    except FileNotFoundError as exc:
        raise StageError("command", f"Codex binary not found: {codex_bin}", command=command) from exc
    except subprocess.TimeoutExpired as exc:
        raise StageError(
            "command",
            f"Codex command timed out after {timeout_seconds} seconds.",
            command=command,
            stderr=normalize_subprocess_output(exc.stderr) or normalize_subprocess_output(exc.stdout),
        ) from exc
    if completed.returncode != 0:
        raise StageError(
            "command",
            "Codex command failed.",
            command=command,
            stderr=(completed.stderr or completed.stdout).strip(),
        )
    return {
        "command": command,
        "display": shell_join(command),
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def run_claude_command(
    *,
    claude_bin: str,
    cwd: Path,
    model: str,
    effort: str,
    output_path: Path,
    prompt_text: str,
    timeout_seconds: int = DEFAULT_COMMAND_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    command = [
        claude_bin,
        "-p",
        "--no-session-persistence",
        "--tools",
        "",
        "--permission-mode",
        "dontAsk",
        "--model",
        model,
        "--effort",
        effort,
    ]
    ensure_parent(output_path)
    try:
        completed = subprocess.run(
            command,
            input=prompt_text,
            text=True,
            cwd=str(cwd),
            capture_output=True,
            check=False,
            timeout=timeout_seconds,
        )
    except FileNotFoundError as exc:
        raise StageError("command", f"Claude binary not found: {claude_bin}", command=command) from exc
    except subprocess.TimeoutExpired as exc:
        raise StageError(
            "command",
            f"Claude command timed out after {timeout_seconds} seconds.",
            command=command,
            stderr=normalize_subprocess_output(exc.stderr) or normalize_subprocess_output(exc.stdout),
        ) from exc
    if completed.returncode != 0:
        raise StageError(
            "command",
            "Claude command failed.",
            command=command,
            stderr=(completed.stderr or completed.stdout).strip(),
        )
    write_text(output_path, completed.stdout.strip() + "\n")
    return {
        "command": command,
        "display": shell_join(command),
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def write_run_record(path: Path, record: dict[str, Any]) -> None:
    write_text(path, json.dumps(record, indent=2, sort_keys=True) + "\n")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Gotenks dual-LLM writing workflow.")
    parser.add_argument("prompt", nargs="*", help="Prompt text when not using stdin or --prompt-file.")
    parser.add_argument("--prompt-file", help="Path to a UTF-8 prompt file.")
    parser.add_argument("--source", action="append", default=[], help="Local file or directory to ingest as shared context.")
    parser.add_argument("--web", action="store_true", help="Run a shared Codex web-research prepass.")
    parser.add_argument("--research-file", help="Path to a prebuilt markdown research packet. Use this to layer a separate research skill before Gotenks.")
    parser.add_argument(
        "--research-mode",
        choices=sorted(RESEARCH_TIMEOUTS),
        default=DEFAULT_RESEARCH_MODE,
        help="How thorough the shared web-research prepass should be.",
    )
    parser.add_argument(
        "--research-timeout",
        type=int,
        help="Override the shared web-research timeout in seconds. Defaults by mode: standard=180, deep=420.",
    )
    parser.add_argument("--output-dir", help="Directory where run artifacts should be written.")
    parser.add_argument("--slug", help="Slug to use for the output directory.")
    parser.add_argument("--codex-model", default=DEFAULT_CODEX_MODEL, help="Codex model slug.")
    parser.add_argument("--codex-effort", default=DEFAULT_CODEX_EFFORT, help="Codex reasoning effort.")
    parser.add_argument("--claude-model", default=DEFAULT_CLAUDE_MODEL, help="Claude model alias.")
    parser.add_argument("--claude-effort", default=DEFAULT_CLAUDE_EFFORT, help="Claude effort level.")
    parser.add_argument("--reviewer-model", default=DEFAULT_REVIEWER_MODEL, help="Model used for the synthesis/reviewer stage.")
    parser.add_argument("--reviewer-effort", default=DEFAULT_REVIEWER_EFFORT, help="Effort level for the synthesis/reviewer stage.")
    parser.add_argument("--final-model", default=DEFAULT_FINAL_MODEL, help="Model used for the final humanized draft stage.")
    parser.add_argument("--final-effort", default=DEFAULT_FINAL_EFFORT, help="Effort level for the final humanized draft stage.")
    parser.add_argument("--skip-humanizer", action="store_true", help="Skip the final humanizer pass and copy merged.md to final.md.")
    parser.add_argument("--humanizer-skill", default=DEFAULT_HUMANIZER_SKILL, help="Skill name to invoke for the final humanizer pass.")
    return parser.parse_args(argv)


def default_output_dir(cwd: Path, prompt: str, slug_override: str | None) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = slugify(slug_override or prompt.splitlines()[0][:72])
    return cwd / DEFAULT_RUN_ROOT / f"{timestamp}-{slug}"


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    cwd = Path.cwd()
    prompt = read_prompt(args)
    if args.web and args.research_file:
        raise StageError("input", "Use either --web or --research-file, not both.")
    if is_obviously_code_request(prompt):
        raise StageError(
            "scope",
            "Gotenks v1 is limited to prose-first markdown deliverables and does not support obvious code-generation requests.",
        )

    output_dir = resolve_path(args.output_dir, cwd) if args.output_dir else default_output_dir(cwd, prompt, args.slug)
    output_dir.mkdir(parents=True, exist_ok=True)

    artifacts = {
        "prompt": output_dir / "prompt.md",
        "context": output_dir / "context.md",
        "research": output_dir / "research.md",
        "codex": output_dir / "codex.md",
        "claude": output_dir / "claude.md",
        "merged": output_dir / "merged.md",
        "final": output_dir / "final.md",
        "run": output_dir / "run.json",
    }

    codex_bin = os.environ.get("CODEX_BIN", "codex")
    claude_bin = os.environ.get("CLAUDE_BIN", "claude")
    run_record: dict[str, Any] = {
        "artifacts": {name: str(path) for name, path in artifacts.items()},
        "commands": {},
        "cwd": str(cwd),
        "error": None,
        "inputs": {
            "prompt": prompt,
            "humanizer_enabled": not args.skip_humanizer,
            "humanizer_skill": args.humanizer_skill,
            "research_file": None,
            "research_mode": args.research_mode,
            "research_timeout_seconds": args.research_timeout or default_research_timeout_seconds(args.research_mode),
            "sources": args.source,
            "web": args.web,
        },
        "models": {
            "codex": {"binary": codex_bin, "model": args.codex_model, "effort": args.codex_effort},
            "claude": {"binary": claude_bin, "model": args.claude_model, "effort": args.claude_effort},
            "reviewer": {"binary": claude_bin, "model": args.reviewer_model, "effort": args.reviewer_effort},
            "finalizer": {"binary": claude_bin, "model": args.final_model, "effort": args.final_effort},
        },
        "output_dir": str(output_dir),
        "source_summary": {"included": [], "skipped": []},
        "started_at": now_iso(),
        "status": "running",
    }

    try:
        write_text(artifacts["prompt"], prompt.strip() + "\n")
        write_run_record(artifacts["run"], run_record)

        context_markdown = None
        if args.source:
            source_result = collect_source_context(args.source, cwd)
            write_text(artifacts["context"], source_result.markdown)
            context_markdown = source_result.markdown
            run_record["source_summary"] = {
                "included": source_result.included,
                "skipped": source_result.skipped,
            }
            write_run_record(artifacts["run"], run_record)

        research_markdown = None
        research_file_path = None
        if args.research_file:
            research_markdown, research_file_path = read_research_file(args.research_file, cwd)
            write_text(artifacts["research"], research_markdown)
            run_record["inputs"]["research_file"] = research_file_path
            run_record["commands"]["research"] = {
                "command": None,
                "display": f"external research file: {research_file_path}",
                "returncode": 0,
                "stderr": "",
                "stdout": "",
            }
            write_run_record(artifacts["run"], run_record)
        elif args.web:
            research_payload = build_research_payload(prompt, context_markdown, args.research_mode)
            research_result = run_codex_command(
                codex_bin=codex_bin,
                cwd=cwd,
                model=args.codex_model,
                effort=args.codex_effort,
                output_path=artifacts["research"],
                prompt_text=research_payload,
                search=True,
                timeout_seconds=args.research_timeout or default_research_timeout_seconds(args.research_mode),
            )
            run_record["commands"]["research"] = research_result
            research_markdown = artifacts["research"].read_text(encoding="utf-8")
            write_run_record(artifacts["run"], run_record)

        codex_payload = build_draft_payload(prompt, context_markdown, research_markdown, "Codex")
        codex_result = run_codex_command(
            codex_bin=codex_bin,
            cwd=cwd,
            model=args.codex_model,
            effort=args.codex_effort,
            output_path=artifacts["codex"],
            prompt_text=codex_payload,
        )
        run_record["commands"]["codex_draft"] = codex_result
        write_run_record(artifacts["run"], run_record)

        claude_payload = build_draft_payload(prompt, context_markdown, research_markdown, "Claude")
        claude_result = run_claude_command(
            claude_bin=claude_bin,
            cwd=cwd,
            model=args.claude_model,
            effort=args.claude_effort,
            output_path=artifacts["claude"],
            prompt_text=claude_payload,
        )
        run_record["commands"]["claude_draft"] = claude_result
        write_run_record(artifacts["run"], run_record)

        synthesis_payload = build_synthesis_payload(
            prompt,
            context_markdown,
            research_markdown,
            artifacts["codex"].read_text(encoding="utf-8"),
            artifacts["claude"].read_text(encoding="utf-8"),
        )
        synthesis_result = run_claude_command(
            claude_bin=claude_bin,
            cwd=cwd,
            model=args.reviewer_model,
            effort=args.reviewer_effort,
            output_path=artifacts["merged"],
            prompt_text=synthesis_payload,
        )
        run_record["commands"]["synthesis"] = synthesis_result

        if args.skip_humanizer:
            merged_markdown = artifacts["merged"].read_text(encoding="utf-8")
            write_text(artifacts["final"], merged_markdown)
            run_record["commands"]["humanizer"] = {
                "command": None,
                "display": "skipped via --skip-humanizer",
                "returncode": 0,
                "stderr": "",
                "stdout": "",
            }
        else:
            humanizer_payload = build_humanizer_payload(
                prompt,
                artifacts["merged"].read_text(encoding="utf-8"),
                args.humanizer_skill,
            )
            humanizer_result = run_claude_command(
                claude_bin=claude_bin,
                cwd=cwd,
                model=args.final_model,
                effort=args.final_effort,
                output_path=artifacts["final"],
                prompt_text=humanizer_payload,
            )
            run_record["commands"]["humanizer"] = humanizer_result

        run_record["completed_at"] = now_iso()
        run_record["status"] = "completed"
        write_run_record(artifacts["run"], run_record)
        print(str(artifacts["final"]))
        return 0
    except StageError as exc:
        run_record["completed_at"] = now_iso()
        run_record["status"] = "failed"
        run_record["error"] = {
            "stage": exc.stage,
            "message": exc.message,
            "command": list(exc.command) if exc.command else None,
            "stderr": exc.stderr,
        }
        write_run_record(artifacts["run"], run_record)
        print(exc.message, file=sys.stderr)
        if exc.command:
            print(shell_join(exc.command), file=sys.stderr)
        if exc.stderr:
            print(exc.stderr, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
