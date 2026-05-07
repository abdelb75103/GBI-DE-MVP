#!/usr/bin/env python3
"""Merge smart translated PDFs with their original PDFs for extraction.

Output order is always:
1. formatted English translation with smart appendix
2. original source PDF from first page to last page
"""

from __future__ import annotations

import csv
import datetime as dt
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
DATE_STAMP = dt.date.today().isoformat()
SMART_DIR = ROOT / "outputs" / "extraction-ready-translations" / "2026-05-07" / "smart-appendix-batch-all18"
OUT_DIR = ROOT / "outputs" / "extraction-ready-translations" / "2026-05-07" / "merged-translated-original-all18"
MANIFEST = ROOT / "exports" / "non-english-translations" / "manifest.csv"

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


def load_original_paths() -> dict[str, Path]:
    paths: dict[str, Path] = {}
    with MANIFEST.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            cov_id = row["covidence_number"].strip()
            if not cov_id.startswith("#"):
                cov_id = f"#{cov_id}"
            if cov_id in INCLUDED_TRANSLATED_IDS:
                paths[cov_id] = Path(row["original_pdf_path"])
    return paths


def merge_pair(cov_id: str, translated_pdf: Path, original_pdf: Path, output_pdf: Path) -> tuple[int, int, int]:
    translated = fitz.open(translated_pdf)
    original = fitz.open(original_pdf)
    out = fitz.open()
    out.insert_pdf(translated)
    out.insert_pdf(original)
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    out.save(output_pdf, garbage=4, deflate=True)
    translated_pages = len(translated)
    original_pages = len(original)
    total_pages = len(out)
    out.close()
    original.close()
    translated.close()
    with fitz.open(output_pdf) as check:
        if len(check) != total_pages:
            raise RuntimeError(f"{cov_id}: saved page count mismatch")
    return translated_pages, original_pages, total_pages


def main() -> int:
    original_paths = load_original_paths()
    rows = []
    pdf_dir = OUT_DIR / "pdfs"
    for cov_id in INCLUDED_TRANSLATED_IDS:
        translated_pdf = SMART_DIR / "pdfs" / f"extraction-ready-{cov_id}-with-smart-appendix.pdf"
        original_pdf = original_paths[cov_id]
        output_pdf = pdf_dir / f"merged-translated-first-original-second-{cov_id}.pdf"
        if not translated_pdf.exists():
            raise FileNotFoundError(translated_pdf)
        if not original_pdf.exists():
            raise FileNotFoundError(original_pdf)
        translated_pages, original_pages, total_pages = merge_pair(cov_id, translated_pdf, original_pdf, output_pdf)
        rows.append(
            {
                "covidence_number": cov_id,
                "translated_pdf": str(translated_pdf),
                "original_pdf": str(original_pdf),
                "merged_pdf": str(output_pdf),
                "translated_pages": translated_pages,
                "original_pages": original_pages,
                "total_pages": total_pages,
                "order": "translated_then_original",
            }
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = OUT_DIR / "merged-translated-original-manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    audit = OUT_DIR / "MERGED_TRANSLATED_ORIGINAL_AUDIT.md"
    lines = [
        "# Merged Translated + Original PDF Audit",
        "",
        f"- Generated: {DATE_STAMP}",
        f"- Records processed: `{len(rows)}`",
        f"- Output folder: `{pdf_dir}`",
        f"- Manifest: `{manifest}`",
        "- Merge order: translated smart-appendix PDF first, original PDF second.",
        "",
        "| Covidence | Translated pages | Original pages | Total pages | Output |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['covidence_number']} | {row['translated_pages']} | {row['original_pages']} | {row['total_pages']} | `{row['merged_pdf']}` |"
        )
    audit.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
