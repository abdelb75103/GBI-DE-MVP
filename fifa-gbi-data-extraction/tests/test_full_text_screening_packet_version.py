#!/usr/bin/env python3
"""Regression test for task-local v8 packet provenance."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


WRAPPER_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "build-full-text-screening-packets-v8.py"
)


def load_wrapper():
    spec = importlib.util.spec_from_file_location("full_text_packet_v8_wrapper", WRAPPER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load wrapper: {WRAPPER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FullTextPacketVersionTests(unittest.TestCase):
    def test_installed_builder_is_overridden_with_current_v8_criteria(self) -> None:
        wrapper = load_wrapper()
        builder = wrapper.load_current_builder()
        self.assertEqual(
            builder.CRITERIA_VERSION,
            "fifa-gbi-full-text-v8-2026-06-23",
        )


if __name__ == "__main__":
    unittest.main()
