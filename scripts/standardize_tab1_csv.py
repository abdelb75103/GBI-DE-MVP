#!/usr/bin/env python3
"""
Seed the project's master analysis sheet with standardized Tab 1 columns.

Why this script exists:
- The project needs one master analysis sheet that later tabs can build into.
- The output must keep the same number of rows per paper because later tabs build on those rows.
- Raw extracted Tab 1 values and standardized Tab 1 values need to sit next to each other.
- Audit metadata must stay outside the main analysis sheet so the analysis file remains readable.

What this script produces:
- `master-analysis-sheet.csv`
  A plain CSV that becomes the working analysis source. It keeps the original row order and row
  count, removes review clutter, and inserts standardized Tab 1 columns beside their raw partners.
- `master-analysis-sheet.xlsx`
  An Excel companion with two worksheets:
  - `master_analysis`: the full working analysis sheet
  - `tab1_standardized_only`: a clean Tab 1-only view with just `studyId` and standardized Tab 1 columns
  Standardized text is green when unchanged from the raw value and red when changed.
- `tab1-standardization-audit-log.csv`
  A separate machine-readable audit log for the Tab 1 pass.

Methodological guardrails:
- No raw export values are overwritten.
- No row collapsing is performed.
- Study-design family mapping preserves the project's distinction between prospective cohorts and
  retrospective analyses of prospectively collected data.
- The audit log remains the source of traceability, while the master analysis sheet stays clean.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import xlsxwriter


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_CLEANING_DIR = REPO_ROOT / "Data Analysis" / "Data Cleaning"
DICT_DIR = DATA_CLEANING_DIR / "dictionaries" / "tab1"
OUTPUT_DIR = DATA_CLEANING_DIR / "outputs" / "master"
AUDIT_DIR = DATA_CLEANING_DIR / "audit" / "tab1"

RAW_TO_STANDARDIZED = {
    "leadAuthor": "leadAuthor_standardized",
    "title": "title_standardized",
    "yearOfPublication": "yearOfPublication_standardized",
    "journal": "journal_standardized",
    "doi": "doi_standardized",
    "studyDesign": "studyDesign_standardized",
}

TAB1_FIELDS = list(RAW_TO_STANDARDIZED.keys())


def load_dictionary(path: Path, key_field: str) -> dict[str, dict[str, str]]:
    """Load a CSV dictionary file keyed by a raw source value."""
    rows: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            key = (row.get(key_field) or "").strip()
            if key:
                rows[key] = row
    return rows


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def canonicalize_lead_author(raw_value: str) -> tuple[str, list[str], str]:
    """
    Standardize author punctuation conservatively.

    This deliberately avoids inventing initials or restructuring the surname order.
    It only removes punctuation artifacts already known to affect consistency.
    """
    if not raw_value.strip():
        return "", [], ""

    canonical = raw_value.strip()
    rule_ids: list[str] = []

    if "," in canonical:
        canonical = canonical.replace(",", "")
        rule_ids.append("T1-AUTHOR-001")
    if "." in canonical:
        canonical = canonical.replace(".", "")
        rule_ids.append("T1-AUTHOR-002")

    canonical = normalize_whitespace(canonical)
    note = "Normalized punctuation and spacing in lead author format." if rule_ids else ""
    return canonical, sorted(set(rule_ids)), note


def canonicalize_title(raw_value: str) -> tuple[str, list[str], str]:
    """
    Apply only minimal safe cleanup to titles.

    If a title is split across rows in the source export, that split is preserved. This script works
    row by row and does not merge rows or infer a pooled one-row-per-paper title.
    """
    if not raw_value.strip():
        return "", [], ""

    canonical = raw_value.strip()
    rule_ids: list[str] = []

    if canonical.lower().endswith(".pdf"):
        canonical = canonical[:-4].rstrip()
        rule_ids.append("T1-TITLE-001")
    canonical = re.sub(r"\s+", " ", canonical)
    canonical = re.sub(r"\.\.+$", ".", canonical)
    canonical = canonical.strip()

    note = "Applied minimal filename-artifact cleanup to title." if rule_ids else ""
    return canonical, sorted(set(rule_ids)), note


def canonicalize_year(raw_value: str) -> tuple[str, list[str], str]:
    if not raw_value.strip():
        return "", [], ""

    match = re.search(r"\b(19|20)\d{2}\b", raw_value)
    if not match:
        return raw_value.strip(), [], ""
    canonical = match.group(0)
    if canonical == raw_value.strip():
        return canonical, [], ""
    return canonical, ["T1-YEAR-001"], "Reduced year field to a 4-digit publication year."


def coerce_excel_value(field: str, value: str) -> tuple[object, str | None]:
    """
    Return the Excel cell value plus an optional semantic type hint.

    Excel can preserve numeric typing, unlike CSV. We use that capability for
    standardized analysis fields where numeric storage materially improves
    downstream sorting and descriptive summaries.
    """
    if field == "yearOfPublication_standardized":
        stripped = (value or "").strip()
        if re.fullmatch(r"(19|20)\d{2}", stripped):
            return int(stripped), "integer"
    return value, None


def canonicalize_doi(raw_value: str) -> tuple[str, list[str], str]:
    if not raw_value.strip():
        return "", [], ""

    canonical = raw_value.strip()
    rule_ids: list[str] = []

    patterns = [
        (r"^https?://(dx\.)?doi\.org/", ""),
        (r"^doi:\s*", ""),
    ]
    for pattern, replacement in patterns:
        next_value = re.sub(pattern, replacement, canonical, flags=re.IGNORECASE)
        if next_value != canonical:
            canonical = next_value
            rule_ids.append("T1-DOI-001")

    next_value = re.sub(r"[.,;)\]]+$", "", canonical)
    if next_value != canonical:
        canonical = next_value
        rule_ids.append("T1-DOI-002")

    canonical = canonical.strip()
    note = "Converted DOI to bare identifier format." if rule_ids else ""
    return canonical, sorted(set(rule_ids)), note


def derive_color(raw_value: str, canonical_value: str) -> str:
    """Return the desired font color state for the standardized companion sheet."""
    if not canonical_value:
        return ""
    return "green" if canonical_value == raw_value else "red"


def append_audit_event(
    audit_rows: list[dict[str, str]],
    *,
    source_file: str,
    output_file: str,
    study_id: str,
    field_name: str,
    raw_value: str,
    canonical_value: str,
    rule_ids: list[str],
    rationale: str,
) -> None:
    if not canonical_value or canonical_value == raw_value:
        return
    for rule_id in rule_ids or ["T1-MANUAL-UNSPECIFIED"]:
        audit_rows.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source_file": source_file,
                "output_file": output_file,
                "studyId": study_id,
                "field_name": field_name,
                "raw_value": raw_value,
                "canonical_value": canonical_value,
                "rule_id": rule_id,
                "change_type": "canonicalization",
                "rationale": rationale,
            }
        )


def build_output_fieldnames(base_fieldnames: list[str]) -> list[str]:
    """
    Keep the source export structure intact while inserting standardized Tab 1 columns
    directly beside their matching raw fields.
    """
    output: list[str] = []
    for field in base_fieldnames:
        output.append(field)
        if field in RAW_TO_STANDARDIZED:
            output.append(RAW_TO_STANDARDIZED[field])
    return output


def write_excel(output_rows: list[dict[str, str]], fieldnames: list[str], xlsx_path: Path) -> None:
    """Create an Excel companion file with a full master sheet and a clean Tab 1-only sheet."""
    workbook = xlsxwriter.Workbook(str(xlsx_path))
    worksheet = workbook.add_worksheet("master_analysis")
    tab1_only = workbook.add_worksheet("tab1_standardized_only")

    header_fmt = workbook.add_format({"bold": True, "bg_color": "#D9D9D9"})
    default_fmt = workbook.add_format({})
    green_fmt = workbook.add_format({"font_color": "#008000"})
    red_fmt = workbook.add_format({"font_color": "#C00000"})
    integer_fmt = workbook.add_format({"num_format": "0"})
    integer_green_fmt = workbook.add_format({"font_color": "#008000", "num_format": "0"})
    integer_red_fmt = workbook.add_format({"font_color": "#C00000", "num_format": "0"})

    for col_idx, name in enumerate(fieldnames):
        worksheet.write(0, col_idx, name, header_fmt)

    for row_idx, row in enumerate(output_rows, start=1):
        for col_idx, field in enumerate(fieldnames):
            value = row.get(field, "")
            fmt = default_fmt
            excel_value, value_type = coerce_excel_value(field, value)

            # Standardized columns are colorized by comparing them with their raw partner.
            raw_partner = None
            for raw_field, std_field in RAW_TO_STANDARDIZED.items():
                if field == std_field:
                    raw_partner = raw_field
                    break

            if raw_partner is not None:
                color = derive_color((row.get(raw_partner) or "").strip(), (value or "").strip())
                if color == "green":
                    fmt = integer_green_fmt if value_type == "integer" else green_fmt
                elif color == "red":
                    fmt = integer_red_fmt if value_type == "integer" else red_fmt
                elif value_type == "integer":
                    fmt = integer_fmt
            elif value_type == "integer":
                fmt = integer_fmt

            worksheet.write(row_idx, col_idx, excel_value, fmt)

    worksheet.freeze_panes(1, 0)
    worksheet.autofilter(0, 0, max(len(output_rows), 1), len(fieldnames) - 1)

    for col_idx, field in enumerate(fieldnames):
        width = min(max(len(field), 16), 42)
        worksheet.set_column(col_idx, col_idx, width)

    # The clean Tab 1 worksheet is intentionally narrow: it excludes untouched downstream
    # extraction columns so reviewers can focus only on the standardized study-details fields.
    # This sheet is plain black text because it is meant to become the cumulative clean build-on
    # sheet for later tabs, not a color-coded review surface.
    tab1_only_fields = ["studyId"] + [RAW_TO_STANDARDIZED[field] for field in TAB1_FIELDS]

    for col_idx, name in enumerate(tab1_only_fields):
        tab1_only.write(0, col_idx, name, header_fmt)

    for row_idx, row in enumerate(output_rows, start=1):
        for col_idx, field in enumerate(tab1_only_fields):
            value = row.get(field, "")
            excel_value, value_type = coerce_excel_value(field, value)
            fmt = integer_fmt if value_type == "integer" else default_fmt
            tab1_only.write(row_idx, col_idx, excel_value, fmt)

    tab1_only.freeze_panes(1, 0)
    tab1_only.autofilter(0, 0, max(len(output_rows), 1), len(tab1_only_fields) - 1)

    for col_idx, field in enumerate(tab1_only_fields):
        width = min(max(len(field), 16), 42)
        tab1_only.set_column(col_idx, col_idx, width)

    workbook.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=str(REPO_ROOT / "exports" / "filtered-studies-export-2026-04-11T15-00-20-112Z.csv"),
        help="Path to the cleaned source export to standardize.",
    )
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    csv_output_path = OUTPUT_DIR / "master-analysis-sheet.csv"
    xlsx_output_path = OUTPUT_DIR / "master-analysis-sheet.xlsx"
    audit_path = AUDIT_DIR / "tab1-standardization-audit-log.csv"

    journal_dict = load_dictionary(DICT_DIR / "journal-canonical-map.csv", "raw_value")
    study_design_dict = load_dictionary(DICT_DIR / "study-design-family-map.csv", "raw_value")

    output_rows: list[dict[str, str]] = []
    audit_rows: list[dict[str, str]] = []

    with input_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        base_fieldnames = list(reader.fieldnames or [])
        output_fieldnames = build_output_fieldnames(base_fieldnames)

        for row in reader:
            raw_author = (row.get("leadAuthor") or "").strip()
            raw_title = (row.get("title") or "").strip()
            raw_year = (row.get("yearOfPublication") or "").strip()
            raw_journal = (row.get("journal") or "").strip()
            raw_doi = (row.get("doi") or "").strip()
            raw_design = (row.get("studyDesign") or "").strip()
            study_id = (row.get("studyId") or "").strip()

            author_canonical, author_rules, author_note = canonicalize_lead_author(raw_author)
            title_canonical, title_rules, title_note = canonicalize_title(raw_title)
            year_canonical, year_rules, year_note = canonicalize_year(raw_year)
            doi_canonical, doi_rules, doi_note = canonicalize_doi(raw_doi)

            journal_entry = journal_dict.get(raw_journal)
            journal_canonical = journal_entry["canonical_value"] if journal_entry else raw_journal
            journal_rules = [journal_entry["rule_id"]] if journal_entry and journal_canonical != raw_journal else []
            journal_note = (
                "Mapped journal title to the approved canonical form."
                if journal_entry and journal_canonical != raw_journal
                else ""
            )

            design_entry = study_design_dict.get(raw_design)
            design_canonical = design_entry["canonical_family"] if design_entry else raw_design
            design_rules = [design_entry["rule_id"]] if design_entry and design_canonical != raw_design else []
            design_note = (
                "Mapped study design text to the approved reporting family."
                if design_entry and design_canonical != raw_design
                else ""
            )

            append_audit_event(
                audit_rows,
                source_file=str(input_path),
                output_file=str(csv_output_path),
                study_id=study_id,
                field_name="leadAuthor",
                raw_value=raw_author,
                canonical_value=author_canonical,
                rule_ids=author_rules,
                rationale=author_note or "Normalized lead author formatting.",
            )
            append_audit_event(
                audit_rows,
                source_file=str(input_path),
                output_file=str(csv_output_path),
                study_id=study_id,
                field_name="title",
                raw_value=raw_title,
                canonical_value=title_canonical,
                rule_ids=title_rules,
                rationale=title_note or "Applied minimal safe title cleanup.",
            )
            append_audit_event(
                audit_rows,
                source_file=str(input_path),
                output_file=str(csv_output_path),
                study_id=study_id,
                field_name="yearOfPublication",
                raw_value=raw_year,
                canonical_value=year_canonical,
                rule_ids=year_rules,
                rationale=year_note or "Standardized publication year format.",
            )
            append_audit_event(
                audit_rows,
                source_file=str(input_path),
                output_file=str(csv_output_path),
                study_id=study_id,
                field_name="journal",
                raw_value=raw_journal,
                canonical_value=journal_canonical,
                rule_ids=journal_rules,
                rationale=journal_note or "Canonicalized journal title where equivalence was explicit.",
            )
            append_audit_event(
                audit_rows,
                source_file=str(input_path),
                output_file=str(csv_output_path),
                study_id=study_id,
                field_name="doi",
                raw_value=raw_doi,
                canonical_value=doi_canonical,
                rule_ids=doi_rules,
                rationale=doi_note or "Canonicalized DOI to bare identifier format.",
            )
            append_audit_event(
                audit_rows,
                source_file=str(input_path),
                output_file=str(csv_output_path),
                study_id=study_id,
                field_name="studyDesign",
                raw_value=raw_design,
                canonical_value=design_canonical,
                rule_ids=design_rules,
                rationale=design_note or "Mapped study design to approved family.",
            )

            output_row = dict(row)
            output_row["leadAuthor_standardized"] = author_canonical
            output_row["title_standardized"] = title_canonical
            output_row["yearOfPublication_standardized"] = year_canonical
            output_row["journal_standardized"] = journal_canonical
            output_row["doi_standardized"] = doi_canonical
            output_row["studyDesign_standardized"] = design_canonical
            output_rows.append(output_row)

    with csv_output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(output_rows)

    with audit_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "timestamp",
                "source_file",
                "output_file",
                "studyId",
                "field_name",
                "raw_value",
                "canonical_value",
                "rule_id",
                "change_type",
                "rationale",
            ],
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        writer.writerows(audit_rows)

    write_excel(output_rows, output_fieldnames, xlsx_output_path)

    print(f"input={input_path}")
    print(f"csv_output={csv_output_path}")
    print(f"xlsx_output={xlsx_output_path}")
    print(f"audit={audit_path}")
    print(f"rows={len(output_rows)}")
    print(f"audit_rows={len(audit_rows)}")


if __name__ == "__main__":
    main()
