#!/usr/bin/env python3
"""
Build a descriptive-analysis summary from an extraction export CSV.

Why this script exists
----------------------
The isokinetic presentation needed coverage counts ("how much of the evidence base is
women's football?", "how many studies report burden?") rather than pooled effect estimates.
Those counts were produced ad hoc inside `isokinetic presentation/scripts/*.mjs`, one script
per slide. This script generalises that method into one reusable descriptive export.

Method carried over from the isokinetic scripts
-----------------------------------------------
- The analytic unit is one unique `paper_id`, EXCEPT for ongoing surveillance programmes
  (UEFA ECIS, FIFA tournament data, Aspetar ASPREV). Those publish the same cohort many
  times, so counting each paper separately would overweight them. Each such status collapses
  into a single analytic unit.
- A unit is classified from the union of all its rows, so a paper covering both futsal and
  11-a-side counts once in each discipline. Percentages are therefore over total assignments,
  not over units, and can exceed 100% when summed.
- Units reporting nothing for a variable are omitted from that variable's percentages and
  reported separately as `not_reported`.
- Raw extracted values stay untouched; normalisation happens here, at read time.

Search-wave split
-----------------
Every line also reports how the units divide between the first and second search waves, so a
deck can show what the second search added. A unit's wave comes from its rows' `search_batch`;
a collapsed surveillance unit whose papers span both waves is counted in both and flagged.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "exports"

# Ongoing surveillance programmes: many papers, one cohort. Collapse to one unit each.
COLLAPSE_STATUSES = {"uefa", "uefa_master_extraction", "fifa_data", "aspetar_asprev", "american_data"}

FIRST_WAVE = "1st search"
SECOND_WAVE = "2nd search"
NO_WAVE = "not labelled"


def unit_waves(unit_rows: list[dict]) -> set[str]:
    """Which search waves a unit belongs to. Collapsed programmes can span both."""
    found = {(row.get("search_batch") or "").strip() or NO_WAVE for row in unit_rows}
    return found or {NO_WAVE}


def norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def disciplines(raw: str) -> set[str]:
    s = norm(raw)
    if not s:
        return set()
    out = set()
    if any(t in s for t in ["5-a-side", "7-a-side", "para-football", "para football", "amputee", "blind football", "cerebral palsy"]):
        out.add("Para football")
    if "beach" in s:
        out.add("Beach soccer")
    if "futsal" in s or "indoor soccer" in s:
        out.add("Futsal")
    if "11-a-side" in s or "11-aside" in s or s in {"association football", "football", "soccer", "football (soccer)"}:
        out.add("Association football (11-a-side)")
    if not out and ("football" in s or "soccer" in s):
        out.add("Association football (11-a-side)")
    return out


def sexes(raw: str) -> set[str]:
    s = norm(raw)
    if not s:
        return set()
    out = set()
    if "female" in s or "women" in s or "girl" in s:
        out.add("Female")
    # "female" contains "male", so only count male on a male-specific token.
    stripped = s.replace("female", "").replace("women", "").replace("girl", "")
    if "male" in stripped or "men" in stripped or "boy" in stripped:
        out.add("Male")
    if "mixed" in s and not out:
        out.update({"Male", "Female"})
    return out


def age_categories(raw: str) -> set[str]:
    s = norm(raw)
    if not s:
        return set()
    out = set()
    youth_tokens = [
        "youth", "junior", "academy", "adolescent", "high school", "schoolboy", "schoolgirl",
        "teen", "u-", "under-", "under ",
    ]
    if re.search(r"\bu\s?-?\d{1,2}\b", s) or any(t in s for t in youth_tokens):
        out.add("Youth")
    if any(t in s for t in ["college", "collegiate", "ncaa", "university"]):
        out.add("Adult")
    if any(t in s for t in ["senior", "adult", "professional", "elite", "first team"]):
        out.add("Adult")
    if not out and s in {"total", "all", "overall", "mixed", "combined"}:
        out.add("Mixed / unclear")
    if not out:
        out.add("Mixed / unclear")
    return out


def levels(raw: str) -> set[str]:
    s = norm(raw)
    if not s:
        return set()
    out = set()
    if "professional" in s or "elite" in s or "national team" in s or "first division" in s:
        out.add("Professional / elite")
    if "semi-professional" in s or "semi professional" in s:
        out.add("Semi-professional")
    if "amateur" in s or "recreational" in s or "community" in s:
        out.add("Amateur / recreational")
    if any(t in s for t in ["high school", "college", "collegiate", "ncaa", "university", "school"]):
        out.add("School / college")
    if any(t in s for t in ["academy", "youth"]):
        out.add("Academy / youth")
    return out or {"Other / unclear"}


def designs(raw: str) -> set[str]:
    s = norm(raw)
    if not s:
        return set()
    if "randomi" in s:
        return {"Randomised controlled trial"}
    if "cross-sectional" in s or "cross sectional" in s:
        return {"Cross-sectional"}
    if "case-control" in s or "case control" in s:
        return {"Case-control"}
    if "retrospective" in s:
        return {"Retrospective cohort"}
    if "prospective" in s or "cohort" in s:
        return {"Prospective cohort"}
    return {"Other / unclear"}


def injury_definitions(raw: str) -> set[str]:
    s = norm(raw)
    if not s:
        return set()
    out = set()
    if "time-loss" in s or "time loss" in s:
        out.add("Time-loss")
    if "medical attention" in s or "medical-attention" in s:
        out.add("Medical attention")
    if "physical complaint" in s or "all complaint" in s:
        out.add("All physical complaints")
    return out or {"Other / unclear"}


COUNTRY_ALIASES = {
    "usa": "United States",
    "us": "United States",
    "u.s.": "United States",
    "u.s.a.": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
    "u.k.": "United Kingdom",
    "great britain": "United Kingdom",
    "holland": "Netherlands",
    "the netherlands": "Netherlands",
    "republic of ireland": "Ireland",
    "korea": "South Korea",
    "republic of korea": "South Korea",
    "iran (islamic republic of)": "Iran",
    "uae": "United Arab Emirates",
    "czechia": "Czech Republic",
    "europe (multi-country)": "Europe (multi-country)",
    "multinational": "Multinational",
    "multi-country": "Multinational",
    "international": "Multinational",
}


def countries(raw: str) -> set[str]:
    s = (raw or "").strip()
    if not s:
        return set()
    out = set()
    for part in re.split(r"[;,/]| and ", s):
        part = part.strip()
        if not part:
            continue
        out.add(COUNTRY_ALIASES.get(norm(part), part.title()))
    return out


def year_bucket(raw: str) -> set[str]:
    m = re.search(r"(19|20)\d{2}", raw or "")
    if not m:
        return set()
    year = int(m.group(0))
    if year < 2000:
        return {"Before 2000"}
    if year < 2010:
        return {"2000-2009"}
    if year < 2015:
        return {"2010-2014"}
    if year < 2020:
        return {"2015-2019"}
    return {"2020-present"}


VARIABLES = [
    ("FIFA discipline", "fifaDiscipline", disciplines),
    ("Sex", "sex", sexes),
    ("Age category", "ageCategory", age_categories),
    ("Level of play", "levelOfPlay", levels),
    ("Study design", "studyDesign", designs),
    ("Injury definition", "injuryDefinition", injury_definitions),
    ("Publication period", "yearOfPublication", year_bucket),
    ("Country", "country", countries),
]

OUTCOME_FIELDS = [
    ("Injury incidence (overall)", "injuryIncidenceOverall"),
    ("Injury burden", "injuryBurden"),
    ("Injury count (total)", "injuryTotalCount"),
    ("Exposure hours", "totalExposure"),
    ("Illness incidence (overall)", "illnessIncidenceOverall"),
    ("Illness count (total)", "illnessTotalCount"),
]


def build_units(rows: list[dict]) -> list[dict]:
    """One unit per paper, with surveillance-programme statuses collapsed into one unit each."""
    by_paper: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        pid = (row.get("paper_id") or "").strip()
        if pid:
            by_paper[pid].append(row)

    units = []
    collapsed: dict[str, list[dict]] = defaultdict(list)
    collapsed_papers: dict[str, set[str]] = defaultdict(set)

    for pid, paper_rows in by_paper.items():
        status = (paper_rows[0].get("status") or "").strip()
        if status in COLLAPSE_STATUSES:
            collapsed[status].extend(paper_rows)
            collapsed_papers[status].add(pid)
            continue
        units.append({
            "id": pid,
            "kind": "paper",
            "status": status,
            "rows": paper_rows,
            "papers": 1,
            "waves": unit_waves(paper_rows),
        })

    for status, status_rows in sorted(collapsed.items()):
        units.append({
            "id": f"[collapsed] {status}",
            "kind": "collapsed_status",
            "status": status,
            "rows": status_rows,
            "papers": len(collapsed_papers[status]),
            "waves": unit_waves(status_rows),
        })

    return units


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_csv", help="extraction export CSV to summarise")
    parser.add_argument("--output-prefix", default="descriptive-summary")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR))
    args = parser.parse_args()

    with open(args.input_csv, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    units = build_units(rows)
    total_papers = len({(r.get("paper_id") or "").strip() for r in rows if (r.get("paper_id") or "").strip()})
    granular_rows = sum(1 for r in rows if (r.get("population_analysis_flag") or "").strip() == "granular_subset")

    out_rows = []

    def add(
        section: str,
        category: str,
        units_n: int,
        pct: float | str,
        rows_n: int,
        note: str = "",
        first: int | str = "",
        second: int | str = "",
    ) -> None:
        out_rows.append({
            "section": section,
            "category": category,
            "analytic_units": units_n,
            "units_1st_search": first,
            "units_2nd_search": second,
            "percent_of_classified": pct,
            "rows": rows_n,
            "note": note,
        })

    def wave_totals(subset: list[dict]) -> tuple[int, int]:
        return (
            sum(1 for u in subset if FIRST_WAVE in u["waves"]),
            sum(1 for u in subset if SECOND_WAVE in u["waves"]),
        )

    paper_wave: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        pid = (row.get("paper_id") or "").strip()
        if pid:
            paper_wave[pid].add((row.get("search_batch") or "").strip() or NO_WAVE)
    first_papers = sum(1 for waves in paper_wave.values() if FIRST_WAVE in waves)
    second_papers = sum(1 for waves in paper_wave.values() if SECOND_WAVE in waves)
    all_first, all_second = wave_totals(units)

    add("Overview", "Papers in source export", total_papers, "", len(rows), "", first_papers, second_papers)
    add("Overview", "Analytic units after collapsing surveillance programmes", len(units), "", len(rows),
        "statuses collapsed: " + ", ".join(sorted(COLLAPSE_STATUSES)), all_first, all_second)
    add("Overview", "Rows flagged granular_subset", "", "", granular_rows,
        "subgroup slices; already counted inside a parent row")

    for label, field, mapper in VARIABLES:
        unit_counts: Counter = Counter()
        first_counts: Counter = Counter()
        second_counts: Counter = Counter()
        row_counts: Counter = Counter()
        classified = 0
        multi = 0
        not_reported = 0
        unreported_units: list[dict] = []

        for unit in units:
            values: set[str] = set()
            for row in unit["rows"]:
                values |= mapper(row.get(field))
            if not values:
                not_reported += 1
                unreported_units.append(unit)
                continue
            classified += 1
            if len(values) > 1:
                multi += 1
            for value in values:
                unit_counts[value] += 1
                if FIRST_WAVE in unit["waves"]:
                    first_counts[value] += 1
                if SECOND_WAVE in unit["waves"]:
                    second_counts[value] += 1

        for row in rows:
            for value in mapper(row.get(field)):
                row_counts[value] += 1

        assignments = sum(unit_counts.values())
        ordered = sorted(unit_counts.items(), key=lambda kv: (-kv[1], kv[0]))
        if label == "Country":
            ordered = ordered[:25]

        for value, count in ordered:
            pct = round(count / assignments * 100, 1) if assignments else 0.0
            add(label, value, count, pct, row_counts[value], "", first_counts[value], second_counts[value])
        nr_first, nr_second = wave_totals(unreported_units)
        add(label, "not_reported", not_reported, "", "",
            f"{classified} units classified, {multi} reported more than one value", nr_first, nr_second)

    for label, field in OUTCOME_FIELDS:
        reporting = [u for u in units if any((r.get(field) or "").strip() for r in u["rows"])]
        row_n = sum(1 for r in rows if (r.get(field) or "").strip())
        pct = round(len(reporting) / len(units) * 100, 1) if units else 0.0
        o_first, o_second = wave_totals(reporting)
        add("Outcome availability", label, len(reporting), pct, row_n,
            "share of all analytic units", o_first, o_second)

    # Composition by paper status, so the descriptive breakdown reconciles against the
    # extraction dashboard (which counts every status except archived and uefa_master_extraction).
    status_units: dict[str, list[dict]] = defaultdict(list)
    for unit in units:
        status_units[unit["status"] or "(none)"].append(unit)
    for status, subset in sorted(status_units.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        s_first, s_second = wave_totals(subset)
        s_rows = sum(1 for r in rows if (r.get("status") or "(none)").strip() == status)
        s_papers = sum(u["papers"] for u in subset)
        pct = round(len(subset) / len(units) * 100, 1) if units else 0.0
        note = f"{s_papers} paper{'' if s_papers == 1 else 's'}"
        if s_papers != len(subset):
            note += " (collapsed to one unit)"
        add("Paper status", status, len(subset), pct, s_rows, note, s_first, s_second)

    # Wave totals in their own section, so a deck can state the second search's contribution.
    for wave in (FIRST_WAVE, SECOND_WAVE, NO_WAVE):
        wave_rows = [r for r in rows if ((r.get("search_batch") or "").strip() or NO_WAVE) == wave]
        wave_units = [u for u in units if wave in u["waves"]]
        papers_n = len({(r.get("paper_id") or "").strip() for r in wave_rows})
        pct = round(papers_n / total_papers * 100, 1) if total_papers else 0.0
        add("Search wave", wave, len(wave_units), pct, len(wave_rows),
            f"{papers_n} paper{'' if papers_n == 1 else 's'} ({pct}% of the export)")
    spanning = [u["id"] for u in units if {FIRST_WAVE, SECOND_WAVE} <= u["waves"]]
    add("Search wave", "units spanning both waves", len(spanning), "", "",
        "; ".join(spanning) or "none")

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    csv_path = out_dir / f"{args.output_prefix}-{stamp}.csv"

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "section", "category", "analytic_units", "units_1st_search", "units_2nd_search",
                "percent_of_classified", "rows", "note",
            ],
        )
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"input={args.input_csv}")
    print(f"source_rows={len(rows)}")
    print(f"source_papers={total_papers}")
    print(f"analytic_units={len(units)}")
    print(f"summary_lines={len(out_rows)}")
    print(f"output={csv_path}")


if __name__ == "__main__":
    main()
