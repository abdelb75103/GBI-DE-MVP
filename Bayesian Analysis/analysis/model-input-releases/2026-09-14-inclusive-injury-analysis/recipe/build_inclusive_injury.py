"""Apply the approved source-defined time-loss rule without dropping records."""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'analysis/model-input-releases/2026-09-14-selected-injury-inputs'
WORDS = {'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7'}
OLD_DECISIONS = {
    'analysis_route', 'primary_model_eligible', 'sensitivity_definition',
    'sensitivity_estimated_exposure', 'sensitivity_rounded_reconstruction',
    'threshold_analysis_route', 'main_scientific_input_selected', 'model_readiness',
}


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, rows):
    fields = list(rows[0])
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def threshold_details(text):
    """Read durations only from definition wording, never severity categories."""
    clean = text.lower().replace('−', '-').replace('–', '-')
    if 'physical complaint' in clean and re.search(r'or\s+time[- ]loss', clean):
        return '', '', '', 'Mixed complaint/time-loss definition; the complaint duration must not be treated as the time-loss threshold.'
    for word, value in WORDS.items():
        clean = re.sub(r'\b' + word + r'\b', value, clean)
    clean = re.sub(r'\bat least a week\b', 'at least 1 week', clean)
    found = re.search(r'(?P<op>>=|≥|>|at least\s*|more than\s*|over\s*)?\s*(?P<n>\d+(?:\.\d+)?)\s*(?P<unit>days?|hours?|hrs?|h\b|weeks?)', clean)
    if not found:
        return '', '', '', ''
    value = Decimal(found['n'])
    unit = found['unit']
    days = value / 24 if unit.startswith(('h', 'hr')) else value * 7 if unit.startswith('week') else value
    op = (found['op'] or '').strip()
    operator = '>=' if op in ('>=', '≥', 'at least') else '>' if op in ('>', 'more than', 'over') else 'unspecified'
    return format(days.normalize(), 'f'), operator, found.group(0).strip(), ''


def build(source, output):
    if (output / 'FROZEN.json').exists():
        raise ValueError('Choose a new output release; this release is frozen')
    original = read(source / 'injury-all-reviewed-observations.csv')
    context_rows = read(source / 'analysis-source-context.csv')
    context = {r['sourceDataRow']: r for r in context_rows}
    assert len(context) == len(context_rows)
    ids = {r['observation_id'] for r in original}
    assert len(ids) == len(original)
    result = []
    for old in original:
        descriptions = [old.get('injuryDefinitionDescription', ''), old.get('time_loss_definition', '')]
        description = max(descriptions, key=len)
        days, operator, threshold_text, mixed_note = threshold_details(description)
        restrictive = bool(days and (Decimal(days) > 1 or (Decimal(days) == 1 and operator == '>')))
        supported = old['alignment_decision'] == 'supported'
        preferred = old['overlap_selection'] == 'select'
        duplicate = old['overlap_selection'] == 'duplicate'
        eligible = supported and preferred
        notes = []
        if restrictive:
            notes.append('Longer minimum absence excludes shorter injuries and may lower incidence or change the severity mix; retain for primary analysis and review manually.')
        if mixed_note:
            notes.append(mixed_note)
        if not supported:
            notes.append('Source confirmation needed: ' + old['alignment_reason'])
        if old['overlap_selection'] == 'hold':
            notes.append('Representation/source review: ' + old['overlap_reason'])
        if old.get('prefit_gate'):
            notes.append(old['prefit_gate'])
        if duplicate:
            notes.append('Alternative representation retained; do not count alongside the linked selected representation.')
        manual = restrictive or bool(mixed_note) or not supported or old['overlap_selection'] == 'hold' or bool(old.get('prefit_gate'))
        sampling = old['sampling_information_route']
        if sampling.startswith('descriptive'):
            sampling = 'reported_rate_without_reported_sampling_uncertainty'
        row = {
            'observation_id': old['observation_id'],
            'paper_id': old['paper_id'],
            'source_study_id': old['source_study_id'],
            'paper_title': old['paper_title'],
            'population_label': old['population_label'],
            'metric': old['metric'],
            'setting': old['setting'],
            'outcome_scope': old['outcome_scope'],
            'injury_definition': 'Time loss' if supported else old['injuryDefinition'],
            'injury_definition_description': description,
            'definition_threshold_status': 'mixed_definition_duration_applies_to_complaints' if mixed_note else 'explicit_duration' if days else old['time_loss_threshold'] if old['time_loss_threshold'] in ('positive_days', 'at_least_one_day_excluding_injury_day_source_verified') else 'duration_not_specified',
            'definition_threshold_note': mixed_note or ('Duration not specified in the extracted definition; retained under the approved source-defined time-loss rule.' if not days and old['time_loss_threshold'] not in ('positive_days', 'at_least_one_day_excluding_injury_day_source_verified') else ''),
            'definition_evidence_field': 'injuryDefinitionDescription' if description == descriptions[0] else 'time_loss_definition',
            'minimum_absence_days_from_definition': days,
            'minimum_absence_operator': operator,
            'minimum_absence_definition_text': threshold_text,
            'alternative_definition_review': 'true' if restrictive or mixed_note else 'false',
            'definition_review_priority': 'high' if days and Decimal(days) >= 7 else 'review' if restrictive or mixed_note else '',
            'analysis_eligible': 'true' if eligible else 'false',
            'source_time_loss_hours_supported': 'true' if supported else 'false',
            'preferred_representation': 'true' if preferred else 'false',
            'duplicate_representation': 'true' if duplicate else 'false',
            'manual_review_required': 'true' if manual else 'false',
            'manual_review_notes': ' | '.join(notes),
            'model_input_kind': sampling,
            'model_specification_status': 'Likelihood and target-specific dependence must be specified before fitting.',
        }
        for key, value in old.items():
            dest = 'previous_' + key if key in OLD_DECISIONS else key
            if dest not in row:
                row[dest] = value
        for key, value in context[old['sourceDataRow']].items():
            row['source_record__' + key] = value
        result.append(row)
    assert {r['observation_id'] for r in result} == ids
    output.mkdir(parents=True, exist_ok=True)
    write(output / 'injury-analysis.csv', result)
    eligible_rows = [r for r in result if r['analysis_eligible'] == 'true']
    summary = {
        'rule': 'Source-defined time-loss injury with compatible player-hours; alternative thresholds and rate-only evidence remain eligible.',
        'csv': 'injury-analysis.csv', 'rows': len(result), 'papers': len({r['paper_id'] for r in result}),
        'source_population_rows': len(context), 'columns': len(result[0]),
        'eligible_rows': len(eligible_rows), 'eligible_papers': len({r['paper_id'] for r in eligible_rows}),
        'eligible_source_population_rows': len({r['sourceDataRow'] for r in eligible_rows}),
        'metrics_all': dict(Counter(r['metric'] for r in result)),
        'metrics_eligible': dict(Counter(r['metric'] for r in eligible_rows)),
        'eligible_model_input_kinds': dict(Counter(r['model_input_kind'] for r in eligible_rows)),
        'alternative_definition_review_rows': sum(r['alternative_definition_review'] == 'true' for r in result),
        'alternative_definition_review_papers': len({r['paper_id'] for r in result if r['alternative_definition_review'] == 'true'}),
        'seven_day_or_longer_definition_rows': sum(bool(r['minimum_absence_days_from_definition']) and Decimal(r['minimum_absence_days_from_definition']) >= 7 for r in result),
        'no_rows_dropped': True, 'numeric_values_changed': False, 'model_fitted': False,
        'source_hashes': {p.name: sha(p) for p in [source/'injury-all-reviewed-observations.csv', source/'analysis-source-context.csv']},
        'csv_sha256': sha(output/'injury-analysis.csv'),
    }
    (output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.source, args.output), indent=2))
