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
const outputPath = path.join(presentationRoot, 'slides', 'generated', 'publicationTimelineData.ts');
const publicationYearOverrides = new Map([
  [
    'S541',
    '2024',
  ],
]);

const pythonScript = `
import csv
import json
import sys

path = sys.argv[1]
with open(path, newline='', encoding='utf-8-sig') as handle:
    rows = []
    for row in csv.DictReader(handle):
        rows.append({
            "paper_id": row.get("paper_id", ""),
            "yearOfPublication": row.get("yearOfPublication", ""),
            "yearOfPublication_standardized": row.get("yearOfPublication_standardized", ""),
        })

print(json.dumps(rows))
`;

const rows = JSON.parse(
  execFileSync('python3', ['-c', pythonScript, masterCsvPath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }),
);

const papers = new Map();
for (const row of rows) {
  const paperId = (row.paper_id || '').trim();
  if (!paperId || papers.has(paperId)) {
    continue;
  }
  const year = (
    publicationYearOverrides.get(paperId)
    || row.yearOfPublication_standardized
    || row.yearOfPublication
    || ''
  ).trim();
  papers.set(paperId, year);
}

const yearCounts = new Map();
for (const year of papers.values()) {
  if (!/^\d{4}$/.test(year)) {
    continue;
  }
  yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
}

const years = Array.from(yearCounts.keys()).map(Number).sort((a, b) => a - b);
const earliestYear = years[0];
const latestYear = years[years.length - 1];
const timelineData = [];
for (let year = earliestYear; year <= latestYear; year += 1) {
  timelineData.push({
    year,
    count: yearCounts.get(String(year)) ?? 0,
  });
}
const pre2005Count = years.filter((year) => year < 2005).reduce((sum, year) => sum + (yearCounts.get(String(year)) ?? 0), 0);
const totalPapers = papers.size;
const papersSince2020 = years
  .filter((year) => year >= 2020)
  .reduce((sum, year) => sum + (yearCounts.get(String(year)) ?? 0), 0);

const file = `export const publicationTimelineData = ${JSON.stringify(timelineData, null, 2)} as const;

export const publicationTimelineMeta = {
  totalPapers: ${totalPapers},
  pre2005Count: ${pre2005Count},
  papersSince2020: ${papersSince2020},
  earliestYear: ${earliestYear},
  latestYear: ${latestYear},
  source: ${JSON.stringify(masterCsvPath)},
} as const;
`;

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, file);
console.log(`output=${outputPath}`);
