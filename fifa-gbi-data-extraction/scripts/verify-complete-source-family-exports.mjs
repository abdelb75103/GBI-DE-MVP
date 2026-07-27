import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const AUDIT_DIR = path.join(
  APP_ROOT,
  'data',
  'source-family-overlap-audit',
  '2026-07-27',
);
const TOURNAMENT_DIR = path.join(
  APP_ROOT,
  'data',
  'tournament-family-reconciliation',
  '2026-07-27',
);
const AUDIT_PATH = path.join(
  AUDIT_DIR,
  'analysis-and-source-export-live-verification-2026-07-27.json',
);

function argumentValues(name) {
  return process.argv.flatMap((value, index) => (
    value === name && process.argv[index + 1] ? [process.argv[index + 1]] : []
  ));
}

function resolveArgumentPath(value) {
  return path.resolve(process.cwd(), value);
}

for (const line of fs.readFileSync(path.join(APP_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sortedUnique(values) {
  return Array.from(new Set(values)).sort();
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  assert(!inQuotes, 'CSV line ends inside a quoted cell');
  cells.push(current);
  return cells;
}

function parseCsv(csv) {
  const lines = csv.split(/\r\n/).filter((line) => line.length > 0);
  const headers = parseCsvLine(lines[0].replace(/^\uFEFF/, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    assert(cells.length === headers.length, 'CSV row has a different column count from its header');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
  return { headers, rows };
}

function mergePapers(inputs) {
  const byStudyId = new Map();
  for (const input of inputs) {
    for (const paper of input.papers) {
      const existing = byStudyId.get(paper.studyId);
      if (existing) {
        const existingIncluded = existing.includeInAnalysisExport
          ?? existing.intendedTreatment?.includeInAnalysisExport;
        const paperIncluded = paper.includeInAnalysisExport
          ?? paper.intendedTreatment?.includeInAnalysisExport;
        assert(
          existingIncluded === paperIncluded,
          `${paper.studyId}: treatment inputs disagree about analysis inclusion`,
        );
      } else {
        byStudyId.set(paper.studyId, paper);
      }
    }
  }
  return [...byStudyId.values()];
}

function mergeRowPolicies(inputs) {
  const byStudyId = new Map();
  for (const input of inputs) {
    for (const paper of input.papers) {
      const existing = byStudyId.get(paper.studyId);
      if (existing) {
        assert(
          JSON.stringify(existing.rows) === JSON.stringify(paper.rows),
          `${paper.studyId}: row inputs disagree`,
        );
      } else {
        byStudyId.set(paper.studyId, paper);
      }
    }
  }
  return [...byStudyId.values()];
}

const treatmentInputPaths = argumentValues('--treatment-input').map(resolveArgumentPath);
const rowInputPaths = argumentValues('--row-input').map(resolveArgumentPath);
const omitRowInputs = process.argv.includes('--no-row-inputs');
const auditPathArgument = argumentValues('--audit')[0];
const outputAuditPath = auditPathArgument ? resolveArgumentPath(auditPathArgument) : AUDIT_PATH;
const treatmentInputs = (
  treatmentInputPaths.length > 0
    ? treatmentInputPaths
    : [
        path.join(AUDIT_DIR, 'analysis-source-treatment-input-2026-07-27.json'),
        path.join(TOURNAMENT_DIR, 'analysis-source-treatment-input-2026-07-27.json'),
      ]
).map(readJson);
const rowInputs = (
  omitRowInputs
    ? []
    : rowInputPaths.length > 0
    ? rowInputPaths
    : [
        path.join(AUDIT_DIR, 'analysis-row-treatment-input-2026-07-27.json'),
        path.join(TOURNAMENT_DIR, 'analysis-tournament-row-treatment-input-2026-07-27.json'),
      ]
).map(readJson);

const treatments = mergePapers(treatmentInputs);
const rowPolicies = mergeRowPolicies(rowInputs);
const studyIds = treatments.map((paper) => paper.studyId);
const expectedIncludedStudyIds = treatments
  .filter((paper) => (
    paper.includeInAnalysisExport
    ?? paper.intendedTreatment?.includeInAnalysisExport
  ))
  .map((paper) => paper.studyId)
  .sort();
const expectedExcludedStudyIds = treatments
  .filter((paper) => !(
    paper.includeInAnalysisExport
    ?? paper.intendedTreatment?.includeInAnalysisExport
  ))
  .map((paper) => paper.studyId)
  .sort();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
const papers = [];
for (let index = 0; index < studyIds.length; index += 100) {
  const { data, error } = await supabase
    .from('papers')
    .select('id,assigned_study_id')
    .in('assigned_study_id', studyIds.slice(index, index + 100));
  if (error) throw error;
  papers.push(...(data ?? []));
}
assert(
  papers.length === studyIds.length,
  `Expected ${studyIds.length} live papers, found ${papers.length}`,
);

const paperIds = papers.map((paper) => paper.id);
const jiti = createJiti(import.meta.url, {
  alias: {
    '@': path.join(APP_ROOT, 'src'),
  },
});
const { buildCsvExport, buildJsonExport } = await jiti.import('../src/lib/exporters.ts');
const exportBatches = chunks(paperIds, 20);

async function buildBatchedJson(scope) {
  const parts = [];
  for (const batch of exportBatches) {
    parts.push(await buildJsonExport(batch, { scope }));
  }
  return {
    generatedAt: new Date().toISOString(),
    exportScope: scope,
    paperCount: parts.reduce((sum, part) => sum + part.paperCount, 0),
    missingPaperIds: parts.flatMap((part) => part.missingPaperIds),
    excludedPapers: parts.flatMap((part) => part.excludedPapers),
    papers: parts.flatMap((part) => part.papers),
  };
}

async function buildBatchedCsv(scope) {
  const parts = [];
  for (const batch of exportBatches) {
    parts.push(await buildCsvExport(batch, { scope }));
  }
  const [first, ...rest] = parts;
  return [
    first.trimEnd(),
    ...rest.map((csv) => csv.split(/\r\n/).slice(1).join('\r\n').trimEnd()),
  ].filter(Boolean).join('\r\n');
}

// Keep every batch and scope sequential. Each call exercises the real exporter
// while avoiding a full-corpus connection fan-out against the Supabase origin.
const analysisJson = await buildBatchedJson('analysis');
const analysisCsv = await buildBatchedCsv('analysis');
const sourceJson = await buildBatchedJson('source');
const sourceCsv = await buildBatchedCsv('source');
const parsedAnalysisCsv = parseCsv(analysisCsv);
const parsedSourceCsv = parseCsv(sourceCsv);

const actualIncludedStudyIds = analysisJson.papers
  .map((record) => record.paper.assignedStudyId)
  .sort();
const actualExcludedStudyIds = analysisJson.excludedPapers
  .map((paper) => paper.assignedStudyId)
  .sort();
const sourceStudyIds = sourceJson.papers
  .map((record) => record.paper.assignedStudyId)
  .sort();
const analysisCsvStudyIds = sortedUnique(
  parsedAnalysisCsv.rows.map((row) => row['Paper ID']).filter(Boolean),
);
const sourceCsvStudyIds = sortedUnique(
  parsedSourceCsv.rows.map((row) => row['Paper ID']).filter(Boolean),
);

assert(
  JSON.stringify(actualIncludedStudyIds) === JSON.stringify(expectedIncludedStudyIds),
  'Analysis JSON included-study set does not match the complete audited treatment set',
);
assert(
  JSON.stringify(actualExcludedStudyIds) === JSON.stringify(expectedExcludedStudyIds),
  'Analysis JSON excluded-study set does not match the complete audited treatment set',
);
assert(
  JSON.stringify(analysisCsvStudyIds) === JSON.stringify(expectedIncludedStudyIds),
  'Analysis CSV study-ID set does not match the complete audited treatment set',
);
assert(
  JSON.stringify(sourceStudyIds) === JSON.stringify([...studyIds].sort()),
  'Source JSON did not retain every audited paper',
);
assert(
  JSON.stringify(sourceCsvStudyIds) === JSON.stringify([...studyIds].sort()),
  'Source CSV did not retain every audited paper',
);
assert(analysisJson.missingPaperIds.length === 0, 'Analysis JSON has missing papers');
assert(sourceJson.missingPaperIds.length === 0, 'Source JSON has missing papers');
assert(
  parsedAnalysisCsv.headers.slice(0, 6).join('|')
  === 'Paper ID|Paper Title|Status|Population Position|Population Label|Tournament / Series',
  'Analysis CSV is missing the stable paper and population identity columns',
);
assert(
  parsedSourceCsv.headers.slice(0, 6).join('|')
  === 'Paper ID|Paper Title|Status|Population Position|Population Label|Tournament / Series',
  'Source CSV is missing the stable paper and population identity columns',
);
const expectedAnalysisCsvRowCount = analysisJson.papers.reduce(
  (sum, record) => sum + Math.max(1, record.populations.length),
  0,
);
const expectedSourceCsvRowCount = sourceJson.papers.reduce(
  (sum, record) => sum + Math.max(1, record.populations.length),
  0,
);
assert(
  parsedAnalysisCsv.rows.length === expectedAnalysisCsvRowCount,
  `Analysis CSV has ${parsedAnalysisCsv.rows.length} rows, expected ${expectedAnalysisCsvRowCount}`,
);
assert(
  parsedSourceCsv.rows.length === expectedSourceCsvRowCount,
  `Source CSV has ${parsedSourceCsv.rows.length} rows, expected ${expectedSourceCsvRowCount}`,
);

const rowChecks = [];
for (const paperPolicy of rowPolicies) {
  const analysisRecord = analysisJson.papers.find(
    (record) => record.paper.assignedStudyId === paperPolicy.studyId,
  );
  const sourceRecord = sourceJson.papers.find(
    (record) => record.paper.assignedStudyId === paperPolicy.studyId,
  );
  const paperIsIncluded = expectedIncludedStudyIds.includes(paperPolicy.studyId);
  assert(
    paperIsIncluded ? Boolean(analysisRecord) : !analysisRecord,
    `${paperPolicy.studyId}: analysis paper presence disagrees with its paper treatment`,
  );
  assert(sourceRecord, `${paperPolicy.studyId}: missing from source JSON`);

  const expectedAnalysisKeys = paperPolicy.rows
    .filter((row) => row.includeInAnalysisExport)
    .map((row) => row.tournamentKey);
  const expectedSourceKeys = paperPolicy.rows.map((row) => row.tournamentKey);
  const actualAnalysisKeys = analysisRecord?.populations.map((row) => row.tournamentKey) ?? [];
  const actualSourceKeys = sourceRecord.populations.map((row) => row.tournamentKey);
  const actualAnalysisCsvRows = parsedAnalysisCsv.rows
    .filter((row) => row['Paper ID'] === paperPolicy.studyId)
    .map((row) => ({
      position: Number(row['Population Position']),
      label: row['Population Label'],
      key: row['Tournament / Series'],
    }));
  const actualSourceCsvRows = parsedSourceCsv.rows
    .filter((row) => row['Paper ID'] === paperPolicy.studyId)
    .map((row) => ({
      position: Number(row['Population Position']),
      label: row['Population Label'],
      key: row['Tournament / Series'],
    }));
  const expectedAnalysisCsvRows = paperIsIncluded
    ? paperPolicy.rows
      .filter((row) => row.includeInAnalysisExport)
      .map((row) => ({
        position: row.populationPosition,
        label: row.expectedLabel,
        key: row.tournamentKey,
      }))
    : [];
  const expectedSourceCsvRows = paperPolicy.rows.map((row) => ({
    position: row.populationPosition,
    label: row.expectedLabel,
    key: row.tournamentKey,
  }));
  if (paperIsIncluded) {
    assert(
      JSON.stringify(actualAnalysisKeys) === JSON.stringify(expectedAnalysisKeys),
      `${paperPolicy.studyId}: analysis rows do not match the staged rules`,
    );
  }
  assert(
    JSON.stringify(actualSourceKeys) === JSON.stringify(expectedSourceKeys),
    `${paperPolicy.studyId}: source rows do not match the staged rules`,
  );
  assert(
    JSON.stringify(actualAnalysisCsvRows) === JSON.stringify(expectedAnalysisCsvRows),
    `${paperPolicy.studyId}: analysis CSV positions, labels or keys do not match the staged rules`,
  );
  assert(
    JSON.stringify(actualSourceCsvRows) === JSON.stringify(expectedSourceCsvRows),
    `${paperPolicy.studyId}: source CSV positions, labels or keys do not match the staged rules`,
  );
  rowChecks.push({
    studyId: paperPolicy.studyId,
    analysisPaperIncluded: paperIsIncluded,
    analysisRowKeys: actualAnalysisKeys,
    analysisCsvRows: actualAnalysisCsvRows,
    excludedRowKeys: paperPolicy.rows
      .filter((row) => !row.includeInAnalysisExport)
      .map((row) => row.tournamentKey),
    sourceRowKeys: actualSourceKeys,
    sourceCsvRows: actualSourceCsvRows,
  });
}

const audit = {
  artifactType: 'complete-source-family-live-export-verification',
  generatedAt: new Date().toISOString(),
  result: 'PASS',
  requestedPaperCount: studyIds.length,
  exportBatchSize: 20,
  analysisIncludedPaperCount: actualIncludedStudyIds.length,
  analysisExcludedPaperCount: actualExcludedStudyIds.length,
  sourcePaperCount: sourceStudyIds.length,
  analysisCsvDataRowCount: parsedAnalysisCsv.rows.length,
  sourceCsvDataRowCount: parsedSourceCsv.rows.length,
  includedStudyIds: actualIncludedStudyIds,
  excludedStudyIds: actualExcludedStudyIds,
  exportHashes: {
    analysisJsonSha256: sha256(JSON.stringify(analysisJson)),
    analysisCsvSha256: sha256(analysisCsv),
    sourceJsonSha256: sha256(JSON.stringify(sourceJson)),
    sourceCsvSha256: sha256(sourceCsv),
  },
  rowChecks,
};

fs.mkdirSync(path.dirname(outputAuditPath), { recursive: true });
fs.writeFileSync(outputAuditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  result: audit.result,
  requestedPaperCount: audit.requestedPaperCount,
  analysisIncludedPaperCount: audit.analysisIncludedPaperCount,
  analysisExcludedPaperCount: audit.analysisExcludedPaperCount,
  sourcePaperCount: audit.sourcePaperCount,
  analysisCsvDataRowCount: audit.analysisCsvDataRowCount,
  sourceCsvDataRowCount: audit.sourceCsvDataRowCount,
  rowCheckCount: audit.rowChecks.length,
  exportHashes: audit.exportHashes,
  auditPath: outputAuditPath,
}, null, 2));
