import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const INPUT_PATH = path.join(
  APP_DIR,
  'data',
  'second-search-extraction',
  'newly-promoted-2026-07-28',
  's4800-manual-extraction-input-2026-07-28.json',
);
const AUDIT_PATH = path.join(
  APP_DIR,
  'data',
  'second-search-extraction',
  'newly-promoted-2026-07-28',
  's4800-manual-extraction-final-live-audit-2026-07-28.json',
);
const APPLY = process.argv.includes('--apply');
const STUDY_ID = 'S4800';
const PAPER_ID = 'e84cb607-2bc9-4df6-9119-a5833c37f087';
const SCREENING_ID = '408f6cba-55a1-419e-a14e-33d10c24b8dd';
const FILE_ID = '35ec28fc-9755-423a-a1be-6cea08fdc2bf';
const FILE_SHA256 = 'b88656471ce9f676ff1a61ccd90805e1bf3afe2f50b8092f2bf4a5be22ca5361';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';

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
const { extractionFieldDefinitions } = await import('../src/lib/extraction/schema.ts');
const { createPopulationSignature, derivePopulationGroups } = await import('../src/lib/extraction/populations.ts');
const { normalizeGlobalFieldValue } = await import('../src/lib/extraction/normalize.ts');
const definitionById = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));
const payload = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const staged = payload.papers[0];

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};

const stableHash = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

const sortById = (rows) => [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));

const protectedScreeningState = (snapshot) => ({
  screening: sortById(snapshot.screening),
  votes: sortById(snapshot.votes),
});

const fetchSnapshot = async () => {
  const papers = requireData(
    await supabase.from('papers').select('*').eq('id', PAPER_ID),
    'paper snapshot',
  );
  const paperFiles = requireData(
    await supabase.from('paper_files').select('*').eq('paper_id', PAPER_ID).order('id'),
    'paper_files snapshot',
  );
  const extractions = requireData(
    await supabase.from('extractions').select('*').eq('paper_id', PAPER_ID).order('tab'),
    'extractions snapshot',
  );
  const extractionFields = extractions.length
    ? requireData(
      await supabase
        .from('extraction_fields')
        .select('*')
        .in('extraction_id', extractions.map((row) => row.id))
        .order('field_id'),
      'extraction_fields snapshot',
    )
    : [];
  const populationGroups = requireData(
    await supabase.from('population_groups').select('*').eq('paper_id', PAPER_ID).order('position'),
    'population_groups snapshot',
  );
  const populationValues = requireData(
    await supabase.from('population_values').select('*').eq('paper_id', PAPER_ID).order('field_id'),
    'population_values snapshot',
  );
  const screening = requireData(
    await supabase.from('screening_records').select('*').eq('assigned_study_id', STUDY_ID).order('stage'),
    'screening snapshot',
  );
  const votes = screening.length
    ? requireData(
      await supabase
        .from('screening_votes')
        .select('*')
        .in('screening_record_id', screening.map((row) => row.id))
        .order('vote_order'),
      'screening votes snapshot',
    )
    : [];
  return {
    papers,
    paperFiles,
    extractions,
    extractionFields,
    populationGroups,
    populationValues,
    screening,
    votes,
  };
};

const assertPreconditions = (snapshot) => {
  if (snapshot.papers.length !== 1) throw new Error(`Expected one S4800 paper row, found ${snapshot.papers.length}`);
  const paper = snapshot.papers[0];
  if (paper.assigned_study_id !== STUDY_ID) throw new Error('Paper study ID mismatch');
  if (paper.status !== 'uploaded') throw new Error(`Expected uploaded status, found ${paper.status}`);
  if (paper.assigned_to !== null) throw new Error(`Expected S4800 to be unassigned, found ${paper.assigned_to}`);
  if (paper.primary_file_id !== FILE_ID || paper.primary_file_sha256 !== FILE_SHA256) {
    throw new Error('Primary paper pointer or SHA-256 changed');
  }
  const primaryFile = snapshot.paperFiles.find((row) => row.id === FILE_ID);
  if (!primaryFile || primaryFile.file_sha256 !== FILE_SHA256) {
    throw new Error('Registered primary paper_files row or SHA-256 changed');
  }
  if (
    snapshot.extractions.length
    || snapshot.extractionFields.length
    || snapshot.populationGroups.length
    || snapshot.populationValues.length
  ) {
    throw new Error('S4800 is no longer extraction-blank; additive-only apply refused');
  }
  const fullText = snapshot.screening.find((row) => row.id === SCREENING_ID);
  if (!fullText || fullText.stage !== 'full_text') throw new Error('Linked full-text screening record changed');
  if (fullText.promoted_paper_id !== PAPER_ID) throw new Error('Promotion link changed');
  if (fullText.metadata?.fullTextResolution !== 'ready_for_extraction') {
    throw new Error('Full-text resolution is no longer ready_for_extraction');
  }
  const fullTextVotes = snapshot.votes.filter((vote) => vote.screening_record_id === SCREENING_ID);
  if (
    fullTextVotes.length !== 3
    || fullTextVotes[0]?.decision !== 'exclude'
    || fullTextVotes[1]?.decision !== 'include'
    || fullTextVotes[2]?.vote_role !== 'consensus_resolution'
    || fullTextVotes[2]?.decision !== 'include'
  ) {
    throw new Error('Protected full-text vote/resolution state changed');
  }
};

const stagedEntries = Object.entries(staged.fields).flatMap(([tab, fields]) =>
  Object.entries(fields).map(([fieldId, rawValue]) => {
    const definition = definitionById.get(fieldId);
    if (!definition || definition.tab !== tab) throw new Error(`Unknown or wrong-tab field: ${tab}.${fieldId}`);
    const value = fieldId === 'studyId'
      ? STUDY_ID
      : normalizeGlobalFieldValue(fieldId, rawValue == null ? null : String(rawValue));
    return {
      tab,
      fieldId,
      value,
      metric: definition.metric ?? null,
    };
  }),
);
const stagedPopulationGroups = derivePopulationGroups(stagedEntries).map((group, index) => ({
  ...group,
  label: staged.populationLabels[index],
}));
if (stagedPopulationGroups.length !== staged.populationLabels.length) {
  throw new Error(
    `Population parser produced ${stagedPopulationGroups.length} rows for ${staged.populationLabels.length} labels`,
  );
}

const before = await fetchSnapshot();
assertPreconditions(before);
const protectedBeforeHash = stableHash(protectedScreeningState(before));
const audit = {
  artifactType: 'Newly promoted paper final live extraction audit',
  date: '2026-07-28',
  scope: 'S4800 only',
  model: payload.model,
  reasoningLevel: payload.reasoningLevel,
  modelNote: payload.modelNote,
  mode: APPLY ? 'live_apply' : 'dry_run',
  phase: 'pre_apply_snapshot_persisted',
  sourceCoverage: payload.stageA.sourceCoverage,
  tablesAndFigures: payload.stageA.tablesAndFigures,
  stageA: payload.stageA,
  populationLayout: payload.stageA.populationLayout,
  preState: before,
  preStateSummary: {
    paperId: PAPER_ID,
    priorStatus: before.papers[0].status,
    priorAssignment: before.papers[0].assigned_to,
    primaryFileId: FILE_ID,
    primaryFileSha256: FILE_SHA256,
    extractions: before.extractions.length,
    extractionFields: before.extractionFields.length,
    populationGroups: before.populationGroups.length,
    populationValues: before.populationValues.length,
    protectedScreeningSignatureSha256: protectedBeforeHash,
  },
  staged: {
    tabs: Object.keys(staged.fields),
    fields: stagedEntries.length,
    reportedFields: stagedEntries.filter((entry) => entry.value !== null).length,
    notReportedCoreFields: stagedEntries.filter((entry) => entry.value === null).map((entry) => entry.fieldId),
    populationGroups: stagedPopulationGroups.length,
    populationValues: stagedPopulationGroups.reduce(
      (count, group) => count + Object.keys(group.values).length,
      0,
    ),
    unknownFields: [],
  },
  applyResult: null,
  integrityGate: null,
  rollback: {
    protectedSnapshot: 'The exact pre-write paper, file, extraction, population, screening, and vote rows are embedded in preState.',
    paperRow: 'Restore status, assigned_to, metadata, and updated_at from preState.papers[0], guarded by the post-apply updated_at.',
    insertedRows: 'Remove only the inserted extraction IDs and population-group ID recorded in applyResult. Their child field/value rows cascade. Row deletion is destructive and requires explicit approval before rollback.',
    storageAndScreening: 'No paper_files, storage object, screening record, screening vote, resolver, or promotion row is written.',
  },
  readyFor: 'Not yet applied',
};

if (APPLY) fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (!APPLY) {
  console.log(JSON.stringify(audit, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const extractionRows = Object.keys(staged.fields).map((tab) => ({
  id: crypto.randomUUID(),
  paper_id: PAPER_ID,
  tab,
  model: 'human-input',
  created_at: now,
  updated_at: now,
}));
const extractionIdByTab = new Map(extractionRows.map((row) => [row.tab, row.id]));
const extractionFieldRows = stagedEntries.map((entry) => ({
  id: crypto.randomUUID(),
  extraction_id: extractionIdByTab.get(entry.tab),
  field_id: entry.fieldId,
  value: entry.value,
  confidence: null,
  source_quote: null,
  page_hint: null,
  metric: entry.metric,
  status: entry.value === null ? 'not_reported' : 'reported',
  updated_at: now,
  updated_by: PROFILE_ID,
}));
const populationGroupRows = stagedPopulationGroups.map((group) => ({
  id: crypto.randomUUID(),
  paper_id: PAPER_ID,
  tab: 'participantCharacteristics',
  label: group.label,
  position: group.position,
  created_at: now,
  updated_at: now,
}));
const populationValueRows = populationGroupRows.flatMap((groupRow) => {
  const parsed = stagedPopulationGroups[groupRow.position];
  return Object.entries(parsed.values).map(([fieldId, value]) => ({
    id: crypto.randomUUID(),
    population_group_id: groupRow.id,
    paper_id: PAPER_ID,
    field_id: fieldId,
    value,
    metric: definitionById.get(fieldId)?.metric ?? null,
    unit: null,
    source_field_id: fieldId,
    created_at: now,
    updated_at: now,
  }));
});

try {
  const insertedExtractions = requireData(
    await supabase.from('extractions').insert(extractionRows).select('id,tab,model'),
    'extraction insert',
  );
  if (insertedExtractions.length !== extractionRows.length) {
    throw new Error(`Expected ${extractionRows.length} inserted extractions, found ${insertedExtractions.length}`);
  }
  const insertedFields = requireData(
    await supabase.from('extraction_fields').insert(extractionFieldRows).select('id,extraction_id,field_id'),
    'extraction field insert',
  );
  if (insertedFields.length !== extractionFieldRows.length) {
    throw new Error(`Expected ${extractionFieldRows.length} inserted fields, found ${insertedFields.length}`);
  }
  const insertedGroups = requireData(
    await supabase.from('population_groups').insert(populationGroupRows).select('id,label,position'),
    'population group insert',
  );
  if (insertedGroups.length !== populationGroupRows.length) {
    throw new Error(`Expected ${populationGroupRows.length} inserted groups, found ${insertedGroups.length}`);
  }
  const insertedValues = requireData(
    await supabase.from('population_values').insert(populationValueRows).select('id,field_id'),
    'population value insert',
  );
  if (insertedValues.length !== populationValueRows.length) {
    throw new Error(`Expected ${populationValueRows.length} inserted values, found ${insertedValues.length}`);
  }
  const updatedMetadata = {
    ...(before.papers[0].metadata ?? {}),
    populationLabels: stagedPopulationGroups.map((group) => group.label),
    populationHash: createPopulationSignature(stagedPopulationGroups),
  };
  const updatedPaper = requireData(
    await supabase
      .from('papers')
      .update({
        assigned_to: PROFILE_ID,
        status: 'processing',
        metadata: updatedMetadata,
        updated_at: now,
      })
      .eq('id', PAPER_ID)
      .eq('assigned_study_id', STUDY_ID)
      .eq('status', 'uploaded')
      .is('assigned_to', null)
      .eq('updated_at', before.papers[0].updated_at)
      .select('id,assigned_study_id,status,assigned_to,updated_at,metadata'),
    'guarded paper assignment/status update',
  );
  if (updatedPaper.length !== 1) throw new Error(`Guarded paper update affected ${updatedPaper.length} rows`);
  audit.applyResult = {
    result: 'passed',
    additiveOnly: true,
    skippedNonblankFields: 0,
    unknownFieldIds: [],
    insertedExtractionIds: insertedExtractions.map((row) => row.id),
    insertedExtractionFieldIds: insertedFields.map((row) => row.id),
    insertedPopulationGroupIds: insertedGroups.map((row) => row.id),
    insertedPopulationValueIds: insertedValues.map((row) => row.id),
    paperUpdate: updatedPaper[0],
    screeningWrites: 0,
    resolverWrites: 0,
    promotionWrites: 0,
    fileWrites: 0,
  };
} catch (error) {
  audit.phase = 'apply_failed';
  audit.applyResult = {
    result: 'failed',
    error: error instanceof Error ? error.message : String(error),
    recovery: 'No automatic destructive compensation was attempted. Use the exact preState and any inserted IDs present in live state to prepare a separately approved rollback.',
  };
  fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  throw error;
}

const after = await fetchSnapshot();
const liveExtractionByTab = new Map(after.extractions.map((row) => [row.tab, row]));
const liveFieldByKey = new Map(
  after.extractionFields.map((row) => {
    const extraction = after.extractions.find((candidate) => candidate.id === row.extraction_id);
    return [`${extraction?.tab}.${row.field_id}`, row];
  }),
);
const sourceToLiveFieldMismatches = stagedEntries.flatMap((entry) => {
  const live = liveFieldByKey.get(`${entry.tab}.${entry.fieldId}`);
  return live?.value === entry.value && live?.status === (entry.value === null ? 'not_reported' : 'reported')
    ? []
    : [{
      tab: entry.tab,
      fieldId: entry.fieldId,
      expectedValue: entry.value,
      actualValue: live?.value ?? null,
      expectedStatus: entry.value === null ? 'not_reported' : 'reported',
      actualStatus: live?.status ?? null,
    }];
});
const liveGroupByPosition = new Map(after.populationGroups.map((row) => [row.position, row]));
const livePopulationValueByKey = new Map(
  after.populationValues.map((row) => {
    const group = after.populationGroups.find((candidate) => candidate.id === row.population_group_id);
    return [`${group?.position}.${row.field_id}`, row.value];
  }),
);
const populationLayoutMismatches = stagedPopulationGroups.flatMap((group) => {
  const live = liveGroupByPosition.get(group.position);
  return live?.label === group.label ? [] : [{
    position: group.position,
    expectedLabel: group.label,
    actualLabel: live?.label ?? null,
  }];
});
const structuredDualWriteMismatches = stagedPopulationGroups.flatMap((group) =>
  Object.entries(group.values).flatMap(([fieldId, expectedValue]) => {
    const fieldTab = definitionById.get(fieldId)?.tab;
    const extractionField = liveFieldByKey.get(`${fieldTab}.${fieldId}`);
    const populationValue = livePopulationValueByKey.get(`${group.position}.${fieldId}`);
    return extractionField?.value === expectedValue && populationValue === expectedValue
      ? []
      : [{
        position: group.position,
        fieldId,
        expectedValue,
        extractionFieldValue: extractionField?.value ?? null,
        populationValue: populationValue ?? null,
      }];
  }),
);
const protectedAfterHash = stableHash(protectedScreeningState(after));
const primaryFileAfter = after.paperFiles.find((row) => row.id === FILE_ID);
const afterPaper = after.papers[0];
const findings = [];
if (after.papers.length !== 1 || afterPaper.assigned_study_id !== STUDY_ID) findings.push('Fixed S4800 membership changed');
if (afterPaper.assigned_to !== PROFILE_ID) findings.push('Assignment is not AbdelRahman Babiker');
if (afterPaper.status !== 'processing') findings.push('Status is not processing');
if (primaryFileAfter?.file_sha256 !== FILE_SHA256 || afterPaper.primary_file_sha256 !== FILE_SHA256) {
  findings.push('Primary source hash changed');
}
if (liveExtractionByTab.get('studyDetails') === undefined) findings.push('studyDetails extraction is missing');
if (liveFieldByKey.get('studyDetails.studyId')?.value !== STUDY_ID) findings.push('studyId does not match assigned_study_id');
if (after.extractions.length !== extractionRows.length) findings.push('Unexpected extraction row count');
if (after.extractionFields.length !== extractionFieldRows.length) findings.push('Unexpected extraction field count');
if (after.populationGroups.length !== populationGroupRows.length) findings.push('Unexpected population group count');
if (after.populationValues.length !== populationValueRows.length) findings.push('Unexpected population value count');
if (sourceToLiveFieldMismatches.length) findings.push('Source-to-live field mismatches found');
if (populationLayoutMismatches.length) findings.push('Population layout mismatches found');
if (structuredDualWriteMismatches.length) findings.push('Structured dual-write mismatches found');
if (protectedAfterHash !== protectedBeforeHash) findings.push('Protected screening/vote/promotion state changed');

audit.phase = findings.length ? 'integrity_gate_failed' : 'complete';
audit.postState = after;
audit.integrityGate = {
  result: findings.length ? 'failed' : 'passed',
  findings: findings.map((message) => ({ severity: 'blocker', message })),
  fixedMembership: after.papers.length === 1 && afterPaper.assigned_study_id === STUDY_ID,
  sourceToLiveFieldTransferMismatches: sourceToLiveFieldMismatches,
  populationLayoutMismatches,
  structuredDualWriteMismatches,
  sourceHashMatchesLivePaper:
    primaryFileAfter?.file_sha256 === FILE_SHA256
    && afterPaper.primary_file_sha256 === FILE_SHA256,
  studyIdMatchesAssignedStudyId: liveFieldByKey.get('studyDetails.studyId')?.value === afterPaper.assigned_study_id,
  assignmentIsAbdelRahmanBabiker: afterPaper.assigned_to === PROFILE_ID,
  statusIsProcessing: afterPaper.status === 'processing',
  protectedScreeningSignatureBeforeSha256: protectedBeforeHash,
  protectedScreeningSignatureAfterSha256: protectedAfterHash,
  protectedScreeningUnchanged: protectedAfterHash === protectedBeforeHash,
  screeningWrites: 0,
  resolverWrites: 0,
  promotionWrites: 0,
  fileWrites: 0,
};
audit.readyFor = findings.length ? 'Blocked pending integrity correction' : 'Human extraction review';
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  auditPath: AUDIT_PATH,
  applyResult: audit.applyResult,
  integrityGate: audit.integrityGate,
  readyFor: audit.readyFor,
}, null, 2));
if (findings.length) process.exit(1);
