import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const PAPER_ID = '65d8464b-db96-4b96-a6b2-9fea69885ba1';
const STUDY_ID = 'S487';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const DOI = '10.4085/1062-6050-47.2.198';
const EXPECTED_FLAG = 'Consult Avanash - NCAA related but not clearly NCAA-ISP/Rio';
const POPULATION_LABEL = "Women's soccer";
const REVIEW_DATE = '2026-07-28';

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

const stableHash = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const selectSnapshot = async () => {
  const paperRows = requireData(
    await supabase.from('papers').select('*').eq('id', PAPER_ID),
    'paper snapshot',
  );
  if (paperRows.length !== 1) throw new Error(`Expected one ${STUDY_ID} paper row`);
  const paper = paperRows[0];

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
        .order('extraction_id')
        .order('field_id'),
      'extraction fields snapshot',
    )
    : [];
  const populationGroups = requireData(
    await supabase.from('population_groups').select('*').eq('paper_id', PAPER_ID).order('position'),
    'population groups snapshot',
  );
  const populationValues = requireData(
    await supabase.from('population_values').select('*').eq('paper_id', PAPER_ID).order('field_id'),
    'population values snapshot',
  );
  const paperFiles = requireData(
    await supabase
      .from('paper_files')
      .select('id,paper_id,storage_bucket,storage_object_path,original_filename,size_bytes,checksum_sha256,uploaded_at,original_file_name,file_sha256')
      .eq('paper_id', PAPER_ID)
      .order('id'),
    'paper files snapshot',
  );
  const screeningRecords = requireData(
    await supabase.from('screening_records').select('*').eq('assigned_study_id', STUDY_ID).order('id'),
    'screening records snapshot',
  );
  const screeningVotes = screeningRecords.length
    ? requireData(
      await supabase
        .from('screening_votes')
        .select('*')
        .in('screening_record_id', screeningRecords.map((row) => row.id))
        .order('screening_record_id')
        .order('vote_order'),
      'screening votes snapshot',
    )
    : [];
  const aiReviewDecisions = requireData(
    await supabase.from('ai_review_decisions').select('*').eq('paper_id', PAPER_ID),
    'AI review decisions snapshot',
  );

  return {
    paper,
    extractions,
    extractionFields,
    populationGroups,
    populationValues,
    paperFiles,
    screeningRecords,
    screeningVotes,
    aiReviewDecisions,
  };
};

const extractionByTab = (snapshot, tab) => {
  const row = snapshot.extractions.find((candidate) => candidate.tab === tab);
  if (!row) throw new Error(`Missing extraction row for ${tab}`);
  return row;
};

const fieldRow = (snapshot, tab, fieldId) => {
  const extraction = extractionByTab(snapshot, tab);
  return snapshot.extractionFields.find(
    (candidate) => candidate.extraction_id === extraction.id && candidate.field_id === fieldId,
  ) ?? null;
};

const populationValueRow = (snapshot, fieldId) =>
  snapshot.populationValues.find((candidate) => candidate.field_id === fieldId) ?? null;

const expectedBefore = {
  studyDesign: 'descriptive epidemiology study',
  injuryDefinition: 'time-loss',
  mechanismReporting: 'Certified athletic trainers',
  sampleSizePlayers: '35',
  injuryTrainingCount: '238.3',
  injuryIncidenceOverall: null,
};

const changes = [
  {
    tab: 'studyDetails',
    fieldId: 'doi',
    value: DOI,
    sourceQuote: 'PubMed PMID 22488286 reports DOI 10.4085/1062-6050-47.2.198.',
    pageHint: 'PubMed metadata',
    expectedValue: undefined,
  },
  {
    tab: 'studyDetails',
    fieldId: 'studyDesign',
    value: 'descriptive epidemiology study [prospective data]',
    sourceQuote: 'Daily team rosters, practices, games, and reportable injuries were entered into the ongoing SIMS surveillance system.',
    pageHint: '2 of 7',
    expectedValue: expectedBefore.studyDesign,
  },
  {
    tab: 'definitions',
    fieldId: 'injuryDefinition',
    value: 'time loss [clinical signs of tissue damage and unable to return the same day]',
    sourceQuote: 'All included injuries required clinical signs of tissue damage and inability to return to practice or game the same day.',
    pageHint: '2 of 7',
    expectedValue: expectedBefore.injuryDefinition,
  },
  {
    tab: 'definitions',
    fieldId: 'mechanismReporting',
    value: 'medical staff [certified athletic trainers]',
    sourceQuote: 'Certified athletic trainers are responsible for entering data from their teams into SIMS.',
    pageHint: '2 of 7',
    expectedValue: expectedBefore.mechanismReporting,
  },
  {
    tab: 'participantCharacteristics',
    fieldId: 'sampleSizePlayers',
    value: null,
    sourceQuote: 'Table 1 reports 35 injured soccer athletes, not the full soccer roster or enrolled player sample.',
    pageHint: '3 of 7',
    expectedValue: expectedBefore.sampleSizePlayers,
  },
  {
    tab: 'injuryOutcome',
    fieldId: 'injuryTrainingCount',
    value: null,
    sourceQuote: 'No soccer-specific training-injury count is reported; 238.3 is the summed overall rate, not a count.',
    pageHint: '4 of 7',
    expectedValue: expectedBefore.injuryTrainingCount,
  },
  {
    tab: 'injuryOutcome',
    fieldId: 'injuryIncidenceOverall',
    value: '238.3',
    sourceQuote: 'Soccer overuse rate 48.3 plus acute rate 190.0 per 10,000 AEs; disjoint categories share the same 3,105-AE denominator.',
    pageHint: '4 of 7',
    expectedValue: expectedBefore.injuryIncidenceOverall,
  },
];

const assertPreconditions = (snapshot) => {
  const { paper } = snapshot;
  if (paper.assigned_study_id !== STUDY_ID) throw new Error('Assigned study ID changed');
  if (paper.assigned_to !== PROFILE_ID) throw new Error('Assignment changed');
  if (paper.status !== 'flagged') throw new Error(`Expected flagged status, found ${paper.status}`);
  if (paper.flag_reason !== EXPECTED_FLAG) throw new Error('Flag reason changed');
  if (paper.primary_file_sha256 !== '383f7b3138b1b4036f0059f1a5adaac5a2243a5616e1b43e637918794e2b58d2') {
    throw new Error('Primary PDF SHA-256 changed');
  }
  if (snapshot.paperFiles.length !== 1 || snapshot.paperFiles[0].id !== paper.primary_file_id) {
    throw new Error('Primary PDF attachment relationship changed');
  }
  if (snapshot.populationGroups.length !== 1 || snapshot.populationGroups[0].position !== 0) {
    throw new Error('Population layout changed');
  }
  for (const change of changes) {
    const row = fieldRow(snapshot, change.tab, change.fieldId);
    if (change.expectedValue === undefined) {
      if (row) throw new Error(`${change.fieldId}: expected no existing row`);
    } else if (!row || row.value !== change.expectedValue) {
      throw new Error(
        `${change.fieldId}: expected ${JSON.stringify(change.expectedValue)}, found ${JSON.stringify(row?.value)}`,
      );
    }
  }
};

const targetRecoverySnapshot = (snapshot) => ({
  paper: {
    id: snapshot.paper.id,
    assigned_study_id: snapshot.paper.assigned_study_id,
    assigned_to: snapshot.paper.assigned_to,
    status: snapshot.paper.status,
    flag_reason: snapshot.paper.flag_reason,
    doi: snapshot.paper.doi,
    normalized_doi: snapshot.paper.normalized_doi,
    metadata: snapshot.paper.metadata,
    updated_at: snapshot.paper.updated_at,
    primary_file_id: snapshot.paper.primary_file_id,
    primary_file_sha256: snapshot.paper.primary_file_sha256,
    storage_bucket: snapshot.paper.storage_bucket,
    storage_object_path: snapshot.paper.storage_object_path,
  },
  extractionFields: changes.map((change) => ({
    tab: change.tab,
    fieldId: change.fieldId,
    row: fieldRow(snapshot, change.tab, change.fieldId),
  })),
  populationGroup: snapshot.populationGroups[0],
  populationValues: ['injuryDefinition', 'sampleSizePlayers', 'injuryTrainingCount', 'injuryIncidenceOverall']
    .map((fieldId) => ({ fieldId, row: populationValueRow(snapshot, fieldId) })),
});

const deriveOneRowPopulation = (snapshot) => {
  const values = {};
  for (const field of snapshot.extractionFields) {
    if (!field.value) continue;
    const fieldId = field.field_id;
    const include =
      new Set([
        'ageCategory',
        'sex',
        'meanAge',
        'sampleSizePlayers',
        'numberOfTeams',
        'observationDuration',
        'seasonLength',
        'numberOfSeasons',
        'totalExposure',
        'matchExposure',
        'trainingExposure',
      ]).has(fieldId)
      || fieldId.includes('_prevalence')
      || fieldId.includes('_incidence')
      || fieldId.includes('_burden')
      || fieldId.includes('_severityMeanDays')
      || fieldId.includes('_severityTotalDays')
      || fieldId.startsWith('injury')
      || fieldId.startsWith('illness');
    if (include) values[fieldId] = field.value;
  }
  return [{ position: 0, label: POPULATION_LABEL, values: Object.fromEntries(Object.entries(values).sort()) }];
};

const updateExistingField = async (change, before) => {
  const row = fieldRow(before, change.tab, change.fieldId);
  const query = supabase
    .from('extraction_fields')
    .update({
      value: change.value,
      status: change.value == null ? 'not_reported' : 'reported',
      source_quote: change.sourceQuote,
      page_hint: change.pageHint,
      updated_at: new Date().toISOString(),
      updated_by: PROFILE_ID,
      updated_by_agent: 'codex',
    })
    .eq('id', row.id)
    .eq('updated_at', row.updated_at);
  const guarded = row.value == null ? query.is('value', null) : query.eq('value', row.value);
  const rows = requireData(await guarded.select('*'), `${change.fieldId} guarded update`);
  if (rows.length !== 1) throw new Error(`${change.fieldId}: guarded update affected ${rows.length} rows`);
};

const insertDoiField = async (change, before) => {
  const extraction = extractionByTab(before, change.tab);
  const row = {
    id: crypto.randomUUID(),
    extraction_id: extraction.id,
    field_id: change.fieldId,
    value: change.value,
    confidence: null,
    status: 'reported',
    metric: null,
    source_quote: change.sourceQuote,
    page_hint: change.pageHint,
    updated_at: new Date().toISOString(),
    updated_by: PROFILE_ID,
    updated_by_agent: 'codex',
  };
  const rows = requireData(
    await supabase.from('extraction_fields').insert(row).select('*'),
    'DOI extraction field insert',
  );
  if (rows.length !== 1) throw new Error(`DOI insert affected ${rows.length} rows`);
};

const syncPopulationValue = async (before, fieldId, value) => {
  const field = changes.find((change) => change.fieldId === fieldId);
  const existing = populationValueRow(before, fieldId);
  if (existing) {
    const query = supabase
      .from('population_values')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('updated_at', existing.updated_at);
    const guarded = existing.value == null ? query.is('value', null) : query.eq('value', existing.value);
    const rows = requireData(await guarded.select('*'), `${fieldId} population value update`);
    if (rows.length !== 1) throw new Error(`${fieldId}: population update affected ${rows.length} rows`);
    return;
  }
  if (value == null) return;
  const group = before.populationGroups[0];
  const rows = requireData(
    await supabase.from('population_values').insert({
      id: crypto.randomUUID(),
      population_group_id: group.id,
      paper_id: PAPER_ID,
      field_id: fieldId,
      value,
      metric: null,
      unit: null,
      source_field_id: fieldId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select('*'),
    `${fieldId} population value insert`,
  );
  if (rows.length !== 1) throw new Error(`${fieldId}: population insert affected ${rows.length} rows`);
  if (!field) throw new Error(`${fieldId}: missing staged field definition`);
};

const applyChanges = async (before) => {
  for (const change of changes) {
    if (change.expectedValue === undefined) {
      await insertDoiField(change, before);
    } else {
      await updateExistingField(change, before);
    }
  }

  for (const fieldId of ['injuryDefinition', 'sampleSizePlayers', 'injuryTrainingCount', 'injuryIncidenceOverall']) {
    await syncPopulationValue(before, fieldId, changes.find((change) => change.fieldId === fieldId).value);
  }

  const group = before.populationGroups[0];
  const groupRows = requireData(
    await supabase
      .from('population_groups')
      .update({ label: POPULATION_LABEL, updated_at: new Date().toISOString() })
      .eq('id', group.id)
      .eq('label', group.label)
      .eq('updated_at', group.updated_at)
      .select('*'),
    'population label update',
  );
  if (groupRows.length !== 1) throw new Error(`Population label update affected ${groupRows.length} rows`);

  const interim = await selectSnapshot();
  const populationGroups = deriveOneRowPopulation(interim);
  const metadata = {
    ...(before.paper.metadata ?? {}),
    populationLabels: [POPULATION_LABEL],
    populationHash: JSON.stringify(populationGroups),
  };
  const paperRows = requireData(
    await supabase
      .from('papers')
      .update({
        status: 'extracted',
        flag_reason: null,
        doi: DOI,
        normalized_doi: DOI,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', PAPER_ID)
      .eq('assigned_study_id', STUDY_ID)
      .eq('assigned_to', PROFILE_ID)
      .eq('status', 'flagged')
      .eq('flag_reason', EXPECTED_FLAG)
      .eq('updated_at', before.paper.updated_at)
      .select('*'),
    'guarded paper update',
  );
  if (paperRows.length !== 1) throw new Error(`Paper update affected ${paperRows.length} rows`);
};

const compareProtected = (before, after) => ({
  assignmentPreserved: after.paper.assigned_to === before.paper.assigned_to,
  assignedStudyIdPreserved: after.paper.assigned_study_id === before.paper.assigned_study_id,
  primaryFilePointerPreserved:
    after.paper.primary_file_id === before.paper.primary_file_id
    && after.paper.storage_bucket === before.paper.storage_bucket
    && after.paper.storage_object_path === before.paper.storage_object_path
    && after.paper.primary_file_sha256 === before.paper.primary_file_sha256,
  paperFilesUnchanged: stableHash(after.paperFiles) === stableHash(before.paperFiles),
  screeningRecordsUnchanged: stableHash(after.screeningRecords) === stableHash(before.screeningRecords),
  screeningVotesUnchanged: stableHash(after.screeningVotes) === stableHash(before.screeningVotes),
  aiReviewDecisionsUnchanged: stableHash(after.aiReviewDecisions) === stableHash(before.aiReviewDecisions),
});

const populationMismatches = (snapshot) => {
  const group = snapshot.populationGroups[0];
  return snapshot.populationValues.flatMap((row) => {
    if (row.population_group_id !== group.id) {
      return [{ fieldId: row.field_id, reason: 'wrong population group' }];
    }
    const extractionField = snapshot.extractionFields.find((candidate) => candidate.field_id === row.field_id);
    if (!extractionField || extractionField.value !== row.value) {
      return [{
        fieldId: row.field_id,
        populationValue: row.value,
        extractionValue: extractionField?.value ?? null,
      }];
    }
    return [];
  });
};

const liveGate = (before, after) => {
  const protectedChecks = compareProtected(before, after);
  const writtenChecks = changes.map((change) => {
    const row = fieldRow(after, change.tab, change.fieldId);
    return {
      fieldId: change.fieldId,
      expected: change.value,
      actual: row?.value ?? null,
      matches: Boolean(row) && row.value === change.value,
    };
  });
  const mismatches = populationMismatches(after);
  const checks = {
    correctPaperStatus: after.paper.status === 'extracted',
    flagCleared: after.paper.flag_reason === null,
    doiWritten: after.paper.doi === DOI && after.paper.normalized_doi === DOI,
    studyIdFieldPreserved: fieldRow(after, 'studyDetails', 'studyId')?.value === STUDY_ID,
    sourceAttached: after.paperFiles.length === 1 && after.paperFiles[0].id === after.paper.primary_file_id,
    populationLayout:
      after.populationGroups.length === 1
      && after.populationGroups[0].position === 0
      && after.populationGroups[0].label === POPULATION_LABEL,
    populationValueMismatches: mismatches,
    allWrittenFieldsMatch: writtenChecks.every((check) => check.matches),
    ...protectedChecks,
  };
  const passed = Object.entries(checks)
    .filter(([key]) => key !== 'populationValueMismatches')
    .every(([, value]) => value === true)
    && mismatches.length === 0;
  return { passed, checks, writtenChecks };
};

const before = await selectSnapshot();
assertPreconditions(before);

const audit = {
  schemaVersion: 1,
  task: 'S487 eligibility adjudication, Tabs 1-10 extraction correction, and focused live integrity gate',
  date: REVIEW_DATE,
  mode: APPLY ? 'live_apply' : 'dry_run',
  model: 'Codex, GPT-5 family runtime (GPT-5.5 was not exposed in this environment); Gemini not used',
  eligibility: {
    decision: 'eligible local/current-participant prospective surveillance cohort',
    sourceSystem: 'Big Ten Sports Injury Monitoring System (SIMS)',
    sourceOwnershipEvidence:
      'Methods: SIMS was established by the Big Ten Athletic Conference in the early 1980s.',
    geographicScopeEvidence:
      'Methods: athletes from one NCAA Division I institution; Limitations: study limited to a single NCAA Big Ten institution and a national sample is needed.',
    notNcaaIsp:
      'The primary outcomes came from the institution-level SIMS roster, daily practice/game logs and injury records, not the NCAA Injury Surveillance Program.',
  },
  primaryPdf: {
    localVerifiedPath: '/tmp/S487-yang2012.pdf',
    sha256: before.paper.primary_file_sha256,
    hashVerifiedAgainstLivePointer: true,
    pages: 7,
  },
  populationLayout: {
    before: before.populationGroups.map(({ label, position }) => ({ label, position })),
    staged: [{ label: POPULATION_LABEL, position: 0 }],
    rationale: 'Only the directly reported women’s soccer sport row is eligible for football extraction.',
  },
  stageACompleteness: {
    passed: true,
    tabs1To4:
      'Citation, DOI, descriptive epidemiology design with prospective daily surveillance data, one U.S. Division I women’s soccer team, female collegiate age group, three-season observation, time-loss definition, medical-staff reporting, athlete-exposure denominator and 3,105 soccer AEs checked.',
    tab5:
      'Soccer total 74 injuries, 15 overuse/repetitive-gradual and 59 acute-sudden. Direct rates are 48.3 and 190.0 per 10,000 AEs; 238.3 is the permitted sum across disjoint onset categories sharing the same denominator.',
    tabs6To10:
      'No illnesses reported. Tables 3-4 provide type, location and severity only for all sports or sex-wide groups, not soccer, so no soccer-specific structured rows are compatible.',
    matchTrainingOrientation:
      'No soccer-specific match/practice exposure or injury split is reported; the existing training-count value 238.3 is a misplaced rate.',
    intentionallyBlank:
      'Soccer roster/sample size, mean age, match/training exposure and counts, recurrence, burden, time-loss duration, common diagnosis/type/location/severity, tissue, location and illness families.',
    derivedValues: [{
      fieldId: 'injuryIncidenceOverall',
      value: '238.3',
      calculation: '48.3 overuse + 190.0 acute, same 3,105 athlete-exposure denominator',
      confidenceInterval: 'not derived or stored because the paper reports only category-specific CIs',
    }],
    blockersCorrectedInStage: [
      'Remove 35 from sampleSizePlayers because it is injured athletes, not roster/sample size.',
      'Remove 238.3 from injuryTrainingCount and place it in injuryIncidenceOverall.',
      'Canonicalise the injury definition and reporter category.',
      'Add DOI and prospective-data provenance to the descriptive study design.',
    ],
  },
  intendedChanges: changes.map(({ expectedValue, ...change }) => ({ ...change, before: expectedValue ?? null })),
  recoverySnapshot: targetRecoverySnapshot(before),
  protectedBeforeHashes: {
    paperFiles: stableHash(before.paperFiles),
    screeningRecords: stableHash(before.screeningRecords),
    screeningVotes: stableHash(before.screeningVotes),
    aiReviewDecisions: stableHash(before.aiReviewDecisions),
  },
  stageBIntegrityGate: null,
};

if (APPLY) {
  await applyChanges(before);
  const after = await selectSnapshot();
  audit.stageBIntegrityGate = liveGate(before, after);
  audit.after = {
    paper: {
      id: after.paper.id,
      assigned_study_id: after.paper.assigned_study_id,
      assigned_to: after.paper.assigned_to,
      status: after.paper.status,
      flag_reason: after.paper.flag_reason,
      doi: after.paper.doi,
      normalized_doi: after.paper.normalized_doi,
      primary_file_id: after.paper.primary_file_id,
      primary_file_sha256: after.paper.primary_file_sha256,
    },
    populationGroups: after.populationGroups,
    targetExtractionFields: changes.map((change) => ({
      tab: change.tab,
      fieldId: change.fieldId,
      row: fieldRow(after, change.tab, change.fieldId),
    })),
    targetPopulationValues: ['injuryDefinition', 'sampleSizePlayers', 'injuryTrainingCount', 'injuryIncidenceOverall']
      .map((fieldId) => ({ fieldId, row: populationValueRow(after, fieldId) })),
  };
  if (!audit.stageBIntegrityGate.passed) {
    throw new Error('Focused live integrity gate failed; use recoverySnapshot for forward correction');
  }
}

const outputDir = path.join(APP_DIR, 'data', 'second-search-extraction', 'adjudication-2026-07-28');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(
  outputDir,
  `s487-source-live-${APPLY ? 'apply-and-integrity-gate' : 'pre-apply-completeness'}-${REVIEW_DATE}.json`,
);
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify({
  mode: audit.mode,
  studyId: STUDY_ID,
  eligibility: audit.eligibility.decision,
  stageACompletenessPassed: audit.stageACompleteness.passed,
  intendedChanges: audit.intendedChanges.map(({ fieldId, before, value }) => ({ fieldId, before, value })),
  outputPath,
  stageBIntegrityGatePassed: audit.stageBIntegrityGate?.passed ?? null,
}, null, 2));
