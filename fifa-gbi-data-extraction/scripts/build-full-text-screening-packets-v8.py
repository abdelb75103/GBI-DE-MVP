#!/usr/bin/env python3
"""Run the installed FIFA full-text packet builder with the current v8 criteria stamp."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


CURRENT_CRITERIA_VERSION = "fifa-gbi-full-text-v8-2026-06-23"
SKILL_BUILDER_PATH = Path(
    "/Users/abdelbabiker/.codex/skills/"
    "fifa-full-text-screening-review/scripts/build_screening_packet.py"
)


def load_current_builder():
    spec = importlib.util.spec_from_file_location(
        "fifa_full_text_screening_packet_builder_v8",
        SKILL_BUILDER_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load installed packet builder: {SKILL_BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.CRITERIA_VERSION = CURRENT_CRITERIA_VERSION
    return module


def main() -> int:
    return load_current_builder().main()


if __name__ == "__main__":
    raise SystemExit(main())
