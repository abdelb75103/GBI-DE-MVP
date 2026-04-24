#!/usr/bin/env python3
"""
Analyze injury-definition usage from the master analysis sheet and generate
presentation-ready outputs.

Outputs
-------
- isokinetic%20presentation/slides/generated/injuryDefinitionAnalysis.json
- isokinetic%20presentation/slides/generated/injuryDefinitionAnalysis.ts
- isokinetic%20presentation/slides/generated/injuryDefinitionAnalysis.md
- isokinetic%20presentation/slides/injury-definition-use-slide.html

Method
------
- Uses the current master analysis CSV as the sole data source.
- Aggregates to one record per unique `paper_id`.
- Uses the first `injuryDefinition_standardized` column, which is the canonical
  value column in the repeated-header export layout.
- Preserves a raw-wording sensitivity audit so hybrid definitions are explicit.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MASTER_CSV = REPO_ROOT / "Data Analysis" / "Data Cleaning" / "outputs" / "master" / "master-analysis-sheet.csv"
OUTPUT_DIR = REPO_ROOT / "isokinetic%20presentation" / "slides" / "generated"
SLIDE_HTML = REPO_ROOT / "isokinetic%20presentation" / "slides" / "injury-definition-use-slide.html"

# Paper-level adjudications for studies where row-specific values should not
# remain as multiple study-level injury-definition families.
PAPER_LEVEL_OVERRIDES = {
    "S231": {
        "category": "time-loss",
        "rationale": (
            "Kidney-specific catastrophic/surgical wording is an outcome-specific "
            "severity concept, not a separate general injury-definition family."
        ),
    },
    "S349": {
        "category": "medical attention",
        "rationale": (
            "The paper defines medical-attention injuries as the broader capture "
            "frame and reports time-loss injuries as a subset within that frame."
        ),
    },
}


def normalize_raw(raw: str) -> str:
    value = (raw or "").strip()
    lower = value.lower()
    lower = lower.replace("medical-attention", "medical attention")
    lower = lower.replace("physical-complaint", "physical complaint")
    lower = lower.replace("physical compaint", "physical complaint")
    return lower


def classify_raw_family(raw_values: set[str]) -> str:
    if not raw_values:
        return "missing"

    families: set[str] = set()
    for raw in raw_values:
        lower = normalize_raw(raw)
        has_physical = "physical complaint" in lower
        has_medical = "medical attention" in lower
        has_time_loss = "time-loss" in lower or "time loss" in lower

        if has_physical and has_medical:
            families.add("physical complaint + medical attention")
        elif has_physical and has_time_loss:
            families.add("physical complaint + time-loss")
        elif has_medical and has_time_loss:
            families.add("medical attention + time-loss")
        elif has_physical:
            families.add("physical complaint")
        elif has_medical:
            families.add("medical attention")
        elif has_time_loss:
            families.add("time-loss")
        else:
            families.add("other/unclear")

    if len(families) == 1:
        return next(iter(families))
    return "mixed raw families"


def pct(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator * 100, 1)


def format_pct(numerator: int, denominator: int) -> str:
    return f"{pct(numerator, denominator):.1f}%"


def load_papers() -> dict[str, dict[str, object]]:
    with MASTER_CSV.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        header = next(reader)

        paper_idx = header.index("paper_id")
        title_idx = header.index("paper_title")
        year_idx = header.index("yearOfPublication")
        raw_idx = header.index("injuryDefinition")
        std_idx = next(i for i, name in enumerate(header) if name == "injuryDefinition_standardized")

        papers: dict[str, dict[str, object]] = {}
        for row in reader:
            paper_id = row[paper_idx].strip()
            if paper_id not in papers:
                papers[paper_id] = {
                    "paper_id": paper_id,
                    "title": row[title_idx].strip(),
                    "year": row[year_idx].strip(),
                    "raw_values": set(),
                    "std_values": set(),
                }

            raw_value = row[raw_idx].strip()
            std_value = row[std_idx].strip()
            if raw_value:
                papers[paper_id]["raw_values"].add(raw_value)
            if std_value:
                papers[paper_id]["std_values"].add(std_value)

    return papers


def summarize() -> dict[str, object]:
    papers = load_papers()
    total_papers = len(papers)

    paper_records = []
    primary_counter: Counter[str] = Counter()
    raw_family_counter: Counter[str] = Counter()
    mixed_papers = []
    missing_papers = []
    overrides_applied = []

    for paper_id, paper in sorted(papers.items()):
        std_values = sorted(paper["std_values"])
        raw_values = sorted(paper["raw_values"])
        raw_family = classify_raw_family(set(raw_values))

        if paper_id in PAPER_LEVEL_OVERRIDES:
            primary = PAPER_LEVEL_OVERRIDES[paper_id]["category"]
            overrides_applied.append(
                {
                    "paper_id": paper_id,
                    "title": paper["title"],
                    "year": paper["year"],
                    "raw_values": raw_values,
                    "standardized_values_before_override": std_values,
                    "final_category": primary,
                    "rationale": PAPER_LEVEL_OVERRIDES[paper_id]["rationale"],
                }
            )
        elif len(std_values) == 0:
            primary = "missing"
            missing_papers.append(
                {"paper_id": paper_id, "title": paper["title"], "year": paper["year"]}
            )
        elif len(std_values) == 1:
            primary = std_values[0]
        else:
            primary = "mixed standardized values"
            mixed_papers.append(
                {
                    "paper_id": paper_id,
                    "title": paper["title"],
                    "year": paper["year"],
                    "raw_values": raw_values,
                    "standardized_values": std_values,
                }
            )

        primary_counter[primary] += 1
        raw_family_counter[raw_family] += 1
        paper_records.append(
            {
                "paper_id": paper_id,
                "title": paper["title"],
                "year": paper["year"],
                "primary_category": primary,
                "raw_family": raw_family,
                "raw_values": raw_values,
                "standardized_values": std_values,
            }
        )

    main_categories = ["physical complaint", "medical attention", "time-loss"]
    main_total = sum(primary_counter[name] for name in main_categories)
    classified_total = total_papers - primary_counter["missing"]

    primary_rows = []
    for name in [
        "time-loss",
        "medical attention",
        "physical complaint",
        "other/specific",
        "not_reported",
        "mixed standardized values",
        "missing",
    ]:
        count = primary_counter[name]
        primary_rows.append(
            {
                "category": name,
                "count": count,
                "pct_all_papers": pct(count, total_papers),
                "pct_classified_papers": pct(count, classified_total),
            }
        )

    raw_rows = [
        {
            "category": name,
            "count": count,
            "pct_all_papers": pct(count, total_papers),
        }
        for name, count in raw_family_counter.most_common()
    ]

    hybrid_total = (
        raw_family_counter["medical attention + time-loss"]
        + raw_family_counter["physical complaint + time-loss"]
        + raw_family_counter["physical complaint + medical attention"]
    )

    summary = {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "source_csv": str(MASTER_CSV),
        "unit_of_analysis": "unique paper_id",
        "paper_count": total_papers,
        "classified_paper_count": classified_total,
        "main_family_paper_count": main_total,
        "primary_rows": primary_rows,
        "raw_rows": raw_rows,
        "main_message": {
            "headline": "Time-loss definitions dominate the literature.",
            "subhead": (
                f"{primary_counter['time-loss']} of {total_papers} studies "
                f"({format_pct(primary_counter['time-loss'], total_papers)}) use a time-loss definition."
            ),
        },
        "key_figures": {
            "time_loss": {
                "count": primary_counter["time-loss"],
                "pct_all_papers": pct(primary_counter["time-loss"], total_papers),
                "pct_main_families": pct(primary_counter["time-loss"], main_total),
            },
            "medical_attention": {
                "count": primary_counter["medical attention"],
                "pct_all_papers": pct(primary_counter["medical attention"], total_papers),
                "pct_main_families": pct(primary_counter["medical attention"], main_total),
            },
            "physical_complaint": {
                "count": primary_counter["physical complaint"],
                "pct_all_papers": pct(primary_counter["physical complaint"], total_papers),
                "pct_main_families": pct(primary_counter["physical complaint"], main_total),
            },
            "residual": {
                "count": total_papers - main_total,
                "pct_all_papers": pct(total_papers - main_total, total_papers),
            },
        },
        "sensitivity_audit": {
            "hybrid_raw_definitions": hybrid_total,
            "medical_attention_plus_time_loss": raw_family_counter["medical attention + time-loss"],
            "physical_complaint_plus_time_loss": raw_family_counter["physical complaint + time-loss"],
            "physical_complaint_plus_medical_attention": raw_family_counter["physical complaint + medical attention"],
            "mixed_raw_family_papers": raw_family_counter["mixed raw families"],
        },
        "paper_level_overrides_applied": overrides_applied,
        "mixed_papers": mixed_papers,
        "missing_papers": missing_papers,
        "paper_records": paper_records,
    }

    return summary


def render_markdown(summary: dict[str, object]) -> str:
    primary = {row["category"]: row for row in summary["primary_rows"]}
    sensitivity = summary["sensitivity_audit"]

    lines = [
        "# Injury Definition Analysis",
        "",
        f"- Generated: `{summary['generated_at_utc']}`",
        f"- Source: `{summary['source_csv']}`",
        f"- Unit of analysis: `{summary['unit_of_analysis']}`",
        f"- Total unique studies: `{summary['paper_count']}`",
        f"- Studies with any standardized injury-definition value: `{summary['classified_paper_count']}`",
        "",
        "## Primary paper-level breakdown",
        "",
        "| Category | Count | % of all studies | % of studies with any standardized value |",
        "| --- | ---: | ---: | ---: |",
    ]

    for key in [
        "time-loss",
        "medical attention",
        "physical complaint",
        "other/specific",
        "not_reported",
        "mixed standardized values",
        "missing",
    ]:
        row = primary[key]
        lines.append(
            f"| {key} | {row['count']} | {row['pct_all_papers']:.1f}% | {row['pct_classified_papers']:.1f}% |"
        )

    lines.extend(
        [
            "",
            "## Sensitivity audit of raw wording",
            "",
            "- Explicit hybrid raw definitions: "
            f"`{sensitivity['hybrid_raw_definitions']}` papers",
            f"- `medical attention + time-loss`: `{sensitivity['medical_attention_plus_time_loss']}`",
            f"- `physical complaint + time-loss`: `{sensitivity['physical_complaint_plus_time_loss']}`",
            f"- `physical complaint + medical attention`: `{sensitivity['physical_complaint_plus_medical_attention']}`",
            f"- Papers with more than one raw family across rows: `{sensitivity['mixed_raw_family_papers']}`",
            "",
            "## Method notes",
            "",
            "- Percentages are descriptive census values from the current master sheet, not sample estimates.",
            "- The primary breakdown uses the standardized paper-level injury-definition family already encoded in the master sheet.",
            "- Because the export repeats header names, the analysis reads the first `injuryDefinition_standardized` column by position rather than importing by duplicate header name.",
            "- Combined raw definitions remain visible in the sensitivity audit so the collapse into broader canonical families is explicit and reviewable.",
        ]
    )

    if summary["mixed_papers"]:
        lines.extend(["", "## Papers with mixed standardized values", ""])
        for paper in summary["mixed_papers"]:
            lines.append(
                f"- `{paper['paper_id']}` {paper['title']} | raw={paper['raw_values']} | standardized={paper['standardized_values']}"
            )

    if summary["paper_level_overrides_applied"]:
        lines.extend(["", "## Paper-level adjudications applied in analysis", ""])
        for paper in summary["paper_level_overrides_applied"]:
            lines.append(
                f"- `{paper['paper_id']}` {paper['title']} -> `{paper['final_category']}`. Rationale: {paper['rationale']}"
            )

    return "\n".join(lines) + "\n"


def render_ts(summary: dict[str, object]) -> str:
    return (
        "export const injuryDefinitionAnalysis = "
        + json.dumps(summary, indent=2)
        + " as const;\n"
    )


def render_slide_html(summary: dict[str, object]) -> str:
    figs = summary["key_figures"]
    sensitivity = summary["sensitivity_audit"]
    total_papers = summary["paper_count"]

    cards = [
        ("Time-loss", figs["time_loss"]["count"], figs["time_loss"]["pct_all_papers"], "#0E5A8A", "#7CC6F9"),
        ("Medical attention", figs["medical_attention"]["count"], figs["medical_attention"]["pct_all_papers"], "#D96C06", "#FFC56B"),
        ("Physical complaint", figs["physical_complaint"]["count"], figs["physical_complaint"]["pct_all_papers"], "#136F63", "#74E6C7"),
    ]

    card_html = []
    for idx, (label, count, pct_value, color, accent) in enumerate(cards, start=1):
        card_html.append(
            f"""
            <article class="card card-{idx}" style="--card:{color}; --accent:{accent}; --pct:{pct_value};">
              <div class="card-top">
                <p class="eyebrow">{label}</p>
                <p class="pct">{pct_value:.1f}<span>%</span></p>
              </div>
              <div class="track" aria-hidden="true">
                <div class="fill"></div>
              </div>
              <p class="count">{count} studies</p>
            </article>
            """
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Injury Definition Use</title>
  <style>
    :root {{
      --bg: #f5efe5;
      --panel: rgba(255, 250, 242, 0.82);
      --ink: #171412;
      --muted: #5e5348;
      --line: rgba(23, 20, 18, 0.12);
      --shadow: 0 28px 70px rgba(65, 42, 21, 0.12);
    }}

    * {{ box-sizing: border-box; }}
    html, body {{ margin: 0; min-height: 100%; background:
      radial-gradient(circle at top left, rgba(255, 226, 186, 0.8), transparent 30%),
      radial-gradient(circle at 85% 20%, rgba(124, 198, 249, 0.22), transparent 24%),
      linear-gradient(135deg, #f6f0e7 0%, #f2ece2 50%, #efe5d9 100%);
      color: var(--ink);
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
    }}

    body {{
      display: grid;
      place-items: center;
      padding: 24px;
      overflow: hidden;
    }}

    .slide {{
      position: relative;
      width: 1600px;
      height: 900px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 30%),
        linear-gradient(145deg, rgba(255,255,255,0.4), rgba(255,255,255,0.15));
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 34px;
      box-shadow: var(--shadow);
      overflow: hidden;
      isolation: isolate;
    }}

    .slide::before,
    .slide::after {{
      content: "";
      position: absolute;
      inset: auto;
      border-radius: 999px;
      filter: blur(6px);
      opacity: 0.65;
      animation: drift 14s ease-in-out infinite alternate;
      z-index: 0;
    }}

    .slide::before {{
      width: 420px;
      height: 420px;
      right: -120px;
      top: -160px;
      background: radial-gradient(circle, rgba(255, 197, 107, 0.8), rgba(255, 197, 107, 0));
    }}

    .slide::after {{
      width: 380px;
      height: 380px;
      left: -80px;
      bottom: -120px;
      background: radial-gradient(circle, rgba(116, 230, 199, 0.55), rgba(116, 230, 199, 0));
      animation-duration: 17s;
    }}

    .frame {{
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 0.95fr 1.05fr;
      gap: 32px;
      height: 100%;
      padding: 58px 60px 46px;
    }}

    .intro {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }}

    .kicker {{
      margin: 0 0 16px;
      font: 600 15px/1.2 "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #7a5b2f;
    }}

    h1 {{
      margin: 0;
      max-width: 660px;
      font-size: 72px;
      line-height: 0.95;
      letter-spacing: -0.045em;
      animation: rise 700ms ease-out both;
    }}

    .lede {{
      margin: 26px 0 0;
      max-width: 620px;
      font-size: 25px;
      line-height: 1.35;
      color: var(--muted);
      animation: rise 700ms 120ms ease-out both;
    }}

    .method {{
      width: 92%;
      padding: 24px 26px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      backdrop-filter: blur(10px);
      animation: rise 700ms 240ms ease-out both;
    }}

    .method h2,
    .notes h2 {{
      margin: 0 0 12px;
      font: 600 18px/1.2 "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }}

    .method p,
    .notes p {{
      margin: 0;
      font-size: 19px;
      line-height: 1.45;
      color: var(--muted);
    }}

    .visuals {{
      display: grid;
      grid-template-rows: auto auto;
      gap: 20px;
      align-content: center;
    }}

    .cards {{
      display: grid;
      gap: 18px;
    }}

    .card {{
      position: relative;
      padding: 22px 24px 20px;
      background: rgba(255, 252, 247, 0.9);
      border: 1px solid rgba(23, 20, 18, 0.08);
      border-radius: 24px;
      box-shadow: 0 14px 34px rgba(74, 51, 30, 0.08);
      animation: rise 650ms ease-out both;
    }}

    .card-1 {{ animation-delay: 120ms; }}
    .card-2 {{ animation-delay: 220ms; }}
    .card-3 {{ animation-delay: 320ms; }}

    .card-top {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }}

    .eyebrow {{
      margin: 0;
      font: 600 18px/1.2 "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--card) 76%, black);
    }}

    .pct {{
      margin: 0;
      font-size: 56px;
      line-height: 0.95;
      letter-spacing: -0.05em;
      color: var(--card);
    }}

    .pct span {{
      font-size: 28px;
      margin-left: 4px;
    }}

    .track {{
      margin: 18px 0 12px;
      height: 14px;
      border-radius: 999px;
      background: rgba(23, 20, 18, 0.08);
      overflow: hidden;
    }}

    .fill {{
      width: 0;
      height: 100%;
      border-radius: inherit;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--card) 80%, white), var(--accent));
      animation: grow 1000ms 500ms cubic-bezier(.2,.8,.2,1) forwards;
    }}

    .count {{
      margin: 0;
      font: 500 21px/1.2 "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: var(--muted);
    }}

    .notes {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }}

    .note {{
      padding: 20px 22px;
      background: rgba(255, 250, 242, 0.78);
      border: 1px solid var(--line);
      border-radius: 22px;
      backdrop-filter: blur(8px);
      animation: rise 650ms 420ms ease-out both;
    }}

    .note strong {{
      display: block;
      margin-bottom: 8px;
      font: 600 17px/1.2 "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ink);
    }}

    .footer {{
      position: absolute;
      left: 60px;
      right: 60px;
      bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      font: 500 15px/1.3 "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: rgba(23, 20, 18, 0.66);
      letter-spacing: 0.02em;
      z-index: 1;
    }}

    @keyframes rise {{
      from {{ opacity: 0; transform: translateY(26px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}

    @keyframes grow {{
      from {{ width: 0; }}
      to {{ width: calc(var(--pct) * 1%); }}
    }}

    @keyframes drift {{
      from {{ transform: translate3d(0, 0, 0) scale(1); }}
      to {{ transform: translate3d(18px, 24px, 0) scale(1.08); }}
    }}
  </style>
</head>
<body>
  <main class="slide">
    <section class="frame">
      <div class="intro">
        <div>
          <p class="kicker">GBI Master Sheet | Injury Definition Use</p>
          <h1>Time-loss definitions are the default frame across the football injury literature.</h1>
          <p class="lede">
            In the current master sheet, nearly seven in ten studies classify injury through a time-loss lens. Medical-attention definitions are much less common, and physical-complaint definitions remain a minority framework.
          </p>
        </div>

        <div class="method">
          <h2>Analysis Basis</h2>
          <p>
            Paper-level census of <strong>{total_papers}</strong> unique studies from the master analysis sheet. Counts use the standardized injury-definition family already encoded in the sheet, with a raw-wording sensitivity audit retained for hybrid definitions and row-level inconsistencies.
          </p>
        </div>
      </div>

      <div class="visuals">
        <section class="cards">
          {''.join(card_html)}
        </section>

        <section class="notes">
          <div class="note">
            <h2>Defensibility</h2>
            <p><strong>Primary denominator</strong>{total_papers} unique studies. The three main families cover <strong>{summary['main_family_paper_count']}</strong> studies ({summary['key_figures']['time_loss']['pct_main_families'] + summary['key_figures']['medical_attention']['pct_main_families'] + summary['key_figures']['physical_complaint']['pct_main_families']:.1f}% of the main-family subset).</p>
          </div>
          <div class="note">
            <h2>Sensitivity Audit</h2>
            <p><strong>Hybrid definitions observed</strong>{sensitivity['hybrid_raw_definitions']} explicit hybrids in raw wording, plus {sensitivity['mixed_raw_family_papers']} papers with row-level mixed raw families. Those edge cases are tracked separately in the generated methods file.</p>
          </div>
        </section>
      </div>
    </section>

    <footer class="footer">
      <span>Animation design: staggered rise-in cards, drifting background gradients, and bars that grow to the observed percentage.</span>
      <span>Source: master-analysis-sheet.csv | Generated {summary['generated_at_utc'][:10]}</span>
    </footer>
  </main>
</body>
</html>
"""


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = summarize()

    json_path = OUTPUT_DIR / "injuryDefinitionAnalysis.json"
    ts_path = OUTPUT_DIR / "injuryDefinitionAnalysis.ts"
    md_path = OUTPUT_DIR / "injuryDefinitionAnalysis.md"

    json_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    ts_path.write_text(render_ts(summary), encoding="utf-8")
    md_path.write_text(render_markdown(summary), encoding="utf-8")
    SLIDE_HTML.write_text(render_slide_html(summary), encoding="utf-8")

    print(f"Wrote {json_path}")
    print(f"Wrote {ts_path}")
    print(f"Wrote {md_path}")
    print(f"Wrote {SLIDE_HTML}")


if __name__ == "__main__":
    main()
