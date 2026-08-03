import fs from 'node:fs';
import path from 'node:path';

const baseDirectory =
  '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main/fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30';
const secondPassDirectory = path.join(baseDirectory, 'ucd-second-pass-2026-07-30');
const originalSnapshotPath = path.join(
  baseDirectory,
  'pre-write-snapshot-2026-07-30T13-01-10-685Z.json',
);
const freshSnapshotPath = path.join(
  secondPassDirectory,
  'pre-write-snapshot-2026-07-30T14-51-10-895Z.json',
);
const originalVerificationPath = path.join(
  secondPassDirectory,
  'final-verification-2026-07-30T14-52-06-229Z.json',
);
const deltaVerificationPath = path.join(
  secondPassDirectory,
  'final-verification-2026-07-30T14-52-34-331Z.json',
);
const outputPath = path.join(secondPassDirectory, 'concurrent-live-activity-audit.json');

const original = JSON.parse(fs.readFileSync(originalSnapshotPath, 'utf8'));
const fresh = JSON.parse(fs.readFileSync(freshSnapshotPath, 'utf8'));
const originalVerification = JSON.parse(fs.readFileSync(originalVerificationPath, 'utf8'));
const deltaVerification = JSON.parse(fs.readFileSync(deltaVerificationPath, 'utf8'));
const targetIds = new Set(original.mapping.map((row) => row.recordId));

const oldOutOfScope = new Map(
  original.globalBaselines.screeningRecordStamps
    .filter((row) => !targetIds.has(row.id))
    .map((row) => [row.id, row]),
);
const freshOutOfScope = new Map(
  fresh.globalBaselines.screeningRecordStamps
    .filter((row) => !targetIds.has(row.id))
    .map((row) => [row.id, row]),
);
const outOfScopeIds = new Set([...oldOutOfScope.keys(), ...freshOutOfScope.keys()]);
const changedOutOfScopeScreeningRecords = [...outOfScopeIds]
  .filter((id) => (
    JSON.stringify(oldOutOfScope.get(id)) !== JSON.stringify(freshOutOfScope.get(id))
  ))
  .map((id) => ({
    id,
    before: oldOutOfScope.get(id) ?? null,
    after: freshOutOfScope.get(id) ?? null,
  }));

const originalTargetVoteIds = new Set(original.targetVotes.map((row) => row.id));
const addedTargetVotes = fresh.targetVotes.filter((row) => !originalTargetVoteIds.has(row.id));

const payload = {
  scope:
    'Concurrent live activity observed between the original workflow snapshot and the UCD second-pass AI snapshot',
  generatedAt: new Date().toISOString(),
  sourcePaths: {
    originalSnapshot: originalSnapshotPath,
    freshSnapshot: freshSnapshotPath,
    originalBaselineVerification: originalVerificationPath,
    deltaVerification: deltaVerificationPath,
  },
  conclusions: {
    originalBaselineVerificationPassed: originalVerification.passed,
    originalBaselineGlobalChecks: originalVerification.globalChecks,
    deltaVerificationPassed: deltaVerification.passed,
    deltaGlobalChecks: deltaVerification.globalChecks,
    addedGlobalVoteCount:
      fresh.globalBaselines.screeningVoteCount
      - original.globalBaselines.screeningVoteCount,
    addedTargetVoteCount: addedTargetVotes.length,
    changedOutOfScopeScreeningRecordCount: changedOutOfScopeScreeningRecords.length,
    workflowMutationBoundary:
      'The upload and AI apply paths update only exact mapped screening_records IDs and do not insert or update screening_votes. The passing fresh-snapshot verification proves no vote or out-of-scope stamp changes occurred during the five-record AI delta.',
  },
  changedOutOfScopeScreeningRecords,
  addedTargetVotes,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({
  outputPath,
  addedTargetVotes: addedTargetVotes.length,
  changedOutOfScopeScreeningRecords: changedOutOfScopeScreeningRecords.length,
}, null, 2));
