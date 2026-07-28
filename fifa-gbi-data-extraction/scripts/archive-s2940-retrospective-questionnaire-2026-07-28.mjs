import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CANONICAL_APP_DIR = '/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction';
const require = createRequire(path.join(CANONICAL_APP_DIR, 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const PAPER_ID = 'a3860937-9f84-410c-ae29-4a0095bcff7e';
const STUDY_ID = 'S2940';
const REVIEWER_ID = '00000000-0000-0000-0000-000000000001';
const REVIEWER_NAME = 'AbdelRahman Babiker';
const REVIEW_DATE = '2026-07-28';
const EXPECTED_STATUS = 'uploaded';
const EXPECTED_FLAG = null;
const NOTE = 'Archived from extraction on 2026-07-28 after eligibility adjudication. The study collected players’ historical injury and exposure information retrospectively by questionnaire/self-report, which meets the project exclusion criterion for retrospective questionnaire data. Existing extraction data, assignment, source attachments, human screening votes, resolver state and promotion state were preserved as audit history.';

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

const envPath = path.join(CANONICAL_APP_DIR, '.env.local');
const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};

const stableHash = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(Array.isArray(value)
    ? [...value].sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    : value))
  .digest('hex');

const paperProtectedHash = (paper) => {
  const { status: _status, flag_reason: _flagReason, updated_at: _updatedAt, ...protectedState } = paper;
  return stableHash(protectedState);
};

const fetchSnapshot = async () => {
  const papers = requireData(
    await supabase.from('papers').select('*').eq('id', PAPER_ID),
    'paper snapshot',
  );
  const paperFiles = requireData(
    await supabase.from('paper_files').select('*').eq('paper_id', PAPER_ID).order('id'),
    'paper files snapshot',
  );
  const paperNotes = requireData(
    await supabase.from('paper_notes').select('*').eq('paper_id', PAPER_ID).order('created_at'),
    'paper notes snapshot',
  );
  const extractions = requireData(
    await supabase.from('extractions').select('*').eq('paper_id', PAPER_ID).order('id'),
    'extractions snapshot',
  );
  const extractionFields = extractions.length
    ? requireData(
      await supabase.from('extraction_fields').select('*').in('extraction_id', extractions.map((row) => row.id)).order('id'),
      'extraction fields snapshot',
    )
    : [];
  const populationGroups = requireData(
    await supabase.from('population_groups').select('*').eq('paper_id', PAPER_ID).order('id'),
    'population groups snapshot',
  );
  const populationValues = requireData(
    await supabase.from('population_values').select('*').eq('paper_id', PAPER_ID).order('id'),
    'population values snapshot',
  );
  const screeningRecords = requireData(
    await supabase.from('screening_records').select('*').eq('assigned_study_id', STUDY_ID).order('stage'),
    'screening records snapshot',
  );
  const screeningVotes = screeningRecords.length
    ? requireData(
      await supabase.from('screening_votes').select('*').in('screening_record_id', screeningRecords.map((row) => row.id)).order('id'),
      'screening votes snapshot',
    )
    : [];
  const aiReviewDecisions = requireData(
    await supabase.from('ai_review_decisions').select('*').eq('paper_id', PAPER_ID),
    'AI review decisions snapshot',
  );
  const uploadQueueReferences = requireData(
    await supabase.from('paper_upload_queue').select('*').eq('paper_id', PAPER_ID),
    'upload queue references snapshot',
  );

  return {
    papers,
    paperFiles,
    paperNotes,
    extractions,
    extractionFields,
    populationGroups,
    populationValues,
    screeningRecords,
    screeningVotes,
    aiReviewDecisions,
    uploadQueueReferences,
  };
};

const assertPreconditions = (snapshot) => {
  if (snapshot.papers.length !== 1) throw new Error(`Expected one paper, found ${snapshot.papers.length}`);
  const paper = snapshot.papers[0];
  if (paper.assigned_study_id !== STUDY_ID) throw new Error(`Paper ID mismatch: found ${paper.assigned_study_id}`);
  if (paper.status !== EXPECTED_STATUS) throw new Error(`Expected ${EXPECTED_STATUS}, found ${paper.status}`);
  if (paper.flag_reason !== EXPECTED_FLAG) throw new Error(`Expected flag "${EXPECTED_FLAG}", found "${paper.flag_reason}"`);
  if (paper.assigned_to !== REVIEWER_ID) throw new Error(`Assignment changed: found ${paper.assigned_to}`);
  const primaryFile = snapshot.paperFiles.find((row) => row.id === paper.primary_file_id);
  if (!primaryFile) throw new Error('Primary file row not found');
  if (primaryFile.file_sha256 !== paper.primary_file_sha256) throw new Error('Primary file hash mismatch');
};

const before = await fetchSnapshot();
assertPreconditions(before);

const outputDir = path.join(APP_DIR, 'data', 'second-search-extraction', 'adjudication-2026-07-28');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(
  outputDir,
  `s2940-retrospective-questionnaire-archive-${APPLY ? 'live-apply' : 'dry-run'}-audit-2026-07-28.json`,
);

const audit = {
  schemaVersion: 1,
  artifactType: 'Backlog 2 reversible extraction exclusion audit',
  task: 'S2940 retrospective-questionnaire exclusion and extraction archive',
  date: REVIEW_DATE,
  mode: APPLY ? 'live_apply' : 'dry_run',
  decision: {
    studyId: STUDY_ID,
    paperId: PAPER_ID,
    priorStatus: EXPECTED_STATUS,
    priorFlagReason: EXPECTED_FLAG,
    currentStatus: 'archived',
    currentFlagReason: null,
    exclusionReason: 'Retrospective questionnaire/self-reported historical injury and exposure collection',
  },
  before,
  apply: [],
  integrityGate: null,
  rollback: {
    paperRow: 'Restore only status and flag_reason from this audit snapshot, guarded by the exact archived updated_at returned by the apply.',
    paperNote: 'The inserted paper-note ID is recorded in this audit. Deleting it is destructive and requires explicit approval.',
    protectedState: 'No extraction, assignment, attachment, screening vote, resolver, promotion or unrelated metadata row is modified.',
  },
};

if (APPLY) {
  audit.phase = 'pre_apply_snapshot_persisted';
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);

  const paper = before.papers[0];
  const guardedUpdate = supabase
      .from('papers')
      .update({ status: 'archived', flag_reason: null })
      .eq('id', PAPER_ID)
      .eq('assigned_study_id', STUDY_ID)
      .eq('status', EXPECTED_STATUS)
      .eq('assigned_to', REVIEWER_ID)
      .eq('updated_at', paper.updated_at);
  const updateResult = EXPECTED_FLAG === null
    ? await guardedUpdate.is('flag_reason', null)
      .select('id,assigned_study_id,status,flag_reason,assigned_to,updated_at')
    : await guardedUpdate.eq('flag_reason', EXPECTED_FLAG)
      .select('id,assigned_study_id,status,flag_reason,assigned_to,updated_at');
  const updateRows = requireData(
    updateResult,
    'guarded paper archive',
  );
  if (updateRows.length !== 1) throw new Error(`Guarded paper archive affected ${updateRows.length} rows`);
  audit.apply.push({ paper: updateRows[0] });

  const insertedNotes = requireData(
    await supabase.from('paper_notes').insert({ paper_id: PAPER_ID, body: NOTE }).select('*'),
    'paper-note insert',
  );
  if (insertedNotes.length !== 1) throw new Error(`Paper-note insert returned ${insertedNotes.length} rows`);
  audit.apply.push({ paperNote: insertedNotes[0] });

  const after = await fetchSnapshot();
  const afterPaper = after.papers[0];
  const newNotes = after.paperNotes.filter((row) =>
    !before.paperNotes.some((beforeNote) => beforeNote.id === row.id));
  const protectedCollections = [
    'paperFiles',
    'extractions',
    'extractionFields',
    'populationGroups',
    'populationValues',
    'screeningRecords',
    'screeningVotes',
    'aiReviewDecisions',
    'uploadQueueReferences',
  ];
  const protectedCollectionChecks = Object.fromEntries(
    protectedCollections.map((key) => [key, stableHash(before[key]) === stableHash(after[key])]),
  );

  audit.integrityGate = {
    exactPaper: after.papers.length === 1 && afterPaper?.id === PAPER_ID && afterPaper?.assigned_study_id === STUDY_ID,
    finalStatusArchived: afterPaper?.status === 'archived',
    finalFlagReasonNull: afterPaper?.flag_reason === null,
    assignmentPreserved: afterPaper?.assigned_to === before.papers[0].assigned_to,
    allOtherPaperColumnsPreserved: paperProtectedHash(afterPaper) === paperProtectedHash(before.papers[0]),
    exactlyOneExclusionNoteAdded: newNotes.length === 1 && newNotes[0].body === NOTE,
    allExistingNotesPreserved: before.paperNotes.every((row) =>
      after.paperNotes.some((afterRow) => stableHash(afterRow) === stableHash(row))),
    protectedCollections: protectedCollectionChecks,
    protectedScreeningVotesResolverAndPromotionUnchanged:
      protectedCollectionChecks.screeningRecords && protectedCollectionChecks.screeningVotes,
    passed: false,
    after,
  };
  audit.integrityGate.passed = Object.entries(audit.integrityGate)
    .filter(([key]) => !['passed', 'after', 'protectedCollections'].includes(key))
    .every(([, value]) => value === true)
    && Object.values(protectedCollectionChecks).every((value) => value === true);
  audit.phase = audit.integrityGate.passed ? 'complete' : 'integrity_gate_failed';
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  if (!audit.integrityGate.passed) {
    throw new Error('Integrity gate failed. Exact restoration data is recorded in the audit; no destructive rollback was attempted.');
  }
} else {
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
}

console.log(JSON.stringify({
  mode: audit.mode,
  outputPath,
  studyId: STUDY_ID,
  priorStatus: before.papers[0].status,
  priorFlagReason: before.papers[0].flag_reason,
  screeningRecordCount: before.screeningRecords.length,
  screeningVoteCount: before.screeningVotes.length,
  extractionCount: before.extractions.length,
  extractionFieldCount: before.extractionFields.length,
  populationGroupCount: before.populationGroups.length,
  populationValueCount: before.populationValues.length,
  paperFileCount: before.paperFiles.length,
  existingNoteCount: before.paperNotes.length,
  integrityGatePassed: audit.integrityGate?.passed ?? null,
}, null, 2));
