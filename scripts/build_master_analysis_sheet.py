#!/usr/bin/env python3
"""
Rebuild the project's master analysis sheet with standardized Tab 1, Tab 2, and approved Tab 3 columns.

Why this script exists
----------------------
- The project uses one cumulative master analysis sheet rather than separate final tab files.
- Raw extracted values must remain intact while standardized analysis columns sit beside them.
- Review/audit metadata must stay outside the analysis sheet so the CSV and workbook remain clean.
- The workbook needs two use cases:
  1. `master_analysis` for review with red/green standardized text.
  2. `clean_analysis_build` as the plain-black build-on sheet for later tabs.

Methodological guardrails
-------------------------
- No row collapsing is performed.
- No raw extracted cell is overwritten.
- Tab 1 standardized values are preserved from the prior approved pass.
- Tab 2 standardization follows the approved counting rules:
  - named multi-country cohorts retain named countries separated by `; `
  - `multinational` is used only when countries are not named
  - `male; female` is used for mixed-sex cohorts so both sexes can be counted separately
- Tab 3 standardization maps injury-definition and reporter wording into approved analysis
  families while preserving the raw extracted values separately.
- For the analysis-ready master sheet, standardized paper-level fields are filled down across all
  rows of a paper when the paper has one shared standardized value for that field.
- Row-specific subgroup values are preserved when more than one distinct standardized value is
  present within the same paper.
"""

from __future__ import annotations

import csv
import re
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import xlsxwriter


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_CLEANING_DIR = REPO_ROOT / "Data Analysis" / "Data Cleaning"
DICT_DIR = DATA_CLEANING_DIR / "dictionaries"
OUTPUT_DIR = DATA_CLEANING_DIR / "outputs" / "master"
TAB1_AUDIT_DIR = DATA_CLEANING_DIR / "audit" / "tab1"
TAB2_AUDIT_DIR = DATA_CLEANING_DIR / "audit" / "tab2"
TAB3_AUDIT_DIR = DATA_CLEANING_DIR / "audit" / "tab3"

INPUT_MASTER_CSV = OUTPUT_DIR / "master-analysis-sheet.csv"
OUTPUT_MASTER_CSV = OUTPUT_DIR / "master-analysis-sheet.csv"
OUTPUT_MASTER_XLSX = OUTPUT_DIR / "master-analysis-sheet.xlsx"
TAB2_AUDIT_CSV = TAB2_AUDIT_DIR / "tab2-standardization-audit-log.csv"
TAB3_AUDIT_CSV = TAB3_AUDIT_DIR / "tab3-standardization-audit-log.csv"

TAB1_RAW_TO_STD = OrderedDict(
    [
        ("leadAuthor", "leadAuthor_standardized"),
        ("title", "title_standardized"),
        ("yearOfPublication", "yearOfPublication_standardized"),
        ("journal", "journal_standardized"),
        ("doi", "doi_standardized"),
        ("studyDesign", "studyDesign_standardized"),
    ]
)

TAB2_RAW_TO_STD = OrderedDict(
    [
        ("fifaDiscipline", "fifaDiscipline_standardized"),
        ("country", "country_standardized"),
        ("levelOfPlay", "levelOfPlay_standardized"),
        ("sex", "sex_standardized"),
        ("ageCategory", "ageCategory_standardized"),
    ]
)

TAB3_RAW_TO_STD = OrderedDict(
    [
        ("injuryDefinition", "injuryDefinition_standardized"),
        ("mechanismReporting", "mechanismReporting_standardized"),
    ]
)

ALL_STD_PAIRS = OrderedDict()
ALL_STD_PAIRS.update(TAB1_RAW_TO_STD)
ALL_STD_PAIRS.update(TAB2_RAW_TO_STD)
ALL_STD_PAIRS.update(TAB3_RAW_TO_STD)

TAB1_STANDARDIZED_FIELDS = list(TAB1_RAW_TO_STD.values())
TAB2_STANDARDIZED_FIELDS = list(TAB2_RAW_TO_STD.values())
TAB3_STANDARDIZED_FIELDS = list(TAB3_RAW_TO_STD.values())


def clean_header(value: str) -> str:
    cleaned = value.lstrip("\ufeff").strip()
    while cleaned.startswith('"') and cleaned.endswith('"') and len(cleaned) >= 2:
        cleaned = cleaned[1:-1].strip()
    cleaned = cleaned.replace('""', '"')
    return cleaned


def load_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        raw_fieldnames = list(reader.fieldnames or [])
        fieldnames = [clean_header(name) for name in raw_fieldnames]
        rows = []
        for raw_row in reader:
            row = {}
            for raw_key, value in raw_row.items():
                row[clean_header(raw_key)] = value or ""
            rows.append(row)
    return fieldnames, rows


def load_dictionary(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            raw_value = (row.get("raw_value") or "").strip()
            if raw_value:
                rows[raw_value] = row
    return rows


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def append_audit_event(
    audit_rows: list[dict[str, str]],
    *,
    source_file: str,
    output_file: str,
    study_id: str,
    field_name: str,
    raw_value: str,
    canonical_value: str,
    rule_id: str,
    rationale: str,
) -> None:
    if not canonical_value:
        return
    if canonical_value == raw_value:
        return
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


def derive_color(raw_value: str, canonical_value: str) -> str:
    if not canonical_value:
        return ""
    return "green" if canonical_value == raw_value else "red"


def coerce_excel_value(field: str, value: str) -> tuple[object, str | None]:
    if field == "yearOfPublication_standardized":
        stripped = (value or "").strip()
        if re.fullmatch(r"(19|20)\d{2}", stripped):
            return int(stripped), "integer"
    return value, None


COUNTRY_ALIASES = {
    "argentina": "Argentina",
    "australia": "Australia",
    "austria": "Austria",
    "belgium": "Belgium",
    "brazil": "Brazil",
    "canada": "Canada",
    "chile": "Chile",
    "croatia": "Croatia",
    "czech republic": "Czech Republic",
    "denmark": "Denmark",
    "england": "England",
    "finland": "Finland",
    "france": "France",
    "germany": "Germany",
    "ghana": "Ghana",
    "greece": "Greece",
    "hong kong": "Hong Kong",
    "iceland": "Iceland",
    "iran": "Iran",
    "ireland": "Ireland",
    "israel": "Israel",
    "italy": "Italy",
    "japan": "Japan",
    "kosovo": "Kosovo",
    "korea": "South Korea",
    "lebanon": "Lebanon",
    "lithuania": "Lithuania",
    "malaysia": "Malaysia",
    "mauritius": "Mauritius",
    "netherlands": "Netherlands",
    "new zealand": "New Zealand",
    "nigeria": "Nigeria",
    "northern ireland": "Northern Ireland",
    "norway": "Norway",
    "poland": "Poland",
    "portugal": "Portugal",
    "qatar": "Qatar",
    "rwanda": "Rwanda",
    "saudi arabia": "Saudi Arabia",
    "scotland": "Scotland",
    "serbia": "Serbia",
    "south africa": "South Africa",
    "south korea": "South Korea",
    "spain": "Spain",
    "sweden": "Sweden",
    "switzerland": "Switzerland",
    "the netherlands": "Netherlands",
    "trinidad and tobago": "Trinidad and Tobago",
    "turkey": "Turkey",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "united states": "United States",
    "usa": "United States",
    "yeman": "Yemen",
    "yemen": "Yemen",
    "uruguay": "Uruguay",
}


def canonicalize_fifa_discipline(raw_value: str, discipline_dict: dict[str, dict[str, str]]) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if not raw:
        return "", "", ""
    if raw in discipline_dict:
        row = discipline_dict[raw]
        return row["canonical_value"], row["rule_id"], row["rationale"]

    lower = raw.lower()
    if "futsal" in lower or "indoor soccer" in lower or "5-a-side" in lower:
        return "Futsal", "T2-DISC-999", "Mapped small-sided indoor football wording to futsal."
    if "beach" in lower:
        return "Beach soccer", "T2-DISC-999", "Mapped beach-football wording to beach soccer."
    if "para" in lower or "amputee" in lower:
        return "Para football", "T2-DISC-999", "Mapped disability-football wording to para football."
    if "football" in lower or "soccer" in lower:
        return (
            "Association football (11-a-side)",
            "T2-DISC-999",
            "Mapped football/soccer wording to the project's main association-football category.",
        )
    return "Other/unclear", "T2-DISC-998", "Could not confidently place the discipline beyond other/unclear."


def split_named_countries(raw: str) -> list[str]:
    protected = raw
    protected = re.sub(r"(?i)trinidad and tobago", "Trinidad__AND__Tobago", protected)
    protected = protected.replace("South Korea/Japan", "South Korea; Japan")
    protected = protected.replace("France/Germany", "France; Germany")
    protected = protected.replace("Czech Republic / Switzerland", "Czech Republic; Switzerland")
    protected = protected.replace("England / Spain / Uruguay / Brazil", "England; Spain; Uruguay; Brazil")
    protected = protected.replace("South Korea/Japan; Germany; South Africa", "South Korea; Japan; Germany; South Africa")
    protected = re.sub(r"\(([^)]*)\)", "", protected)
    protected = protected.replace("/", ";")
    protected = re.sub(r"\band\b", ";", protected, flags=re.IGNORECASE)
    protected = re.sub(r",", ";", protected)
    parts = [part.strip().replace("Trinidad__AND__Tobago", "Trinidad and Tobago") for part in protected.split(";")]
    return [part for part in parts if part]


def canonicalize_country(raw_value: str) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if not raw:
        return "", "", ""

    lower = raw.lower()
    lower = lower.replace("alsace region", "").strip()

    if lower in {"international", "worldwide", "multiple countries", "multiple host countries", "multinational"}:
        return "multinational", "T2-COUNTRY-001", "Used multinational because the cohort was international but unnamed."
    if "europe" in lower and not any(name in lower for name in COUNTRY_ALIASES):
        return "Europe", "T2-COUNTRY-002", "Used Europe because the cohort was an unnamed European multi-country sample."
    if re.search(r"\b\d+\s+european countries\b", lower) or "europe (" in lower or "nine european countries" in lower:
        return "Europe", "T2-COUNTRY-002", "Used Europe because the cohort was an unnamed European multi-country sample."
    if "12 nations" in lower or "19 european countries" in lower or "20 european countries" in lower or "16 european countries" in lower:
        return "Europe", "T2-COUNTRY-002", "Used Europe because the cohort was an unnamed European multi-country sample."
    if lower in {"london", "uk"}:
        return "United Kingdom", "T2-COUNTRY-003", "Normalized UK-local wording to United Kingdom."
    if lower in {"america"}:
        return "United States", "T2-COUNTRY-004", "Normalized America to United States for this dataset context."
    if "michigan" in lower and "united states" in lower:
        return "United States", "T2-COUNTRY-005", "Collapsed state-specific wording to United States."
    if lower in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[lower], "T2-COUNTRY-006", "Normalized country alias to canonical country label."

    tokens = split_named_countries(raw)
    canonical_tokens: list[str] = []
    for token in tokens:
        normalized = normalize_whitespace(token).lower()
        if not normalized:
            continue
        if normalized in COUNTRY_ALIASES:
            canonical_tokens.append(COUNTRY_ALIASES[normalized])
        elif normalized == "europe":
            canonical_tokens.append("Europe")
        elif normalized == "international":
            canonical_tokens.append("multinational")

    if canonical_tokens:
        deduped = list(OrderedDict.fromkeys(canonical_tokens))
        if len(deduped) == 1:
            return deduped[0], "T2-COUNTRY-007", "Canonicalized a single named country."
        if any(item in {"Europe", "multinational"} for item in deduped) and len(deduped) == 1:
            return deduped[0], "T2-COUNTRY-008", "Retained the broad geographic label because countries were not named."
        return "; ".join(deduped), "T2-COUNTRY-009", "Preserved named multi-country cohorts as split-countable country values."

    return raw, "T2-COUNTRY-010", "Retained raw country wording because no safer canonical transformation was available."


def canonicalize_sex(raw_value: str, sex_dict: dict[str, dict[str, str]]) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if not raw:
        return "", "", ""
    if raw in sex_dict:
        row = sex_dict[raw]
        return row["canonical_value"], row["rule_id"], row["rationale"]

    lines = [normalize_whitespace(part).lower() for part in re.split(r"[\n;]+", raw) if normalize_whitespace(part)]
    male_markers = ("male", "men", "boys")
    female_markers = ("female", "women", "girls")
    has_male = any(any(marker in line for marker in male_markers) for line in lines)
    has_female = any(any(marker in line for marker in female_markers) for line in lines)

    if raw.lower() == "mixed":
        return "male; female", "T2-SEX-999", "Converted mixed-sex wording to split-countable male and female."
    if has_male and has_female:
        return "male; female", "T2-SEX-998", "Converted both-sex wording to split-countable male and female."
    if has_male:
        return "male", "T2-SEX-997", "Collapsed subgroup-specific male wording to male."
    if has_female:
        return "female", "T2-SEX-996", "Collapsed subgroup-specific female wording to female."
    return "unclear", "T2-SEX-995", "Sex was not clearly identifiable from the raw extraction value."


def canonicalize_level_of_play(raw_value: str, play_dict: dict[str, dict[str, str]]) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if not raw:
        return "", "", ""
    if raw in play_dict:
        row = play_dict[raw]
        return row["canonical_value"], row["rule_id"], row["rationale"]

    lower = raw.lower()

    if any(marker in lower for marker in ["colleg", "ncaa", "college"]):
        return "collegiate", "T2-PLAY-999", "Collapsed collegiate wording to the collegiate analysis category."
    if "high school" in lower or "middle school" in lower or "varsity" in lower:
        return "high school", "T2-PLAY-998", "Collapsed school-level wording to the high-school analysis category."
    if "national team" in lower or "olympic" in lower or "paralympic" in lower or "international championship" in lower:
        return "national/international", "T2-PLAY-997", "Collapsed international competition wording to the national/international category."
    if "semi-professional" in lower:
        return "semi-professional", "T2-PLAY-996", "Retained semi-professional as its own analysis category."
    if any(marker in lower for marker in ["academy", "elite youth", "professional academy"]):
        return "elite youth", "T2-PLAY-995", "Collapsed academy pathway wording to elite youth."
    if "youth" in lower or "junior" in lower:
        return "youth", "T2-PLAY-994", "Collapsed youth-specific wording to the youth analysis category."
    if any(marker in lower for marker in ["all levels", "mixed", "professional and", "amateur and", "first and lower league"]):
        return "mixed", "T2-PLAY-993", "Retained mixed playing-level wording as mixed."
    if any(marker in lower for marker in ["amateur", "community", "recreational", "local team", "low-skilled", "high-skilled", "veteran"]):
        return "amateur", "T2-PLAY-992", "Collapsed amateur/community wording to amateur."
    if any(marker in lower for marker in ["professional", "premier league", "first division", "second division"]):
        return "professional", "T2-PLAY-991", "Collapsed professional-league wording to professional."
    if any(marker in lower for marker in ["elite", "top-level", "high-level"]):
        return "elite", "T2-PLAY-990", "Collapsed elite/top-level wording to elite."
    return "other/unclear", "T2-PLAY-989", "Could not confidently place the playing level beyond other/unclear."


def parse_age_numeric_signal(raw_value: str) -> tuple[str, str, str] | None:
    lower = normalize_whitespace(raw_value).lower()
    if not lower:
        return None

    if any(marker in lower for marker in ["u-", "u ", "under ", "under-", "u13", "u14", "u15", "u16", "u17", "u18", "u19", "u20", "u21", "u23"]):
        return "youth", "T2-AGE-996", "Collapsed under-age shorthand to the youth age category."

    range_match = re.search(r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)", lower)
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(2))
        if high < 18:
            return "youth", "T2-AGE-995", "Collapsed an age range fully below 18 to the youth age category."
        if low >= 18:
            return "adult", "T2-AGE-994", "Collapsed an age range entirely on the adult side of 18 to the adult age category."
        return "mixed_age", "T2-AGE-993", "Collapsed an age range spanning both sides of 18 to mixed_age."

    single_match = re.fullmatch(r"\d+(?:\.\d+)?", lower)
    if single_match:
        value = float(single_match.group(0))
        if value < 18:
            return "youth", "T2-AGE-992", "Collapsed a numeric age value below 18 to the youth age category."
        return "adult", "T2-AGE-991", "Collapsed a numeric age value on the adult side of 18 to the adult age category."

    return None


def parse_mean_age_signal(mean_age_raw: str) -> tuple[str, str, str] | None:
    lower = normalize_whitespace(mean_age_raw).lower()
    if not lower:
        return None

    classifications: list[str] = []
    for part in [segment.strip() for segment in re.split(r"[;\n]+", lower) if segment.strip()]:
        range_match = re.search(r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)", part)
        if range_match:
            low = float(range_match.group(1))
            high = float(range_match.group(2))
            if high < 18:
                classifications.append("youth")
            elif low >= 18:
                classifications.append("adult")
            else:
                classifications.append("mixed_age")
            continue

        number_match = re.search(r"(\d+(?:\.\d+)?)", part)
        if not number_match:
            continue
        value = float(number_match.group(1))
        classifications.append("youth" if value < 18 else "adult")

    if not classifications:
        return None

    unique = list(OrderedDict.fromkeys(classifications))
    if len(unique) == 1:
        label = unique[0]
        if label == "youth":
            return "youth", "T2-AGE-990", "Used a conservative mean-age signal fully below 18 to classify the cohort as youth."
        if label == "adult":
            return "adult", "T2-AGE-989", "Used a conservative mean-age signal on the adult side of 18 to classify the cohort as adult."
        return "mixed_age", "T2-AGE-988", "Used age expressions spanning youth and adult values to classify the cohort as mixed_age."

    if all(label in {"adult", "mixed_age"} for label in unique) or all(label in {"youth", "mixed_age"} for label in unique):
        return "mixed_age", "T2-AGE-987", "Used age expressions spanning youth and adult values to classify the cohort as mixed_age."

    return None


def canonicalize_age_category(
    raw_value: str,
    age_dict: dict[str, dict[str, str]],
    *,
    mean_age: str = "",
    level_of_play: str = "",
    paper_title: str = "",
) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if raw and raw in age_dict:
        row = age_dict[raw]
        return row["canonical_value"], row["rule_id"], row["rationale"]

    lower = raw.lower()
    if raw:
        if any(marker in lower for marker in ["high school and college", "adolescent and adult", "senior and youth", "adult and youth"]):
            return "mixed_age", "T2-AGE-986", "Collapsed explicit mixed youth/adult wording to mixed_age."
        if any(marker in lower for marker in ["high school", "middle school", "schoolboy", "schoolgirl", "adolescent", "youth", "junior", "academy"]):
            return "youth", "T2-AGE-985", "Collapsed school/youth wording to the youth age category."
        if any(marker in lower for marker in ["college", "collegiate", "ncaa", "university"]):
            return "adult", "T2-AGE-984", "Collapsed collegiate wording to the adult age category for analysis."
        if any(marker in lower for marker in ["senior", "adult", "professional", "elite"]):
            return "adult", "T2-AGE-983", "Collapsed adult/senior wording to the adult age category."
        numeric_signal = parse_age_numeric_signal(raw)
        if numeric_signal:
            return numeric_signal

    title_lower = normalize_whitespace(paper_title).lower()
    if title_lower:
        if any(marker in title_lower for marker in ["high school", "schoolboy", "schoolgirl", "adolescent", "children", "child", "youth", "junior", "academy"]) or re.search(r"\bu[- ]?\d{1,2}\b", title_lower):
            return "youth", "T2-AGE-982", "Used explicit youth wording in the paper title to classify the cohort as youth."
        if any(marker in title_lower for marker in ["college", "collegiate", "ncaa", "intercollegiate", "university"]):
            return "adult", "T2-AGE-981", "Used collegiate wording in the paper title to classify the cohort as adult."
        if any(marker in title_lower for marker in ["professional", "elite", "senior", "national team", "olympic", "first league", "lower league"]):
            return "adult", "T2-AGE-980", "Used adult/professional wording in the paper title to classify the cohort as adult."

    play_lower = normalize_whitespace(level_of_play).lower()
    if play_lower:
        if any(marker in play_lower for marker in ["elite youth", "youth", "high school"]):
            return "youth", "T2-AGE-979", "Used a youth playing-level signal to classify the cohort as youth."
        if any(marker in play_lower for marker in ["collegiate", "professional", "elite", "semi-professional"]):
            return "adult", "T2-AGE-978", "Used an adult playing-level signal to classify the cohort as adult."

    mean_age_signal = parse_mean_age_signal(mean_age)
    if mean_age_signal:
        return mean_age_signal

    if raw:
        return "unclear", "T2-AGE-977", "Retained a non-standard age-category wording as unclear because it could not be defensibly mapped."
    return "", "", ""


def canonicalize_injury_definition(
    raw_value: str,
    definition_dict: dict[str, dict[str, str]],
) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if not raw:
        return "", "", ""
    if raw in definition_dict:
        row = definition_dict[raw]
        return row["canonical_value"], row["rule_id"], row["rationale"]

    lower = raw.lower()
    lower = lower.replace("medical-attention", "medical attention")
    lower = lower.replace("physical-complaint", "physical complaint")
    lower = lower.replace("physical compaint", "physical complaint")

    if lower == "not_reported":
        return "not_reported", "T3-INJDEF-999", "Explicitly retained not_reported."
    if "physical complaint" in lower and "time-loss" in lower:
        return (
            "physical complaint",
            "T3-INJDEF-997",
            "Collapsed combined physical-complaint and time-loss wording into physical complaint because it is the broader surveillance family.",
        )
    if "medical attention" in lower and "time-loss" in lower:
        return (
            "medical attention",
            "T3-INJDEF-998",
            "Collapsed combined medical-attention and time-loss wording into medical attention because it is the broader surveillance family.",
        )
    if "physical complaint" in lower:
        return "physical complaint", "T3-INJDEF-996", "Collapsed physical-complaint wording to the approved physical-complaint family."
    if "time-loss" in lower or "time loss" in lower:
        return "time-loss", "T3-INJDEF-995", "Collapsed specific time-loss wording to the approved time-loss family."
    if "medical attention" in lower:
        return "medical attention", "T3-INJDEF-994", "Collapsed medical-attention wording to the approved medical-attention family."
    if any(
        marker in lower
        for marker in [
            "acl",
            "concussion",
            "hamstring",
            "groin",
            "knee",
            "muscle",
            "kidney",
            "catastrophic",
            "surgical",
        ]
    ):
        return (
            "other/specific",
            "T3-INJDEF-993",
            "Retained a condition-specific definition as other/specific because it did not safely collapse into a broader family.",
        )
    return "other/specific", "T3-INJDEF-992", "Retained a non-standard injury-definition wording as other/specific."


def canonicalize_mechanism_reporting(
    raw_value: str,
    reporter_dict: dict[str, dict[str, str]],
) -> tuple[str, str, str]:
    raw = normalize_whitespace(raw_value)
    if not raw:
        return "", "", ""
    if raw in reporter_dict:
        row = reporter_dict[raw]
        return row["canonical_value"], row["rule_id"], row["rationale"]

    lower = raw.lower()

    if lower == "not_reported":
        return "not_reported", "T3-REPORT-999", "Explicitly retained not_reported."

    has_athletic_trainer = any(
        marker in lower for marker in ["athletic trainer", "certified athletic trainer", "certified athletic trainers"]
    )
    has_medical = any(
        marker in lower
        for marker in [
            "medical staff",
            "physician",
            "physicians",
            "physiotherapist",
            "physiotherapists",
            "orthopaedic surgeon",
            "orthopedic surgeon",
            "surgeon",
            "medical examiner",
            "medical expert",
            "medical services",
            "sport clinician",
            "sports medicine",
            "team medic",
            "paramedic",
            "physical therapist",
            "physical therapists",
            "tournament medical",
            "medical service",
            "sports trainer",
        ]
    )
    has_referee = "referee-selfreported" in lower or ("referee" in lower and "self" in lower)
    has_player = any(
        marker in lower
        for marker in [
            "player-self",
            "player self",
            "player reported",
            "questionnaire",
            "interview",
            "reported condition inquiry",
            "self-reported",
            "self reported",
        ]
    )
    has_coach = any(
        marker in lower
        for marker in [
            "coach",
            "coaches",
            "manager",
            "captain",
            "team adviser",
            "pe teacher",
            "pe teachers",
        ]
    )

    components: list[str] = []
    if has_athletic_trainer or has_medical:
        components.append("medical/performance staff")

    if has_referee:
        components.append("referee self-report")
    elif has_player:
        components.append("player self-report")

    if has_coach:
        components.append("coach")

    if components:
        ordered = list(OrderedDict.fromkeys(components))
        return (
            "; ".join(ordered),
            "T3-REPORT-998",
            "Collapsed reporter wording into canonical reporter families while preserving explicit multi-source reporting.",
        )

    return "other/unclear", "T3-REPORT-997", "Could not confidently place the reporter wording into the approved canonical families."


def build_output_fieldnames(base_fieldnames: list[str]) -> list[str]:
    output: list[str] = []
    for field in base_fieldnames:
        output.append(field)
        if field in TAB2_RAW_TO_STD:
            output.append(TAB2_RAW_TO_STD[field])
        if field in TAB3_RAW_TO_STD:
            output.append(TAB3_RAW_TO_STD[field])
    return output


def fill_down_shared_standardized_fields(rows: list[dict[str, str]]) -> None:
    """
    Analysis-ready rule:
    If a paper has one shared standardized value for a field, repeat that value on all rows
    belonging to the paper. If the paper has multiple distinct standardized values for that field,
    preserve the row-specific values instead.
    """
    rows_by_study: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        study_id = (row.get("studyId") or "").strip()
        rows_by_study.setdefault(study_id, []).append(row)

    standardized_fields = TAB1_STANDARDIZED_FIELDS + TAB2_STANDARDIZED_FIELDS + TAB3_STANDARDIZED_FIELDS

    for study_id, group_rows in rows_by_study.items():
        if not study_id:
            continue
        for field in standardized_fields:
            nonblank_values = [
                (row.get(field) or "").strip()
                for row in group_rows
                if (row.get(field) or "").strip()
            ]
            unique_values = list(OrderedDict.fromkeys(nonblank_values))
            if len(unique_values) != 1:
                continue
            shared_value = unique_values[0]
            for row in group_rows:
                row[field] = shared_value


def write_excel(output_rows: list[dict[str, str]], fieldnames: list[str], xlsx_path: Path) -> None:
    workbook = xlsxwriter.Workbook(str(xlsx_path))
    master = workbook.add_worksheet("master_analysis")
    clean = workbook.add_worksheet("clean_analysis_build")

    header_fmt = workbook.add_format({"bold": True, "bg_color": "#D9D9D9"})
    default_fmt = workbook.add_format({})
    green_fmt = workbook.add_format({"font_color": "#008000"})
    red_fmt = workbook.add_format({"font_color": "#C00000"})
    integer_fmt = workbook.add_format({"num_format": "0"})
    integer_green_fmt = workbook.add_format({"font_color": "#008000", "num_format": "0"})
    integer_red_fmt = workbook.add_format({"font_color": "#C00000", "num_format": "0"})

    for col_idx, name in enumerate(fieldnames):
        master.write(0, col_idx, name, header_fmt)

    for row_idx, row in enumerate(output_rows, start=1):
        for col_idx, field in enumerate(fieldnames):
            value = row.get(field, "")
            fmt = default_fmt
            excel_value, value_type = coerce_excel_value(field, value)

            raw_partner = None
            for raw_field, std_field in ALL_STD_PAIRS.items():
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

            master.write(row_idx, col_idx, excel_value, fmt)

    master.freeze_panes(1, 0)
    master.autofilter(0, 0, max(len(output_rows), 1), len(fieldnames) - 1)

    for col_idx, field in enumerate(fieldnames):
        master.set_column(col_idx, col_idx, min(max(len(field), 16), 42))

    clean_fields = [
        "paper_id",
        "studyId",
        "population_label",
        *TAB1_STANDARDIZED_FIELDS,
        *TAB2_STANDARDIZED_FIELDS,
        *TAB3_STANDARDIZED_FIELDS,
    ]
    present_clean_fields = [field for field in clean_fields if field in fieldnames]

    for col_idx, name in enumerate(present_clean_fields):
        clean.write(0, col_idx, name, header_fmt)

    for row_idx, row in enumerate(output_rows, start=1):
        for col_idx, field in enumerate(present_clean_fields):
            value = row.get(field, "")
            excel_value, value_type = coerce_excel_value(field, value)
            fmt = integer_fmt if value_type == "integer" else default_fmt
            clean.write(row_idx, col_idx, excel_value, fmt)

    clean.freeze_panes(1, 0)
    clean.autofilter(0, 0, max(len(output_rows), 1), len(present_clean_fields) - 1)

    for col_idx, field in enumerate(present_clean_fields):
        clean.set_column(col_idx, col_idx, min(max(len(field), 16), 42))

    workbook.close()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TAB2_AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    TAB3_AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames, rows = load_rows(INPUT_MASTER_CSV)
    output_fieldnames = build_output_fieldnames(fieldnames)

    discipline_dict = load_dictionary(DICT_DIR / "tab2" / "fifa-discipline-canonical-map.csv")
    sex_dict = load_dictionary(DICT_DIR / "tab2" / "sex-canonical-map.csv")
    play_dict = load_dictionary(DICT_DIR / "tab2" / "level-of-play-canonical-map.csv")
    age_dict = load_dictionary(DICT_DIR / "tab2" / "age-category-canonical-map.csv")
    injury_definition_dict = load_dictionary(DICT_DIR / "tab3" / "injury-definition-canonical-map.csv")
    reporter_dict = load_dictionary(DICT_DIR / "tab3" / "mechanism-reporting-canonical-map.csv")

    audit_rows: list[dict[str, str]] = []
    tab3_audit_rows: list[dict[str, str]] = []
    output_rows: list[dict[str, str]] = []

    for row in rows:
        study_id = (row.get("studyId") or "").strip()
        output_row = dict(row)

        discipline_std, discipline_rule, discipline_note = canonicalize_fifa_discipline(
            row.get("fifaDiscipline", ""),
            discipline_dict,
        )
        country_std, country_rule, country_note = canonicalize_country(row.get("country", ""))
        play_std, play_rule, play_note = canonicalize_level_of_play(row.get("levelOfPlay", ""), play_dict)
        sex_std, sex_rule, sex_note = canonicalize_sex(row.get("sex", ""), sex_dict)
        age_std, age_rule, age_note = canonicalize_age_category(
            row.get("ageCategory", ""),
            age_dict,
            mean_age=row.get("meanAge", ""),
            level_of_play=play_std or row.get("levelOfPlay", ""),
            paper_title=row.get("paper_title", "") or row.get("title", ""),
        )
        injury_def_std, injury_def_rule, injury_def_note = canonicalize_injury_definition(
            row.get("injuryDefinition", ""),
            injury_definition_dict,
        )
        reporter_std, reporter_rule, reporter_note = canonicalize_mechanism_reporting(
            row.get("mechanismReporting", ""),
            reporter_dict,
        )

        output_row["fifaDiscipline_standardized"] = discipline_std
        output_row["country_standardized"] = country_std
        output_row["levelOfPlay_standardized"] = play_std
        output_row["sex_standardized"] = sex_std
        output_row["ageCategory_standardized"] = age_std
        output_row["injuryDefinition_standardized"] = injury_def_std
        output_row["mechanismReporting_standardized"] = reporter_std

        append_audit_event(
            audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="fifaDiscipline",
            raw_value=(row.get("fifaDiscipline") or "").strip(),
            canonical_value=discipline_std,
            rule_id=discipline_rule,
            rationale=discipline_note,
        )
        append_audit_event(
            audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="country",
            raw_value=(row.get("country") or "").strip(),
            canonical_value=country_std,
            rule_id=country_rule,
            rationale=country_note,
        )
        append_audit_event(
            audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="levelOfPlay",
            raw_value=(row.get("levelOfPlay") or "").strip(),
            canonical_value=play_std,
            rule_id=play_rule,
            rationale=play_note,
        )
        append_audit_event(
            audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="sex",
            raw_value=(row.get("sex") or "").strip(),
            canonical_value=sex_std,
            rule_id=sex_rule,
            rationale=sex_note,
        )
        append_audit_event(
            audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="ageCategory",
            raw_value=(row.get("ageCategory") or "").strip(),
            canonical_value=age_std,
            rule_id=age_rule,
            rationale=age_note,
        )
        append_audit_event(
            tab3_audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="injuryDefinition",
            raw_value=(row.get("injuryDefinition") or "").strip(),
            canonical_value=injury_def_std,
            rule_id=injury_def_rule,
            rationale=injury_def_note,
        )
        append_audit_event(
            tab3_audit_rows,
            source_file=str(INPUT_MASTER_CSV),
            output_file=str(OUTPUT_MASTER_CSV),
            study_id=study_id,
            field_name="mechanismReporting",
            raw_value=(row.get("mechanismReporting") or "").strip(),
            canonical_value=reporter_std,
            rule_id=reporter_rule,
            rationale=reporter_note,
        )

        output_rows.append(output_row)

    fill_down_shared_standardized_fields(output_rows)

    with OUTPUT_MASTER_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(output_rows)

    with TAB2_AUDIT_CSV.open("w", newline="", encoding="utf-8") as handle:
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
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        writer.writerows(audit_rows)

    with TAB3_AUDIT_CSV.open("w", newline="", encoding="utf-8") as handle:
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
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        writer.writerows(tab3_audit_rows)

    write_excel(output_rows, output_fieldnames, OUTPUT_MASTER_XLSX)

    print(f"input={INPUT_MASTER_CSV}")
    print(f"csv_output={OUTPUT_MASTER_CSV}")
    print(f"xlsx_output={OUTPUT_MASTER_XLSX}")
    print(f"tab2_audit={TAB2_AUDIT_CSV}")
    print(f"tab3_audit={TAB3_AUDIT_CSV}")
    print(f"rows={len(output_rows)}")
    print(f"tab2_audit_rows={len(audit_rows)}")
    print(f"tab3_audit_rows={len(tab3_audit_rows)}")


if __name__ == "__main__":
    main()
