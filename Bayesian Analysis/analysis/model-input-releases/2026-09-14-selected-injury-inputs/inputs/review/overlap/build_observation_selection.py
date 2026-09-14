#!/usr/bin/env python3
"""Build the bounded cohort-overlap selection for the working injury master.

This is an overlap representation decision only. It does not certify
definition, denominator, arithmetic, or model eligibility.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
RELEASE = ROOT / "analysis/model-input-releases/2026-09-14-adjudicated-analysis"
SCOPE_MAP = ROOT / "protocol-v2/injury-rule-review-2026-09-14/scope-overlap/population-overlap-decisions.csv"
LEDGER = ROOT.parent / "fifa-gbi-data-extraction/data/source-family-overlap-audit/2026-07-27/source-family-decision-ledger-2026-07-27.json"
ALIGNMENT = ROOT / "protocol-v2/final-input-verification-2026-09-14/alignment/alignment-decisions.csv"
ALIGNMENT_VALIDATION = ROOT / "protocol-v2/final-input-verification-2026-09-14/alignment/validation.json"
PAIR_REVIEW = ROOT / "protocol-v2/final-input-verification-2026-09-14/alignment/matching-overall-category-adjudication.csv"

# The source-alignment reviewer retained row 174 as the aligned Ghana total.
# Its age rows have denominator conflicts, so they cannot replace that total.
SOURCE_PARENT_FALLBACKS = {
    "S1229:parent:174": {"174", "175", "176", "177", "178"},
}

# The saved S604 source note states that both labels describe acute traumatic
# injuries during official matches. Its overall and match observations carry the
# same 2,947 injuries and exposure, so retain the correctly labelled match target
# once rather than treating the two labels as independent observations.
S604_OVERALL_ID = "1048:incidence:overall:main"
S604_MATCH_ID = "1048:incidence:match:main"
S604_CANONICAL_SCOPE = "restricted_acute_traumatic_match_injuries"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def supported(alignment: dict[str, str]) -> bool:
    return alignment["metric_alignment_status"] == "supported" and alignment["threshold_route"] != "hold"


def number(value: str) -> Decimal | None:
    try:
        result = Decimal(value)
        return result if result.is_finite() else None
    except (InvalidOperation, TypeError, ValueError):
        return None


def numerical_route(row: dict[str, str]) -> str:
    exposure = number(row.get("exposure_player_hours", ""))
    quantity = number(row.get("injury_count" if row["metric"] == "incidence" else "days_lost", ""))
    if exposure is not None and exposure > 0 and quantity is not None and quantity >= 0:
        if row["metric"] == "burden":
            return "days_and_exposure"
        if quantity == quantity.to_integral_value():
            return "count_and_exposure"
    rate, lower, upper = number(row["rate_per_1000_player_hours"]), number(row["ci95_lower"]), number(row["ci95_upper"])
    if rate is not None and rate >= 0 and lower is not None and upper is not None and 0 <= lower <= rate <= upper and lower < upper:
        return "reported_rate_and_interval"
    return "descriptive_rate_without_usable_sampling_information"


def quantitative(row: dict[str, str], alignment: dict[str, str]) -> bool:
    return supported(alignment) and (
        numerical_route(row) != "descriptive_rate_without_usable_sampling_information"
        or alignment.get("reverse_exposure_supported") == "true"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master_path = RELEASE / "injury-analysis-master.csv"
    master = read_csv(master_path)
    scope = {row["sourceDataRow"]: row for row in read_csv(SCOPE_MAP)}
    alignment = read_csv(ALIGNMENT)
    alignment_validation = json.loads(ALIGNMENT_VALIDATION.read_text(encoding="utf-8"))
    if len(master) != 3211 or len({row["observation_id"] for row in master}) != 3211:
        raise ValueError("Expected 3,211 unique observations in the working master")
    if len(scope) != 646:
        raise ValueError("Expected 646 source-row overlap decisions")
    if alignment_validation.get("pass") is not True or alignment_validation.get("csv_sha256") != sha256(ALIGNMENT):
        raise ValueError("Alignment validation does not match alignment-decisions.csv")
    if len(alignment) != 3211 or len({row["observation_id"] for row in alignment}) != 3211:
        raise ValueError("Expected 3,211 unique alignment decisions")
    master_by_id = {row["observation_id"]: row for row in master}
    alignment_by_id = {row["observation_id"]: row for row in alignment}
    if set(master_by_id) != set(alignment_by_id):
        raise ValueError("Alignment IDs do not match the working master")

    s604_overall = master_by_id[S604_OVERALL_ID]
    s604_match = master_by_id[S604_MATCH_ID]
    if not (
        s604_overall["injury_count"] == s604_match["injury_count"] == "2947"
        and s604_overall["exposure_player_hours"] == s604_match["exposure_player_hours"]
        and alignment_by_id[S604_OVERALL_ID]["outcome_scope"] == S604_CANONICAL_SCOPE
        and alignment_by_id[S604_MATCH_ID]["outcome_scope"] == S604_CANONICAL_SCOPE
    ):
        raise ValueError("S604 source-confirmed overall/match identity guard is not satisfied")

    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    family_by_study: dict[str, dict] = {}
    for family in ledger["families"]:
        for paper in family.get("papers", []):
            family_by_study[paper["studyId"]] = {"family_key": family["familyKey"], **paper}

    observations_by_source: dict[str, list[dict[str, str]]] = defaultdict(list)
    observations_by_source_target: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in master:
        observations_by_source[row["sourceDataRow"]].append(row)
        observations_by_source_target[(row["sourceDataRow"], row["metric"], row["setting"], row["outcome_target"])].append(row)

    def final_target(row: dict[str, str]) -> tuple[str, str, str, str]:
        decision = alignment_by_id[row["observation_id"]]
        return row["metric"], row["setting"], decision["outcome_scope"], decision["threshold_route"]

    observations_by_source_final_target: dict[tuple[str, str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in master:
        observations_by_source_final_target[(row["sourceDataRow"], *final_target(row))].append(row)

    # A numerical partition only becomes an automatic representation choice where
    # source names identify a parent and child strata in the same paper, and the
    # prior map verified three or more displayed quantity fields. Numerical equality
    # of outcome rates is deliberately not used.
    partitions: dict[str, dict[str, list[str] | str]] = {}
    for row in scope.values():
        if row["overlap_status"] != "verified_exhaustive_numerical_partition":
            continue
        group = partitions.setdefault(row["overlap_group"], {"parent": "", "children": []})
        if row["row_role"] == "parent":
            group["parent"] = row["sourceDataRow"]
        elif row["row_role"] == "granular":
            group["children"].append(row["sourceDataRow"])
    for group, relation in partitions.items():
        if not relation["parent"] or not relation["children"]:
            raise ValueError("Incomplete named partition: " + group)

    source_to_partition: dict[str, tuple[str, str]] = {}
    for group, relation in partitions.items():
        source_to_partition[relation["parent"]] = (group, "parent")
        for child in relation["children"]:
            source_to_partition[child] = (group, "granular")

    # A parent can be suppressed only when every named child has the same final
    # target and the alignment record supports each replacement. A parent with a
    # count/hour, rate/CI or approved reverse-exposure route also requires the same
    # quantitative route from every child. If coverage is partial or held, retain a
    # supported parent and hold only unsupported competing children.
    partition_actions: dict[str, dict[str, str]] = {}
    for group, relation in partitions.items():
        parent = str(relation["parent"])
        children = list(relation["children"])
        processed_parent_targets: set[tuple[str, str, str, str]] = set()
        for parent_observation in observations_by_source[parent]:
            parent_alignment = alignment_by_id[parent_observation["observation_id"]]
            target_key = final_target(parent_observation)
            if target_key in processed_parent_targets:
                continue
            processed_parent_targets.add(target_key)
            matching_by_child = {
                child: observations_by_source_final_target.get((child, *target_key), []) for child in children
            }
            reporting_children = {child: rows for child, rows in matching_by_child.items() if rows}
            if not reporting_children:
                continue
            child_representatives = {}
            for child, rows in reporting_children.items():
                eligible = [
                    row for row in rows
                    if supported(alignment_by_id[row["observation_id"]])
                    and (not quantitative(parent_observation, parent_alignment) or quantitative(row, alignment_by_id[row["observation_id"]]))
                ]
                if eligible:
                    child_representatives[child] = max(
                        eligible,
                        key=lambda row: (
                            quantitative(row, alignment_by_id[row["observation_id"]]),
                            numerical_route(row) != "descriptive_rate_without_usable_sampling_information",
                            row["observation_id"],
                        ),
                    )
            complete_replacement = (
                supported(parent_alignment)
                and len(child_representatives) == len(children)
            )
            if complete_replacement:
                partition_actions[parent_observation["observation_id"]] = {
                    "mode": "parent_duplicate_complete_aligned_child_coverage",
                    "parent": parent,
                    "children": ";".join(children),
                    "matches": ";".join(sorted(row["observation_id"] for rows in reporting_children.values() for row in rows)),
                }
            elif supported(parent_alignment):
                partition_actions[parent_observation["observation_id"]] = {
                    "mode": "parent_select_incomplete_or_held_child_coverage",
                    "parent": parent,
                    "children": ";".join(children),
                    "matches": ";".join(sorted(row["observation_id"] for rows in reporting_children.values() for row in rows)),
                }
            else:
                partition_actions[parent_observation["observation_id"]] = {
                    "mode": "parent_hold_alignment_not_supported",
                    "parent": parent,
                    "children": ";".join(children),
                    "matches": ";".join(sorted(row["observation_id"] for rows in reporting_children.values() for row in rows)),
                }
            for child, rows in reporting_children.items():
                selected_child = child_representatives.get(child)
                for child_observation in rows:
                    if child_observation["observation_id"] in partition_actions:
                        raise ValueError("Conflicting partition action for " + child_observation["observation_id"])
                    child_alignment = alignment_by_id[child_observation["observation_id"]]
                    if complete_replacement:
                        mode = "child_select_complete_aligned_coverage" if child_observation == selected_child else "child_duplicate_selected_child"
                    elif not supported(child_alignment):
                        mode = "child_hold_alignment_not_supported"
                    elif supported(parent_alignment):
                        mode = "child_duplicate_parent_retained"
                    else:
                        mode = "child_select_parent_not_supported"
                    partition_actions[child_observation["observation_id"]] = {
                        "mode": mode,
                        "parent": parent,
                        "children": ";".join(children),
                        "matches": parent_observation["observation_id"],
                        "representative": selected_child["observation_id"] if selected_child else "",
                    }

    # A possible partition does not justify a blanket hold. A source-supported
    # parent remains selected. Only a child that competes for its same final target
    # is held; a supported specialist child with no parent counterpart is retained.
    unresolved_actions: dict[str, dict[str, str]] = {}
    unresolved_groups: dict[str, dict[str, list[str] | str]] = {}
    for row in scope.values():
        if row["overlap_status"] != "possible_parent_granular_overlap_unresolved":
            continue
        group = unresolved_groups.setdefault(row["overlap_group"], {"parent": "", "children": []})
        if row["row_role"] == "parent":
            group["parent"] = row["sourceDataRow"]
        elif row["row_role"] == "granular":
            group["children"].append(row["sourceDataRow"])
    for group_name, relation in unresolved_groups.items():
        parent = str(relation["parent"])
        children = list(relation["children"])
        if not parent:
            raise ValueError("Unresolved group lacks parent: " + group_name)
        force_parent = parent in SOURCE_PARENT_FALLBACKS.get(group_name, set())
        parent_final: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
        for parent_observation in observations_by_source[parent]:
            parent_final[final_target(parent_observation)].append(parent_observation)
            parent_supported = supported(alignment_by_id[parent_observation["observation_id"]]) or force_parent
            unresolved_actions[parent_observation["observation_id"]] = {
                "mode": "parent_select_unresolved_competition" if parent_supported else "parent_hold_alignment_not_supported",
                "parent": parent,
                "group": group_name,
            }
        for child in children:
            for child_observation in observations_by_source[child]:
                child_alignment = alignment_by_id[child_observation["observation_id"]]
                parents = parent_final.get(final_target(child_observation), [])
                if parents:
                    parent_observation = parents[0]
                    parent_supported = supported(alignment_by_id[parent_observation["observation_id"]]) or force_parent
                    mode = "child_hold_unresolved_competitor" if parent_supported else (
                        "child_select_parent_not_supported" if supported(child_alignment) else "child_hold_alignment_not_supported"
                    )
                    parent_id = parent_observation["observation_id"]
                else:
                    mode = "child_select_distinct_final_target" if supported(child_alignment) else "child_hold_alignment_not_supported"
                    parent_id = parent
                unresolved_actions[child_observation["observation_id"]] = {
                    "mode": mode, "parent": parent_id, "group": group_name,
                }

    # The pair review, not rate equality, establishes whether an apparent main
    # result duplicates a detailed restricted representation.
    pair_actions: dict[str, dict[str, str]] = {}
    matched_pairs: dict[str, list[dict[str, str]]] = defaultdict(list)
    for pair in read_csv(PAIR_REVIEW):
        parent_id, detailed_id = pair["main_observation_id"], pair["detailed_observation_id"]
        if pair["title_definition_scope_evidence"] == "matched":
            matched_pairs[parent_id].append(pair)
        else:
            parent_action = pair_actions.get(parent_id)
            if parent_action is None:
                pair_actions[parent_id] = {"mode": "hold", "details": "", "evidence": pair["evidence"]}
            pair_actions.setdefault(detailed_id, {"mode": "hold", "details": "", "evidence": pair["evidence"]})

    # A title/definition match confirms a shared outcome representation, but it
    # does not make a rate-only descriptor an adequate replacement for a parent
    # with source count/hour or days/hour information. Suppress a quantitative
    # parent only if each matched detailed representation also has a compatible
    # quantitative route. If the parent is alignment-supported, retain it and
    # suppress the descriptor-only duplicates; otherwise keep a specific hold.
    for parent_id, pairs in matched_pairs.items():
        parent = master_by_id[parent_id]
        parent_alignment = alignment_by_id[parent_id]
        details = [pair["detailed_observation_id"] for pair in pairs]
        evidence = "; ".join(dict.fromkeys(pair["evidence"] for pair in pairs))
        parent_quantitative = numerical_route(parent) != "descriptive_rate_without_usable_sampling_information" or parent_alignment.get("reverse_exposure_supported") == "true"
        complete_quantitative_detail_coverage = all(
            supported(alignment_by_id[detailed_id])
            and quantitative(master_by_id[detailed_id], alignment_by_id[detailed_id])
            for detailed_id in details
        )
        if parent_quantitative and not complete_quantitative_detail_coverage:
            if supported(parent_alignment):
                pair_actions[parent_id] = {
                    "mode": "select_quantitative_parent",
                    "details": ";".join(details),
                    "evidence": evidence,
                }
                for detailed_id in details:
                    pair_actions[detailed_id] = {
                        "mode": "duplicate_of_quantitative_parent",
                        "parent": parent_id,
                        "evidence": evidence,
                    }
            else:
                pair_actions[parent_id] = {
                    "mode": "hold_quantitative_parent_scope_unverified",
                    "details": ";".join(details),
                    "evidence": evidence,
                }
        elif all(supported(alignment_by_id[detailed_id]) for detailed_id in details):
            pair_actions[parent_id] = {"mode": "duplicate", "details": ";".join(details), "evidence": evidence}
        else:
            pair_actions[parent_id] = {"mode": "hold", "details": ";".join(details), "evidence": evidence}

    anchor_by_target: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in master:
        anchor_by_target[(row["source_study_id"], row["metric"], row["setting"], row["outcome_target"])].append(row)

    selection_rows: list[dict[str, str]] = []
    for observation in master:
        source_id = observation["sourceDataRow"]
        map_row = scope[source_id]
        alignment_row = alignment_by_id[observation["observation_id"]]
        study_link = family_by_study.get(observation["source_study_id"]) or family_by_study.get(observation["paper_id"])
        target = "|".join(final_target(observation))
        cohort_period_key = "|".join([
            observation["paper_id"], source_id, observation["population_label"] or "unnamed_population",
            observation["dataCollectionPeriod"] or observation["numberOfSeasons"] or "period_not_reported",
        ])
        record = {
            "observation_id": observation["observation_id"],
            "selection": "select",
            "overlap_family": observation["cohort_family"] or observation["paper_id"],
            "parent_id": "",
            "reason": "",
            "evidence": "",
            "duplicate_of": "",
            "analysis_target": target,
            "alignment_status": alignment_row["metric_alignment_status"],
            "threshold_route": alignment_row["threshold_route"],
            "metric_usability": alignment_row["metric_usability"],
            "reverse_exposure_supported": alignment_row.get("reverse_exposure_supported", "false"),
            "cohort_period_key": cohort_period_key,
            "setting_handling": (
                "separate_target_overall_combined_do_not_pool_with_match_or_training_components_same_likelihood"
                if observation["setting"] == "overall" else
                "separate_target_component_setting_do_not_pool_with_overall_combined_same_likelihood"
            ),
            "overlap_status": map_row["overlap_status"],
            "source_locator": f"injury-analysis-master.csv observation_id={observation['observation_id']}; sourceDataRow={source_id}",
            "historical_study_id": observation["source_study_id"],
            "historical_role": "",
        }

        # Historical source-family policy is applied before ordinary row selection.
        # S261's appended source row has source_study_id S1431, hence its identity
        # must come from source_study_id rather than its container paper_id.
        if observation["observation_id"] == S604_OVERALL_ID:
            record.update(
                selection="duplicate",
                overlap_family="S604:acute_traumatic_official_matches",
                parent_id=observation["sourceDataRow"],
                duplicate_of=S604_MATCH_ID,
                reason=(
                    "Duplicate label for the same 2,947 acute traumatic official-match injuries and exposure. "
                    "The source-confirmed match representation is retained as the analysis target."
                ),
                evidence=(
                    "alignment-decisions.csv S604 rows 1048 overall/match; S604 source_notes, 2026-04-07: "
                    "Acute traumatic injuries during official matches; matching injury_count=2947 and exposure_player_hours"
                ),
                setting_handling="duplicate_same_observed_match_population_retained_as_match_target",
            )
        elif (
            observation["observation_id"] in pair_actions
            and partition_actions.get(observation["observation_id"], {}).get("mode")
            != "parent_duplicate_complete_aligned_child_coverage"
        ):
            action = pair_actions[observation["observation_id"]]
            if action["mode"] == "duplicate":
                record.update(
                    selection="duplicate",
                    parent_id=source_id,
                    duplicate_of=action["details"],
                    reason=(
                        "The alignment pair review confirms that this generic representation is the same restricted source outcome as the retained "
                        "descriptor-rich detailed representation."
                    ),
                    evidence="matching-overall-category-adjudication.csv; " + action["evidence"],
                )
            elif action["mode"] == "select_quantitative_parent":
                record.update(
                    selection="select",
                    parent_id=source_id,
                    reason=(
                        "Selected source count/hour or days/hour representation. The alignment pair review confirms the same outcome, but each "
                        "descriptor-rich alternative lacks compatible quantitative coverage."
                    ),
                    evidence="matching-overall-category-adjudication.csv; " + action["evidence"] + "; complete quantitative detail coverage absent",
                )
            elif action["mode"] == "duplicate_of_quantitative_parent":
                parent_partition = partition_actions.get(action["parent"], {})
                duplicate_target = (
                    parent_partition["matches"]
                    if parent_partition.get("mode") == "parent_duplicate_complete_aligned_child_coverage"
                    else action["parent"]
                )
                record.update(
                    selection="duplicate",
                    parent_id=master_by_id[action["parent"]]["sourceDataRow"],
                    duplicate_of=duplicate_target,
                    reason=(
                        "Duplicate of the source-supported count/hour or days/hour representation for the same source outcome. "
                        "This descriptor-only representation does not replace its sampling information."
                        if duplicate_target == action["parent"] else
                        "Duplicate source alias of a parent already replaced by the verified aligned granular partition."
                    ),
                    evidence="matching-overall-category-adjudication.csv; " + action["evidence"] + (
                        "; quantitative parent retained" if duplicate_target == action["parent"] else
                        "; parent replaced by selected granular observations=" + duplicate_target
                    ),
                )
            elif action["mode"] == "hold_quantitative_parent_scope_unverified":
                record.update(
                    selection="hold",
                    parent_id=source_id,
                    reason=(
                        "Held pending source alignment of the count/hour or days/hour scope. The matching rate-only descriptor does not establish "
                        "a quantitative replacement."
                    ),
                    evidence="matching-overall-category-adjudication.csv; " + action["evidence"] + "; complete quantitative detail coverage absent",
                )
            else:
                record.update(
                    selection="hold",
                    parent_id=source_id,
                    reason="The alignment pair review does not verify a separable time-loss scope for this matching parent/category representation.",
                    evidence="matching-overall-category-adjudication.csv; " + action["evidence"],
                )
        elif study_link and study_link.get("role") == "nested_subset":
            anchor = study_link.get("anchorStudyId", "")
            anchor_matches = anchor_by_target.get((anchor, observation["metric"], observation["setting"], observation["outcome_target"]), [])
            if anchor_matches:
                record.update(
                    selection="duplicate",
                    overlap_family=study_link["family_key"],
                    parent_id=anchor,
                    duplicate_of=";".join(sorted(row["observation_id"] for row in anchor_matches)),
                    historical_role="nested_subset",
                    reason=(
                        f"{observation['source_study_id']} is a named nested subset of {anchor}, and {anchor} reports this same metric, setting and outcome target. "
                        "The nested observation is a duplicate representation for that target."
                    ),
                    evidence=f"source-family-decision-ledger-2026-07-27.json family={study_link['family_key']}; studyId={observation['source_study_id']}; anchorStudyId={anchor}; target-matched anchor observations=" + ";".join(sorted(row["observation_id"] for row in anchor_matches)) + "; " + str(study_link.get("evidence", "")),
                )
            else:
                record.update(
                    selection="select",
                    overlap_family=study_link["family_key"],
                    parent_id=anchor,
                    historical_role="nested_subset",
                    reason=(
                        f"{observation['source_study_id']} is nested within {anchor}, but {anchor} has no observation for this metric, setting and outcome target. "
                        "The specialist target is selected as a distinct representation and remains linked to the source family."
                    ),
                    evidence=f"source-family-decision-ledger-2026-07-27.json family={study_link['family_key']}; studyId={observation['source_study_id']}; anchorStudyId={anchor}; target-matched anchor search in injury-analysis-master.csv found none; " + str(study_link.get("evidence", "")),
                )
        elif observation["observation_id"] in partition_actions:
            action = partition_actions[observation["observation_id"]]
            if action["mode"] == "parent_duplicate_complete_aligned_child_coverage":
                record.update(
                    selection="duplicate",
                    parent_id=action["parent"],
                    duplicate_of=action["matches"],
                    reason=(
                        "Every named child reports this final metric, setting, outcome scope and threshold route, and each replacement is alignment-supported. "
                        "The prior map verified an exhaustive numerical partition from three or more source quantity fields, so the parent is a duplicate representation."
                    ),
                    evidence=map_row["evidence"] + "; complete alignment-supported child target coverage; selected child source rows=" + action["children"],
                )
            elif action["mode"] == "child_select_complete_aligned_coverage":
                record.update(
                    selection="select",
                    parent_id=action["parent"],
                    reason=(
                        "Selected named granular stratum from a verified exhaustive partition with complete alignment-supported child target coverage. "
                        "The aligned parent representation is marked duplicate."
                    ),
                    evidence=map_row["evidence"] + f"; parent sourceDataRow={action['parent']}; complete alignment-supported child target coverage",
                )
            elif action["mode"] == "child_duplicate_selected_child":
                record.update(
                    selection="duplicate",
                    parent_id=action["parent"],
                    duplicate_of=action["representative"],
                    reason=(
                        "Duplicate source alias of the selected named granular stratum. The selected child retains the compatible quantitative "
                        "representation used for the verified exhaustive partition."
                    ),
                    evidence=map_row["evidence"] + "; selected child representation=" + action["representative"],
                )
            elif action["mode"] == "parent_select_incomplete_or_held_child_coverage":
                record.update(
                    selection="select",
                    parent_id=action["parent"],
                    reason=(
                        "At least one named child is absent, held, scope-mismatched or threshold-incompatible for this final target. "
                        "The alignment-supported parent remains the complete representation."
                    ),
                    evidence=map_row["evidence"] + "; incomplete or alignment-ineligible child coverage; matching child observation IDs=" + action["matches"],
                )
            elif action["mode"] == "child_duplicate_parent_retained":
                record.update(
                    selection="duplicate",
                    parent_id=action["parent"],
                    duplicate_of=action["matches"],
                    reason=(
                        "This alignment-supported child reports a target represented by its retained parent. The parent is kept because the named child "
                        "coverage is incomplete or another replacement is held or incompatible."
                    ),
                    evidence=map_row["evidence"] + f"; retained parent sourceDataRow={action['parent']}; incomplete or alignment-ineligible child coverage",
                )
            elif action["mode"] in {"parent_hold_alignment_not_supported", "child_hold_alignment_not_supported"}:
                record.update(
                    selection="hold",
                    parent_id=action["parent"],
                    reason="This potential representation is held because the final alignment record does not support its source metric or threshold route.",
                    evidence=map_row["evidence"] + "; alignment-decisions.csv metric/threshold hold",
                )
            elif action["mode"] == "child_select_parent_not_supported":
                record.update(
                    selection="select",
                    parent_id=action["parent"],
                    reason="The parent is not alignment-supported for this final target, so this supported granular observation remains selected.",
                    evidence=map_row["evidence"] + f"; parent sourceDataRow={action['parent']} is alignment-held",
                )
            else:
                raise ValueError("Unknown partition action")
        elif observation["observation_id"] in unresolved_actions:
            action = unresolved_actions[observation["observation_id"]]
            if action["mode"] == "parent_select_unresolved_competition":
                record.update(
                    selection="select",
                    parent_id=action["parent"],
                    reason=(
                        "Selected as the source-supported parent for this final target. The named child rows are not proven disjoint replacements, "
                        "so only competing child representations are held."
                    ),
                    evidence=map_row["evidence"] + "; final alignment source-supported parent fallback",
                )
            elif action["mode"] == "child_hold_unresolved_competitor":
                record.update(
                    selection="hold",
                    parent_id=action["parent"],
                    reason=(
                        "This child competes with a retained source-supported parent for the same final target, but available evidence does not establish "
                        "a disjoint population-period partition."
                    ),
                    evidence=map_row["evidence"] + "; competing parent observation=" + action["parent"],
                )
            elif action["mode"] == "child_select_distinct_final_target":
                record.update(
                    selection="select",
                    parent_id=action["parent"],
                    reason=(
                        "Selected because this supported child has no parent counterpart with the same final metric, setting, outcome scope and threshold route."
                    ),
                    evidence=map_row["evidence"] + "; final-target comparison found no parent counterpart",
                )
            elif action["mode"] == "child_select_parent_not_supported":
                record.update(
                    selection="select",
                    parent_id=action["parent"],
                    reason="The parent is alignment-held for this final target, so this supported child remains selected.",
                    evidence=map_row["evidence"] + "; parent alignment hold",
                )
            elif action["mode"] in {"parent_hold_alignment_not_supported", "child_hold_alignment_not_supported"}:
                record.update(
                    selection="hold",
                    parent_id=action["parent"],
                    reason="Held because the final alignment record does not support this source metric or threshold route.",
                    evidence=map_row["evidence"] + "; alignment-decisions.csv metric/threshold hold",
                )
            else:
                raise ValueError("Unknown unresolved overlap action")
        elif source_id in source_to_partition:
            partition_group, role = source_to_partition[source_id]
            relation = partitions[partition_group]
            parent = str(relation["parent"])
            children = list(relation["children"])
            if role == "parent":
                record.update(
                    selection="select" if supported(alignment_row) else "hold",
                    parent_id=parent,
                    reason=(
                        "The named partition is verified, but no child observation reports this same final target. "
                        "The parent is the only available representation for this target."
                        if supported(alignment_row) else "The parent has no final alignment support for this target."
                    ),
                    evidence=map_row["evidence"] + "; final-target counterpart search in injury-analysis-master.csv found no granular observation",
                )
            else:
                record.update(
                    selection="select" if supported(alignment_row) else "hold",
                    parent_id=parent,
                    reason=(
                        "Selected named granular stratum from a verified exhaustive same-paper partition because no aligned parent counterpart reports this final target."
                        if supported(alignment_row) else "Held because this granular observation has no final alignment support."
                    ),
                    evidence=map_row["evidence"] + f"; named population={map_row['population_label']}; parent sourceDataRow={parent}",
                )
        elif map_row["overlap_status"] == "possible_parent_granular_overlap_unresolved":
            record.update(
                selection="hold",
                parent_id=map_row["overlap_group"],
                reason=(
                    "The source labels imply a parent and granular relation, but available evidence does not establish an exhaustive, mutually exclusive "
                    "population-period partition. Select neither representation for this target until the named cohort and period are checked."
                ),
                evidence=map_row["evidence"],
            )
        elif map_row["overlap_status"] == "explicit_nested_linked_cohort":
            record.update(
                selection="duplicate",
                parent_id="S076",
                duplicate_of="study:S076",
                reason="The source-row map identifies this as the S1431 cohort nested within S076 for three seasons.",
                evidence=map_row["evidence"],
            )
        elif map_row["overlap_status"] == "existing_source_family_policy_applies":
            # The historic ledger either identifies an anchor, a separate family, or
            # leaves only source-family context. Do not turn a policy note into a
            # claim of independence.
            if study_link and study_link.get("role") == "anchor":
                record.update(
                    selection="select",
                    overlap_family=study_link["family_key"],
                    historical_role="anchor",
                    reason="Selected as the named historical source-family anchor for its reported target.",
                    evidence=f"source-family-decision-ledger-2026-07-27.json family={study_link['family_key']}; studyId={study_link['studyId']}; " + str(study_link.get("evidence", "")),
                )
            elif study_link and study_link.get("role") == "separate_family":
                record.update(
                    selection="select",
                    overlap_family=study_link["family_key"],
                    historical_role="separate_family",
                    reason="Selected because the historical ledger records this source as a separate family, not a duplicate of an anchor.",
                    evidence=f"source-family-decision-ledger-2026-07-27.json family={study_link['family_key']}; studyId={study_link['studyId']}; " + str(study_link.get("evidence", "")),
                )
            else:
                record.update(
                    selection="select",
                    historical_role=(study_link or {}).get("role", "policy_link_unresolved"),
                    reason=(
                        "No overlapping parent, granular row, or exact historical source-family link was identified in available evidence. "
                        "This selection does not claim the paper is proven independent of every external source."
                    ),
                    evidence=map_row["evidence"] + "; historical-ledger lookup found no exact current study-ID link",
                )
        elif map_row["overlap_status"] == "no_parent_granular_relation_identified_in_frozen_rows":
            record.update(
                selection="select",
                reason=(
                    "No same-paper parent or granular overlap was identified in available evidence. "
                    "This selection does not claim the paper is proven independent of every external source."
                ),
                evidence=map_row["evidence"],
            )
        else:
            # Multiple source rows are retained as their named population or period
            # targets. This does not provide an independence claim or licence to pool
            # them into one likelihood without a dependence model.
            record.update(
                selection="select",
                reason=(
                    "Selected as a separately reported named stratum. No parent representation was selected as a duplicate for this target. "
                    "Retain the shared paper family for later dependence handling."
                ),
                evidence=map_row["evidence"],
            )
        if record["selection"] == "select" and not supported(alignment_row):
            record.update(
                selection="hold",
                reason="Held because the final alignment record does not support this source metric or threshold route.",
                evidence=record["evidence"] + "; alignment-decisions.csv metric/threshold hold",
            )
        selection_rows.append(record)

    fields = list(selection_rows[0])
    write_csv(OUT / "observation-selection.csv", selection_rows, fields)

    # Every historical paper represented in this master gets one exact source-ID
    # record. The ledger may contain other papers that are not in this release.
    current_studies = defaultdict(lambda: {
        "source_rows": set(), "paper_ids": set(), "observations": 0,
        "all_injury_observations": 0, "restricted_target_observations": 0,
        "select_observations": 0, "duplicate_observations": 0, "hold_observations": 0,
    })
    selection_by_id = {row["observation_id"]: row for row in selection_rows}
    for row in master:
        if row["source_study_id"] in family_by_study or row["paper_id"] in family_by_study:
            identity = row["source_study_id"] if row["source_study_id"] in family_by_study else row["paper_id"]
            current_studies[identity]["source_rows"].add(row["sourceDataRow"])
            current_studies[identity]["paper_ids"].add(row["paper_id"])
            current_studies[identity]["observations"] += 1
            if row["outcome_target"] == "all_injuries":
                current_studies[identity]["all_injury_observations"] += 1
            else:
                current_studies[identity]["restricted_target_observations"] += 1
            current_studies[identity][selection_by_id[row["observation_id"]]["selection"] + "_observations"] += 1
    family_rows = []
    for study_id, usage in sorted(current_studies.items()):
        link = family_by_study[study_id]
        role = link.get("role", "")
        has_all_injury = usage["all_injury_observations"] > 0
        has_restricted = usage["restricted_target_observations"] > 0
        target_purpose = (
            "all-injury and distinct restricted targets" if has_all_injury and has_restricted else
            "all-injury target" if has_all_injury else "distinct restricted target"
        )
        if role == "nested_subset":
            purpose = f"nested subset for {target_purpose}; duplicate only for target-matched anchor outcomes, otherwise selectable specialist outcome"
        elif role == "separate_family":
            purpose = f"separate family, selectable for its {target_purpose}"
        elif role == "anchor":
            purpose = f"family anchor, selectable for its {target_purpose}"
        else:
            purpose = "historical family member, requires source-family treatment"
        family_rows.append({
            "study_id": study_id,
            "paper_ids_in_working_master": ";".join(sorted(usage["paper_ids"])),
            "source_rows": ";".join(sorted(usage["source_rows"], key=int)),
            "overlap_family": link["family_key"],
            "historical_role": role,
            "anchor_study_id": link.get("anchorStudyId") or "",
            "relationship": link.get("relationship") or "",
            "selection_purpose": purpose,
            "observations": str(usage["observations"]),
            "all_injury_observations": str(usage["all_injury_observations"]),
            "restricted_target_observations": str(usage["restricted_target_observations"]),
            "select_observations": str(usage["select_observations"]),
            "duplicate_observations": str(usage["duplicate_observations"]),
            "hold_observations": str(usage["hold_observations"]),
            "evidence": str(link.get("evidence", "")),
            "ledger_locator": f"source-family-decision-ledger-2026-07-27.json family={link['family_key']}; studyId={study_id}",
        })
    write_csv(OUT / "historical-family-links.csv", family_rows, list(family_rows[0]))

    unresolved = []
    for group in sorted({row["overlap_group"] for row in scope.values() if row["overlap_status"] == "possible_parent_granular_overlap_unresolved"}):
        rows = [row for row in scope.values() if row["overlap_group"] == group]
        parent_id = next(row["sourceDataRow"] for row in rows if row["row_role"] == "parent")
        child_ids = {row["sourceDataRow"] for row in rows if row["row_role"] == "granular"}
        parent_counts = Counter(row["selection"] for row in selection_rows if row["source_locator"].endswith("sourceDataRow=" + parent_id))
        child_counts = Counter(
            row["selection"] for child_id in child_ids for row in selection_rows
            if row["source_locator"].endswith("sourceDataRow=" + child_id)
        )
        unresolved.append({
            "unresolved_group": group,
            "paper_id": rows[0]["paper_id"],
            "source_rows": ";".join(row["sourceDataRow"] for row in rows),
            "named_populations": ";".join(row["population_label"] for row in rows),
            "selection_policy": "retain a source-supported parent; hold only a competing child with the same final target; select a supported child with no parent counterpart",
            "parent_selection_counts": json.dumps(dict(sorted(parent_counts.items()))),
            "child_selection_counts": json.dumps(dict(sorted(child_counts.items()))),
            "remaining_source_question": "Confirm mutual exclusivity only if a later analysis needs the parent and competing child representations together.",
            "owner": "source-alignment reviewer if simultaneous parent/child use is proposed",
            "evidence": rows[0]["evidence"],
        })
    write_csv(OUT / "unresolved-overlap-groups.csv", unresolved, list(unresolved[0]))

    partition_rows = []
    for group, relation in sorted(partitions.items()):
        parent = str(relation["parent"])
        children = list(relation["children"])
        map_rows = [scope[parent], *(scope[child] for child in children)]
        parent_records = observations_by_source[parent]
        parent_ids = {row["observation_id"] for row in parent_records}
        duplicated = [row for row in selection_rows if row["selection"] == "duplicate" and row["observation_id"] in parent_ids]
        retained_parent = [row for row in selection_rows if row["selection"] == "select" and row["observation_id"] in parent_ids]
        partition_rows.append({
            "partition_group": group,
            "paper_id": scope[parent]["paper_id"],
            "parent_source_row": parent,
            "parent_population": scope[parent]["population_label"],
            "child_source_rows": ";".join(children),
            "child_populations": ";".join(scope[child]["population_label"] for child in children),
            "named_period_evidence": ";".join(sorted({
                row["dataCollectionPeriod"] or row["numberOfSeasons"] or "period_not_reported" for row in parent_records
            })),
            "source_quantity_evidence": scope[parent]["evidence"],
            "parent_observations": str(len(parent_records)),
            "parent_duplicate_observations": str(len(duplicated)),
            "parent_selected_for_unrepresented_target": str(len(retained_parent)),
            "selection_rule": "suppress parent only with complete named child final-target coverage and alignment-supported replacements; retain a supported parent when any replacement is absent, held or incompatible",
        })
    write_csv(OUT / "verified-named-partitions.csv", partition_rows, list(partition_rows[0]))

    selection_by_id = {row["observation_id"]: row for row in selection_rows}
    quantitative_pair_rows = []
    for parent_id, pairs in sorted(matched_pairs.items()):
        action = pair_actions.get(parent_id, {})
        if action.get("mode") not in {"select_quantitative_parent", "hold_quantitative_parent_scope_unverified"}:
            continue
        parent = master_by_id[parent_id]
        parent_alignment = alignment_by_id[parent_id]
        for pair in pairs:
            detailed_id = pair["detailed_observation_id"]
            detailed = master_by_id[detailed_id]
            detailed_alignment = alignment_by_id[detailed_id]
            quantitative_pair_rows.append({
                "parent_observation_id": parent_id,
                "detailed_observation_id": detailed_id,
                "parent_source_row": parent["sourceDataRow"],
                "paper_id": parent["paper_id"],
                "metric": parent["metric"],
                "setting": parent["setting"],
                "parent_numerical_route": numerical_route(parent),
                "parent_reverse_exposure_supported": parent_alignment.get("reverse_exposure_supported", "false"),
                "parent_alignment_status": parent_alignment["metric_alignment_status"],
                "detailed_numerical_route": numerical_route(detailed),
                "detailed_reverse_exposure_supported": detailed_alignment.get("reverse_exposure_supported", "false"),
                "detailed_alignment_status": detailed_alignment["metric_alignment_status"],
                "parent_selection": selection_by_id[parent_id]["selection"],
                "detailed_selection": selection_by_id[detailed_id]["selection"],
                "selection_rule": action["mode"],
                "pair_review_locator": "matching-overall-category-adjudication.csv parent=" + parent_id + "; detailed=" + detailed_id,
                "evidence": pair["evidence"],
            })
    write_csv(
        OUT / "quantitative-pair-coverage-review.csv",
        quantitative_pair_rows,
        list(quantitative_pair_rows[0]),
    )

    counts = Counter(row["selection"] for row in selection_rows)
    selection_by_id = {row["observation_id"]: row for row in selection_rows}
    assert sum(counts.values()) == 3211
    assert set(counts).issubset({"select", "duplicate", "hold"})
    assert len(family_rows) == 28
    assert all(row["analysis_target"].split("|")[1] in {"overall", "match", "training"} for row in selection_rows)
    duplicate_rows = [row for row in selection_rows if row["selection"] == "duplicate"]
    assert all(row["duplicate_of"] for row in duplicate_rows)

    def pair_action_is_consistent(observation_id: str, action: dict[str, str]) -> bool:
        record = selection_by_id[observation_id]
        if action["mode"] == "duplicate":
            return record["selection"] == "duplicate"
        if action["mode"] == "select_quantitative_parent":
            return (
                record["selection"] == "select"
                and all(selection_by_id[detailed_id]["selection"] == "duplicate" for detailed_id in action["details"].split(";"))
            ) or (
                record["selection"] == "duplicate"
                and partition_actions.get(observation_id, {}).get("mode") == "parent_duplicate_complete_aligned_child_coverage"
            )
        if action["mode"] == "hold_quantitative_parent_scope_unverified":
            return record["selection"] == "hold"
        if action["mode"] == "duplicate_of_quantitative_parent":
            parent_partition = partition_actions.get(action["parent"], {})
            expected_duplicate_of = (
                parent_partition["matches"]
                if parent_partition.get("mode") == "parent_duplicate_complete_aligned_child_coverage"
                else action["parent"]
            )
            return record["selection"] == "duplicate" and record["duplicate_of"] == expected_duplicate_of
        return True

    checks = {
        "unique_observation_ids": len({row["observation_id"] for row in selection_rows}) == 3211,
        "every_working_master_observation_has_one_selection": len(selection_rows) == 3211,
        "selection_values_are_contract_values": set(counts).issubset({"select", "duplicate", "hold"}),
        "every_duplicate_has_a_link": all(row["duplicate_of"] for row in duplicate_rows),
        "alignment_hash_matches_validation": alignment_validation["csv_sha256"] == sha256(ALIGNMENT),
        "every_selected_observation_is_alignment_supported": all(
            supported(alignment_by_id[row["observation_id"]]) for row in selection_rows if row["selection"] == "select"
        ),
        "unresolved_groups_do_not_receive_blanket_holds": all(
            any(row["selection"] == "select" for row in selection_rows if row["source_locator"].endswith("sourceDataRow=" + str(relation["parent"])))
            for relation in unresolved_groups.values()
        ),
        "overall_match_training_targets_are_distinct": all(row["analysis_target"].split("|")[1] in {"overall", "match", "training"} for row in selection_rows),
        "s604_overall_and_match_are_not_independent_inputs": (
            selection_by_id[S604_OVERALL_ID]["selection"] == "duplicate"
            and selection_by_id[S604_OVERALL_ID]["duplicate_of"] == S604_MATCH_ID
            and selection_by_id[S604_MATCH_ID]["selection"] == "select"
        ),
        "historical_studies_have_exact_links": len(family_rows) == 28,
        "parent_duplicates_have_complete_aligned_child_target_coverage": all(
            action["mode"] == "parent_duplicate_complete_aligned_child_coverage"
            for observation_id, action in partition_actions.items()
            if master_by_id[observation_id]["sourceDataRow"] == action["parent"]
            and selection_by_id[observation_id]["selection"] == "duplicate"
        ),
        "matched_pair_representations_preserve_quantitative_coverage": all(
            pair_action_is_consistent(observation_id, action) for observation_id, action in pair_actions.items()
        ),
        "nested_subset_duplicates_have_target_matched_anchor": all(
            bool(anchor_by_target.get(("S076", m["metric"], m["setting"], m["outcome_target"]), []))
            for row in selection_rows if row["selection"] == "duplicate"
            for m in [master_by_id[row["observation_id"]]]
            if m["source_study_id"] == "S1431"
        ),
    }
    (OUT / "checks.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
    summary = {
        "status": "overlap_representation_selection_with_final_alignment_guard_pending_model_selection",
        "date": str(date.today()),
        "input": {
            "master": str(master_path.relative_to(ROOT)),
            "master_sha256": sha256(master_path),
            "scope_map": str(SCOPE_MAP.relative_to(ROOT)),
            "scope_map_sha256": sha256(SCOPE_MAP),
            "historical_ledger": str(LEDGER),
            "historical_ledger_sha256": sha256(LEDGER),
            "alignment_decisions": str(ALIGNMENT.relative_to(ROOT)),
            "alignment_decisions_sha256": sha256(ALIGNMENT),
            "alignment_validation": str(ALIGNMENT_VALIDATION.relative_to(ROOT)),
            "alignment_validation_sha256": sha256(ALIGNMENT_VALIDATION),
            "matching_pair_review": str(PAIR_REVIEW.relative_to(ROOT)),
            "matching_pair_review_sha256": sha256(PAIR_REVIEW),
        },
        "observations": len(selection_rows),
        "selection_counts": dict(sorted(counts.items())),
        "verified_named_numerical_partition_source_rows": sum(1 for row in scope.values() if row["overlap_status"] == "verified_exhaustive_numerical_partition"),
        "unresolved_parent_granular_groups": len(unresolved),
        "unresolved_parent_granular_observations": sum(
            1 for row in selection_rows if row["overlap_status"] == "possible_parent_granular_overlap_unresolved"
        ),
        "unresolved_group_selection_counts": dict(Counter(
            row["selection"] for row in selection_rows if row["overlap_status"] == "possible_parent_granular_overlap_unresolved"
        )),
        "historical_family_studies_in_working_master": len(family_rows),
        "matched_pair_parent_duplicates": sum(
            1 for observation_id, action in pair_actions.items()
            if action["mode"] == "duplicate" and selection_by_id[observation_id]["selection"] == "duplicate"
        ),
        "quantitative_matched_pair_coverage_links": len(quantitative_pair_rows),
        "quantitative_matched_pair_coverage_parents": len({row["parent_observation_id"] for row in quantitative_pair_rows}),
        "key_rules": [
            "Numerical equality of observed outcome rates is not evidence of independence or a restricted outcome scope.",
            "A parent is suppressed only when every named child has the same final target and is alignment-supported, with a compatible quantitative route when the parent is quantitative.",
            "A matching descriptor-rich alias cannot replace a source count/hour or days/hour representation unless it has compatible quantitative coverage.",
            "Overall combined, match and training remain separate analysis targets and must not enter the same pooled likelihood as interchangeable components.",
            "A no-overlap finding is limited to available evidence and does not prove cross-paper independence.",
        ],
        "model_fitted": False,
        "source_files_modified": False,
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (OUT / "README.md").write_text(
        "# Overlap representation selection\n\n"
        "`observation-selection.csv` assigns one `select`, `duplicate` or `hold` decision to every one of the 3,211 working-master observations. "
        "It resolves representation overlap and applies the final source-alignment gate. Likelihood choice and final model selection remain separate.\n\n"
        f"The selection contains {counts['select']} selects, {counts['duplicate']} duplicates and {counts['hold']} holds. "
        "Holds cover specific alignment gaps, unresolved competing parent/child representations and unverified matching parent/category pairs.\n\n"
        "`verified-named-partitions.csv` records the ten source-row partitions accepted only where the prior review verified three or more quantity fields. "
        "Its parent is a duplicate only when every named child has the exact final target and alignment support.\n\n"
        "`historical-family-links.csv` has the 28 study IDs from the historical source-family ledger that occur in this working master. "
        "It records each anchor, nested subset or separate family without treating a specialist outcome as a duplicate solely because its cohort overlaps an all-injury anchor.\n\n"
        "The `analysis_target` and `setting_handling` columns keep overall combined, match and training results as distinct targets. "
        "A later likelihood must not pool an overall combined result with its match/training components as interchangeable evidence.\n\n"
        "`quantitative-pair-coverage-review.csv` records every matching parent/detail pair where retaining source sampling information affected the representation decision.\n\n"
        "`checks.json` records contract and selection checks. `summary.json` records exact input hashes, including the alignment decision file. No source file changed and no model was fitted.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
