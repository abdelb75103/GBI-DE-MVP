"""Join reviewed evidence and overlap decisions into traceable analysis datasets."""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKING = ROOT / 'analysis/model-input-releases/2026-09-14-adjudicated-analysis'
REVIEW = ROOT / 'protocol-v2/final-input-verification-2026-09-14'


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, rows, fields):
    with path.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def number(value):
    try:
        n = Decimal(value)
        return n if n.is_finite() else None
    except (InvalidOperation, TypeError, ValueError):
        return None


def indexed(path, ids):
    rows = read(path)
    result = {r['observation_id']: r for r in rows}
    if len(result) != len(rows) or set(result) != ids:
        raise ValueError(f'{path.name}: decisions must cover each observation exactly once')
    return result


def numerical_route(row):
    exposure = number(row.get('exposure_player_hours', ''))
    quantity = number(row.get('injury_count' if row['metric'] == 'incidence' else 'days_lost', ''))
    if exposure is not None and exposure > 0 and quantity is not None and quantity >= 0:
        if row['metric'] == 'burden':
            return 'days_and_exposure'
        if quantity == quantity.to_integral_value():
            return 'count_and_exposure'
    rate = number(row['rate_per_1000_player_hours'])
    lo, hi = number(row['ci95_lower']), number(row['ci95_upper'])
    if rate is not None and rate >= 0 and lo is not None and hi is not None and 0 <= lo <= rate <= hi and lo < hi:
        return 'reported_rate_and_interval'
    return 'descriptive_rate_without_usable_sampling_information'


def build(out, working=WORKING, review=REVIEW):
    if (out/'FROZEN.json').exists():
        raise ValueError('Choose a new release')
    out.mkdir(parents=True, exist_ok=True)
    sources = [working/'injury-analysis-master.csv', review/'alignment/alignment-decisions.csv',
               review/'overlap/observation-selection.csv']
    master = read(sources[0]); ids = {r['observation_id'] for r in master}
    assert len(ids) == len(master)
    alignment, overlap = indexed(sources[1], ids), indexed(sources[2], ids)
    correction_path = review/'owner-metric-corrections.json'
    corrections = json.loads(correction_path.read_text()) if correction_path.exists() else {}
    if correction_path.exists():
        sources.append(correction_path)
    if not set(corrections).issubset(ids):
        raise ValueError('Metric correction refers to an unknown observation')
    results = []
    for original in master:
        r = dict(original); oid = r['observation_id']; a, o = alignment[oid], overlap[oid]
        r['candidate_injury_count'] = r['injury_count']
        r['candidate_source_count_field'] = r['source_count_field']
        r['metric_correction_reason'] = ''
        r['metric_correction_evidence'] = ''
        if oid in corrections:
            correction = corrections[oid]
            if r['injury_count'] != correction['injury_count_before']:
                raise ValueError(f'{oid}: correction baseline differs')
            r['injury_count'] = correction['injury_count']
            r['source_count_field'] = correction['source_count_field']
            r['metric_correction_reason'] = correction['reason']
            r['metric_correction_evidence'] = correction['evidence']
        rate = number(r['rate_per_1000_player_hours'])
        if rate is None or rate < 0:
            raise ValueError(f'{oid}: invalid candidate rate')
        assert a['threshold_route'] in ['main', 'sensitivity', 'hold']
        assert a['metric_alignment_status'] in ['supported', 'hold']
        assert o['selection'] in ['select', 'duplicate', 'hold']
        r['release_context_csv'] = 'analysis-source-context.csv'
        r['release_context_join_key'] = 'sourceDataRow'
        r['candidate_outcome_scope'] = r['outcome_scope']
        for field in ['injury_location', 'tissue_type', 'injury_diagnosis']:
            r['candidate_' + field] = r[field]
        r['candidate_review_flags'] = r.pop('review_flags')
        for dest, source in [('outcome_scope','outcome_scope'), ('injury_location','location'),
                             ('tissue_type','type'), ('injury_diagnosis','diagnosis')]:
            r[dest] = a.get(source, '')
        r['outcome_target'] = r['outcome_scope']
        for field in ['reported_rate_alignment', 'reported_time_loss_rate_per_1000',
                      'calculated_crude_count_rate_per_1000', 'published_rate_method', 'prefit_gate']:
            r[field] = a.get(field, '')
        r['alignment_decision'] = a['metric_alignment_status']
        r['alignment_reason'], r['alignment_evidence'] = a['reason'], a['evidence']
        r['threshold_analysis_route'] = a['threshold_route']
        r['overlap_selection'], r['overlap_family'] = o['selection'], o['overlap_family']
        r['overlap_reason'], r['overlap_evidence'] = o['reason'], o['evidence']
        r['selected_parent_id'], r['duplicate_of'] = o.get('parent_id', ''), o.get('duplicate_of','')
        r['sampling_information_route'] = numerical_route(r)
        r['reverse_exposure_supported'] = a.get('reverse_exposure_supported', 'false')
        r['reverse_exposure_evidence'] = a.get('reverse_exposure_evidence', '')
        if r['reverse_exposure_supported'] == 'true':
            count = number(r['injury_count'])
            if r['metric'] != 'incidence' or count is None or count <= 0 or count != count.to_integral_value() or rate <= 0:
                raise ValueError(f'{oid}: unsupported reverse-exposure arithmetic')
            if number(r['exposure_player_hours']) is None:
                r['inferred_exposure_player_hours'] = str(count * Decimal(1000) / rate)
                r['arithmetic_method'] = 'approximate_hours_from_matched_crude_reported_rate'
                r['rounding_assumption'] = 'Approximate point derivation from reported rate; original precision unverified; no rounding bounds claimed.'
                r['sampling_information_route'] = 'observed_count_and_approximate_inferred_exposure'
        r['analysis_target_key'] = '|'.join([r['metric'], r['setting'], r['outcome_scope'],
                                            r['injury_location'], r['tissue_type'], r['injury_diagnosis'],
                                            r.get('player_position',''), r.get('laterality','')])
        if o['selection'] == 'duplicate':
            disposition = 'duplicate_representation'
        elif a['metric_alignment_status'] == 'hold' or a['threshold_route'] == 'hold' or o['selection'] == 'hold':
            disposition = 'hold_for_specific_evidence_gap'
        elif r['sampling_information_route'].startswith('descriptive'):
            disposition = 'descriptive_only'
        else:
            disposition = a['threshold_route']
            if r.get('exposure_method_sensitivity_only') == 'true' or r['sampling_information_route'] == 'observed_count_and_approximate_inferred_exposure':
                disposition = 'sensitivity'
        r['analysis_route'] = disposition
        r['main_scientific_input_selected'] = 'true' if disposition == 'main' else 'false'
        r['primary_model_eligible'] = 'false'
        r['model_readiness'] = 'likelihood_and_target_selection_pending'
        r['sensitivity_rounded_reconstruction'] = 'true' if r['sampling_information_route'] == 'observed_count_and_approximate_inferred_exposure' else r.get('sensitivity_rounded_reconstruction', 'false')
        r['sensitivity_definition'] = 'true' if a['threshold_route'] == 'sensitivity' else 'false'
        r['descriptor_status'] = a.get('scope_alignment_status', 'reviewed_see_alignment_decision')
        r['scope_verification'] = 'reviewed_see_alignment_decision'
        r['metric_alignment_verification'] = a['metric_alignment_status']
        r['overlap_verification'] = o['selection']
        results.append(r)
    assert len(results) == len(ids)
    fields = list(dict.fromkeys(k for r in results for k in r))
    write(out/'injury-all-reviewed-observations.csv', results, fields)
    for status, filename in [('main','injury-main-analysis.csv'), ('sensitivity','injury-sensitivity-additions.csv'),
                             ('descriptive_only','injury-descriptive-only.csv'),
                             ('hold_for_specific_evidence_gap','injury-held-records.csv'),
                             ('duplicate_representation','injury-duplicate-representations.csv')]:
        write(out/filename, [r for r in results if r['analysis_route']==status], fields)
    coverage = defaultdict(list)
    for r in results:
        coverage[(r['analysis_route'], r['metric'], r['setting'], r['outcome_scope'], r['discipline'])].append(r)
    coverage_rows = [dict(zip(['analysis_route', 'metric', 'setting', 'outcome_scope', 'discipline'], key),
                          observations=len(rows), papers=len({r['paper_id'] for r in rows}),
                          source_rows=len({r['sourceDataRow'] for r in rows}))
                     for key, rows in sorted(coverage.items())]
    write(out/'coverage-by-target.csv', coverage_rows, list(coverage_rows[0]))
    summary = {'status':'selection_build_complete_model_specification_pending','observations':len(results),
               'dispositions':dict(Counter(r['analysis_route'] for r in results)),
               'papers_by_disposition':{s:len({r['paper_id'] for r in results if r['analysis_route']==s}) for s in sorted({r['analysis_route'] for r in results})},
               'sampling_routes':dict(Counter(r['sampling_information_route'] for r in results)),
               'selected_sampling_routes':dict(Counter(r['sampling_information_route'] for r in results if r['analysis_route'] in ['main','sensitivity'])),
               'input_hashes':{str(p):sha(p) for p in sources},'model_fitted':False,
               'independence_limit':'Separate target keys are not independent observations of one overall injury outcome. Model construction must respect cohort and target dependence.'}
    (out/'validation.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary


if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--working', type=Path, default=WORKING)
    parser.add_argument('--review', type=Path, default=REVIEW)
    args = parser.parse_args()
    print(json.dumps(build(args.output, args.working, args.review), indent=2))
