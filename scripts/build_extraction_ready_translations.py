#!/usr/bin/env python3
"""Build extraction-ready English PDFs for translated non-English papers.

The generator is intentionally deterministic: it formats the existing English
translation text, renders table-like blocks as PDF tables where possible, and
audits table detections from the original source PDF. It does not use image
generation or translation APIs.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import HRFlowable
from xml.sax.saxutils import escape


SECTION_HEADINGS = {
    "abstract",
    "summary",
    "keywords",
    "introduction",
    "background",
    "material and methods",
    "materials and methods",
    "methods",
    "subjects",
    "participants",
    "results",
    "discussion",
    "conclusion",
    "conclusions",
    "references",
    "figures and tables",
    "ethical aspects",
    "statistical analysis",
}

DATE_STAMP = dt.date.today().isoformat()


@dataclass
class PaperRow:
    covidence_number: str
    language: str
    title: str
    original_pdf_path: Path
    english_pdf_path: Path
    english_txt_path: Path
    notes_path: Path


@dataclass
class BuildResult:
    covidence_number: str
    language: str
    title: str
    output_pdf: Path
    paper_audit: Path
    preview_files: list[Path]
    english_table_blocks: int
    source_tables_detected: int
    original_pages: int
    output_pages: int
    status: str
    note: str


def read_manifest(path: Path, targets: set[str] | None) -> list[PaperRow]:
    rows: list[PaperRow] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            cov_num = normalize_covidence_number(row.get("covidence_number", ""))
            if targets and cov_num not in targets:
                continue
            if row.get("translation_status") != "translated_codex_manual":
                continue
            original = Path(row.get("original_pdf_path", ""))
            english_pdf = Path(row.get("english_pdf_path", ""))
            english_txt = english_pdf.with_suffix(".txt")
            notes = Path(row.get("notes_path", "")) if row.get("notes_path") else english_pdf.parent / "translation-notes.md"
            if not original.exists() or not english_txt.exists():
                continue
            rows.append(
                PaperRow(
                    covidence_number=cov_num,
                    language=row.get("language", ""),
                    title=row.get("title", "").strip(),
                    original_pdf_path=original,
                    english_pdf_path=english_pdf,
                    english_txt_path=english_txt,
                    notes_path=notes,
                )
            )
    return rows


def normalize_covidence_number(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text if text.startswith("#") else f"#{text}"


def read_targets(path: Path | None) -> set[str] | None:
    if not path:
        return None
    targets: set[str] = set()
    with path.open(newline="", encoding="utf-8-sig") as handle:
        if path.suffix.lower() == ".csv":
            reader = csv.DictReader(handle)
            for row in reader:
                value = row.get("covidence_number") or row.get("Covidence #") or row.get("covidenceNumber")
                if value:
                    targets.add(normalize_covidence_number(value))
        else:
            for line in handle:
                value = line.strip()
                if value:
                    targets.add(normalize_covidence_number(value))
    return targets


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ExtractionTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=21,
            alignment=TA_CENTER,
            spaceAfter=10,
        ),
        "meta": ParagraphStyle(
            "ExtractionMeta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#555555"),
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "h1": ParagraphStyle(
            "ExtractionH1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "h2": ParagraphStyle(
            "ExtractionH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=colors.HexColor("#374151"),
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "ExtractionBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
            firstLineIndent=10,
            spaceAfter=5,
        ),
        "caption": ParagraphStyle(
            "ExtractionCaption",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#111827"),
            spaceBefore=7,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "ExtractionSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#4B5563"),
            spaceAfter=3,
        ),
        "cell": ParagraphStyle(
            "ExtractionCell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=6.5,
            leading=7.5,
            wordWrap="CJK",
        ),
        "cell_header": ParagraphStyle(
            "ExtractionCellHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=6.5,
            leading=7.5,
            wordWrap="CJK",
        ),
    }


def split_blocks(text: str) -> list[list[str]]:
    blocks: list[list[str]] = []
    current: list[str] = []
    for raw_line in text.replace("\r\n", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            if current:
                blocks.append(current)
                current = []
            continue
        current.append(line)
    if current:
        blocks.append(current)
    return blocks


def is_page_marker(block: list[str]) -> bool:
    return len(block) == 1 and re.match(r"^--- PAGE \d+ ---$", block[0])


def is_heading(block: list[str]) -> bool:
    if len(block) != 1:
        return False
    return is_heading_line(block[0])


def is_heading_line(text: str) -> bool:
    text = text.strip()
    key = re.sub(r"[^a-z0-9 ]+", "", text.lower()).strip()
    if key in SECTION_HEADINGS:
        return True
    if len(text) <= 42 and text.isupper() and any(ch.isalpha() for ch in text):
        return True
    return False


def is_table_caption(block: list[str]) -> bool:
    return bool(block and re.match(r"^(Table|Figure)\s+\d+\.?", block[0], re.IGNORECASE))


def is_pipe_table(block: list[str]) -> bool:
    return sum(1 for line in block if "|" in line) >= 2


def is_vertical_table(block: list[str]) -> bool:
    if len(block) < 4:
        return False
    short_lines = sum(1 for line in block if len(line) <= 48)
    numeric_lines = sum(1 for line in block if re.search(r"\d", line))
    return short_lines >= max(3, int(len(block) * 0.7)) and numeric_lines >= 2


def html(text: str) -> str:
    return escape(text).replace("\n", "<br/>")


def para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(html(text), style)


def rows_from_pipe(block: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in block:
        if "|" not in line:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if any(cells):
            rows.append(cells)
    return normalize_row_widths(rows)


def rows_from_vertical(block: list[str]) -> list[list[str]]:
    lines = [line.strip() for line in block if line.strip()]
    if len(lines) >= 3 and lines[0].lower() == "frequency" and lines[1].lower() == "percentage":
        rows = [["Variable", "Frequency", "Percentage"]]
        for index in range(2, len(lines), 3):
            rows.append(lines[index : index + 3])
        return normalize_row_widths(rows)
    if len(lines) >= 4 and lines[0].lower() in {"frequency", "n", "count"}:
        rows = [["Variable", lines[0]]]
        for index in range(1, len(lines), 2):
            rows.append(lines[index : index + 2])
        return normalize_row_widths(rows)
    return [[line] for line in lines]


def normalize_row_widths(rows: list[list[str]]) -> list[list[str]]:
    if not rows:
        return rows
    width = max(len(row) for row in rows)
    return [row + [""] * (width - len(row)) for row in rows]


def render_table(rows: list[list[str]], style_map: dict[str, ParagraphStyle]) -> Table:
    if not rows:
        rows = [["No extracted rows"]]
    max_cols = max(len(row) for row in rows)
    usable_width = LETTER[0] - 1.1 * inch
    col_widths = [usable_width / max_cols] * max_cols
    data = []
    for row_index, row in enumerate(rows):
        cell_style = style_map["cell_header"] if row_index == 0 else style_map["cell"]
        data.append([Paragraph(html(cell), cell_style) for cell in row])
    table = Table(data, colWidths=col_widths, repeatRows=1 if len(rows) > 1 else 0)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9CA3AF")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def extract_source_tables(original_pdf: Path) -> tuple[int, int, list[dict[str, object]]]:
    doc = fitz.open(original_pdf)
    tables: list[dict[str, object]] = []
    for page_index, page in enumerate(doc):
        try:
            found = page.find_tables().tables
        except Exception:
            found = []
        for table_index, table in enumerate(found, start=1):
            try:
                matrix = table.extract()
            except Exception:
                matrix = []
            rows = len(matrix)
            cols = max((len(row) for row in matrix), default=0)
            sample = [[str(cell or "").strip() for cell in row[:5]] for row in matrix[:5]]
            tables.append(
                {
                    "page": page_index + 1,
                    "table_on_page": table_index,
                    "rows": rows,
                    "cols": cols,
                    "sample": sample,
                }
            )
    pages = len(doc)
    doc.close()
    return pages, len(tables), tables


def build_pdf(paper: PaperRow, out_pdf: Path) -> int:
    style_map = styles()
    doc = SimpleDocTemplate(
        str(out_pdf),
        pagesize=LETTER,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title=f"Extraction-ready translation {paper.covidence_number}",
        author="Codex",
    )
    text = paper.english_txt_path.read_text(encoding="utf-8", errors="replace")
    story = [
        para(f"{paper.covidence_number} Extraction-Ready English Translation", style_map["title"]),
        para(
            f"Source language: {paper.language or 'not recorded'} | Generated: {DATE_STAMP} | "
            "Tables rendered deterministically from translated text; original table detections audited separately.",
            style_map["meta"],
        ),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#D1D5DB"), spaceAfter=8),
    ]

    last_caption: str | None = None
    for block in split_blocks(text):
        if is_page_marker(block):
            story.append(para(block[0].strip("- "), style_map["small"]))
            continue
        if len(block) > 1 and is_heading_line(block[0]):
            story.append(para(block[0], style_map["h1"]))
            block = block[1:]
            if not block:
                continue
        if len(block) > 1 and block[0].startswith(paper.covidence_number):
            story.append(para(block[0], style_map["h2"]))
            block = block[1:]
            if not block:
                continue
        if is_heading(block):
            story.append(para(block[0], style_map["h1"]))
            continue
        if len(block) > 1 and is_table_caption([block[0]]):
            last_caption = block[0]
            story.append(para(last_caption, style_map["caption"]))
            block = block[1:]
            if not block:
                continue
        if len(block) > 1 and last_caption and not is_pipe_table(block) and is_vertical_table(block):
            story.append(render_table(rows_from_vertical(block), style_map))
            story.append(Spacer(1, 5))
            last_caption = None
            continue
        if is_table_caption(block):
            last_caption = " ".join(block)
            story.append(para(last_caption, style_map["caption"]))
            continue
        if is_pipe_table(block):
            rows = rows_from_pipe(block)
            story.append(render_table(rows, style_map))
            story.append(Spacer(1, 5))
            last_caption = None
            continue
        if last_caption and is_vertical_table(block):
            story.append(render_table(rows_from_vertical(block), style_map))
            story.append(Spacer(1, 5))
            last_caption = None
            continue
        text_block = " ".join(block)
        if len(text_block) <= 90 and (text_block.endswith(":") or re.match(r"^\d+\. ", text_block)):
            story.append(para(text_block, style_map["h2"]))
        else:
            story.append(para(text_block, style_map["body"]))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    with fitz.open(out_pdf) as built:
        return len(built)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(0.55 * inch, 0.32 * inch, "Extraction-ready translated PDF generated locally from project translation files.")
    canvas.drawRightString(LETTER[0] - 0.55 * inch, 0.32 * inch, f"Page {doc.page}")
    canvas.restoreState()


def count_english_table_blocks(text_path: Path) -> int:
    count = 0
    last_caption = False
    for block in split_blocks(text_path.read_text(encoding="utf-8", errors="replace")):
        if is_table_caption(block):
            last_caption = True
            count += 1
            continue
        if is_pipe_table(block) or (last_caption and is_vertical_table(block)):
            last_caption = False
    return count


def render_previews(pdf_path: Path, preview_dir: Path, covidence_number: str) -> list[Path]:
    preview_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    doc = fitz.open(pdf_path)
    page_indices = [0]
    if len(doc) > 1:
        page_indices.append(1)
    if len(doc) > 2:
        page_indices.append(len(doc) - 1)
    for page_index, page in enumerate(doc):
        if page.search_for("Table") or page.search_for("Figure"):
            page_indices.append(page_index)
    for page_index in sorted(set(page_indices)):
        page = doc[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        path = preview_dir / f"{covidence_number.strip('#')}-page-{page_index + 1}.png"
        pix.save(path)
        paths.append(path)
    doc.close()
    return paths


def write_paper_audit(paper: PaperRow, path: Path, source_pages: int, source_tables: list[dict[str, object]], english_blocks: int, output_pdf: Path, previews: list[Path]):
    lines = [
        f"# {paper.covidence_number} Extraction-Ready PDF Audit",
        "",
        f"- Generated: {DATE_STAMP}",
        f"- Source language: {paper.language or 'not recorded'}",
        f"- Original PDF: `{paper.original_pdf_path}`",
        f"- English translation text: `{paper.english_txt_path}`",
        f"- Output PDF: `{output_pdf}`",
        f"- Original pages: `{source_pages}`",
        f"- Original table grids detected: `{len(source_tables)}`",
        f"- English table/caption blocks rendered: `{english_blocks}`",
        "",
        "## Table Audit",
        "",
    ]
    if source_tables:
        lines.append("| Source page | Table on page | Rows | Columns | Sample cells |")
        lines.append("| ---: | ---: | ---: | ---: | --- |")
        for item in source_tables:
            sample = "; ".join(" / ".join(cell for cell in row if cell) for row in item["sample"])
            lines.append(f"| {item['page']} | {item['table_on_page']} | {item['rows']} | {item['cols']} | {escape_md(sample[:240])} |")
    else:
        lines.append("No grid tables were detected by PyMuPDF in the original PDF. Figures or prose summaries may still contain extractable data and must be checked during extraction.")
    lines.extend(
        [
            "",
            "## Verification Notes",
            "",
            "- The output PDF is generated from the existing English translation text; no translation API or image generation was used.",
            "- Where translated text uses pipe-delimited rows, the table is rendered as a structured grid in the same narrative location.",
            "- Where translated text only has vertical table lines, the table is rendered as a compact grid when the pattern is defensible, otherwise as differentiated text.",
            "- During live extraction, compare the output PDF against the original PDF for every table-derived value before applying fields.",
            "",
            "## Preview Files",
            "",
        ]
    )
    lines.extend(f"- `{preview}`" for preview in previews)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def escape_md(value: str) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def write_batch_audit(results: list[BuildResult], out_dir: Path, target_note: str):
    audit = out_dir / "EXTRACTION_READY_AUDIT.md"
    lines = [
        "# Non-English Extraction-Ready PDF Audit",
        "",
        f"- Generated: {DATE_STAMP}",
        f"- Output folder: `{out_dir}`",
        f"- Target source: {target_note}",
        f"- Papers processed: `{len(results)}`",
        f"- Source table grids detected: `{sum(r.source_tables_detected for r in results)}`",
        f"- English table/caption blocks rendered: `{sum(r.english_table_blocks for r in results)}`",
        "",
        "## Paper Outputs",
        "",
        "| Covidence # | Language | Source tables | English table blocks | Output pages | Status | PDF | Paper audit |",
        "| --- | --- | ---: | ---: | ---: | --- | --- | --- |",
    ]
    for result in results:
        lines.append(
            f"| {result.covidence_number} | {escape_md(result.language)} | {result.source_tables_detected} | "
            f"{result.english_table_blocks} | {result.output_pages} | {result.status} | "
            f"`{result.output_pdf}` | `{result.paper_audit}` |"
        )
    lines.extend(
        [
            "",
            "## Extraction Use",
            "",
            "Use each extraction-ready PDF together with the original source PDF. The rebuilt English tables are intended to make extraction faster, but source verification remains required for all table-derived values.",
        ]
    )
    audit.write_text("\n".join(lines) + "\n", encoding="utf-8")

    manifest = out_dir / "extraction-ready-manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "covidence_number",
                "language",
                "title",
                "output_pdf",
                "paper_audit",
                "source_tables_detected",
                "english_table_blocks",
                "original_pages",
                "output_pages",
                "status",
                "note",
            ],
        )
        writer.writeheader()
        for result in results:
            writer.writerow(
                {
                    "covidence_number": result.covidence_number,
                    "language": result.language,
                    "title": result.title,
                    "output_pdf": str(result.output_pdf),
                    "paper_audit": str(result.paper_audit),
                    "source_tables_detected": result.source_tables_detected,
                    "english_table_blocks": result.english_table_blocks,
                    "original_pages": result.original_pages,
                    "output_pages": result.output_pages,
                    "status": result.status,
                    "note": result.note,
                }
            )


def build_all(manifest: Path, out_dir: Path, targets: set[str] | None, target_note: str, limit: int | None) -> list[BuildResult]:
    papers = read_manifest(manifest, targets)
    if limit:
        papers = papers[:limit]
    pdf_dir = out_dir / "pdfs"
    audit_dir = out_dir / "paper-audits"
    preview_dir = out_dir / "previews"
    for directory in [pdf_dir, audit_dir, preview_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    results: list[BuildResult] = []
    for paper in papers:
        clean_id = paper.covidence_number.strip("#")
        output_pdf = pdf_dir / f"extraction-ready-{paper.covidence_number}.pdf"
        paper_audit = audit_dir / f"table-audit-{paper.covidence_number}.md"
        source_pages, source_count, source_tables = extract_source_tables(paper.original_pdf_path)
        english_blocks = count_english_table_blocks(paper.english_txt_path)
        output_pages = build_pdf(paper, output_pdf)
        previews = render_previews(output_pdf, preview_dir, clean_id)
        status = "ready_for_extraction_review"
        note = "Formatted translation generated; table values require original-source spot-check during extraction."
        if source_count > english_blocks:
            status = "needs_table_spot_check"
            note = "Original has more detected table grids than rendered English table blocks; inspect original PDF for any missing table structure."
        write_paper_audit(paper, paper_audit, source_pages, source_tables, english_blocks, output_pdf, previews)
        results.append(
            BuildResult(
                covidence_number=paper.covidence_number,
                language=paper.language,
                title=paper.title,
                output_pdf=output_pdf,
                paper_audit=paper_audit,
                preview_files=previews,
                english_table_blocks=english_blocks,
                source_tables_detected=source_count,
                original_pages=source_pages,
                output_pages=output_pages,
                status=status,
                note=note,
            )
        )
    write_batch_audit(results, out_dir, target_note)
    return results


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("exports/non-english-translations/manifest.csv"))
    parser.add_argument("--out-dir", type=Path, default=Path(f"outputs/extraction-ready-translations/{DATE_STAMP}"))
    parser.add_argument("--targets", type=Path, help="Optional CSV or newline list of Covidence numbers to process.")
    parser.add_argument("--target-note", default="translated records currently intended for Covidence extraction; local manifest used as the reproducible source list")
    parser.add_argument("--limit", type=int, help="Optional pilot limit.")
    args = parser.parse_args(argv)

    targets = read_targets(args.targets)
    results = build_all(args.manifest, args.out_dir, targets, args.target_note, args.limit)
    print(f"processed={len(results)}")
    print(f"out_dir={args.out_dir}")
    print(f"audit={args.out_dir / 'EXTRACTION_READY_AUDIT.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
