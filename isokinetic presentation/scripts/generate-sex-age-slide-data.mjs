import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const presentationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(presentationRoot, '..');
const masterCsvPath = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'outputs',
  'master',
  'master-analysis-sheet.csv',
);
const outputPath = path.join(presentationRoot, 'slides', 'generated', 'sexAgeSlideData.ts');

const pythonScript = `
import csv
import json
import sys
from collections import defaultdict

path = sys.argv[1]

with open(path, newline='', encoding='utf-8-sig') as handle:
    rows = list(csv.DictReader(handle))

by_paper = defaultdict(list)
for row in rows:
    paper_id = (row.get('paper_id') or '').strip()
    if paper_id:
        by_paper[paper_id].append(row)

def age_bucket(value):
    s = (value or '').strip().lower().replace('–', '-').replace('—', '-')
    if not s:
        return None
    if s == 'adult':
        return 'adult'
    if s == 'youth':
        return 'youth'
    if s == 'mixed_age':
        return 'mixed_age'
    if s == 'unclear':
        return 'unclear'
    if 'senior and youth' in s or ('senior' in s and 'youth' in s):
        return 'mixed_age'
    if any(token in s for token in ['college', 'collegiate', 'ncaa', 'university']):
        return 'adult'
    if any(
        token in s
        for token in [
            'high school', 'schoolboy', 'school boy', 'schoolgirl', 'school girl', 'adolescent',
            'youth', 'junior', 'u-', 'under-', 'under ', 'academy', 'teen', 'teenage',
            'u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u19', 'u20', 'u21', 'u23',
        ]
    ):
        return 'youth'
    if any(token in s for token in ['senior', 'adult', 'professional', 'elite', 'first team']):
        return 'adult'
    return 'unclear'

def sexes(value):
    s = (value or '').strip().lower()
    out = []
    if 'male' in s:
        out.append('male')
    if 'female' in s:
        out.append('female')
    if not out and s == 'unclear':
        out.append('unclear')
    return out

def resolve_combos(rows_for_group):
    combos_by_sex = defaultdict(set)
    for row in rows_for_group:
        sex_values = sexes(row.get('sex_standardized') or '')
        age = age_bucket(row.get('ageCategory_standardized') or row.get('ageCategory') or '')
        for sex in sex_values:
            combos_by_sex[sex].add(age or 'unclear')

    cleaned = set()
    for sex, ages in combos_by_sex.items():
        specific = {age for age in ages if age != 'unclear'}
        use = specific if specific else ({'unclear'} if ages else set())
        for age in use:
            if age == 'mixed_age':
                cleaned.add((sex, 'youth'))
                cleaned.add((sex, 'adult'))
            else:
                cleaned.add((sex, age))
    return cleaned

collapse_statuses = {'american_data', 'uefa', 'fifa_data', 'aspetar_asprev'}
status_rows = defaultdict(list)
resolved_units = []

for paper_id, paper_rows in by_paper.items():
    status = (paper_rows[0].get('status') or '').strip()
    if status in collapse_statuses:
        status_rows[status].extend(paper_rows)
    else:
        resolved_units.extend(resolve_combos(paper_rows))

for status, rows_for_status in status_rows.items():
    resolved_units.extend(resolve_combos(rows_for_status))

bucket_counts = {
    "Adult men's cohorts": 0,
    "Adult women's cohorts": 0,
    "Boys' youth cohorts": 0,
    "Girls' youth cohorts": 0,
}
hidden_remainder = 0

for sex, age in resolved_units:
    if age == 'youth' and sex == 'male':
        bucket_counts["Boys' youth cohorts"] += 1
    elif age == 'youth' and sex == 'female':
        bucket_counts["Girls' youth cohorts"] += 1
    elif age == 'adult' and sex == 'male':
        bucket_counts["Adult men's cohorts"] += 1
    elif age == 'adult' and sex == 'female':
        bucket_counts["Adult women's cohorts"] += 1
    else:
        hidden_remainder += 1

result = {
    "totalPapers": len(by_paper),
    "totalPopulationUnits": len(resolved_units),
    "segments": [
        {"label": "Adult men's cohorts", "count": bucket_counts["Adult men's cohorts"]},
        {"label": "Adult women's cohorts", "count": bucket_counts["Adult women's cohorts"]},
        {"label": "Boys' youth cohorts", "count": bucket_counts["Boys' youth cohorts"]},
        {"label": "Girls' youth cohorts", "count": bucket_counts["Girls' youth cohorts"]},
    ],
    "hiddenRemainderCount": hidden_remainder,
    "method": "unique sex-age population units using ageCategory_standardized where available; surveillance programs collapsed; collegiate counted as adult; mixed-age split across youth and adult; unclear retained in denominator",
}

print(json.dumps(result))
`;

const result = JSON.parse(
  execFileSync('python3', ['-c', pythonScript, masterCsvPath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }),
);

const segments = result.segments.map((segment) => ({
  ...segment,
  percent: Number(((segment.count / result.totalPopulationUnits) * 100).toFixed(1)),
}));

const hiddenRemainderPct = Number(
  ((result.hiddenRemainderCount / result.totalPopulationUnits) * 100).toFixed(1),
);

const file = `export const sexAgeSlideData = ${JSON.stringify(segments, null, 2)} as const;

export const sexAgeSlideMeta = {
  totalPapers: ${result.totalPapers},
  totalPopulationUnits: ${result.totalPopulationUnits},
  hiddenRemainderCount: ${result.hiddenRemainderCount},
  hiddenRemainderPct: ${hiddenRemainderPct},
  source: ${JSON.stringify(masterCsvPath)},
  method: ${JSON.stringify(result.method)},
} as const;
`;

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, file);
console.log(`output=${outputPath}`);
