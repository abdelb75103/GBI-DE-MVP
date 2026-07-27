import fs from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(
  APP_ROOT,
  'data',
  'tournament-family-reconciliation',
  '2026-07-27',
);
const TREATMENT_INPUT_PATH = path.join(
  DATA_DIR,
  'analysis-source-treatment-input-2026-07-27.json',
);
const ROW_INPUT_PATH = path.join(
  DATA_DIR,
  'analysis-tournament-row-treatment-input-2026-07-27.json',
);
const AUDIT_PATH = path.join(
  DATA_DIR,
  'analysis-export-live-verification-2026-07-27.json',
);

for (const line of fs.readFileSync(path.join(APP_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const treatmentInput = JSON.parse(fs.readFileSync(TREATMENT_INPUT_PATH, 'utf8'));
const rowInput = JSON.parse(fs.readFileSync(ROW_INPUT_PATH, 'utf8'));
const studyIds = treatmentInput.papers.map((paper) => paper.studyId);
const expectedExcludedStudyIds = treatmentInput.papers
  .filter((paper) => !paper.includeInAnalysisExport)
  .map((paper) => paper.studyId)
  .sort();
const expectedIncludedStudyIds = treatmentInput.papers
  .filter((paper) => paper.includeInAnalysisExport)
  .map((paper) => paper.studyId)
  .sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sortedUnique(values) {
  return Array.from(new Set(values)).sort();
}

function firstCsvCell(line) {
  const match = line.match(/^"((?:[^"]|"")*)"/);
  return match ? match[1].replace(/""/g, '"') : null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
const { data: papers, error: papersError } = await supabase
  .from('papers')
  .select('id,assigned_study_id')
  .in('assigned_study_id', studyIds);
if (papersError) throw papersError;
assert(papers?.length === studyIds.length, `Expected ${studyIds.length} live papers, found ${papers?.length ?? 0}`);

const paperIds = papers.map((paper) => paper.id);
const jiti = createJiti(import.meta.url, {
  alias: {
    '@': path.join(APP_ROOT, 'src'),
  },
});
const { buildCsvExport, buildJsonExport } = await jiti.import('../src/lib/exporters.ts');

const [analysisJson, analysisCsv, sourceJson] = await Promise.all([
  buildJsonExport(paperIds),
  buildCsvExport(paperIds),
  buildJsonExport(paperIds, { scope: 'source' }),
]);

const actualExcludedStudyIds = analysisJson.excludedPapers
  .map((paper) => paper.assignedStudyId)
  .sort();
const actualIncludedStudyIds = analysisJson.papers
  .map((record) => record.paper.assignedStudyId)
  .sort();
const sourceStudyIds = sourceJson.papers
  .map((record) => record.paper.assignedStudyId)
  .sort();
const csvStudyIds = sortedUnique(
  analysisCsv
    .split(/\r\n/)
    .slice(1)
    .map(firstCsvCell)
    .filter(Boolean),
);

assert(
  JSON.stringify(actualExcludedStudyIds) === JSON.stringify(expectedExcludedStudyIds),
  `Analysis JSON excluded ${actualExcludedStudyIds.join(', ')}, expected ${expectedExcludedStudyIds.join(', ')}`,
);
assert(
  JSON.stringify(actualIncludedStudyIds) === JSON.stringify(expectedIncludedStudyIds),
  'Analysis JSON included-study set does not match the staged rules',
);
assert(
  JSON.stringify(csvStudyIds) === JSON.stringify(expectedIncludedStudyIds),
  'Analysis CSV study-ID set does not match the staged rules',
);
assert(
  JSON.stringify(sourceStudyIds) === JSON.stringify([...studyIds].sort()),
  'Source-scope JSON did not retain all source-family papers',
);
assert(
  analysisCsv.startsWith('\uFEFF"Paper ID","Paper Title","Status","Population Position","Population Label","Tournament / Series"'),
  'Analysis CSV is missing the tournament-row identity columns',
);

const rowChecks = [];
for (const paperPolicy of rowInput.papers) {
  const analysisRecord = analysisJson.papers.find(
    (record) => record.paper.assignedStudyId === paperPolicy.studyId,
  );
  const sourceRecord = sourceJson.papers.find(
    (record) => record.paper.assignedStudyId === paperPolicy.studyId,
  );
  assert(analysisRecord, `${paperPolicy.studyId}: missing from analysis JSON`);
  assert(sourceRecord, `${paperPolicy.studyId}: missing from source JSON`);
  const expectedAnalysisKeys = paperPolicy.rows
    .filter((row) => row.includeInAnalysisExport)
    .map((row) => row.tournamentKey);
  const expectedSourceKeys = paperPolicy.rows.map((row) => row.tournamentKey);
  const actualAnalysisKeys = analysisRecord.populations.map((row) => row.tournamentKey);
  const actualSourceKeys = sourceRecord.populations.map((row) => row.tournamentKey);
  assert(
    JSON.stringify(actualAnalysisKeys) === JSON.stringify(expectedAnalysisKeys),
    `${paperPolicy.studyId}: analysis tournament rows do not match the staged rules`,
  );
  assert(
    JSON.stringify(actualSourceKeys) === JSON.stringify(expectedSourceKeys),
    `${paperPolicy.studyId}: source tournament rows do not match the staged rules`,
  );
  rowChecks.push({
    studyId: paperPolicy.studyId,
    analysisTournamentKeys: actualAnalysisKeys,
    sourceOnlyTournamentKeys: paperPolicy.rows
      .filter((row) => !row.includeInAnalysisExport)
      .map((row) => row.tournamentKey),
  });
}

const audit = {
  generatedAt: new Date().toISOString(),
  result: 'PASS',
  requestedPaperCount: studyIds.length,
  analysisIncludedPaperCount: actualIncludedStudyIds.length,
  analysisExcludedPaperCount: actualExcludedStudyIds.length,
  sourceAuditPaperCount: sourceStudyIds.length,
  csvDataRowCount: analysisCsv.split(/\r\n/).length - 1,
  includedStudyIds: actualIncludedStudyIds,
  excludedStudyIds: actualExcludedStudyIds,
  exclusionRules: treatmentInput.papers
    .filter((paper) => !paper.includeInAnalysisExport)
    .map((paper) => ({
      studyId: paper.studyId,
      analysisRole: paper.analysisRole,
    })),
  rowChecks,
};
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit, null, 2));
