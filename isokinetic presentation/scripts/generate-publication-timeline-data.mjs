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
const outputPathV2 = path.join(presentationRoot, 'slides', 'generated', 'publicationTimelineDataV2.ts');
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
            "status": row.get("status", ""),
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
  if (!paperId) {
    continue;
  }
  const year = (
    publicationYearOverrides.get(paperId)
    || row.yearOfPublication_standardized
    || row.yearOfPublication
    || ''
  ).trim();
  const status = (row.status || '').trim();
  const existing = papers.get(paperId);
  if (!existing) {
    papers.set(paperId, {
      year,
      statuses: new Set(status ? [status] : []),
    });
    continue;
  }
  if (!existing.year && year) {
    existing.year = year;
  }
  if (status) {
    existing.statuses.add(status);
  }
}

function buildTimelineDataset(paperEntries, excludedStatuses = []) {
  const excluded = new Set(excludedStatuses);
  const filteredEntries = paperEntries.filter(({statuses}) =>
    !Array.from(statuses).some((status) => excluded.has(status)),
  );

  const yearCounts = new Map();
  for (const {year} of filteredEntries) {
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

  const pre2005Count = years
    .filter((year) => year < 2005)
    .reduce((sum, year) => sum + (yearCounts.get(String(year)) ?? 0), 0);
  const papersSince2020 = years
    .filter((year) => year >= 2020)
    .reduce((sum, year) => sum + (yearCounts.get(String(year)) ?? 0), 0);

  return {
    timelineData,
    meta: {
      totalPapers: filteredEntries.length,
      pre2005Count,
      papersSince2020,
      earliestYear,
      latestYear,
      excludedStatuses,
      source: masterCsvPath,
    },
  };
}

function toFile(dataExportName, metaExportName, dataset) {
  return `export const ${dataExportName} = ${JSON.stringify(dataset.timelineData, null, 2)} as const;

export const ${metaExportName} = {
  totalPapers: ${dataset.meta.totalPapers},
  pre2005Count: ${dataset.meta.pre2005Count},
  papersSince2020: ${dataset.meta.papersSince2020},
  earliestYear: ${dataset.meta.earliestYear},
  latestYear: ${dataset.meta.latestYear},
  excludedStatuses: ${JSON.stringify(dataset.meta.excludedStatuses)},
  source: ${JSON.stringify(dataset.meta.source)},
} as const;
`;
}

const paperEntries = Array.from(papers.values());
const fullDataset = buildTimelineDataset(paperEntries);
const filteredDataset = buildTimelineDataset(paperEntries, ['american_data', 'uefa']);

const file = toFile('publicationTimelineData', 'publicationTimelineMeta', fullDataset);
const fileV2 = toFile('publicationTimelineDataV2', 'publicationTimelineMetaV2', filteredDataset);

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, file);
fs.writeFileSync(outputPathV2, fileV2);
console.log(`output=${outputPath}`);
console.log(`output=${outputPathV2}`);
