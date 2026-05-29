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

ECIS_REFINED_DECISIONS = {
    "S006": (
        "retained concept rows",
        "Use LCL and PCL rows because they add diagnosis-specific incidence, burden, time-loss, recurrence/mechanism, and exposure details.",
        "Kept live as two ligament-specific rows; shared ECIS definitions stay on the S200 anchor row only.",
    ),
    "S007": (
        "retained concept rows",
        "Use indirect thigh and direct thigh contusion rows because they add directly reported incidence, burden, time-loss, mechanism, and exposure details.",
        "Kept live as two thigh-specific rows; not used to create another all-injury denominator.",
    ),
    "S011": (
        "audit-only overlap",
        "Do not use live unless historical common-injury benchmarking is specifically requested.",
        "The paper adds older common-injury summaries but would add multiple extra diagnosis rows across an already-overlapping ECIS period.",
    ),
    "S043": (
        "retained concept row",
        "Use the overall hamstring row because it adds a longer hamstring-specific ECIS period with match/training incidence, time-loss, recurrence, and exposure.",
        "Structural/functional subtype count rows are audit-only because they mainly add subtype counts/time-loss without new compatible incidence/burden fields.",
    ),
    "S046": (
        "retained concept rows",
        "Use hip/groin and adductor-related rows because they add incidence, burden, time-loss, mechanism, recurrence, and exposure details.",
        "Kept live as concept rows; not merged into S200 all-injury counts.",
    ),
    "S091": (
        "retained concept rows",
        "Use Achilles tendinopathy and rupture rows because they add diagnosis-specific incidence, burden, time-loss, recurrence, and exposure details.",
        "Kept live as two Achilles-specific rows.",
    ),
    "S106": (
        "retained concept row",
        "Use the MCL row because it adds diagnosis-specific incidence, burden, time-loss, recurrence/mechanism, and exposure details.",
        "Kept live as one ligament-specific row.",
    ),
    "S107": (
        "retained concept row",
        "Use the ankle row because it adds ankle-specific incidence, time-loss, recurrence, exposure, and structured location/tissue values.",
        "Kept live as one ankle-specific row.",
    ),
    "S113": (
        "retained concept row",
        "Use the upper-extremity row because it adds incidence, time-loss, recurrence, and exposure details for a location group not isolated in S200.",
        "Kept live as one location-specific row.",
    ),
    "S200": (
        "master anchor",
        "Use as the only all-injury ECIS men denominator and the base for shared definitions/context.",
        "Live anchor row includes all-injury count/incidence/exposure plus directly reported S200 parent tissue counts.",
    ),
    "S202": (
        "retained/audit split",
        "Use the overall stress-fracture row because it adds direct incidence and recurrence-rate detail; do not use the fifth-metatarsal stress-fracture count-only row live.",
        "Count-only subtype detail remains audit-only unless the reviewer requests a separate stress-fracture subtype worksheet.",
    ),
    "S340": (
        "retained concept rows",
        "Use head/neck and concussion rows because they add location/diagnosis-specific incidence, time-loss, and exposure details.",
        "Kept live as two concept rows.",
    ),
    "S368": (
        "retained concept row",
        "Use the syndesmosis row because it adds directly reported incidence, burden, total time-loss, recurrence, and exposure details.",
        "Kept live as one ankle subtype row.",
    ),
    "S401": (
        "retained concept row",
        "Use the ACL row because it adds diagnosis-specific incidence, recurrence, severity, and exposure details for a high-priority injury.",
        "Kept live even though burden is not directly reported.",
    ),
    "S451": (
        "retained concept row",
        "Use the fifth-metatarsal fracture row because it adds fracture-specific incidence, recurrence/non-contact detail, and exposure.",
        "Kept live separately from stress-fracture rows because the case definition differs.",
    ),
    "S527": (
        "audit-only overlap",
        "Do not use live in the master because it is a return-to-play risk/prognosis source rather than a clean incidence/burden extraction row.",
        "Relevant for interpretation, but not a separate master population row.",
    ),
    "S581": (
        "audit-only overlap",
        "Do not use live because the index-injury RTP rows duplicate diagnosis concepts already represented by cleaner incidence/burden source papers.",
        "Retain in audit for prognosis context only.",
    ),
}

ECIS_SOURCE_LEDGER = {
    "S002": {
        "topic": "ACL injury",
        "period": "earlier ECIS/cohort period",
        "tag": "superseded",
        "handling": "Do not add a live row; use S401 ACL as the retained ACL concept row.",
        "reason": "Older ACL-focused source overlaps the ECIS programme and is superseded for master extraction by the later 15-year ACL paper.",
    },
    "S006": {
        "topic": "LCL/PCL injuries",
        "period": "2001-2018",
        "tag": "included here",
        "handling": "Live ECIS rows: LCL injuries; PCL injuries.",
        "reason": "Adds diagnosis-specific incidence, burden, time-loss, recurrence/mechanism, and exposure not isolated in S200.",
    },
    "S007": {
        "topic": "Indirect thigh strains and direct thigh contusions",
        "period": "2001-2013",
        "tag": "included here",
        "handling": "Live ECIS rows: indirect thigh muscle injuries; direct thigh muscle contusions.",
        "reason": "Adds directly reported incidence, burden, time-loss, mechanism, and exposure for thigh injury subtypes.",
    },
    "S011": {
        "topic": "Common injury patterns / prevention-era benchmark",
        "period": "overlapping 11-year ECIS period",
        "tag": "already included / audit-only",
        "handling": "No live ECIS row unless a reviewer requests a historical common-injury benchmark worksheet.",
        "reason": "All-injury denominator overlaps S200; common diagnosis rows would duplicate concepts already represented by cleaner retained concept papers.",
    },
    "S019": {
        "topic": "Team injury burden / prevention practice association",
        "period": "overlapping ECIS period",
        "tag": "audit-only",
        "handling": "Do not add to master rows; extract in own workspace only if team-level risk-factor analysis is needed.",
        "reason": "Association/risk-factor paper, not a clean additional injury-count denominator for the ECIS master.",
    },
    "S042": {
        "topic": "Hamstring time trend",
        "period": "2001/02-2014/15",
        "tag": "superseded",
        "handling": "No live ECIS row; use S043 hamstring row.",
        "reason": "Earlier hamstring time-trend paper is superseded by the longer 21-season hamstring paper retained in the master.",
    },
    "S043": {
        "topic": "Hamstring injuries",
        "period": "2001/02-2021/22",
        "tag": "included here",
        "handling": "Live ECIS row: hamstring injuries. Structural/functional subtype count rows remain audit-only.",
        "reason": "Adds longer hamstring-specific match/training incidence, time-loss, recurrence, and exposure. Subtypes are not separate master rows because they mainly add counts/time-loss without compatible incidence/burden.",
    },
    "S046": {
        "topic": "Hip/groin and adductor-related injuries",
        "period": "2001/02-2015/16",
        "tag": "included here",
        "handling": "Live ECIS rows: hip/groin injuries; adductor-related hip/groin injuries.",
        "reason": "Adds incidence, burden, time-loss, mechanism, recurrence, and exposure for a location/diagnosis not isolated in S200.",
    },
    "S056": {
        "topic": "COVID-19 lockdown/restart injury burden",
        "period": "COVID restart period",
        "tag": "audit-only special period",
        "handling": "Do not add to the master denominator; extract separately only for COVID-specific analysis.",
        "reason": "Special-period subgroup analysis would not be combinable with S200 programme-period counts.",
    },
    "S057": {
        "topic": "Team performance impact",
        "period": "overlapping 11-year ECIS period",
        "tag": "audit-only",
        "handling": "No live ECIS row.",
        "reason": "Performance association paper; injury denominator overlaps the ECIS all-injury programme already represented by S200.",
    },
    "S079": {
        "topic": "Internal workload and non-contact injury",
        "period": "one ECIS season / five teams",
        "tag": "audit-only risk factor",
        "handling": "No live ECIS row unless a separate workload-risk worksheet is created.",
        "reason": "Risk-factor analysis with a restricted cohort; not a clean programme-wide count to merge into the master.",
    },
    "S084": {
        "topic": "Fixture congestion and muscle injuries",
        "period": "overlapping ECIS period",
        "tag": "audit-only risk factor",
        "handling": "No live ECIS row.",
        "reason": "Exposure/risk-factor paper; muscle injury parent counts are already represented by S200 and specific thigh/hamstring papers.",
    },
    "S091": {
        "topic": "Achilles tendon injuries",
        "period": "2001-2011",
        "tag": "included here",
        "handling": "Live ECIS rows: Achilles tendinopathy; Achilles tendon rupture.",
        "reason": "Adds diagnosis-specific incidence, burden, time-loss, recurrence, and exposure.",
    },
    "S106": {
        "topic": "MCL injuries",
        "period": "2001/02-2011/12",
        "tag": "included here",
        "handling": "Live ECIS row: MCL injuries.",
        "reason": "Adds diagnosis-specific incidence, burden, time-loss, recurrence/mechanism, and exposure.",
    },
    "S107": {
        "topic": "Ankle injuries",
        "period": "2001/02-2011/12",
        "tag": "included here",
        "handling": "Live ECIS row: ankle injuries.",
        "reason": "Adds ankle-specific incidence, time-loss, recurrence, exposure, and structured location/tissue values.",
    },
    "S108": {
        "topic": "Early Champions League prospective injury study",
        "period": "early ECIS/Champions League period",
        "tag": "already included",
        "handling": "No live ECIS row.",
        "reason": "Early all-injury surveillance is incorporated into the broader S200 ECIS master period.",
    },
    "S110": {
        "topic": "Hip/groin injuries",
        "period": "earlier ECIS hip/groin period",
        "tag": "superseded",
        "handling": "No live ECIS row; use S046 hip/groin rows.",
        "reason": "Earlier hip/groin source is superseded by the longer retained hip/groin paper.",
    },
    "S113": {
        "topic": "Upper extremity injuries",
        "period": "2001-2011",
        "tag": "included here",
        "handling": "Live ECIS row: upper extremity injuries.",
        "reason": "Adds incidence, time-loss, recurrence, and exposure for a location group not isolated in S200.",
    },
    "S175": {
        "topic": "Anterior ankle impingement",
        "period": "overlapping ECIS ankle period",
        "tag": "covered by ankle row / audit-only",
        "handling": "No live ECIS row unless a reviewer requests a diagnosis-level ankle worksheet.",
        "reason": "Specific ankle diagnosis overlaps the retained S107 ankle row and appears more useful for diagnosis detail than for master-level incidence/burden consolidation.",
    },
    "S199": {
        "topic": "Winter break and player availability",
        "period": "overlapping ECIS period",
        "tag": "audit-only availability paper",
        "handling": "No live ECIS row.",
        "reason": "Availability/performance association paper; does not add a clean master injury-count denominator.",
    },
    "S200": {
        "topic": "All injuries, men's ECIS",
        "period": "2001/02-2018/19",
        "tag": "master sheet",
        "handling": "Top live ECIS row and master denominator.",
        "reason": "Only all-injury ECIS men denominator used for the master; shared definitions and cohort context are stored here.",
    },
    "S201": {
        "topic": "General epidemiology of football injuries",
        "period": "earlier/summary source",
        "tag": "already included / superseded",
        "handling": "No live ECIS row.",
        "reason": "General epidemiology source is superseded for master extraction by S200 and retained diagnosis-specific papers.",
    },
    "S202": {
        "topic": "Stress fractures",
        "period": "ECIS-related cohorts",
        "tag": "included here / partial audit-only",
        "handling": "Live ECIS row: stress fractures. Fifth-metatarsal stress-fracture count-only detail is audit-only.",
        "reason": "Overall stress-fracture incidence and recurrence-rate detail are retained; count-only subtype detail is not a separate master row.",
    },
    "S340": {
        "topic": "Head/neck injuries and concussion",
        "period": "2001/02-2009/10",
        "tag": "included here",
        "handling": "Live ECIS rows: head/neck injuries; concussion.",
        "reason": "Adds location/diagnosis-specific incidence, time-loss, and exposure.",
    },
    "S358": {
        "topic": "Lower injury rates / prevention or time-trend analysis",
        "period": "overlapping ECIS period",
        "tag": "audit-only trend paper",
        "handling": "No live ECIS row unless a trend-specific worksheet is created.",
        "reason": "Trend/risk paper overlaps the S200 denominator and is not a separate master population.",
    },
    "S368": {
        "topic": "Isolated syndesmotic ankle injuries",
        "period": "2001-2016",
        "tag": "included here",
        "handling": "Live ECIS row: isolated syndesmotic ankle injuries.",
        "reason": "Adds directly reported incidence, burden, total time-loss, recurrence, and exposure.",
    },
    "S401": {
        "topic": "ACL injuries",
        "period": "2001-2015",
        "tag": "included here",
        "handling": "Live ECIS row: ACL injuries.",
        "reason": "Retained as the strongest ACL-specific ECIS row with direct incidence, recurrence/severity, and exposure.",
    },
    "S415": {
        "topic": "Match congestion and performance/player availability",
        "period": "overlapping ECIS period",
        "tag": "audit-only availability paper",
        "handling": "No live ECIS row.",
        "reason": "Team availability/performance association paper; not a clean additional injury outcome row.",
    },
    "S451": {
        "topic": "Fifth metatarsal fractures",
        "period": "2001-2012",
        "tag": "included here",
        "handling": "Live ECIS row: fifth metatarsal fractures.",
        "reason": "Adds fracture-specific incidence, recurrence/non-contact detail, and exposure; separate from stress-fracture case definition.",
    },
    "S509": {
        "topic": "MCL injuries",
        "period": "overlapping MCL period",
        "tag": "duplicate/superseded",
        "handling": "No additional live row; use retained S106 MCL row.",
        "reason": "Appears to duplicate or overlap the MCL concept already represented by S106.",
    },
    "S513": {
        "topic": "Short turnaround and muscle injury rate",
        "period": "overlapping ECIS period",
        "tag": "audit-only risk factor",
        "handling": "No live ECIS row.",
        "reason": "Fixture-congestion/risk-factor analysis; not a separate master denominator.",
    },
    "S527": {
        "topic": "First match after return to play",
        "period": "overlapping ECIS RTP period",
        "tag": "audit-only prognosis",
        "handling": "No live ECIS row.",
        "reason": "Return-to-play risk/prognosis source rather than a clean incidence/burden extraction row.",
    },
    "S554": {
        "topic": "Regional differences in injury incidence",
        "period": "overlapping ECIS period",
        "tag": "audit-only subgroup paper",
        "handling": "No live ECIS row unless a region-specific subgroup worksheet is created.",
        "reason": "Regional subgroup incidence would split the same ECIS denominator already held by S200.",
    },
    "S576": {
        "topic": "Concussion and subsequent injury risk",
        "period": "overlapping ECIS concussion period",
        "tag": "covered by concussion row / audit-only",
        "handling": "No additional live ECIS row; use S340 for concussion incidence/time-loss.",
        "reason": "Prognosis/risk paper; concussion extraction concept is already represented by S340.",
    },
    "S581": {
        "topic": "Time before return to play for common injuries",
        "period": "2001-2017",
        "tag": "audit-only prognosis",
        "handling": "No live ECIS row.",
        "reason": "Index-injury RTP rows duplicate diagnosis concepts already represented by cleaner incidence/burden source papers.",
    },
}

S200_MASTER_FIELDS = [
    ("Master source", "S200 - Injury rates decreased in men's professional football"),
    ("Role", "Only all-injury ECIS men denominator used in the master extraction"),
    ("Reporting period", "2001/02-2018/19"),
    ("Population", "49 professional elite men's teams; 3302 players"),
    ("Exposure", "1,784,281 player-hours"),
    ("All injuries", "11,820 time-loss injuries"),
    ("Training / match injuries", "5,035 training; 6,785 match"),
    ("Incidence", "6.6 overall; 3.4 training (95% CI 3.3-3.5); 23.8 match (95% CI 23.2-24.4) per 1000 h"),
    ("Structured parent tissue counts", "Muscle injury 4,763; ligament/joint capsule 1,971"),
    ("Definitions stored here", "time-loss injury; incidence per 1000 player-hours; burden as days lost per 1000 player-hours; medical staff reporting"),
]

ECIS_LIVE_ROWS = [
    ("S200", "All injuries anchor", "2001/02-2018/19", "Base denominator plus shared definitions/context"),
    ("S043", "Hamstring injuries", "2001/02-2021/22", "Incidence, time-loss, recurrence, exposure"),
    ("S046", "Hip/groin injuries", "2001/02-2015/16", "Incidence, burden, time-loss, mechanism, recurrence, exposure"),
    ("S046", "Adductor-related hip/groin injuries", "2001/02-2015/16", "Diagnosis-specific incidence/counts"),
    ("S006", "LCL injuries", "2001-2018", "Incidence, burden, time-loss, mechanism, recurrence, exposure"),
    ("S006", "PCL injuries", "2001-2018", "Incidence, burden, time-loss, mechanism, recurrence, exposure"),
    ("S106", "MCL injuries", "2001/02-2011/12", "Incidence, burden, time-loss, mechanism, recurrence, exposure"),
    ("S401", "ACL injuries", "2001-2015", "Incidence, recurrence/severity, exposure"),
    ("S107", "Ankle injuries", "2001/02-2011/12", "Incidence, time-loss, recurrence, exposure"),
    ("S368", "Isolated syndesmotic ankle injuries", "2001-2016", "Incidence, burden, total time-loss, recurrence, exposure"),
    ("S113", "Upper extremity injuries", "2001-2011", "Incidence, time-loss, recurrence, exposure"),
    ("S340", "Head/neck injuries", "2001/02-2009/10", "Incidence, time-loss, exposure"),
    ("S340", "Concussion", "2001/02-2009/10", "Diagnosis-specific incidence/time-loss"),
    ("S202", "Stress fractures", "ECIS-related cohorts", "Incidence and recurrence-rate detail"),
    ("S451", "Fifth metatarsal fractures", "2001-2012", "Incidence, recurrence/non-contact, exposure"),
    ("S091", "Achilles tendinopathy", "2001-2011", "Incidence, burden, time-loss, recurrence, exposure"),
    ("S091", "Achilles tendon rupture", "2001-2011", "Incidence, burden, time-loss, exposure"),
    ("S007", "Indirect thigh muscle injuries", "2001-2013", "Incidence, burden, time-loss, mechanism, exposure"),
    ("S007", "Direct thigh muscle contusions", "2001-2013", "Incidence, burden, time-loss, mechanism, exposure"),
]

ECIS_VISUAL_STATUS = {
    "S200": ("anchor", "S200 - MASTER: ECIS men all-injury denominator"),
    "S006": ("included", "S006 - included as LCL + PCL rows"),
    "S007": ("included", "S007 - included as indirect thigh + direct thigh contusion rows"),
    "S043": ("included", "S043 - included as hamstring row"),
    "S046": ("included", "S046 - included as hip/groin + adductor rows"),
    "S091": ("included", "S091 - included as Achilles tendinopathy + rupture rows"),
    "S106": ("included", "S106 - included as MCL row"),
    "S107": ("included", "S107 - included as ankle row"),
    "S113": ("included", "S113 - included as upper-extremity row"),
    "S202": ("included", "S202 - included as stress-fracture row; count-only subtype audit-only"),
    "S340": ("included", "S340 - included as head/neck + concussion rows"),
    "S368": ("included", "S368 - included as syndesmosis row"),
    "S401": ("included", "S401 - included as ACL row"),
    "S451": ("included", "S451 - included as fifth-metatarsal fracture row"),
    "S002": ("covered", "S002 - not included; ACL superseded by S401"),
    "S011": ("covered", "S011 - not included; common-injury overlap covered by S200 + retained concept rows"),
    "S042": ("covered", "S042 - not included; hamstring superseded by S043"),
    "S108": ("covered", "S108 - not included; early all-injury data already captured in S200"),
    "S110": ("covered", "S110 - not included; hip/groin superseded by S046"),
    "S175": ("covered", "S175 - not included; ankle diagnosis detail covered by S107 unless specialist worksheet needed"),
    "S201": ("covered", "S201 - not included; broad summary superseded by S200"),
    "S509": ("covered", "S509 - not included; MCL concept covered by S106"),
    "S576": ("covered", "S576 - not included; concussion concept covered by S340"),
    "S581": ("covered", "S581 - not included; RTP prognosis overlaps retained concept rows"),
    "S019": ("audit", "S019 - audit-only; risk/prevention association"),
    "S056": ("audit", "S056 - audit-only; COVID special period, illness data incomplete"),
    "S057": ("audit", "S057 - audit-only; performance association"),
    "S079": ("audit", "S079 - audit-only; workload risk factor subset"),
    "S084": ("audit", "S084 - audit-only; fixture congestion risk factor"),
    "S199": ("audit", "S199 - audit-only; winter-break availability paper"),
    "S358": ("audit", "S358 - audit-only; trend/risk paper"),
    "S415": ("audit", "S415 - audit-only; availability/performance paper"),
    "S513": ("audit", "S513 - audit-only; short-turnaround risk factor"),
    "S527": ("audit", "S527 - audit-only; return-to-play risk paper"),
    "S554": ("audit", "S554 - audit-only; regional subgroup paper"),
}

OTHER_VISUAL_STATUS = {
    "S112": "S112 - separate WECIS women master, not part of S200 ECIS men",
    "S068": "S068 - own workspace; South America vs ECIS comparator",
    "S109": "S109 - own workspace; UEFA tournament audit",
    "S111": "S111 - own workspace; UEFA-method paper, non-ECIS/WECIS",
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
        ledger = ECIS_SOURCE_LEDGER["S200"]
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "ECIS men",
            ledger["tag"],
            ledger["handling"],
            ledger["reason"],
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
    if sid in ECIS_SOURCE_LEDGER:
        ledger = ECIS_SOURCE_LEDGER[sid]
        return SourcePaper(
            sid,
            title,
            status,
            year,
            lead,
            doi,
            "ECIS men",
            ledger["tag"],
            ledger["handling"],
            ledger["reason"],
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
        "tiny": ParagraphStyle(
            "Tiny",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=6.4,
            leading=7.5,
        ),
        "visual_header": ParagraphStyle(
            "VisualHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_LEFT,
        ),
        "visual_anchor": ParagraphStyle(
            "VisualAnchor",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.white,
            alignment=TA_LEFT,
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
            para("Notes", header_style),
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
                para(row.notes, style),
                para(row.title, style),
            ]
        )
    table = Table(
        data,
        colWidths=[15 * mm, 12 * mm, 17 * mm, 32 * mm, 24 * mm, 45 * mm, 55 * mm, 67 * mm],
        repeatRows=1,
    )
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


def simple_table(headers: list[str], rows: list[list[Any]], widths_mm: list[int], style: ParagraphStyle, header_style: ParagraphStyle) -> Table:
    data = [[para(header, header_style) for header in headers]]
    for row in rows:
        data.append([para(cell, style) for cell in row])
    table = Table(data, colWidths=[width * mm for width in widths_mm], repeatRows=1)
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


def lane_table(title: str, rows: list[str], width_mm: int, header_color: str, row_color: str, s: dict[str, ParagraphStyle]) -> Table:
    data = [[para(title, s["visual_header"])]]
    for row in rows:
        data.append([para(row, s["tiny"])])
    table = Table(data, colWidths=[width_mm * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor(row_color)),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(header_color)),
                ("INNERGRID", (0, 1), (-1, -1), 0.25, colors.HexColor("#d6dde6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def ecis_visual_map(ecis_rows: list[SourcePaper], other_rows: list[SourcePaper], s: dict[str, ParagraphStyle]) -> list[Any]:
    included: list[str] = []
    covered: list[str] = []
    audit: list[str] = []
    known_ecis_ids = set()

    for row in ecis_rows:
        known_ecis_ids.add(row.study_id)
        bucket, text = ECIS_VISUAL_STATUS.get(
            row.study_id,
            ("audit", f"{row.study_id} - audit-only until ECIS/WECIS membership and non-duplicative value confirmed"),
        )
        if bucket == "anchor":
            continue
        if bucket == "included":
            included.append(text)
        elif bucket == "covered":
            covered.append(text)
        else:
            audit.append(text)

    for sid, (bucket, text) in ECIS_VISUAL_STATUS.items():
        if sid in known_ecis_ids or bucket == "anchor":
            continue
        if bucket == "included":
            included.append(text)
        elif bucket == "covered":
            covered.append(text)
        else:
            audit.append(text)

    for row in other_rows:
        audit.append(OTHER_VISUAL_STATUS.get(row.study_id, f"{row.study_id} - separate workspace or non-ECIS/WECIS triage"))

    anchor = Table(
        [[para("S200 ECIS MEN MASTER ANCHOR - all-injury denominator, 2001/02-2018/19, 11,820 injuries, 1,784,281 player-hours", s["visual_anchor"])]],
        colWidths=[260 * mm],
    )
    anchor.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0b2545")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#0b2545")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    lanes = Table(
        [
            [
                lane_table("Included in ECIS master extraction", included, 86, "#1f7a4d", "#eef8f2", s),
                lane_table("Not included: data already captured or superseded", covered, 86, "#9a5b00", "#fff7e8", s),
                lane_table("Not included in S200 master: audit-only or separate workspace", audit, 86, "#5b6472", "#f4f6f8", s),
            ]
        ],
        colWidths=[86 * mm, 86 * mm, 86 * mm],
    )
    lanes.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    return [
        para("Sparse Visual Source Map", s["h1"]),
        para("Read this page first: S200 is the master denominator. Papers below either enrich S200 with retained concept rows, are already covered by a stronger retained source, or stay outside the S200 men master.", s["body"]),
        Spacer(1, 4),
        anchor,
        Spacer(1, 5),
        lanes,
    ]


def ledger_rows(rows: list[SourcePaper]) -> list[list[str]]:
    output = []
    for row in rows:
        ledger = ECIS_SOURCE_LEDGER.get(row.study_id, {})
        output.append(
            [
                row.study_id,
                row.year,
                ledger.get("tag", row.role),
                ledger.get("topic", ""),
                ledger.get("period", ""),
                ledger.get("handling", row.decision),
                ledger.get("reason", row.notes),
            ]
        )
    return output


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
                "For the ECIS men master, use concept rows only when a supplement adds useful incidence, burden, time-loss, recurrence, mechanism, or exposure detail beyond the S200 all-injury anchor.",
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
                "Topic-specific count-only subtype rows are audit-only unless they are needed for a reviewer-requested diagnosis worksheet.",
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


def build_ecis_master_pdf(path: Path, ecis_rows: list[SourcePaper], other_rows: list[SourcePaper]) -> None:
    s = styles()
    story: list[Any] = [para("UEFA ECIS Men Master Extraction", s["title"])]
    story.append(para(f"Prepared: {TODAY}", s["body"]))
    story.append(Spacer(1, 5))

    story.append(para("S200 Master Sheet", s["h1"]))
    story.extend(
        bullets(
            [
                "This is the only all-injury ECIS men denominator used in the master extraction.",
                "Overlapping all-injury, trend, risk-factor, availability, or prognosis papers do not create extra master rows.",
                "Supplement papers are retained only when they add useful diagnosis/location-specific incidence, burden, time-loss, recurrence, mechanism, or exposure values.",
            ],
            s["body"],
        )
    )
    story.append(
        simple_table(
            ["Field", "S200 value / master decision"],
            [[field, value] for field, value in S200_MASTER_FIELDS],
            [55, 205],
            s["small"],
            s["table_header"],
        )
    )

    story.append(PageBreak())
    story.extend(ecis_visual_map(ecis_rows, other_rows, s))

    story.append(PageBreak())
    append_methodology_sections(story, s)

    story.append(PageBreak())
    story.append(para("Live ECIS Master Rows", s["h1"]))
    story.append(
        simple_table(
            ["Source", "Live row", "Reporting period", "Information retained"],
            ECIS_LIVE_ROWS,
            [18, 58, 38, 146],
            s["small"],
            s["table_header"],
        )
    )

    included = [
        row
        for row in ecis_rows
        if ECIS_SOURCE_LEDGER.get(row.study_id, {}).get("tag") in {"master sheet", "included here", "included here / partial audit-only"}
    ]
    not_live = [row for row in ecis_rows if row not in included]

    story.append(PageBreak())
    story.append(para("Included Source Decisions", s["h1"]))
    story.append(
        simple_table(
            ["Study", "Year", "Tag", "Topic", "Period", "How included", "Reason"],
            ledger_rows(included),
            [13, 11, 31, 36, 28, 66, 75],
            s["small"],
            s["table_header"],
        )
    )

    story.append(PageBreak())
    story.append(para("Already Included, Superseded, Or Audit-Only", s["h1"]))
    story.extend(
        bullets(
            [
                "Already included means the S200 master row already captures the relevant all-injury denominator or broad ECIS programme information.",
                "Superseded means a stronger or longer ECIS source is the retained live row for the same concept.",
                "Audit-only means the paper may be useful for interpretation, risk/prognosis, subgroup, trend, or future specialist worksheets but should not add rows to this master.",
            ],
            s["body"],
        )
    )
    story.append(
        simple_table(
            ["Study", "Year", "Tag", "Topic", "Period", "Handling", "Reason"],
            ledger_rows(not_live),
            [13, 11, 31, 36, 28, 66, 75],
            s["small"],
            s["table_header"],
        )
    )

    if other_rows:
        story.append(PageBreak())
        story.append(para("Not Part Of ECIS Men Master", s["h1"]))
        story.extend(
            bullets(
                [
                    "These records are UEFA-related but should not be merged into the ECIS men master.",
                    "If eligible, they stay in their own workspace or in the WECIS master, not inside the S200 men master.",
                ],
                s["body"],
            )
        )
        story.append(source_table(other_rows, s["small"], s["table_header"]))

    story.append(PageBreak())
    story.append(para("Reviewer Checklist", s["h1"]))
    story.extend(
        bullets(
            [
                "Confirm S200 remains the only all-injury ECIS men denominator.",
                "Confirm every retained supplement row has a useful metric beyond count-only overlap.",
                "Confirm every non-retained paper has a visible tag: already included, superseded, audit-only, or separate workspace/WECIS.",
                "Confirm no ordinary UEFA source paper is exported analytically alongside the master in a way that double counts ECIS data.",
            ],
            s["body"],
        )
    )
    build_doc(path, "UEFA ECIS Men Master Extraction", story)


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


def append_methodology_sections(story: list[Any], s: dict[str, ParagraphStyle]) -> None:
    story.append(para("Methodological Justification", s["title"]))
    story.append(para(f"Prepared: {TODAY}", s["body"]))
    story.append(Spacer(1, 5))

    story.append(para("Purpose", s["h1"]))
    story.extend(
        bullets(
            [
                "Provide a peer-review-facing rationale for how the UEFA Elite Club Injury Study family was consolidated without duplicate counting.",
                "Explain why the men ECIS and women WECIS records are treated as separate master records.",
                "Document why retained supplement rows are field-level enrichments rather than independent all-injury cohorts.",
                "Document why illness fields remain blank unless a paper reports extractable illness outcomes.",
            ],
            s["body"],
        )
    )

    story.append(para("Primary Methodological Principle", s["h1"]))
    story.extend(
        bullets(
            [
                "The extraction unit is the surveillance programme-period and directly reported subgroup/concept, not the publication.",
                "An overlapping paper cannot contribute a second all-injury denominator for the same ECIS or WECIS surveillance population.",
                "A topic-specific paper can contribute values only for fields that are not already represented by the anchor source and are directly compatible with the live schema.",
                "This preserves the broad programme denominator while still capturing clinically useful incidence, burden, severity, recurrence, mechanism, and exposure details from companion papers.",
            ],
            s["body"],
        )
    )

    story.append(para("Anchor Selection", s["h1"]))
    story.append(
        simple_table(
            ["Master", "Anchor", "Reason"],
            [
                [
                    "Men ECIS",
                    "S200",
                    "Longest and most recent broad all-injury ECIS men denominator in the audited set; used for shared context, definitions, exposure, all-injury counts, and overall incidence.",
                ],
                [
                    "Women WECIS",
                    "S112",
                    "Only audited WECIS women all-injury programme paper; kept separate because sex, programme, teams, period, and denominator differ from men ECIS.",
                ],
            ],
            [32, 25, 203],
            s["small"],
            s["table_header"],
        )
    )

    story.append(para("Why S200 Is An Anchor, Not A Complete Pattern Table", s["h1"]))
    story.extend(
        bullets(
            [
                "S200 is the best ECIS men all-injury denominator anchor, but it does not provide every location and type detail needed for the structured tabs.",
                "Older broad papers such as early Champions League or 11-year summaries are not imported as ordinary all-injury rows because their periods overlap S200 and their rates would represent shorter historical denominators.",
                "Those older papers remain available as audit-only historical benchmarks, but they should not be mixed into the main analysis CSV unless a separate historical worksheet is intentionally created.",
                "The cleaner approach is to keep S200 as the denominator anchor and add retained concept rows from the best companion papers where they report direct additional metrics.",
            ],
            s["body"],
        )
    )

    story.append(PageBreak())
    story.append(para("Supplement Inclusion Rule", s["h1"]))
    story.extend(
        bullets(
            [
                "Retain a supplement row only when it adds direct incidence, burden, time-loss, mean or total severity days, recurrence, mechanism, or exposure detail beyond the anchor.",
                "Do not retain count-only subtype rows if the value only subdivides an already retained injury concept without adding analytical metrics.",
                "Do not back-calculate counts from rates, exposure from counts/rates, or days lost from burden.",
                "Transparent aggregation is allowed only for directly reported compatible subrows sharing the same denominator and mapping cleanly to a schema parent category.",
            ],
            s["body"],
        )
    )

    story.append(para("Structured Location And Type Tabs", s["h1"]))
    story.extend(
        bullets(
            [
                "The final structured-tab pass treated injuryTissueType and injuryLocation as metric sweeps, not count-only tabs.",
                "Where a retained concept row directly reports a compatible count plus overall incidence, burden, mean days, or total days for that same concept, the numeric metric was mirrored into the matching structured row.",
                "Additional direct structured detail was added from retained ankle and head/neck papers, including ankle pathology incidence/burden/severity and head/neck/concussion/fracture/laceration severity metrics.",
                "Numeric cells contain numbers only. Confidence intervals, IQRs, caveats, and source logic are kept in outcome fields, source quotes, PDF/audit notes, or backlog text rather than inside numeric boxes.",
            ],
            s["body"],
        )
    )

    story.append(para("Illness Decision", s["h1"]))
    story.extend(
        bullets(
            [
                "The ECIS and WECIS anchor papers focus on injuries; illness is mentioned mainly for availability, attendance, COVID context, or surveillance-method references.",
                "The COVID restart ECIS paper was checked specifically; it states that COVID illness data were incomplete because there was no accompanying illness card.",
                "The head/neck ECIS paper explicitly reports that no illnesses were recorded.",
                "The non-ECIS UEFA-model NWPL paper mentions an illness card but does not provide extractable illness count, incidence, burden, region, etiology, or severity tables in the reviewed text.",
                "Therefore illness tabs remain blank in the ECIS/WECIS masters unless a future source reports direct illness outcomes with a compatible denominator.",
            ],
            s["body"],
        )
    )

    story.append(PageBreak())
    story.append(para("CSV And Analysis Implications", s["h1"]))
    story.extend(
        bullets(
            [
                "Use the master records for ECIS/WECIS analytical export, not the ordinary overlapping UEFA source records as separate all-injury records.",
                "Keep retained supplement rows identifiable by sex/scope labels such as male - hamstring-specific study or male - ACL-specific study.",
                "When comparing with CSV exports, filter or flag source-role values so anchor rows, retained concept rows, audit-only sources, and separate-workspace UEFA-related records are not pooled incorrectly.",
                "If a future analysis needs historical broad location/type distributions, create a separate historical benchmark worksheet instead of merging those values into the S200 master denominator.",
            ],
            s["body"],
        )
    )

    story.append(para("Residual Limitations", s["h1"]))
    story.extend(
        bullets(
            [
                "The approach prioritizes avoiding duplicate denominators over maximizing the number of filled cells.",
                "Some older broad location/type tables are intentionally absent from the live master because they would represent shorter or different denominator frames.",
                "Some parent structured fields remain blank when papers report subrows that do not cover the full parent category or when burden is a median/IQR summary rather than an additive raw component.",
                "These blanks are methodological safeguards, not missed extraction opportunities.",
            ],
            s["body"],
        )
    )


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    standalone_methodology_pdf = OUT_DIR / "UEFA_Master_Methodological_Justification.pdf"
    standalone_methodology_pdf.unlink(missing_ok=True)

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
        "methodological_justification_location": "Embedded in output/pdf/UEFA_ECIS_Men_Master_Extraction.pdf",
        "methodological_principles": {
            "unit_of_extraction": "surveillance programme-period and directly reported subgroup/concept, not publication count",
            "anchor_rule": "one all-injury denominator per overlapping ECIS/WECIS programme frame",
            "supplement_rule": "retain only direct compatible field-level metrics beyond the anchor",
            "illness_rule": "leave illness tabs blank unless direct illness outcomes are reported with a compatible denominator",
        },
        "ecis_sparse_visual_map": ECIS_VISUAL_STATUS,
        "separate_workspace_visual_map": OTHER_VISUAL_STATUS,
        "s200_master_sheet": dict(S200_MASTER_FIELDS),
        "ecis_live_rows": [
            {"source": source, "row": row, "reporting_period": period, "retained_information": retained}
            for source, row, period, retained in ECIS_LIVE_ROWS
        ],
        "ecis_source_ledger": ECIS_SOURCE_LEDGER,
        "sources": [row.__dict__ for row in papers],
    }
    audit_path = AUDIT_DIR / "uefa-master-source-audit.json"
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")

    build_ecis_master_pdf(OUT_DIR / "UEFA_ECIS_Men_Master_Extraction.pdf", ecis, wecis + triage)
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
