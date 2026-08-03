import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const SOURCE_PROPOSAL_PATH = path.join(
  APP_DIR,
  'data',
  'full-text-pdf-retrieval',
  'promoted-title-abstract-2026-07-30',
  'extraction-gate-audit-2026-07-30',
  'prep-s683-s2761',
  's2761-stage-a-proposal.json',
);
const SOURCE_PDF_PATH = path.join(
  APP_DIR,
  'data',
  'full-text-pdf-retrieval',
  'promoted-title-abstract-2026-07-30',
  'worker-b',
  'files',
  'S2761.pdf',
);
const AUDIT_PATH = path.join(
  APP_DIR,
  'data',
  'full-text-pdf-retrieval',
  'promoted-title-abstract-2026-07-30',
  'extraction-gate-audit-2026-07-30',
  's2761-season-population-correction-final-live-audit-2026-08-01.json',
);
const APPLY = process.argv.includes('--apply');
const STUDY_ID = 'S2761';
const PAPER_ID = 'd4d0195b-4fd9-4627-be16-e71f941e8383';
const FILE_ID = '690a9c53-0280-45c4-bbe3-8fb2425a4de2';
const FILE_SHA256 = '6435ff92affb8b580dfee3505485c75eb274512567f5b5450fde4ed0c1df597f';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const ORIGINAL_LABELS = ['Total', 'Goalkeeper', 'Defenders', 'Midfielders', 'Forwards'];
const SEASON_LABELS = [
  'Total',
  '2016-2017 season',
  '2017-2018 season',
  '2018-2019 season',
  '2019-2020 season',
  '2020-2021 season',
];

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

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};
const stableHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const sorted = (rows) => [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
const sameIds = (left, right) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
const groupValuesByPosition = (groups, values) => new Map(
  values.map((row) => {
    const group = groups.find((candidate) => candidate.id === row.population_group_id);
    return [`${group?.position}.${row.field_id}`, row];
  }),
);
const protectedState = (snapshot) => ({
  screening: sorted(snapshot.screening),
  votes: sorted(snapshot.votes),
});

const fetchSnapshot = async () => {
  const papers = requireData(await supabase.from('papers').select('*').eq('id', PAPER_ID), 'paper snapshot');
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
  const notes = requireData(
    await supabase.from('paper_notes').select('*').eq('paper_id', PAPER_ID).order('created_at'),
    'paper_notes snapshot',
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
    notes,
    screening,
    votes,
  };
};

const proposal = JSON.parse(fs.readFileSync(SOURCE_PROPOSAL_PATH, 'utf8'));
const fields = structuredClone(proposal.fields);
fields.participantCharacteristics.sex = 'male';
fields.participantCharacteristics.sampleSizePlayers = '169\n33\n33\n31\n35\n37';
fields.injuryOutcome.injuryPlayersCompletedStudy = '169\n33\n33\n31\n35\n37';
fields.injuryOutcome.injuryTeamsCompletedStudy = '1';
fields.injuryOutcome.injuryTotalCount = '\n41\n32\n58\n49\n46';
fields.injuryOutcome.injuryIncidenceOverall = '8.9\n8.08\n6.17\n12.6\n9.81\n8.2';
fields.injuryOutcome.injuryIncidenceMatch = '15.47\n12.02\n9.6\n23.6\n19.4\n15.8';
fields.injuryOutcome.injuryIncidenceTraining = '7.76\n7.2\n5.5\n10.8\n8.45\n7.1';
fields.injuryOutcome.injuryTimeLossTotal = '4457\n926\n974\n875\n624\n1058';
fields.injuryOutcome.injuryMostCommonSeverity = [
  'minor [<8 days, authors\' reported grouping]',
  'minor [<8 days]',
  'minor [<8 days]',
  'minor [<8 days]',
  'minor [<8 days]',
  'severe/major [>28 days]',
].join('\n');
fields.illnessOutcome.illnessTimeLossTotal = '116\n0\n0\n28\n18\n70';
fields.injuryLocation.injuryLocation_abdomen_prevalence = '2';
fields.injuryLocation.injuryLocation_groin_prevalence = '33';
fields.injuryLocation.injuryLocation_thigh_prevalence = '81';
fields.injuryLocation.injuryLocation_knee_prevalence = '32';
fields.injuryLocation.injuryLocation_lower_leg_prevalence = '29';
fields.injuryLocation.injuryLocation_upper_limb_overall_prevalence = '2';
fields.injuryLocation.injuryLocation_shoulder_prevalence = null;

const stagedEntries = Object.entries(fields).flatMap(([tab, tabFields]) =>
  Object.entries(tabFields ?? {}).map(([fieldId, rawValue]) => {
    const definition = definitionById.get(fieldId);
    if (!definition || definition.tab !== tab) throw new Error(`Unknown or wrong-tab field: ${tab}.${fieldId}`);
    return {
      tab,
      fieldId,
      value: fieldId === 'studyId'
        ? STUDY_ID
        : normalizeGlobalFieldValue(fieldId, rawValue == null ? null : String(rawValue)),
      metric: definition.metric ?? null,
    };
  }),
);
const stagedPopulationGroups = derivePopulationGroups(stagedEntries).map((group, index) => ({
  ...group,
  label: SEASON_LABELS[index],
}));
if (stagedPopulationGroups.length !== SEASON_LABELS.length) {
  throw new Error(`Expected ${SEASON_LABELS.length} staged population groups, found ${stagedPopulationGroups.length}`);
}
const expectedPopulationValueCount = stagedPopulationGroups.reduce(
  (count, group) => count + Object.keys(group.values).length,
  0,
);

const before = await fetchSnapshot();
const paperBefore = before.papers[0];
if (!paperBefore || paperBefore.assigned_study_id !== STUDY_ID) throw new Error('S2761 paper identity changed');
if (paperBefore.status !== 'processing' || paperBefore.assigned_to !== PROFILE_ID) {
  throw new Error('S2761 is no longer assigned to AbdelRahman Babiker in processing');
}
if (before.paperFiles.length !== 1 || before.paperFiles[0].id !== FILE_ID) {
  throw new Error('S2761 live attachment count or identity changed');
}
if (
  paperBefore.primary_file_sha256 !== FILE_SHA256
  || before.paperFiles[0].file_sha256 !== FILE_SHA256
  || hashFile(SOURCE_PDF_PATH) !== FILE_SHA256
) {
  throw new Error('Live or local S2761 primary source hash changed');
}
if (before.extractions.length !== 10 || before.extractionFields.length !== 78) {
  throw new Error('S2761 extraction row or field count changed from the verified bridge apply');
}
if (JSON.stringify(before.populationGroups.map((row) => row.label)) !== JSON.stringify(ORIGINAL_LABELS)) {
  throw new Error('S2761 no longer has the expected position-based population layout');
}
if (before.populationValues.length !== 56) {
  throw new Error('S2761 population values changed from the verified bridge apply');
}
const fullTextBefore = before.screening.find((row) => row.stage === 'full_text');
if (
  !fullTextBefore
  || paperBefore.metadata?.screeningRecordId !== fullTextBefore.id
  || paperBefore.metadata?.temporaryExtractionPromotion !== true
  || paperBefore.metadata?.humanFullTextReviewStillPending !== true
) {
  throw new Error('S2761 temporary extraction bridge or screening link changed');
}
const protectedBeforeHash = stableHash(protectedState(before));
const notesBeforeHash = stableHash(sorted(before.notes));

const currentExtractionByTab = new Map(before.extractions.map((row) => [row.tab, row]));
const currentFieldByKey = new Map(
  before.extractionFields.map((row) => {
    const extraction = before.extractions.find((candidate) => candidate.id === row.extraction_id);
    return [`${extraction?.tab}.${row.field_id}`, row];
  }),
);
const currentGroupByPosition = new Map(before.populationGroups.map((row) => [row.position, row]));
const currentPopulationValueByKey = groupValuesByPosition(before.populationGroups, before.populationValues);

const audit = {
  artifactType: 'S2761 season-based extraction correction final live audit',
  date: '2026-08-01',
  generatedAt: new Date().toISOString(),
  mode: APPLY ? 'apply' : 'dry_run',
  phase: 'pre_state_persisted',
  scope: 'S2761 only; replace position-based population mapping with directly reported season rows',
  source: {
    proposalPath: SOURCE_PROPOSAL_PATH,
    pdfPath: SOURCE_PDF_PATH,
    sha256: FILE_SHA256,
    pages: 15,
    sectionsScanned: [
      'Methods - Participants and Figure 1',
      'Methods - injury identification, severity, follow-up, incidence',
      'Results - all prose, Tables 1-7, Figures 2-6',
      'Discussion, limitations, and conclusion',
    ],
  },
  populationLayout: {
    priorLabels: ORIGINAL_LABELS,
    correctedLabels: SEASON_LABELS,
    rationale: 'The leading Total row preserves pooled-only metrics. The participant flow and Figures 2, 3, 5, and 6 directly report compatible values for each of five seasons; season is the strongest directly reported extraction axis.',
  },
  stageA: {
    result: 'passed',
    tabsChecked: Object.keys(fields),
    stagedFields: stagedEntries.length,
    reportedFields: stagedEntries.filter((entry) => entry.value !== null).length,
    notReportedFields: stagedEntries.filter((entry) => entry.value === null).map((entry) => entry.fieldId),
    populationGroups: stagedPopulationGroups.length,
    nonblankPopulationValues: expectedPopulationValueCount,
    unknownFields: [],
    directSeasonValues: {
      sampleSizePlayers: ['33', '33', '31', '35', '37'],
      injuryTotalCount: ['41', '32', '58', '49', '46'],
      injuryIncidenceOverall: ['8.08', '6.17', '12.6', '9.81', '8.2'],
      injuryIncidenceMatch: ['12.02', '9.6', '23.6', '19.4', '15.8'],
      injuryIncidenceTraining: ['7.2', '5.5', '10.8', '8.45', '7.1'],
      illnessTimeLossTotal: ['0', '0', '28', '18', '70'],
    },
    transparentAggregations: {
      injuryTimeLossTotalBySeason: ['4 + 922 = 926', '331 + 643 = 974', '165 + 710 = 875', '50 + 574 = 624', '0 + 1058 = 1058'],
      pooledLocationCounts: ['groin 30 + osteitis pubis 3 = 33', 'thigh 20 + 59 + 2 = 81', 'lower leg 2 + 22 + 5 = 29'],
    },
    caveats: [
      'Pooled injury count remains blank because the source reports 224 in Results prose, 229 in severity prose, while the five direct Figure 2 season counts sum to 226.',
      'Pooled overall incidence retains 8.9 from the abstract and Results with CI 8.72-9.0; the Discussion reports 8.49.',
      'Time-loss units alternate between missed training sessions and days. Stored season totals are transparent contact plus non-contact component sums from Figure 3.',
      'Figure 4 pooled knee count 32 replaces the prior position-table aggregation of 35. The combined Foot-Ankle count is not forced into separate foot or ankle count rows.',
      'The paper explicitly identifies a professional men\'s team and lack of female participants, so sex is corrected to male.',
    ],
  },
  preState: before,
  preStateSummary: {
    paperUpdatedAt: paperBefore.updated_at,
    extractionIds: before.extractions.map((row) => row.id),
    extractionFieldIds: before.extractionFields.map((row) => row.id),
    populationGroupIds: before.populationGroups.map((row) => row.id),
    populationValueIds: before.populationValues.map((row) => row.id),
    noteIds: before.notes.map((row) => row.id),
    notesSignatureSha256: notesBeforeHash,
    protectedScreeningSignatureSha256: protectedBeforeHash,
  },
  applyResult: null,
  postState: null,
  integrityGate: null,
  rollback: {
    snapshot: 'Restore the exact preState extraction_fields, population_groups, population_values, papers[0].metadata, and papers[0].updated_at values.',
    insertedRows: 'Remove only correction-inserted IDs recorded in applyResult. Deletion is destructive and requires explicit approval.',
    automaticRollback: false,
  },
  readyFor: 'Correction not yet applied',
};

if (APPLY) fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
if (!APPLY) {
  console.log(JSON.stringify({
    mode: 'dry_run',
    preconditions: 'passed',
    sourceSha256: FILE_SHA256,
    protectedScreeningSignatureSha256: protectedBeforeHash,
    stagedFields: stagedEntries.length,
    reportedFields: stagedEntries.filter((entry) => entry.value !== null).length,
    populationLabels: SEASON_LABELS,
    nonblankPopulationValues: expectedPopulationValueCount,
    pooledInjuryCount: null,
    seasonInjuryCounts: ['41', '32', '58', '49', '46'],
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const insertedExtractionFieldIds = [];
const fieldRows = stagedEntries.map((entry) => {
  const current = currentFieldByKey.get(`${entry.tab}.${entry.fieldId}`);
  if (current) {
    return {
      ...current,
      value: entry.value,
      metric: entry.metric,
      status: entry.value === null ? 'not_reported' : 'reported',
      updated_at: now,
      updated_by: PROFILE_ID,
    };
  }
  const extraction = currentExtractionByTab.get(entry.tab);
  if (!extraction) throw new Error(`Missing extraction row for ${entry.tab}`);
  const id = crypto.randomUUID();
  insertedExtractionFieldIds.push(id);
  return {
    id,
    extraction_id: extraction.id,
    field_id: entry.fieldId,
    value: entry.value,
    confidence: null,
    source_quote: null,
    page_hint: null,
    metric: entry.metric,
    status: entry.value === null ? 'not_reported' : 'reported',
    updated_at: now,
    updated_by: PROFILE_ID,
  };
});

const correctedGroupRows = stagedPopulationGroups.map((group) => {
  const current = currentGroupByPosition.get(group.position);
  return current
    ? { ...current, label: group.label, updated_at: now }
    : {
      id: crypto.randomUUID(),
      paper_id: PAPER_ID,
      tab: 'participantCharacteristics',
      label: group.label,
      position: group.position,
      created_at: now,
      updated_at: now,
    };
});
const insertedPopulationGroupIds = correctedGroupRows
  .filter((row) => !before.populationGroups.some((candidate) => candidate.id === row.id))
  .map((row) => row.id);
const expectedPopulationRows = stagedPopulationGroups.flatMap((group) => {
  const groupRow = correctedGroupRows[group.position];
  return Object.entries(group.values).map(([fieldId, value]) => {
    const current = currentPopulationValueByKey.get(`${group.position}.${fieldId}`);
    return current
      ? { ...current, value, metric: definitionById.get(fieldId)?.metric ?? null, updated_at: now }
      : {
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
      };
  });
});
const expectedPopulationKeys = new Set(
  stagedPopulationGroups.flatMap((group) =>
    Object.keys(group.values).map((fieldId) => `${group.position}.${fieldId}`)),
);
const clearedPopulationRows = before.populationValues
  .filter((row) => {
    const group = before.populationGroups.find((candidate) => candidate.id === row.population_group_id);
    return !expectedPopulationKeys.has(`${group?.position}.${row.field_id}`);
  })
  .map((row) => ({ ...row, value: null, updated_at: now }));
const insertedPopulationValueIds = expectedPopulationRows
  .filter((row) => !before.populationValues.some((candidate) => candidate.id === row.id))
  .map((row) => row.id);

try {
  const updatedFields = requireData(
    await supabase.from('extraction_fields').upsert(fieldRows).select('id,extraction_id,field_id,value,status'),
    'corrected extraction field upsert',
  );
  if (updatedFields.length !== fieldRows.length) throw new Error('Corrected extraction field count mismatch');
  const updatedGroups = requireData(
    await supabase.from('population_groups').upsert(correctedGroupRows).select('*'),
    'corrected population group upsert',
  );
  if (updatedGroups.length !== correctedGroupRows.length) throw new Error('Corrected population group count mismatch');
  const populationRowsToUpsert = [...expectedPopulationRows, ...clearedPopulationRows];
  const updatedPopulationRows = requireData(
    await supabase.from('population_values').upsert(populationRowsToUpsert).select('id,field_id,value,population_group_id'),
    'corrected population value upsert',
  );
  if (updatedPopulationRows.length !== populationRowsToUpsert.length) {
    throw new Error('Corrected population value count mismatch');
  }

  const latestPaperRows = requireData(await supabase.from('papers').select('*').eq('id', PAPER_ID), 'latest paper');
  const latestPaper = latestPaperRows[0];
  if (
    latestPaper?.assigned_study_id !== STUDY_ID
    || latestPaper?.status !== 'processing'
    || latestPaper?.assigned_to !== PROFILE_ID
    || latestPaper?.primary_file_sha256 !== FILE_SHA256
  ) {
    throw new Error('Latest guarded S2761 paper state changed before metadata update');
  }
  const correctedMetadata = {
    ...(latestPaper.metadata ?? {}),
    populationLabels: SEASON_LABELS,
    populationHash: createPopulationSignature(stagedPopulationGroups),
    extractionSeasonCorrection20260801: {
      correctedAt: now,
      priorAxis: 'player position',
      correctedAxis: 'season',
      sourceSha256: FILE_SHA256,
      auditPath: AUDIT_PATH,
    },
  };
  const paperRows = requireData(
    await supabase
      .from('papers')
      .update({ metadata: correctedMetadata, updated_at: now })
      .eq('id', PAPER_ID)
      .eq('assigned_study_id', STUDY_ID)
      .eq('status', 'processing')
      .eq('assigned_to', PROFILE_ID)
      .eq('primary_file_sha256', FILE_SHA256)
      .select('id,assigned_study_id,status,assigned_to,updated_at,primary_file_sha256,metadata'),
    'guarded corrected paper metadata update',
  );
  if (paperRows.length !== 1) throw new Error('Corrected paper metadata update affected an unexpected row count');

  audit.applyResult = {
    result: 'passed',
    scope: 'S2761 only',
    updatedExtractionFieldIds: updatedFields.map((row) => row.id),
    insertedExtractionFieldIds,
    reusedPopulationGroupIds: correctedGroupRows
      .filter((row) => before.populationGroups.some((candidate) => candidate.id === row.id))
      .map((row) => row.id),
    insertedPopulationGroupIds,
    updatedOrInsertedPopulationValueIds: updatedPopulationRows.map((row) => row.id),
    insertedPopulationValueIds,
    clearedPopulationValueIds: clearedPopulationRows.map((row) => row.id),
    paperUpdate: paperRows[0],
    noteWrites: 0,
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
    recovery: 'No automatic destructive compensation was attempted. Use preState and any inserted IDs visible in live state to prepare a separately approved rollback.',
  };
  fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  throw error;
}

const after = await fetchSnapshot();
const paperAfter = after.papers[0];
const protectedAfterHash = stableHash(protectedState(after));
const liveFieldByKey = new Map(
  after.extractionFields.map((row) => {
    const extraction = after.extractions.find((candidate) => candidate.id === row.extraction_id);
    return [`${extraction?.tab}.${row.field_id}`, row];
  }),
);
const liveGroupByPosition = new Map(after.populationGroups.map((row) => [row.position, row]));
const livePopulationValueByKey = groupValuesByPosition(after.populationGroups, after.populationValues);
const sourceToLiveFieldTransferMismatches = stagedEntries.flatMap((entry) => {
  const live = liveFieldByKey.get(`${entry.tab}.${entry.fieldId}`);
  const expectedStatus = entry.value === null ? 'not_reported' : 'reported';
  return live?.value === entry.value && live?.status === expectedStatus
    ? []
    : [{
      tab: entry.tab,
      fieldId: entry.fieldId,
      expectedValue: entry.value,
      actualValue: live?.value ?? null,
      expectedStatus,
      actualStatus: live?.status ?? null,
    }];
});
const populationLayoutMismatches = stagedPopulationGroups.flatMap((group) => {
  const live = liveGroupByPosition.get(group.position);
  return live?.label === group.label
    ? []
    : [{ position: group.position, expectedLabel: group.label, actualLabel: live?.label ?? null }];
});
const structuredDualWriteMismatches = stagedPopulationGroups.flatMap((group) =>
  Object.entries(group.values).flatMap(([fieldId, expectedValue]) => {
    const fieldTab = definitionById.get(fieldId)?.tab;
    const extractionField = liveFieldByKey.get(`${fieldTab}.${fieldId}`);
    const populationValue = livePopulationValueByKey.get(`${group.position}.${fieldId}`);
    const fieldLines = extractionField?.value?.split(/\r?\n/) ?? [];
    const expectedLine = fieldLines[group.position] ?? null;
    return expectedLine === expectedValue && populationValue?.value === expectedValue
      ? []
      : [{
        position: group.position,
        fieldId,
        expectedValue,
        extractionFieldLine: expectedLine,
        populationValue: populationValue?.value ?? null,
      }];
  }),
);
const unexpectedNonblankPopulationValues = [...livePopulationValueByKey.entries()].flatMap(([key, row]) =>
  !expectedPopulationKeys.has(key) && row.value !== null && String(row.value).trim()
    ? [{ key, value: row.value, id: row.id }]
    : []);
const findings = [];
if (!sameIds(after.extractions.map((row) => row.id), before.extractions.map((row) => row.id))) {
  findings.push('Extraction IDs changed');
}
if (after.extractionFields.length !== stagedEntries.length) findings.push('Extraction field count mismatch');
if (after.populationGroups.length !== SEASON_LABELS.length) findings.push('Population group count is not six');
if (sourceToLiveFieldTransferMismatches.length) findings.push('Source-to-live field mismatches found');
if (populationLayoutMismatches.length) findings.push('Population layout mismatches found');
if (structuredDualWriteMismatches.length) findings.push('Structured dual-write mismatches found');
if (unexpectedNonblankPopulationValues.length) findings.push('Unexpected nonblank population values found');
if (paperAfter.status !== 'processing' || paperAfter.assigned_to !== PROFILE_ID) {
  findings.push('Assignment or processing status changed');
}
if (liveFieldByKey.get('studyDetails.studyId')?.value !== STUDY_ID) findings.push('studyId changed');
if (
  paperAfter.primary_file_sha256 !== FILE_SHA256
  || after.paperFiles.length !== 1
  || after.paperFiles[0].id !== FILE_ID
  || after.paperFiles[0].file_sha256 !== FILE_SHA256
) findings.push('Primary source attachment or hash changed');
if (protectedAfterHash !== protectedBeforeHash) findings.push('Protected screening or promotion state changed');
if (stableHash(sorted(after.notes)) !== notesBeforeHash) findings.push('Paper notes changed');
if (JSON.stringify(paperAfter.metadata?.populationLabels) !== JSON.stringify(SEASON_LABELS)) {
  findings.push('Paper populationLabels metadata mismatch');
}
if (paperAfter.metadata?.populationHash !== createPopulationSignature(stagedPopulationGroups)) {
  findings.push('Paper populationHash metadata mismatch');
}

audit.phase = findings.length ? 'integrity_gate_failed' : 'complete';
audit.postState = after;
audit.integrityGate = {
  result: findings.length ? 'failed' : 'passed',
  findings: findings.map((message) => ({ severity: 'blocker', message })),
  sourceToLiveFieldTransferMismatches,
  populationLayoutMismatches,
  structuredDualWriteMismatches,
  unexpectedNonblankPopulationValues,
  extractionRows: after.extractions.length,
  extractionFields: after.extractionFields.length,
  reportedExtractionFields: after.extractionFields.filter((row) => row.status === 'reported').length,
  notReportedExtractionFields: after.extractionFields.filter((row) => row.status === 'not_reported').length,
  populationGroups: after.populationGroups.length,
  physicalPopulationValueRows: after.populationValues.length,
  nonblankPopulationValues: after.populationValues.filter((row) => row.value !== null && String(row.value).trim()).length,
  expectedNonblankPopulationValues: expectedPopulationValueCount,
  populationLabels: after.populationGroups.map((row) => row.label),
  sourceHashMatchesLivePaper:
    paperAfter.primary_file_sha256 === FILE_SHA256
    && after.paperFiles.length === 1
    && after.paperFiles[0].file_sha256 === FILE_SHA256,
  studyIdMatchesAssignedStudyId: liveFieldByKey.get('studyDetails.studyId')?.value === paperAfter.assigned_study_id,
  assignmentIsAbdelRahmanBabiker: paperAfter.assigned_to === PROFILE_ID,
  statusIsProcessing: paperAfter.status === 'processing',
  protectedScreeningSignatureBeforeSha256: protectedBeforeHash,
  protectedScreeningSignatureAfterSha256: protectedAfterHash,
  protectedScreeningUnchanged: protectedAfterHash === protectedBeforeHash,
  notesSignatureBeforeSha256: notesBeforeHash,
  notesSignatureAfterSha256: stableHash(sorted(after.notes)),
  notesUnchanged: stableHash(sorted(after.notes)) === notesBeforeHash,
  screeningWrites: 0,
  resolverWrites: 0,
  promotionWrites: 0,
  fileWrites: 0,
};
audit.readyFor = findings.length ? 'Blocked pending correction' : 'Human extraction review';
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  auditPath: AUDIT_PATH,
  applyResult: audit.applyResult,
  integrityGate: audit.integrityGate,
  readyFor: audit.readyFor,
}, null, 2));
if (findings.length) process.exit(1);
