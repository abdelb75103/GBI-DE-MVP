#!/usr/bin/env python3
"""Build local UEFA ECIS/WECIS master extraction PDFs and triage audit.

This script is read-only against Supabase. It writes local PDF/JSON artifacts.
"""

from __future__ import annotations

import json
import os
import re
import sys
import textwrap
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
APP_ENV = ROOT / "fifa-gbi-data-extraction" / ".env.local"
OUT_DIR = ROOT / "output" / "pdf"
AUDIT_DIR = ROOT / "Data Analysis" / "Data Cleaning" / "audit" / "uefa-master"
TODAY = date.today().isoformat()

MANDATORY_IDS = {
    "S068",  # UEFA-related comparator, no longer status=uefa after own-workspace extraction
    "S109",  # UEFA tournament audit, no longer status=uefa after own-workspace extraction
    "S111",  # UEFA-method-only/non-ECIS source retained in triage even if assigned elsewhere
    "S200",  # all-injury ECIS anchor, currently extracted
    "S112",  # WECIS anchor
}


@dataclass
class SourcePaper:
    study_id: str
    title: str
    status: str
    year: str
    lead_author: str
    doi: str
    category: str
    role: str
    decision: str
    notes: str


def ascii_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = (
        text.replace("\u2010", "-")
        .replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", text).strip()


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def supabase_get(env: dict[str, str], endpoint: str) -> list[dict[str, Any]]:
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    req = Request(
        f"{base}/rest/v1/{endpoint}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        raise RuntimeError(f"Supabase read failed for {endpoint}: {exc}") from exc


def load_papers() -> list[dict[str, Any]]:
    env = load_env(APP_ENV)
    uefa = supabase_get(
        env,
        "papers?select=assigned_study_id,title,status,year,lead_author,doi&status=eq.uefa&order=assigned_study_id.asc",
    )
    extra_filter = ",".join(MANDATORY_IDS)
    extra = supabase_get(
        env,
        f"papers?select=assigned_study_id,title,status,year,lead_author,doi&assigned_study_id=in.({extra_filter})",
    )
    by_id = {row["assigned_study_id"]: row for row in uefa + extra}
    return [by_id[key] for key in sorted(by_id)]


def classify(row: dict[str, Any]) -> SourcePaper:
    sid = ascii_text(row.get("assigned_study_id"))
    title = ascii_text(row.get("title"))
    lower = title.lower()
    status = ascii_text(row.get("status"))
    year = ascii_text(row.get("year"))
    lead = ascii_text(row.get("lead_author"))
    doi = ascii_text(row.get("doi"))

    if sid == "S200" or "injury rates decreased in men's professional football" in lower:
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "ECIS men",
            "master anchor",
            "Use as the main all-injury ECIS men source.",
            "Currently status extracted, so it must be pulled into the UEFA source universe by content.",
        )
    if "women" in lower or "wecis" in lower:
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "WECIS women",
            "master anchor",
            "Use as the WECIS women all-injury source.",
            "Separate master because sex, programme start, and surveillance period differ from men ECIS.",
        )
    if sid == "S068" or "south america compared with europe" in lower:
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "UEFA-related comparator",
            "own workspace",
            "Extract in its own paper workspace if needed; do not create a master record.",
            "Contains a South American cohort plus ECIS European comparator; independent South American data must not be folded into ECIS.",
        )
    if sid == "S109" or "european championships 2006 to 2008" in lower:
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "UEFA tournament",
            "own workspace",
            "Extract in its own paper workspace if needed; do not create a master record.",
            "Tournament audit is UEFA-branded but not ECIS/WECIS elite-club longitudinal surveillance.",
        )
    if sid == "S111" or "uefa model" in lower:
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "UEFA-method-only/non-ECIS",
            "own workspace",
            "Extract in its own paper workspace if it is eligible; do not create a master record.",
            "Uses UEFA methodology/model language but does not appear to be ECIS/WECIS surveillance.",
        )
    if "champions league" in lower or "elite club" in lower or "male elite" in lower or "men's professional" in lower:
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "ECIS men",
            "supplement",
            "Use only for field-level details not already captured by the ECIS men master.",
            "Topic-specific or overlapping ECIS-family source.",
        )
    return SourcePaper(
        sid,
        title,
        status,
        year,
        lead,
        doi,
        "ECIS men",
        "supplement needs confirmation",
        "Review full text before use; default is supplement only.",
        "Current tag is UEFA, but title requires manual confirmation of ECIS/WECIS family membership.",
    )


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            spaceAfter=8,
            textColor=colors.HexColor("#0b2545"),
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=5,
            textColor=colors.HexColor("#143d59"),
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            alignment=TA_LEFT,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=9,
            textColor=colors.white,
            alignment=TA_LEFT,
        ),
    }


def para(text: Any, style: ParagraphStyle) -> Paragraph:
    return Paragraph(ascii_text(text), style)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#5f6b7a"))
    canvas.drawString(15 * mm, 10 * mm, f"UEFA master extraction audit - prepared {TODAY}")
    canvas.drawRightString(282 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_doc(path: Path, title: str, story: list[Any]) -> None:
    doc = BaseDocTemplate(
        str(path),
        pagesize=landscape(A4),
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    doc.build(story)


def source_table(rows: list[SourcePaper], style: ParagraphStyle, header_style: ParagraphStyle) -> Table:
    data = [
        [
            para("Study ID", header_style),
            para("Year", header_style),
            para("Status", header_style),
            para("Category", header_style),
            para("Role", header_style),
            para("Decision", header_style),
            para("Title", header_style),
        ]
    ]
    for row in rows:
        data.append(
            [
                para(row.study_id, style),
                para(row.year, style),
                para(row.status, style),
                para(row.category, style),
                para(row.role, style),
                para(row.decision, style),
                para(row.title, style),
            ]
        )
    table = Table(data, colWidths=[18 * mm, 14 * mm, 20 * mm, 44 * mm, 28 * mm, 60 * mm, 78 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b2545")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c9d2dc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f8fb")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def bullets(items: list[str], style: ParagraphStyle) -> list[Paragraph]:
    return [para(f"- {item}", style) for item in items]


def build_master_pdf(path: Path, title: str, rows: list[SourcePaper], kind: str) -> None:
    s = styles()
    story: list[Any] = [para(title, s["title"])]
    story.append(para(f"Prepared: {TODAY}", s["body"]))
    story.append(Spacer(1, 5))
    story.append(para("Purpose", s["h1"]))
    story.extend(
        bullets(
            [
                f"Create a single consolidated {kind} extraction target while avoiding duplicate counting across overlapping UEFA surveillance publications.",
                "Count programme-periods and populations, not papers.",
                "Use source papers only as field-level provenance unless they define the master all-injury programme-period.",
            ],
            s["body"],
        )
    )
    story.append(para("Counting Rule", s["h1"]))
    story.extend(
        bullets(
            [
                "One overlapping surveillance programme-period contributes once to high-level counts.",
                "Topic-specific papers cannot add another all-injury count for the same players, seasons, and method frame.",
                "Topic-specific papers may add missing field-level values such as burden, RTP, recurrence, diagnosis, location, or severity.",
                "Do not subtract overlapping periods unless a source directly reports the non-overlapping value.",
            ],
            s["body"],
        )
    )
    story.append(para("Source Inventory And Decisions", s["h1"]))
    story.append(source_table(rows, s["small"], s["table_header"]))
    story.append(PageBreak())
    story.append(para("Field-Level Provenance Requirements", s["h1"]))
    story.extend(
        bullets(
            [
                "Each extracted value must record source study ID, page/table/figure, source role, direct-vs-derived status, and overlap decision.",
                "If a value is taken from a supplement paper, record why the master source did not already cover that field.",
                "If the same metric appears in two overlapping papers, prefer the broadest all-injury master unless the supplement reports a more specific row that matches the extraction field.",
                "If source definitions differ, split into a separate population/programme-period row instead of merging.",
            ],
            s["body"],
        )
    )
    story.append(para("Reviewer Checklist", s["h1"]))
    story.extend(
        bullets(
            [
                "Confirm all source IDs in the PDF have been reviewed against full text or reliable extracted text.",
                "Confirm no ordinary UEFA source paper remains in the analytical export alongside this master record.",
                "Confirm all source-only and already-included papers are marked in the provenance ledger.",
                "Confirm all live values have field-level provenance before marking the master record review-ready.",
            ],
            s["body"],
        )
    )
    build_doc(path, title, story)


def build_triage_pdf(path: Path, rows: list[SourcePaper]) -> None:
    s = styles()
    story: list[Any] = [para("UEFA Related Source Triage Audit", s["title"])]
    story.append(para(f"Prepared: {TODAY}", s["body"]))
    story.append(Spacer(1, 5))
    story.append(para("Purpose", s["h1"]))
    story.extend(
        bullets(
            [
                "Identify UEFA-tagged or UEFA-branded papers that should not be merged into ECIS men or WECIS women master records.",
                "Confirm that non-ECIS/WECIS papers should be extracted in their own existing workspace if eligible.",
                "Prevent accidental double counting by documenting why these papers are not master-record sources.",
            ],
            s["body"],
        )
    )
    story.append(para("Triage Rule", s["h1"]))
    story.extend(
        bullets(
            [
                "If the paper is not UEFA ECIS or WECIS, do not create a new master record.",
                "If eligible for the main review, extract it in its own current paper workspace.",
                "If a paper only uses the UEFA model/method and is not a UEFA surveillance cohort, classify it by its actual cohort and setting.",
                "If a paper contains an ECIS comparator plus a non-European cohort, keep the non-European cohort separate and do not fold it into ECIS.",
            ],
            s["body"],
        )
    )
    story.append(para("Papers Requiring Separate Workspace Handling", s["h1"]))
    story.append(source_table(rows, s["small"], s["table_header"]))
    story.append(Spacer(1, 8))
    story.append(para("Audit Notes", s["h1"]))
    for row in rows:
        story.append(
            KeepTogether(
                [
                    para(f"{row.study_id}: {row.title}", s["body"]),
                    para(f"Decision: {row.decision}", s["small"]),
                    para(f"Reason: {row.notes}", s["small"]),
                    Spacer(1, 4),
                ]
            )
        )
    build_doc(path, "UEFA Related Source Triage Audit", story)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    papers = [classify(row) for row in load_papers()]
    ecis = [row for row in papers if row.category == "ECIS men"]
    wecis = [row for row in papers if row.category == "WECIS women"]
    triage = [row for row in papers if row.category not in {"ECIS men", "WECIS women"}]

    audit = {
        "prepared": TODAY,
        "counts": {
            "all_sources_reviewed": len(papers),
            "ecis_men_sources": len(ecis),
            "wecis_women_sources": len(wecis),
            "separate_workspace_sources": len(triage),
        },
        "sources": [row.__dict__ for row in papers],
    }
    audit_path = AUDIT_DIR / "uefa-master-source-audit.json"
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")

    build_master_pdf(OUT_DIR / "UEFA_ECIS_Men_Master_Extraction.pdf", "UEFA ECIS Men Master Extraction", ecis, "men's ECIS")
    build_master_pdf(OUT_DIR / "UEFA_WECIS_Women_Master_Extraction.pdf", "UEFA WECIS Women Master Extraction", wecis, "women's WECIS")
    build_triage_pdf(OUT_DIR / "UEFA_Related_Source_Triage.pdf", triage)

    print(json.dumps({"audit": str(audit_path), "pdfs": [str(p) for p in sorted(OUT_DIR.glob("UEFA_*.pdf"))]}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
