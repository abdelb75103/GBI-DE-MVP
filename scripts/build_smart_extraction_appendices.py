#!/usr/bin/env python3
"""Build smart extraction appendices for included translated papers.

The script appends extraction-relevant English tables and figure context to the
formatted 2026-05-07 translated PDFs. It is intentionally conservative:
tables are rendered from translated rows, while figure pages are included as
full source-page images with English caption/key text so figures are not cut
off by brittle crops.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import importlib.util
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
HELPER_PATH = ROOT / "scripts" / "build_extraction_ready_translations.py"
VISUAL_HELPER_PATH = ROOT / "scripts" / "build_visual_extraction_pdfs.py"
BASE_BATCH = ROOT / "outputs" / "extraction-ready-translations" / "2026-05-07"
DATE_STAMP = dt.date.today().isoformat()

spec = importlib.util.spec_from_file_location("translation_pdf_helpers", HELPER_PATH)
helpers = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = helpers
spec.loader.exec_module(helpers)

visual_spec = importlib.util.spec_from_file_location("visual_pdf_helpers", VISUAL_HELPER_PATH)
visual_helpers = importlib.util.module_from_spec(visual_spec)
assert visual_spec and visual_spec.loader
sys.modules[visual_spec.name] = visual_helpers
visual_spec.loader.exec_module(visual_helpers)


INCLUDED_TRANSLATED_IDS = [
    "#50",
    "#245",
    "#720",
    "#53",
    "#626",
    "#719",
    "#733",
    "#734",
    "#855",
    "#113",
    "#412",
    "#815",
    "#835",
    "#547",
    "#249",
    "#252",
    "#752",
    "#744",
]

EXTRACTION_KEYWORDS = {
    "acl",
    "age",
    "anthropometric",
    "body",
    "classification",
    "contact",
    "days",
    "diagnosis",
    "distribution",
    "etiology",
    "exposure",
    "frequency",
    "grade",
    "height",
    "incidence",
    "injur",
    "location",
    "match",
    "mechanism",
    "month",
    "player",
    "population",
    "prevalence",
    "rate",
    "risk",
    "season",
    "severity",
    "structural",
    "team",
    "time",
    "training",
    "type",
    "weight",
}

SOURCE_FIGURE_LABELS = [
    "Fig.",
    "Figure",
    "Abb.",
    "Abbildung",
    "Figura",
    "Figuras",
    "Gráfico",
    "Grafico",
    "Figuur",
    "Figur",
]


@dataclass(frozen=True)
class FigureCaption:
    label: str
    caption: str
    translation_page: int | None
    source_pages: tuple[int, ...]


@dataclass(frozen=True)
class AppendixResult:
    covidence_number: str
    base_pdf: Path
    output_pdf: Path
    audit_file: Path
    table_count: int
    figure_count: int
    figure_source_pages: int
    output_pages: int
    status: str


def style_map() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", parent=base["Title"], fontSize=16, leading=20, spaceAfter=8),
        "h1": ParagraphStyle("H1", parent=base["Heading1"], fontSize=13, leading=16, spaceBefore=8, spaceAfter=6),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontSize=10.5, leading=13, spaceBefore=8, spaceAfter=4),
        "caption": ParagraphStyle("Caption", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=8.8, leading=10.8, spaceBefore=5, spaceAfter=5),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontSize=8.3, leading=10.5, spaceAfter=5),
        "small": ParagraphStyle("Small", parent=base["BodyText"], fontSize=7.2, leading=8.8, textColor=colors.HexColor("#374151"), spaceAfter=3),
        "cell": ParagraphStyle("Cell", parent=base["BodyText"], fontSize=6.8, leading=7.8, wordWrap="CJK"),
        "cell_header": ParagraphStyle("CellHeader", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=6.8, leading=7.8, wordWrap="CJK"),
    }


def para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def relevance_score(text: str) -> int:
    lower = text.lower()
    return sum(1 for keyword in EXTRACTION_KEYWORDS if keyword in lower)


def normalize_id(value: str) -> str:
    value = value.strip()
    return value if value.startswith("#") else f"#{value}"


def selected_ids(targets: Iterable[str] | None, include_sample: bool) -> list[str]:
    if targets:
        requested = [normalize_id(target) for target in targets]
    elif include_sample:
        requested = INCLUDED_TRANSLATED_IDS
    else:
        requested = [cov_id for cov_id in INCLUDED_TRANSLATED_IDS if cov_id != "#245"]
    invalid = [cov_id for cov_id in requested if cov_id not in INCLUDED_TRANSLATED_IDS]
    if invalid:
        raise SystemExit(f"Targets are not in the included translated extraction set: {', '.join(invalid)}")
    return requested


def relevant_table_blocks(text_path: Path) -> list[dict[str, object]]:
    blocks = []
    for block in table_blocks_from_translation(text_path):
        caption = str(block.get("caption", ""))
        if not caption.lower().startswith("table"):
            continue
        if relevance_score(caption + " " + " ".join(" ".join(row) for row in block.get("rows", []))) > 0:
            blocks.append(block)
    return blocks


def table_blocks_from_translation(text_path: Path) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    pending_caption: str | None = None
    for block in helpers.split_blocks(text_path.read_text(encoding="utf-8", errors="replace")):
        if helpers.is_page_marker(block):
            continue
        if len(block) > 1 and is_strict_table_caption(block[0]):
            pending_caption = block[0]
            block = block[1:]
            if not block:
                continue
        elif len(block) == 1 and is_strict_table_caption(block[0]):
            pending_caption = " ".join(block)
            continue

        rows = None
        if helpers.is_pipe_table(block):
            rows = helpers.rows_from_pipe(block)
        elif pending_caption and helpers.is_vertical_table(block):
            rows = helpers.rows_from_vertical(block)
        elif pending_caption:
            rows = rows_from_loose_table(block)
        if rows and pending_caption:
            results.append({"caption": pending_caption, "rows": rows})
            pending_caption = None
    return results


def is_strict_table_caption(line: str) -> bool:
    return bool(re.match(r"^Table\s+\d+[.:]\s+", line.strip(), re.IGNORECASE))


def rows_from_loose_table(block: list[str]) -> list[list[str]] | None:
    rows: list[list[str]] = []
    split_rows = []
    for line in block:
        cells = [cell.strip() for cell in re.split(r"\s{2,}", line.strip()) if cell.strip()]
        if len(cells) >= 2 and any(re.search(r"\d", cell) for cell in cells[1:]):
            split_rows.append(cells)
    if len(split_rows) >= 2:
        return helpers.normalize_row_widths(split_rows)

    for line in block:
        if ":" not in line:
            continue
        left, right = line.split(":", 1)
        if len(left) <= 80 and re.search(r"\d|none|no ", right, re.IGNORECASE):
            rows.append([left.strip(), right.strip()])
    if rows:
        return [["Item", "Values"], *rows]
    return None


def figure_label_number(label: str) -> str:
    match = re.search(r"(\d+[A-Za-z]?)", label)
    return match.group(1) if match else label


def parse_relevant_figure_captions(text_path: Path, original_pdf: Path) -> list[FigureCaption]:
    text = text_path.read_text(encoding="utf-8", errors="replace")
    current_page: int | None = None
    captions: list[FigureCaption] = []
    for block in helpers.split_blocks(text):
        if helpers.is_page_marker(block):
            match = re.search(r"\d+", block[0])
            current_page = int(match.group(0)) if match else current_page
            continue
        line = " ".join(block)
        match = re.match(r"^((?:Fig\.|Figure)\s*\d+[A-Za-z]?)\s*[:.]?\s*(.+)$", line, re.IGNORECASE)
        if not match:
            continue
        label = re.sub(r"\s+", " ", match.group(1)).strip()
        caption = line.strip()
        if relevance_score(caption) == 0:
            continue
        source_pages = find_source_pages(original_pdf, label, current_page)
        captions.append(FigureCaption(label=label, caption=caption, translation_page=current_page, source_pages=tuple(source_pages)))
    return captions


def find_source_pages(original_pdf: Path, translated_label: str, fallback_page: int | None) -> list[int]:
    label_number = figure_label_number(translated_label)
    loose_number = re.sub(r"[A-Za-z]$", "", label_number)
    patterns = []
    for prefix in SOURCE_FIGURE_LABELS:
        patterns.append(re.compile(rf"{re.escape(prefix)}\s*{re.escape(label_number)}\b", re.IGNORECASE))
        if loose_number != label_number:
            patterns.append(re.compile(rf"{re.escape(prefix)}\s*{re.escape(loose_number)}\b", re.IGNORECASE))

    pages: list[int] = []
    doc = fitz.open(original_pdf)
    for page_index, page in enumerate(doc):
        page_text = page.get_text("text")
        if any(pattern.search(page_text) for pattern in patterns):
            pages.append(page_index + 1)
    page_count = len(doc)
    doc.close()

    if pages:
        return sorted(set(pages))
    generic_patterns = [re.compile(rf"{re.escape(prefix)}\s*\d+", re.IGNORECASE) for prefix in SOURCE_FIGURE_LABELS]
    generic_patterns.append(re.compile(r"gr.{0,8}ca\s*\d+", re.IGNORECASE))
    doc = fitz.open(original_pdf)
    generic_pages = []
    for page_index, page in enumerate(doc):
        page_text = page.get_text("text")
        if any(pattern.search(page_text) for pattern in generic_patterns):
            generic_pages.append(page_index + 1)
    page_count = len(doc)
    doc.close()
    if generic_pages:
        return sorted(set(generic_pages))
    if fallback_page and 1 <= fallback_page <= page_count:
        return [fallback_page]
    return list(range(1, page_count + 1))


def render_table(rows: list[list[str]], styles: dict[str, ParagraphStyle]) -> Table:
    rows = helpers.normalize_row_widths(rows)
    usable_width = LETTER[0] - inch
    cols = max((len(row) for row in rows), default=1)
    data = []
    for row_index, row in enumerate(rows):
        cell_style = styles["cell_header"] if row_index == 0 else styles["cell"]
        data.append([Paragraph(escape(str(cell)), cell_style) for cell in row])
    table = Table(data, colWidths=[usable_width / cols] * cols, repeatRows=1)
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


def source_page_image(original_pdf: Path, source_page: int, output_dir: Path, cov_id: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(original_pdf)
    page = doc[source_page - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(1.65, 1.65), alpha=False)
    path = output_dir / f"{cov_id.strip('#')}-source-page-{source_page}.png"
    pix.save(path)
    doc.close()
    return path


def build_appendix(cov_id: str, out_dir: Path) -> tuple[Path, list[dict[str, object]], list[FigureCaption], list[int]]:
    source_dir = ROOT / "exports" / "non-english-translations" / cov_id
    text_path = source_dir / f"english-translation-{cov_id}.txt"
    original_pdf = source_dir / f"original-{cov_id}.pdf"
    appendix_pdf = out_dir / "appendices" / f"smart-appendix-{cov_id}.pdf"
    appendix_pdf.parent.mkdir(parents=True, exist_ok=True)
    styles = style_map()
    table_blocks = relevant_table_blocks(text_path)
    figure_captions = parse_relevant_figure_captions(text_path, original_pdf)
    figure_pages = sorted({page for caption in figure_captions for page in caption.source_pages})
    captions_by_page = {page: [caption for caption in figure_captions if page in caption.source_pages] for page in figure_pages}

    doc = SimpleDocTemplate(
        str(appendix_pdf),
        pagesize=LETTER,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.45 * inch,
    )
    story = [
        para(f"{cov_id} Smart Extraction Appendix", styles["title"]),
        para("Added to the 2026-05-07 formatted English translation PDF. This appendix includes only translated tables and figure source pages selected for likely extraction relevance.", styles["body"]),
    ]

    if table_blocks:
        story.append(para("Selected English Tables", styles["h1"]))
        for block in table_blocks:
            story.append(para(str(block["caption"]), styles["caption"]))
            story.append(render_table(block["rows"], styles))
            story.append(Spacer(1, 9))
    else:
        story.append(para("Selected English Tables", styles["h1"]))
        story.append(para("No extraction-relevant translated table rows were detected for this record.", styles["body"]))

    if figure_captions:
        story.append(PageBreak())
        story.append(para("Selected Figure Source Pages With English Captions", styles["h1"]))
        story.append(para("Full original source pages are shown to prevent figure cutoff. Use the English captions below each page to interpret relevant figure labels/legends during extraction review.", styles["body"]))
        if figure_pages:
            for index, page_num in enumerate(figure_pages):
                if index:
                    story.append(PageBreak())
                story.append(para(f"Original source page {page_num}", styles["h2"]))
                image_path = source_page_image(original_pdf, page_num, out_dir / "assets", cov_id)
                img = Image(str(image_path))
                max_w = LETTER[0] - inch
                max_h = 5.95 * inch
                ratio = min(max_w / img.drawWidth, max_h / img.drawHeight, 1)
                img.drawWidth *= ratio
                img.drawHeight *= ratio
                story.append(img)
                story.append(Spacer(1, 5))
                for caption in captions_by_page[page_num]:
                    story.append(para(caption.caption, styles["caption"]))
        else:
            story.append(para("Relevant figure captions were found in the translation, but no matching original source page could be mapped automatically.", styles["body"]))
            for caption in figure_captions:
                story.append(para(caption.caption, styles["caption"]))

    doc.build(story)
    return appendix_pdf, table_blocks, figure_captions, figure_pages


def append_pdf(base_pdf: Path, appendix_pdf: Path, output_pdf: Path) -> int:
    base = fitz.open(base_pdf)
    appendix = fitz.open(appendix_pdf)
    base.insert_pdf(appendix)
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    base.save(output_pdf, garbage=4, deflate=True)
    page_count = len(base)
    appendix.close()
    base.close()
    return page_count


def render_previews(pdf_path: Path, preview_dir: Path, cov_id: str) -> list[Path]:
    preview_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    start = max(0, len(doc) - 6)
    paths: list[Path] = []
    for index in range(start, len(doc)):
        pix = doc[index].get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
        path = preview_dir / f"{cov_id.strip('#')}-smart-page-{index + 1}.png"
        pix.save(path)
        paths.append(path)
    doc.close()
    return paths


def build_one(cov_id: str, out_dir: Path) -> AppendixResult:
    base_pdf = BASE_BATCH / "pdfs" / f"extraction-ready-{cov_id}.pdf"
    if not base_pdf.exists():
        raise FileNotFoundError(base_pdf)
    output_pdf = out_dir / "pdfs" / f"extraction-ready-{cov_id}-with-smart-appendix.pdf"
    audit_file = out_dir / "paper-audits" / f"smart-appendix-audit-{cov_id}.md"
    appendix_pdf, table_blocks, figure_captions, figure_pages = build_appendix(cov_id, out_dir)
    output_pages = append_pdf(base_pdf, appendix_pdf, output_pdf)
    previews = render_previews(output_pdf, out_dir / "previews", cov_id)
    status = "smart_appendix_ready"
    if not table_blocks and not figure_captions:
        status = "no_relevant_appendix_items"
    elif figure_captions and not figure_pages:
        status = "figure_captions_unmapped"
    write_paper_audit(cov_id, base_pdf, output_pdf, appendix_pdf, audit_file, table_blocks, figure_captions, figure_pages, previews, status)
    return AppendixResult(cov_id, base_pdf, output_pdf, audit_file, len(table_blocks), len(figure_captions), len(figure_pages), output_pages, status)


def write_paper_audit(
    cov_id: str,
    base_pdf: Path,
    output_pdf: Path,
    appendix_pdf: Path,
    audit_file: Path,
    table_blocks: list[dict[str, object]],
    figure_captions: list[FigureCaption],
    figure_pages: list[int],
    previews: list[Path],
    status: str,
) -> None:
    audit_file.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {cov_id} Smart Extraction Appendix Audit",
        "",
        f"- Generated: {DATE_STAMP}",
        f"- Included translated extraction record: `{cov_id in INCLUDED_TRANSLATED_IDS}`",
        f"- Base formatted 2026-05-07 PDF: `{base_pdf}`",
        f"- Output PDF with smart appendix: `{output_pdf}`",
        f"- Appendix PDF: `{appendix_pdf}`",
        f"- Relevant English tables included: `{len(table_blocks)}`",
        f"- Relevant figure captions included: `{len(figure_captions)}`",
        f"- Original source pages rendered for figures: `{len(figure_pages)}`",
        f"- Status: `{status}`",
        "",
        "## Selection Logic",
        "",
        "- Tables and figures are selected only when captions/rows match extraction concepts such as population, exposure, incidence, risk, injury type, severity, location, mechanism, timing, match/training, team, or season.",
        "- Tables are rendered as clean English grids from translated rows.",
        "- Figure context uses full original source pages to avoid cutoffs; English translated captions are listed underneath.",
        "",
        "## Included Tables",
        "",
    ]
    if table_blocks:
        for index, block in enumerate(table_blocks, start=1):
            lines.append(f"{index}. {block.get('caption', 'Translated table')}")
    else:
        lines.append("- None detected.")
    lines.extend(["", "## Included Figures", ""])
    if figure_captions:
        for caption in figure_captions:
            source = ", ".join(str(page) for page in caption.source_pages) or "unmapped"
            lines.append(f"- {caption.caption} Source page(s): {source}")
    else:
        lines.append("- None detected.")
    lines.extend(["", "## Preview Files", ""])
    for preview in previews:
        lines.append(f"- `{preview}`")
    audit_file.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_manifest(results: list[AppendixResult], out_dir: Path) -> None:
    manifest = out_dir / "smart-appendix-manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "covidence_number",
                "base_pdf",
                "output_pdf",
                "audit_file",
                "relevant_tables",
                "relevant_figures",
                "figure_source_pages",
                "output_pages",
                "status",
            ],
        )
        writer.writeheader()
        for result in results:
            writer.writerow(
                {
                    "covidence_number": result.covidence_number,
                    "base_pdf": result.base_pdf,
                    "output_pdf": result.output_pdf,
                    "audit_file": result.audit_file,
                    "relevant_tables": result.table_count,
                    "relevant_figures": result.figure_count,
                    "figure_source_pages": result.figure_source_pages,
                    "output_pages": result.output_pages,
                    "status": result.status,
                }
            )

    audit = out_dir / "SMART_APPENDIX_BATCH_AUDIT.md"
    lines = [
        "# Smart Extraction Appendix Batch Audit",
        "",
        f"- Generated: {DATE_STAMP}",
        f"- Base batch: `{BASE_BATCH}`",
        f"- Records processed: `{len(results)}`",
        f"- Total relevant English tables: `{sum(result.table_count for result in results)}`",
        f"- Total relevant figure captions: `{sum(result.figure_count for result in results)}`",
        f"- Total figure source pages rendered: `{sum(result.figure_source_pages for result in results)}`",
        f"- Manifest: `{manifest}`",
        "",
        "## Records",
        "",
        "| Covidence | Tables | Figures | Figure pages | Status | Output |",
        "| --- | ---: | ---: | ---: | --- | --- |",
    ]
    for result in results:
        lines.append(
            f"| {result.covidence_number} | {result.table_count} | {result.figure_count} | {result.figure_source_pages} | {result.status} | `{result.output_pdf}` |"
        )
    audit.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=BASE_BATCH / "smart-appendix-batch")
    parser.add_argument("--target", action="append", help="Covidence number to process. May be repeated.")
    parser.add_argument("--include-sample", action="store_true", help="Include #245 as well as the other included records.")
    args = parser.parse_args()

    targets = selected_ids(args.target, args.include_sample)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    results = [build_one(cov_id, args.out_dir) for cov_id in targets]
    write_manifest(results, args.out_dir)
    print(args.out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
