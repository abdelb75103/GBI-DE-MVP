#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MASTER_PDF = REPO_ROOT / "output" / "pdf" / "UEFA_ECIS_Men_Master_Extraction.pdf"
AUDIT_DIR = REPO_ROOT / "Data Analysis" / "Data Cleaning" / "audit" / "uefa-master"
BACKUP_PDF = (
    AUDIT_DIR
    / "UEFA_ECIS_Men_Master_Extraction.pre-methodology-appendix.7effd081c1af.pdf"
)
APPENDIX_PDF = AUDIT_DIR / "UEFA_ECIS_Men_Second_Search_Methodology_Addendum.pdf"
NEXT_PDF = REPO_ROOT / "output" / "pdf" / "UEFA_ECIS_Men_Master_Extraction.next.pdf"
LOCAL_AUDIT = (
    AUDIT_DIR / "uefa-men-second-search-methodology-appendix-local-audit-2026-07-27.json"
)

EXPECTED_INPUT_SHA256 = "7effd081c1afac526fe7e24236eb6ca02821558d6da8ea3194abfa6d0f91004c"
EXPECTED_INPUT_PAGES = 11

NAVY = colors.HexColor("#0b2545")
BLUE = colors.HexColor("#143d59")
MUTED = colors.HexColor("#5f6b7a")
GRID = colors.HexColor("#c9d2dc")
PALE_BLUE = colors.HexColor("#eef5fa")
PALE_GREEN = colors.HexColor("#edf7f1")
PALE_GREY = colors.HexColor("#f6f8fb")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=22,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceAfter=3,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=BLUE,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.6,
            textColor=colors.black,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.25,
            leading=9.1,
            textColor=colors.black,
        ),
        "small_bold": ParagraphStyle(
            "SmallBold",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.25,
            leading=9.1,
            textColor=NAVY,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.25,
            leading=9.1,
            textColor=colors.white,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9.2,
            leading=12,
            textColor=NAVY,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=6.8,
            leading=8,
            textColor=MUTED,
        ),
    }


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def addendum_footer(canvas, _doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(15 * mm, 10 * mm, "UEFA master extraction audit - second-search addendum - prepared 2026-07-27")
    canvas.drawRightString(282 * mm, 10 * mm, "Page 12")
    canvas.restoreState()


def build_appendix_page(path: Path) -> None:
    s = styles()
    doc = SimpleDocTemplate(
        str(path),
        pagesize=landscape(A4),
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=13 * mm,
        bottomMargin=16 * mm,
        title="UEFA ECIS Men Second-Search Methodology Addendum",
        author="FIFA GBI extraction audit",
    )

    story = [
        paragraph("Second-search methodology addendum", s["title"]),
        paragraph(
            "Men's UEFA Elite Club Injury Study (ECIS) master | Reviewed and applied 27 July 2026",
            s["subtitle"],
        ),
    ]

    conclusion = Table(
        [[paragraph(
            "<b>Conclusion.</b> The second search identified one directly supported, non-overlapping "
            "men's ECIS supplement for the live master: S5151. The other reviewed men's UEFA papers "
            "did not add a compatible independent master row.",
            s["callout"],
        )]],
        colWidths=[267 * mm],
    )
    conclusion.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.7, BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend([conclusion, Spacer(1, 5)])

    story.append(paragraph("Data added to the men's master", s["h2"]))
    added_data = [
        [
            paragraph("Paper", s["table_header"]),
            paragraph("Why it was additive", s["table_header"]),
            paragraph("Exact live row added", s["table_header"]),
        ],
        [
            paragraph(
                "<b>S5151</b><br/>DOI 10.1136/bmjsem-2025-002772<br/>2022/23 season",
                s["small"],
            ),
            paragraph(
                "This directly reported full-season cohort is later than the S200 all-injury anchor "
                "(ending 2018/19) and the retained S043 hamstring period (ending 2021/22). Historical "
                "comparators, World Cup subgroup contrasts and unpooled muscle-rate contrasts were "
                "not imported.",
                s["small"],
            ),
            paragraph(
                "<b>913</b> players; <b>29</b> teams; <b>176,790</b> player-hours; "
                "<b>1,123</b> injuries; training incidence <b>3.5</b> "
                "(95% CI 3.2-3.9); match incidence <b>21.1</b> "
                "(95% CI 19.5-22.9); <b>26,418</b> injury-absence days.",
                s["small"],
            ),
        ],
    ]
    added_table = Table(added_data, colWidths=[42 * mm, 102 * mm, 123 * mm], repeatRows=1)
    added_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, 1), PALE_GREEN),
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([added_table, Spacer(1, 5)])

    story.append(paragraph("Men's papers reviewed but not added", s["h2"]))
    excluded_data = [
        [
            paragraph("Paper", s["table_header"]),
            paragraph("Classification", s["table_header"]),
            paragraph("Audit conclusion", s["table_header"]),
        ],
        [
            paragraph("<b>S4839</b><br/>DOI 10.1136/bmjsem-2024-002182", s["small"]),
            paragraph("Audit-only risk-factor substudy", s["small"]),
            paragraph(
                "Four-season, 14-team analysis with 54 team-season burden and survey-predictor "
                "observations. It does not report a compatible pooled programme-wide hamstring "
                "incidence or burden row beyond the retained S043 concept.",
                s["small"],
            ),
        ],
        [
            paragraph("<b>S2391</b><br/>DOI 10.1177/03635465251353213", s["small"]),
            paragraph("Audit-only nested ACLR cohort", s["small"]),
            paragraph(
                "The 110 ACL reconstruction cases are nested within 5,447 ECIS players. Adding the "
                "pre/post return-to-play rates would double-count ECIS players, injuries and exposure "
                "and would mix prognosis with surveillance.",
                s["small"],
            ),
        ],
        [
            paragraph("<b>S5338</b><br/>UEFA EURO 2024 / Copa America 2024", s["small"]),
            paragraph("Separate tournament workspace", s["small"]),
            paragraph(
                "Tournament surveillance is not part of the longitudinal elite-club ECIS programme. "
                "Its existing reviewed extraction remains separate and was not copied into the master.",
                s["small"],
            ),
        ],
    ]
    excluded_table = Table(excluded_data, colWidths=[52 * mm, 56 * mm, 159 * mm], repeatRows=1)
    excluded_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_GREY]),
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.extend([excluded_table, Spacer(1, 5)])

    story.append(paragraph("Live outcome and audit controls", s["h2"]))
    controls = Table(
        [
            [
                paragraph(
                    "<b>Master outcome</b><br/>UEFA-ECIS-MASTER increased from 19 to 20 rows. "
                    "S200 remains the historical all-injury anchor; no earlier row was replaced, "
                    "extended or pooled.",
                    s["small"],
                ),
                paragraph(
                    "<b>Integrity result</b><br/>All 11 S5151 fields matched across "
                    "population_values and newline-aligned extraction_fields. Previous 19-row "
                    "prefixes, assignment, status and protected screening state were unchanged.",
                    s["small"],
                ),
            ],
            [
                paragraph(
                    "<b>Women's boundary check</b><br/>S1091 was confirmed as a duplicate alias "
                    "of S112 (same DOI, article and Table 2). S112 remains the single WECIS "
                    "source-of-truth; no duplicate women's record was created.",
                    s["small"],
                ),
                paragraph(
                    "<b>Page 11 clarification</b><br/>Read “S200 remains the historical all-injury "
                    "ECIS men anchor for overlapping periods”, not “the only all-injury denominator”. "
                    "S5151 is a later, non-overlapping one-season supplement.",
                    s["small"],
                ),
            ],
        ],
        colWidths=[133.5 * mm, 133.5 * mm],
    )
    controls.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_GREY),
                ("BOX", (0, 0), (-1, -1), 0.45, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(KeepTogether(controls))
    doc.build(story, onFirstPage=addendum_footer)


def page_signature(page) -> dict[str, object]:
    contents = page.get_contents()
    content_bytes = contents.get_data() if contents else b""
    return {
        "contentSha256": hashlib.sha256(content_bytes).hexdigest(),
        "mediaBox": [float(value) for value in page.mediabox],
        "rotation": int(page.rotation or 0),
        "textSha256": hashlib.sha256((page.extract_text() or "").encode("utf-8")).hexdigest(),
    }


def main() -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    input_sha256 = sha256_file(MASTER_PDF)
    if input_sha256 != EXPECTED_INPUT_SHA256:
        raise RuntimeError(
            f"Unexpected input PDF hash {input_sha256}; expected {EXPECTED_INPUT_SHA256}."
        )

    source_reader = PdfReader(str(MASTER_PDF))
    if len(source_reader.pages) != EXPECTED_INPUT_PAGES:
        raise RuntimeError(
            f"Expected {EXPECTED_INPUT_PAGES} source pages, found {len(source_reader.pages)}."
        )

    if BACKUP_PDF.exists():
        if sha256_file(BACKUP_PDF) != input_sha256:
            raise RuntimeError("Existing pre-append backup does not match the current master PDF.")
    else:
        BACKUP_PDF.write_bytes(MASTER_PDF.read_bytes())

    build_appendix_page(APPENDIX_PDF)
    appendix_reader = PdfReader(str(APPENDIX_PDF))
    if len(appendix_reader.pages) != 1:
        raise RuntimeError(f"Expected a one-page appendix, found {len(appendix_reader.pages)} pages.")

    writer = PdfWriter()
    writer.clone_document_from_reader(source_reader)
    writer.add_page(appendix_reader.pages[0])
    writer.add_metadata(
        {
            "/Title": "UEFA ECIS Men Master Extraction with Second-Search Methodology Addendum",
            "/Subject": "ECIS men source-family reconciliation and live audit trail",
            "/Author": "FIFA GBI extraction audit",
        }
    )
    with NEXT_PDF.open("wb") as stream:
        writer.write(stream)

    final_reader = PdfReader(str(NEXT_PDF))
    if len(final_reader.pages) != EXPECTED_INPUT_PAGES + 1:
        raise RuntimeError(f"Expected 12 final pages, found {len(final_reader.pages)}.")

    source_signatures = [page_signature(page) for page in source_reader.pages]
    preserved_signatures = [
        page_signature(final_reader.pages[index]) for index in range(EXPECTED_INPUT_PAGES)
    ]
    if source_signatures != preserved_signatures:
        raise RuntimeError("One or more of the existing 11 pages changed during the append.")

    os.replace(NEXT_PDF, MASTER_PDF)
    output_sha256 = sha256_file(MASTER_PDF)
    audit = {
        "artifactType": "UEFA ECIS men second-search methodology appendix local build audit",
        "date": "2026-07-27",
        "input": {
            "path": str(BACKUP_PDF),
            "sha256": input_sha256,
            "pages": EXPECTED_INPUT_PAGES,
        },
        "appendix": {
            "path": str(APPENDIX_PDF),
            "pages": 1,
            "content": {
                "includedSupplement": "S5151",
                "auditOnly": ["S4839", "S2391"],
                "separateWorkspace": ["S5338"],
                "womensBoundaryCheck": "S1091 duplicate alias of S112",
                "clarification": "S200 is the historical all-injury ECIS men anchor for overlapping periods.",
            },
        },
        "output": {
            "path": str(MASTER_PDF),
            "sha256": output_sha256,
            "pages": EXPECTED_INPUT_PAGES + 1,
            "existingPageSignaturesPreserved": True,
        },
        "readyFor": "Visual QA before live PDF-only refresh",
    }
    LOCAL_AUDIT.write_text(f"{json.dumps(audit, indent=2)}\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
