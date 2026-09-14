"""Verify the inclusive export against the retained frozen candidate evidence."""
import csv
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / 'analysis/model-input-releases/2026-09-14-selected-injury-inputs'
RELEASE = ROOT / 'analysis/model-input-releases/2026-09-14-inclusive-injury-analysis'
CODE = ROOT / 'analysis/standardisation-tools/build_inclusive_injury.py'


def rows(path):
    with path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        result = list(reader)
        assert len(reader.fieldnames) == len(set(reader.fieldnames)), 'Duplicate headers'
        return result


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


spec = importlib.util.spec_from_file_location('inclusive_exporter', CODE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
old = rows(SOURCE / 'injury-all-reviewed-observations.csv')
new = rows(RELEASE / 'injury-analysis.csv')
context = {r['sourceDataRow']: r for r in rows(SOURCE / 'analysis-source-context.csv')}
assert len(old) == len(new) == 3211
assert [r['observation_id'] for r in old] == [r['observation_id'] for r in new]
assert len({r['observation_id'] for r in new}) == len(new)
checked_original = checked_context = zeros = blanks = 0
for before, after in zip(old, new):
    for key, value in before.items():
        dest = 'previous_' + key if key in module.OLD_DECISIONS else key
        assert after[dest] == value, (before['observation_id'], key)
        checked_original += 1
        zeros += value == '0'
        blanks += value == ''
    for key, value in context[before['sourceDataRow']].items():
        assert after['source_record__' + key] == value, (before['observation_id'], key)
        checked_context += 1
    assert (after['analysis_eligible'] == 'true') == (before['alignment_decision'] == 'supported' and before['overlap_selection'] == 'select')
    assert (after['duplicate_representation'] == 'true') == (before['overlap_selection'] == 'duplicate')
    assert after['model_specification_status'] == 'Likelihood and target-specific dependence must be specified before fitting.'
    if after['duplicate_representation'] == 'true':
        assert after['analysis_eligible'] == 'false'
        assert after['overlap_reason'] and after['manual_review_notes']
        assert after['duplicate_of'] and after['selected_parent_id']
        assert all(target in {r['observation_id'] for r in new} for target in after['duplicate_of'].split(';'))
    if after['source_time_loss_hours_supported'] == 'false':
        assert after['manual_review_required'] == 'true'
        assert after['alignment_reason'] in after['manual_review_notes']
    if after['minimum_absence_days_from_definition'] and float(after['minimum_absence_days_from_definition']) >= 7:
        assert after['alternative_definition_review'] == 'true'
        assert after['definition_review_priority'] == 'high'
        assert after['manual_review_required'] == 'true'
    assert after['definition_threshold_status']
    assert after['injury_definition_description'] == before[after['definition_evidence_field']]
    if after['definition_threshold_status'] == 'duration_not_specified':
        assert after['minimum_absence_days_from_definition'] == ''
        assert 'Duration not specified' in after['definition_threshold_note']
    if after['prefit_gate']:
        assert after['prefit_gate'] in after['manual_review_notes']
eligible = [r for r in new if r['analysis_eligible'] == 'true']
assert len(eligible) == 2219 and len({r['paper_id'] for r in eligible}) == 220
assert sum(r['model_input_kind'] == 'reported_rate_without_reported_sampling_uncertainty' for r in eligible) == 1506
replay = HERE / 'replay'
module.build(SOURCE, replay)
assert (replay / 'injury-analysis.csv').read_bytes() == (RELEASE / 'injury-analysis.csv').read_bytes()
assert (replay / 'summary.json').read_bytes() == (RELEASE / 'summary.json').read_bytes()
report = {
    'status': 'technical_checks_passed',
    'retained_rows': len(new), 'retained_papers': len({r['paper_id'] for r in new}),
    'eligible_rows': len(eligible), 'eligible_papers': len({r['paper_id'] for r in eligible}),
    'original_cells_checked': checked_original, 'source_context_cells_checked': checked_context,
    'original_blank_cells_preserved': blanks, 'original_literal_zero_cells_preserved': zeros,
    'byte_identical_csv_and_summary_replay': True,
    'hashes': {str(p.relative_to(ROOT)): sha(p) for p in [CODE, RELEASE/'injury-analysis.csv', RELEASE/'summary.json', SOURCE/'injury-all-reviewed-observations.csv', SOURCE/'analysis-source-context.csv']},
}
(HERE / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
