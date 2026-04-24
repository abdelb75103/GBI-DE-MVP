#!/usr/bin/env python3

import json
import sys
from pathlib import Path

from pypdf import PdfReader


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: pdf-page-dump.py <pdf-path>", file=sys.stderr)
        return 1

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    reader = PdfReader(str(pdf_path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
      text = page.extract_text() or ""
      pages.append(
          {
              "page": index,
              "text": text,
          }
      )

    sys.stdout.write(json.dumps({"pages": pages}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
