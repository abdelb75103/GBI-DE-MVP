"""Extract the approved eligible rows without changing any retained cells."""
import csv, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'analysis/model-input-releases/2026-09-14-inclusive-injury-analysis/injury-analysis.csv'
out = ROOT / 'analysis/model-input-releases/2026-09-14-authoritative-injury-analysis'
if (out/'FROZEN.json').exists():
    raise SystemExit('Release already frozen')
out.mkdir(parents=True, exist_ok=True)
with source.open(newline='',encoding='utf-8') as f:
    reader=csv.DictReader(f); fields=reader.fieldnames; rows=list(reader)
selected=[r for r in rows if r['analysis_eligible']=='true']
assert len(selected)==2219 and len({r['paper_id'] for r in selected})==220
assert len({r['observation_id'] for r in selected})==2219
with (out/'injury-analysis.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(selected)
with (out/'injury-analysis.csv').open(newline='',encoding='utf-8') as f:
    assert list(csv.DictReader(f))==selected
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
(out/'validation.json').write_text(json.dumps({'rows':2219,'papers':220,'incidence':sum(r['metric']=='incidence' for r in selected),'burden':sum(r['metric']=='burden' for r in selected),'columns':len(fields),'all_selected_cells_equal_audit_source':True,'audit_source_sha256':sha(source),'csv_sha256':sha(out/'injury-analysis.csv')},indent=2)+'\n')
print((out/'validation.json').read_text())
