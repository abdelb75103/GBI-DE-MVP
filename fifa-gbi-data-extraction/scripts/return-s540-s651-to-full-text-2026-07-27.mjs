import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const REVIEWER_ID = '00000000-0000-0000-0000-000000000001';
const REVIEWER_NAME = 'AbdelRahman Babiker';
const REVIEW_DATE = '2026-07-27';
const protectedPapers = {
  S288: '908ec4c3-6d92-48ff-9c7e-6df7797f37c4',
};

const targets = {
  S540: {
    paperId: 'a83334ab-faec-490a-b70e-6840a757f811',
    expectedStatus: 'flagged',
    expectedFlag: 'No explicit injury definition or clear reporting source',
    exclusionReason: 'Unclear injury definition or reporting source',
    reason: 'The paper does not state an explicit injury case definition or identify who maintained the in-season injury record.',
    note: 'Retrospectively archived from extraction on 2026-07-27 after eligibility adjudication. Although the paper reports injuries and athlete-exposures, it does not state an explicit injury case definition and does not identify whether the in-season injury record was maintained by medical staff, an athletic trainer, coaching staff, or researchers. The existing extracted injury-definition value was an interpretation, not an explicit case definition stated by the paper. Abdel adjudicated the paper for exclusion. No linked full-text screening record existed, and none was created.',
  },
  S651: {
    paperId: 'c92ba4dc-4363-4388-af33-d29f221bac77',
    expectedStatus: 'extracted',
    expectedFlag: 'media used in combination?',
    exclusionReason: 'Public or otherwise ineligible data source',
    reason: 'Clinical diagnoses and absence duration were obtained from sports-media reports and/or club medical-staff reports, without observation-level source attribution.',
    note: 'Retrospectively archived from extraction on 2026-07-27 after eligibility adjudication. The paper states that clinical diagnoses and injury-related absence duration were obtained from newspapers, magazines, newsletters and tabloids and/or club medical-staff reports. It does not identify which individual observations came from media versus medical staff. Abdel adjudicated the mixed and incompletely attributable reporting source for exclusion. No linked full-text screening record existed, and none was created.',
  },
};

const parseEnv = (contents) => Object.fromEntries(
  contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      return [key, value];
    }),
);

const env = parseEnv(fs.readFileSync(path.join(APP_DIR, '.env.local'), 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};

const paperIds = Object.values(targets).map((target) => target.paperId);
const protectedPaperIds = Object.values(protectedPapers);
const allPaperIds = [...paperIds, ...protectedPaperIds];
const allStudyIds = [...Object.keys(targets), ...Object.keys(protectedPapers)];
const stableHash = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(Array.isArray(value)
    ? [...value].sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    : value))
  .digest('hex');
const protectedPaperHash = (paper) => {
  const { status: _status, flag_reason: _flagReason, updated_at: _updatedAt, ...stable } = paper;
  return stableHash(stable);
};

const fetchSnapshot = async () => {
  const papers = requireData(
    await supabase.from('papers').select('*').in('id', allPaperIds).order('assigned_study_id'),
    'papers snapshot',
  );
  const paperFiles = requireData(
    await supabase.from('paper_files').select('*').in('paper_id', allPaperIds).order('paper_id'),
    'paper files snapshot',
  );
  const paperNotes = requireData(
    await supabase.from('paper_notes').select('*').in('paper_id', allPaperIds).order('paper_id'),
    'paper notes snapshot',
  );
  const extractions = requireData(
    await supabase.from('extractions').select('*').in('paper_id', allPaperIds).order('paper_id'),
    'extractions snapshot',
  );
  const extractionFields = extractions.length
    ? requireData(
      await supabase.from('extraction_fields').select('*').in('extraction_id', extractions.map((row) => row.id)).order('extraction_id'),
      'extraction fields snapshot',
    )
    : [];
  const populationGroups = requireData(
    await supabase.from('population_groups').select('*').in('paper_id', allPaperIds).order('paper_id'),
    'population groups snapshot',
  );
  const populationValues = requireData(
    await supabase.from('population_values').select('*').in('paper_id', allPaperIds).order('paper_id'),
    'population values snapshot',
  );
  const existingScreening = requireData(
    await supabase.from('screening_records').select('*').in('assigned_study_id', allStudyIds),
    'existing screening snapshot',
  );
  const screeningVotes = existingScreening.length
    ? requireData(
      await supabase.from('screening_votes').select('*').in('screening_record_id', existingScreening.map((row) => row.id)),
      'screening votes snapshot',
    )
    : [];
  return {
    papers,
    paperFiles,
    paperNotes,
    extractions,
    extractionFields,
    populationGroups,
    populationValues,
    existingScreening,
    screeningVotes,
  };
};

const assertPreconditions = (snapshot) => {
  if (snapshot.existingScreening.some((row) => Object.hasOwn(targets, row.assigned_study_id))) {
    throw new Error('A screening record now exists for S540 or S651; refusing to create a duplicate');
  }
  for (const [studyId, target] of Object.entries(targets)) {
    const paper = snapshot.papers.find((row) => row.id === target.paperId);
    if (!paper) throw new Error(`${studyId}: paper not found`);
    if (paper.assigned_study_id !== studyId) throw new Error(`${studyId}: paper ID mismatch`);
    if (paper.status !== target.expectedStatus) {
      throw new Error(`${studyId}: expected ${target.expectedStatus}, found ${paper.status}`);
    }
    if (paper.flag_reason !== target.expectedFlag) throw new Error(`${studyId}: flag reason changed`);
    if (paper.assigned_to !== REVIEWER_ID) throw new Error(`${studyId}: assignment changed`);
    const file = snapshot.paperFiles.find((row) => row.id === paper.primary_file_id);
    if (!file) throw new Error(`${studyId}: primary file row not found`);
    if (file.file_sha256 !== paper.primary_file_sha256) {
      throw new Error(`${studyId}: primary file hash mismatch`);
    }
  }
  for (const [studyId, paperId] of Object.entries(protectedPapers)) {
    const paper = snapshot.papers.find((row) => row.id === paperId);
    if (!paper || paper.assigned_study_id !== studyId) throw new Error(`${studyId}: protected paper not found`);
    if (paper.status !== 'extracted' || paper.flag_reason !== null) {
      throw new Error(`${studyId}: protected paper state changed`);
    }
  }
};

const before = await fetchSnapshot();
assertPreconditions(before);

const audit = {
  schemaVersion: 1,
  task: 'S540 and S651 reversible extraction archive with adjudication notes',
  date: REVIEW_DATE,
  mode: APPLY ? 'live_apply' : 'dry_run',
  decisions: Object.fromEntries(Object.entries(targets).map(([studyId, target]) => [studyId, {
    disposition: 'archived_from_extraction',
    extractionPaperDisposition: 'archived',
    paperId: target.paperId,
    screeningId: null,
    exclusionReason: target.exclusionReason,
    reason: target.reason,
  }])),
  before,
  apply: [],
  integrityGate: null,
  rollback: {
    paperRows: 'Restore only status and flag_reason from this audit snapshot, guarded by the exact archived updated_at returned by the apply. Compensation results are recorded in failure.compensation.',
    paperNotes: 'The newly inserted paper-note IDs are recorded in this audit. Deleting them is destructive and requires explicit approval before rollback.',
    childAndStorageRows: 'No child extraction, vote, note, file or storage rows are modified or deleted.',
  },
};
const outputDir = path.join(APP_DIR, 'data', 'second-search-extraction', 'adjudication-2026-07-27');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(
  outputDir,
  `s540-s651-retrospective-return-${APPLY ? 'live-apply' : 'dry-run'}-audit-2026-07-27.json`,
);
if (APPLY) {
  audit.phase = 'pre_apply_snapshot_persisted';
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
}

if (APPLY) {
  const changedPapers = [];
  try {
    for (const [studyId, target] of Object.entries(targets)) {
      const paper = before.papers.find((row) => row.id === target.paperId);
      const result = await supabase
        .from('papers')
        .update({ status: 'archived', flag_reason: null })
        .eq('id', target.paperId)
        .eq('assigned_study_id', studyId)
        .eq('status', target.expectedStatus)
        .eq('flag_reason', target.expectedFlag)
        .eq('updated_at', paper.updated_at)
        .select('id,assigned_study_id,status,flag_reason,assigned_to,updated_at');
      const rows = requireData(result, `${studyId} paper archive`);
      if (rows.length !== 1) throw new Error(`${studyId}: guarded paper archive affected ${rows.length} rows`);
      audit.apply.push(rows[0]);
      changedPapers.push(rows[0]);
    }

    const noteRows = Object.entries(targets).map(([studyId, target]) => ({
      paper_id: target.paperId,
      body: `${target.note} Archived in extraction without creating a replacement full-text screening record. Adjudicated by ${REVIEWER_NAME} on ${REVIEW_DATE}.`,
    }));
    const inserted = requireData(
      await supabase.from('paper_notes').insert(noteRows).select('*'),
      'paper-note insert',
    );
    if (inserted.length !== noteRows.length) {
      throw new Error(`paper-note insert returned ${inserted.length} rows`);
    }
    audit.apply.push(...inserted);
  } catch (error) {
    const compensation = [];
    for (const changed of changedPapers.reverse()) {
      const row = before.papers.find((candidate) => candidate.id === changed.id);
      const result = await supabase
        .from('papers')
        .update({ status: row.status, flag_reason: row.flag_reason })
        .eq('id', changed.id)
        .eq('status', 'archived')
        .is('flag_reason', null)
        .eq('updated_at', changed.updated_at)
        .select('id,status,flag_reason,updated_at');
      const rows = result.error ? [] : result.data ?? [];
      compensation.push({
        paperId: changed.id,
        restored: !result.error && rows.length === 1,
        error: result.error?.message ?? null,
        returnedRows: rows,
      });
    }
    audit.phase = 'apply_failed';
    audit.failure = { message: error.message, compensation };
    fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
    throw error;
  }

  const after = await fetchSnapshot();
  const childKeys = ['paperFiles', 'extractions', 'extractionFields', 'populationGroups', 'populationValues'];
  const checks = Object.entries(targets).map(([studyId, target]) => {
    const paper = after.papers.find((row) => row.id === target.paperId);
    const newNotes = after.paperNotes.filter((row) =>
      row.paper_id === target.paperId
      && !before.paperNotes.some((beforeNote) => beforeNote.id === row.id));
    return {
      studyId,
      paperArchived: paper?.status === 'archived' && paper?.flag_reason === null,
      assignmentPreserved: paper?.assigned_to === REVIEWER_ID,
      exactlyOneAdjudicationNoteAdded: newNotes.length === 1
        && newNotes[0].body === `${target.note} Archived in extraction without creating a replacement full-text screening record. Adjudicated by ${REVIEWER_NAME} on ${REVIEW_DATE}.`,
      allExistingNotesPreserved: before.paperNotes
        .filter((row) => row.paper_id === target.paperId)
        .every((row) => after.paperNotes.some((afterRow) => stableHash(afterRow) === stableHash(row))),
      allOtherPaperColumnsPreserved: protectedPaperHash(paper)
        === protectedPaperHash(before.papers.find((row) => row.id === target.paperId)),
      noScreeningRecordCreated: !after.existingScreening
        .some((row) => row.assigned_study_id === studyId),
    };
  });
  const childrenUnchanged = childKeys.every((key) => stableHash(before[key]) === stableHash(after[key]));
  const s288PaperBefore = before.papers.find((row) => row.id === protectedPapers.S288);
  const s288PaperAfter = after.papers.find((row) => row.id === protectedPapers.S288);
  const s288ScreeningBefore = before.existingScreening
    .filter((row) => row.assigned_study_id === 'S288');
  const s288ScreeningAfter = after.existingScreening
    .filter((row) => row.assigned_study_id === 'S288');
  const s288ScreeningIdsBefore = new Set(s288ScreeningBefore.map((row) => row.id));
  const s288ScreeningIdsAfter = new Set(s288ScreeningAfter.map((row) => row.id));
  const s288ProtectedUnchanged = stableHash(s288PaperBefore) === stableHash(s288PaperAfter)
    && ['paperFiles', 'paperNotes', 'extractions', 'extractionFields', 'populationGroups', 'populationValues']
      .every((key) => stableHash(before[key].filter((row) =>
        row.paper_id === protectedPapers.S288
        || (key === 'extractionFields' && before.extractions
          .filter((extraction) => extraction.paper_id === protectedPapers.S288)
          .some((extraction) => extraction.id === row.extraction_id))))
        === stableHash(after[key].filter((row) =>
          row.paper_id === protectedPapers.S288
          || (key === 'extractionFields' && after.extractions
            .filter((extraction) => extraction.paper_id === protectedPapers.S288)
            .some((extraction) => extraction.id === row.extraction_id)))))
    && stableHash(s288ScreeningBefore) === stableHash(s288ScreeningAfter)
    && stableHash(before.screeningVotes.filter((row) => s288ScreeningIdsBefore.has(row.screening_record_id)))
      === stableHash(after.screeningVotes.filter((row) => s288ScreeningIdsAfter.has(row.screening_record_id)));
  audit.integrityGate = {
    checks,
    previousScreeningStillAbsent: before.existingScreening.length === 0,
    noTargetScreeningOrVoteRowsCreated: !after.existingScreening
      .some((row) => Object.hasOwn(targets, row.assigned_study_id))
      && after.screeningVotes.length === before.screeningVotes.length,
    childAndStorageReferencesUnchanged: childrenUnchanged,
    protectedS288Unchanged: s288ProtectedUnchanged,
    passed: checks.every((check) => Object.entries(check)
      .filter(([key]) => key !== 'studyId')
      .every(([, value]) => value === true))
      && !after.existingScreening.some((row) => Object.hasOwn(targets, row.assigned_study_id))
      && after.screeningVotes.length === before.screeningVotes.length
      && childrenUnchanged
      && s288ProtectedUnchanged,
    after,
  };
  if (!audit.integrityGate.passed) {
    audit.phase = 'integrity_gate_failed';
    fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
    throw new Error('Integrity gate failed. The audit contains exact restoration data; no destructive paper-note deletion was attempted.');
  }
  audit.phase = 'complete';
}

fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify({
  mode: audit.mode,
  outputPath,
  integrityGatePassed: audit.integrityGate?.passed ?? null,
}, null, 2));
