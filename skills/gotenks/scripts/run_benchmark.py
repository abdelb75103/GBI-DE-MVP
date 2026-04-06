#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence

from run_gotenks import (
    DEFAULT_CLAUDE_EFFORT,
    DEFAULT_CLAUDE_MODEL,
    DEFAULT_CODEX_EFFORT,
    DEFAULT_CODEX_MODEL,
    DEFAULT_FINAL_EFFORT,
    DEFAULT_FINAL_MODEL,
    DEFAULT_REVIEWER_EFFORT,
    DEFAULT_REVIEWER_MODEL,
    StageError,
    collect_source_context,
    now_iso,
    resolve_path,
    run_claude_command,
    run_codex_command,
    shell_join,
    write_text,
)

BASE_DIMENSIONS = ["faithfulness", "completeness", "structure", "clarity", "actionability"]


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark the Gotenks writing workflow against single-model baselines.")
    parser.add_argument("--prompts-file", default=str(Path(__file__).resolve().parent.parent / "benchmarks/prompts.json"))
    parser.add_argument("--output-dir", help="Directory for benchmark outputs.")
    parser.add_argument("--limit", type=int, help="Maximum number of prompts to run.")
    parser.add_argument("--prompt-id", action="append", default=[], help="Run only the specified prompt id. Repeat as needed.")
    parser.add_argument("--codex-model", default=DEFAULT_CODEX_MODEL)
    parser.add_argument("--codex-effort", default=DEFAULT_CODEX_EFFORT)
    parser.add_argument("--claude-model", default=DEFAULT_CLAUDE_MODEL)
    parser.add_argument("--claude-effort", default=DEFAULT_CLAUDE_EFFORT)
    parser.add_argument("--reviewer-model", default=DEFAULT_REVIEWER_MODEL)
    parser.add_argument("--reviewer-effort", default=DEFAULT_REVIEWER_EFFORT)
    parser.add_argument("--final-model", default=DEFAULT_FINAL_MODEL)
    parser.add_argument("--final-effort", default=DEFAULT_FINAL_EFFORT)
    parser.add_argument("--research-mode", choices=["standard", "deep"], default="standard")
    parser.add_argument("--research-timeout", type=int)
    parser.add_argument("--judge-codex-model", default=DEFAULT_CODEX_MODEL)
    parser.add_argument("--judge-codex-effort", default=DEFAULT_CODEX_EFFORT)
    parser.add_argument("--judge-claude-model", default=DEFAULT_CLAUDE_MODEL)
    parser.add_argument("--judge-claude-effort", default=DEFAULT_CLAUDE_EFFORT)
    return parser.parse_args(argv)


def default_output_dir(cwd: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return cwd / ".gotenks/benchmarks" / timestamp


def load_prompts(path: Path, selected_ids: Sequence[str], limit: int | None) -> list[dict[str, Any]]:
    prompts = json.loads(path.read_text(encoding="utf-8"))
    if selected_ids:
        selected = set(selected_ids)
        prompts = [prompt for prompt in prompts if prompt["id"] in selected]
    if limit is not None:
        prompts = prompts[:limit]
    if not prompts:
        raise StageError("benchmark", "No benchmark prompts matched the requested filter.")
    return prompts


def extract_json_object(text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(text[index:])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    raise StageError("judge", "Could not parse JSON from judge output.", stderr=text.strip())


def build_single_model_payload(
    *,
    user_prompt: str,
    context_markdown: str | None,
    research_markdown: str | None,
    model_name: str,
) -> str:
    sections = [
        "# GOTENKS_BASELINE_TASK",
        "",
        f"You are producing the single-model {model_name} baseline for the Gotenks benchmark.",
        "Write one polished markdown deliverable that answers the user's request directly.",
        "Use headings when useful. State material assumptions. Return markdown only.",
        "",
        "## User Request",
        user_prompt,
    ]
    if context_markdown:
        sections.extend(["", "## Shared Local Context", context_markdown.strip()])
    if research_markdown:
        sections.extend(["", "## Shared Research Packet", research_markdown.strip()])
    return "\n".join(sections).strip() + "\n"


def build_judge_payload(
    *,
    prompt_entry: dict[str, Any],
    context_markdown: str | None,
    research_markdown: str | None,
    labeled_outputs: dict[str, str],
) -> str:
    dimensions = BASE_DIMENSIONS + (["citation_quality"] if prompt_entry.get("web") else [])
    schema_hint = {
        "winner_label": "A",
        "scores": {
            label: {dimension: 0 for dimension in dimensions} | {"overall": 0}
            for label in sorted(labeled_outputs)
        },
        "notes": {label: "one sentence" for label in sorted(labeled_outputs)},
    }
    sections = [
        "# GOTENKS_BENCHMARK_JUDGE_TASK",
        "",
        "Evaluate the blinded writing outputs and return JSON only.",
        "Score every dimension on a 0-10 scale. Use one decimal place only if needed.",
        "Select exactly one winner label.",
        "Dimensions: " + ", ".join(dimensions),
        "",
        "## User Request",
        prompt_entry["prompt"],
    ]
    if context_markdown:
        sections.extend(["", "## Shared Local Context", context_markdown.strip()])
    if research_markdown:
        sections.extend(["", "## Shared Research Packet", research_markdown.strip()])
    sections.extend(["", "## Candidate Outputs"])
    for label in sorted(labeled_outputs):
        sections.extend(["", f"### Label {label}", labeled_outputs[label].strip()])
    sections.extend(
        [
            "",
            "## Required JSON Shape",
            json.dumps(schema_hint, indent=2),
            "",
            "Return JSON only. Do not wrap it in markdown fences.",
        ]
    )
    return "\n".join(sections).strip() + "\n"


def normalize(value: float) -> float:
    return max(0.0, min(1.0, value / 10.0))


def run_judge_pair(
    *,
    prompt_entry: dict[str, Any],
    context_markdown: str | None,
    research_markdown: str | None,
    labeled_outputs: dict[str, str],
    output_dir: Path,
    codex_bin: str,
    claude_bin: str,
    args: argparse.Namespace,
    cwd: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    judge_payload = build_judge_payload(
        prompt_entry=prompt_entry,
        context_markdown=context_markdown,
        research_markdown=research_markdown,
        labeled_outputs=labeled_outputs,
    )

    codex_output = output_dir / "judges/codex.json"
    codex_result = run_codex_command(
        codex_bin=codex_bin,
        cwd=cwd,
        model=args.judge_codex_model,
        effort=args.judge_codex_effort,
        output_path=codex_output,
        prompt_text=judge_payload,
    )
    claude_output = output_dir / "judges/claude.json"
    claude_result = run_claude_command(
        claude_bin=claude_bin,
        cwd=cwd,
        model=args.judge_claude_model,
        effort=args.judge_claude_effort,
        output_path=claude_output,
        prompt_text=judge_payload,
    )
    return (
        {
            "metadata": codex_result,
            "parsed": extract_json_object(codex_output.read_text(encoding="utf-8")),
        },
        {
            "metadata": claude_result,
            "parsed": extract_json_object(claude_output.read_text(encoding="utf-8")),
        },
    )


def variant_score_from_judge(parsed: dict[str, Any], label: str) -> float:
    score_entry = parsed["scores"][label]
    return normalize(float(score_entry["overall"]))


def build_report(summary: dict[str, Any]) -> str:
    lines = [
        "# Gotenks Benchmark Report",
        "",
        f"- Generated at: `{summary['generated_at']}`",
        f"- Prompts run: `{summary['prompt_count']}`",
        f"- Acceptance passed: `{summary['acceptance']['passed']}`",
        f"- Acceptance reason: {summary['acceptance']['reason']}",
        "",
        "## Aggregate Scores",
        "",
        "| Variant | Average Score | Prompt Wins |",
        "| --- | ---: | ---: |",
    ]
    for variant, aggregate in summary["aggregates"].items():
        lines.append(
            f"| {variant} | {aggregate['average_score']:.3f} | {aggregate['prompt_wins']} |"
        )
    lines.extend(["", "## Manual Spot-Check Queue", ""])
    for prompt_id in summary["human_spot_check_ids"]:
        lines.append(f"- `{prompt_id}`")
    lines.extend(["", "## Prompt Results", ""])
    for prompt in summary["prompts"]:
        lines.extend(
            [
                f"### `{prompt['id']}`",
                "",
                f"- Winner: `{prompt['winner']}`",
                f"- Output dir: `{prompt['output_dir']}`",
                f"- Judge winners: Codex=`{prompt['judges']['codex']['winner_label']}`, Claude=`{prompt['judges']['claude']['winner_label']}`",
                f"- Scores: gotenks={prompt['scores']['gotenks']:.3f}, codex-only={prompt['scores']['codex-only']:.3f}, claude-only={prompt['scores']['claude-only']:.3f}",
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    cwd = Path.cwd()
    prompts_path = resolve_path(args.prompts_file, cwd)
    benchmark_root = prompts_path.parent
    output_dir = resolve_path(args.output_dir, cwd) if args.output_dir else default_output_dir(cwd)
    output_dir.mkdir(parents=True, exist_ok=True)

    codex_bin = os.environ.get("CODEX_BIN", "codex")
    claude_bin = os.environ.get("CLAUDE_BIN", "claude")
    python_bin = os.environ.get("PYTHON_BIN", sys.executable)
    runner_path = Path(__file__).resolve().parent / "run_gotenks.py"

    prompts = load_prompts(prompts_path, args.prompt_id, args.limit)
    prompt_results: list[dict[str, Any]] = []

    for prompt_entry in prompts:
        prompt_dir = output_dir / prompt_entry["id"]
        prompt_dir.mkdir(parents=True, exist_ok=True)
        source_result = collect_source_context(prompt_entry.get("sources", []), benchmark_root)
        context_markdown = source_result.markdown if prompt_entry.get("sources") else None

        gotenks_dir = prompt_dir / "gotenks"
        gotenks_command = [python_bin, str(runner_path), "--output-dir", str(gotenks_dir)]
        gotenks_command.extend(["--reviewer-model", args.reviewer_model, "--reviewer-effort", args.reviewer_effort])
        gotenks_command.extend(["--final-model", args.final_model, "--final-effort", args.final_effort])
        for source in prompt_entry.get("sources", []):
            gotenks_command.extend(["--source", source])
        if prompt_entry.get("web"):
            gotenks_command.append("--web")
            gotenks_command.extend(["--research-mode", args.research_mode])
            if args.research_timeout is not None:
                gotenks_command.extend(["--research-timeout", str(args.research_timeout)])

        completed = subprocess.run(
            gotenks_command,
            input=prompt_entry["prompt"],
            text=True,
            cwd=str(benchmark_root),
            env=os.environ.copy(),
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0:
            raise StageError(
                "benchmark",
                f"Gotenks runner failed for prompt {prompt_entry['id']}.",
                command=gotenks_command,
                stderr=(completed.stderr or completed.stdout).strip(),
            )

        gotenks_final = (gotenks_dir / "final.md").read_text(encoding="utf-8")
        research_markdown = None
        research_path = gotenks_dir / "research.md"
        if research_path.exists():
            research_markdown = research_path.read_text(encoding="utf-8")

        baselines_dir = prompt_dir / "baselines"
        baselines_dir.mkdir(parents=True, exist_ok=True)
        codex_baseline_path = baselines_dir / "codex.md"
        codex_baseline_payload = build_single_model_payload(
            user_prompt=prompt_entry["prompt"],
            context_markdown=context_markdown,
            research_markdown=research_markdown,
            model_name="Codex",
        )
        codex_metadata = run_codex_command(
            codex_bin=codex_bin,
            cwd=benchmark_root,
            model=args.codex_model,
            effort=args.codex_effort,
            output_path=codex_baseline_path,
            prompt_text=codex_baseline_payload,
        )

        claude_baseline_path = baselines_dir / "claude.md"
        claude_baseline_payload = build_single_model_payload(
            user_prompt=prompt_entry["prompt"],
            context_markdown=context_markdown,
            research_markdown=research_markdown,
            model_name="Claude",
        )
        claude_metadata = run_claude_command(
            claude_bin=claude_bin,
            cwd=benchmark_root,
            model=args.claude_model,
            effort=args.claude_effort,
            output_path=claude_baseline_path,
            prompt_text=claude_baseline_payload,
        )

        variant_outputs = {
            "gotenks": gotenks_final,
            "codex-only": codex_baseline_path.read_text(encoding="utf-8"),
            "claude-only": claude_baseline_path.read_text(encoding="utf-8"),
        }

        labels = ["A", "B", "C"]
        rng = random.Random(prompt_entry["id"])
        shuffled_variants = list(variant_outputs.items())
        rng.shuffle(shuffled_variants)
        label_to_variant = {label: variant for label, (variant, _) in zip(labels, shuffled_variants)}
        labeled_outputs = {label: output for label, (_, output) in zip(labels, shuffled_variants)}

        codex_judge, claude_judge = run_judge_pair(
            prompt_entry=prompt_entry,
            context_markdown=context_markdown,
            research_markdown=research_markdown,
            labeled_outputs=labeled_outputs,
            output_dir=prompt_dir,
            codex_bin=codex_bin,
            claude_bin=claude_bin,
            args=args,
            cwd=benchmark_root,
        )

        scores = {}
        for label, variant in label_to_variant.items():
            codex_score = variant_score_from_judge(codex_judge["parsed"], label)
            claude_score = variant_score_from_judge(claude_judge["parsed"], label)
            scores[variant] = round((codex_score + claude_score) / 2, 4)

        winner = max(scores, key=scores.get)
        judge_winner_labels = {
            "codex": codex_judge["parsed"]["winner_label"],
            "claude": claude_judge["parsed"]["winner_label"],
        }
        prompt_results.append(
            {
                "category": prompt_entry["category"],
                "id": prompt_entry["id"],
                "judges": {
                    "codex": {
                        "winner_label": judge_winner_labels["codex"],
                        "winner_variant": label_to_variant[judge_winner_labels["codex"]],
                        "metadata": codex_judge["metadata"],
                    },
                    "claude": {
                        "winner_label": judge_winner_labels["claude"],
                        "winner_variant": label_to_variant[judge_winner_labels["claude"]],
                        "metadata": claude_judge["metadata"],
                    },
                },
                "label_map": label_to_variant,
                "output_dir": str(prompt_dir),
                "priority": prompt_entry["priority"],
                "scores": scores,
                "title": prompt_entry["title"],
                "variant_commands": {
                    "gotenks": shell_join(gotenks_command),
                    "codex-only": codex_metadata["display"],
                    "claude-only": claude_metadata["display"],
                },
                "winner": winner,
                "web": prompt_entry.get("web", False),
            }
        )

    aggregates = {}
    for variant in ["gotenks", "codex-only", "claude-only"]:
        variant_scores = [prompt["scores"][variant] for prompt in prompt_results]
        prompt_wins = sum(1 for prompt in prompt_results if prompt["winner"] == variant)
        aggregates[variant] = {
            "average_score": round(sum(variant_scores) / len(variant_scores), 4),
            "prompt_wins": prompt_wins,
        }

    top_priority_ids = [
        prompt["id"]
        for prompt in sorted(prompt_results, key=lambda item: (-item["priority"], item["id"]))[:3]
    ]
    disagreement_ids = []
    for prompt in prompt_results:
        judge_variants = {
            prompt["judges"]["codex"]["winner_variant"],
            prompt["judges"]["claude"]["winner_variant"],
        }
        ordered_scores = sorted(prompt["scores"].values(), reverse=True)
        close_call = len(ordered_scores) > 1 and ordered_scores[0] - ordered_scores[1] < 0.05
        if len(judge_variants) > 1 or close_call:
            disagreement_ids.append(prompt["id"])
    human_spot_check_ids = sorted(set(top_priority_ids + disagreement_ids))

    gotenks_majority = aggregates["gotenks"]["prompt_wins"] > len(prompt_results) / 2
    gotenks_highest_average = aggregates["gotenks"]["average_score"] > max(
        aggregates["codex-only"]["average_score"],
        aggregates["claude-only"]["average_score"],
    )
    acceptance_passed = gotenks_majority and gotenks_highest_average
    acceptance_reason = (
        "Gotenks has the highest average score and beats both baselines on a majority of prompts."
        if acceptance_passed
        else "Gotenks does not yet clear the configured majority-and-average acceptance bar."
    )

    summary = {
        "acceptance": {
            "passed": acceptance_passed,
            "reason": acceptance_reason,
        },
        "aggregates": aggregates,
        "generated_at": now_iso(),
        "human_spot_check_ids": human_spot_check_ids,
        "output_dir": str(output_dir),
        "prompt_count": len(prompt_results),
        "prompts": prompt_results,
    }

    write_text(output_dir / "summary.json", json.dumps(summary, indent=2, sort_keys=True) + "\n")
    write_text(output_dir / "report.md", build_report(summary))
    print(str(output_dir / "report.md"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
