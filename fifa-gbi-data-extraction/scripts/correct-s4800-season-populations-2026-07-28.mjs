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
const SOURCE_PDF_PATH = path.join(
  APP_DIR,
  'data',
  'full-text-pdf-retrieval',
  'awaiting-pdf-2026-06-23',
  '124_S4800_Ogawa_T_2025.pdf',
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
const priorAudit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const staged = payload.papers[0];

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};
const stableHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const sortById = (rows) => [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
const sameIds = (left, right) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
const protectedScreeningState = (snapshot) => ({
  screening: sortById(snapshot.screening),
  votes: sortById(snapshot.votes),
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

const stagedEntries = Object.entries(staged.fields).flatMap(([tab, fields]) =>
  Object.entries(fields).map(([fieldId, rawValue]) => {
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
  label: staged.populationLabels[index],
}));
if (stagedPopulationGroups.length !== 7 || staged.populationLabels.length !== 7) {
  throw new Error('Corrected payload must produce exactly seven population rows');
}
const expectedPopulationValueCount = stagedPopulationGroups.reduce(
  (count, group) => count + Object.keys(group.values).length,
  0,
);
if (expectedPopulationValueCount !== 135) {
  throw new Error(`Corrected payload must produce 135 nonblank population values, found ${expectedPopulationValueCount}`);
}

const before = await fetchSnapshot();
const paperBefore = before.papers[0];
if (!paperBefore || paperBefore.assigned_study_id !== STUDY_ID) throw new Error('S4800 paper row changed');
if (paperBefore.status !== 'processing' || paperBefore.assigned_to !== PROFILE_ID) {
  throw new Error('S4800 is no longer assigned to AbdelRahman Babiker in processing');
}
const primaryFileBefore = before.paperFiles.find((row) => row.id === FILE_ID);
if (
  paperBefore.primary_file_sha256 !== FILE_SHA256
  || primaryFileBefore?.file_sha256 !== FILE_SHA256
  || hashFile(SOURCE_PDF_PATH) !== FILE_SHA256
) {
  throw new Error('Live or local S4800 primary source hash changed');
}
if (
  priorAudit.phase !== 'complete'
  || priorAudit.readyFor !== 'Human extraction review'
  || priorAudit.applyResult?.result !== 'passed'
) {
  throw new Error('Original successful apply audit is unavailable');
}
if (!sameIds(before.extractions.map((row) => row.id), priorAudit.applyResult.insertedExtractionIds)) {
  throw new Error('Current extraction IDs do not match the captured original inserted IDs');
}
if (!sameIds(before.extractionFields.map((row) => row.id), priorAudit.applyResult.insertedExtractionFieldIds)) {
  throw new Error('Current extraction-field IDs do not match the captured original inserted IDs');
}
if (!sameIds(before.populationGroups.map((row) => row.id), priorAudit.applyResult.insertedPopulationGroupIds)) {
  throw new Error('Current population-group IDs do not match the captured original inserted IDs');
}
if (!sameIds(before.populationValues.map((row) => row.id), priorAudit.applyResult.insertedPopulationValueIds)) {
  throw new Error('Current population-value IDs do not match the captured original inserted IDs');
}
const fullTextBefore = before.screening.find((row) => row.id === SCREENING_ID);
if (
  !fullTextBefore
  || fullTextBefore.promoted_paper_id !== PAPER_ID
  || fullTextBefore.metadata?.fullTextResolution !== 'ready_for_extraction'
) {
  throw new Error('Protected screening or promotion state changed');
}
const protectedBeforeHash = stableHash(protectedScreeningState(before));
if (protectedBeforeHash !== priorAudit.integrityGate.protectedScreeningSignatureAfterSha256) {
  throw new Error('Protected screening signature no longer matches the successful original gate');
}

const extractionByTab = new Map(before.extractions.map((row) => [row.tab, row]));
const currentFieldByKey = new Map(
  before.extractionFields.map((row) => {
    const extraction = before.extractions.find((candidate) => candidate.id === row.extraction_id);
    return [`${extraction?.tab}.${row.field_id}`, row];
  }),
);
const currentGroupByPosition = new Map(before.populationGroups.map((row) => [row.position, row]));
const currentPopulationValueByKey = new Map(
  before.populationValues.map((row) => {
    const group = before.populationGroups.find((candidate) => candidate.id === row.population_group_id);
    return [`${group?.position}.${row.field_id}`, row];
  }),
);
const missingFields = stagedEntries.filter((entry) => !currentFieldByKey.has(`${entry.tab}.${entry.fieldId}`));
if (missingFields.length) throw new Error(`Missing existing extraction fields: ${missingFields.map((x) => x.fieldId).join(', ')}`);

const correctionAudit = {
  ...priorAudit,
  artifactType: 'Corrected newly promoted paper final live extraction audit',
  phase: 'correction_pre_state_persisted',
  stageA: payload.stageA,
  populationLayout: payload.stageA.populationLayout,
  staged: {
    tabs: Object.keys(staged.fields),
    fields: stagedEntries.length,
    reportedFields: stagedEntries.filter((entry) => entry.value !== null).length,
    notReportedFields: stagedEntries.filter((entry) => entry.value === null).map((entry) => entry.fieldId),
    populationGroups: stagedPopulationGroups.length,
    nonblankPopulationValues: expectedPopulationValueCount,
    unknownFields: [],
  },
  correctionHistory: [
    {
      reviewType: 'cold post-apply semantic review',
      findings: payload.stageA.correctionHistory.findingsCorrected,
      disposition: payload.stageA.correctionHistory.disposition,
      priorPopulationLayout: priorAudit.populationLayout,
      correctedPopulationLayout: payload.stageA.populationLayout,
      recurrenceFrameCaveat: payload.stageA.recurrenceFrameCaveat,
      correctedAt: null,
    },
  ],
  correctionPreState: before,
  correctionPreStateSummary: {
    paperId: PAPER_ID,
    paperUpdatedAt: paperBefore.updated_at,
    status: paperBefore.status,
    assignedTo: paperBefore.assigned_to,
    extractionIds: before.extractions.map((row) => row.id),
    extractionFieldIds: before.extractionFields.map((row) => row.id),
    populationGroupIds: before.populationGroups.map((row) => row.id),
    populationValueIds: before.populationValues.map((row) => row.id),
    sourceSha256: FILE_SHA256,
    protectedScreeningSignatureSha256: protectedBeforeHash,
  },
  correctionApplyResult: null,
  priorIntegrityGate: priorAudit.integrityGate,
  integrityGate: null,
  readyFor: 'Correction not yet applied',
  backlogReadySummary: null,
  rollback: {
    ...priorAudit.rollback,
    correctionOnly: 'Restore the exact correctionPreState field, population, paper metadata, and group rows. Remove only the six correction-inserted population group IDs recorded in correctionApplyResult. Deletion is destructive and requires explicit approval.',
    fullExtraction: 'The original preState remains embedded. A full rollback would remove only the original and correction inserted extraction/population IDs and restore preState.papers[0].',
  },
};
if (APPLY) fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(correctionAudit, null, 2)}\n`);
if (!APPLY) {
  console.log(JSON.stringify({
    mode: 'dry_run',
    preconditions: 'passed',
    stagedFields: stagedEntries.length,
    reportedFields: stagedEntries.filter((entry) => entry.value !== null).length,
    clearedFields: stagedEntries.filter((entry) => entry.value === null).map((entry) => entry.fieldId),
    populationLabels: staged.populationLabels,
    nonblankPopulationValues: expectedPopulationValueCount,
    sourceSha256: FILE_SHA256,
    protectedScreeningSignatureSha256: protectedBeforeHash,
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const fieldRows = stagedEntries.map((entry) => {
  const current = currentFieldByKey.get(`${entry.tab}.${entry.fieldId}`);
  return {
    ...current,
    value: entry.value,
    metric: entry.metric,
    status: entry.value === null ? 'not_reported' : 'reported',
    updated_at: now,
    updated_by: PROFILE_ID,
  };
});
const existingAllSeasonsGroup = currentGroupByPosition.get(0);
if (!existingAllSeasonsGroup) throw new Error('Original Total population group is missing');
const correctedGroupRows = stagedPopulationGroups.map((group) => {
  if (group.position === 0) {
    return {
      ...existingAllSeasonsGroup,
      label: group.label,
      updated_at: now,
    };
  }
  return {
    id: crypto.randomUUID(),
    paper_id: PAPER_ID,
    tab: 'participantCharacteristics',
    label: group.label,
    position: group.position,
    created_at: now,
    updated_at: now,
  };
});
const newGroupRows = correctedGroupRows.filter((row) => row.position > 0);
const correctedPopulationRows = [];
for (const groupRow of correctedGroupRows) {
  const stagedGroup = stagedPopulationGroups[groupRow.position];
  for (const [fieldId, value] of Object.entries(stagedGroup.values)) {
    const current = currentPopulationValueByKey.get(`${groupRow.position}.${fieldId}`);
    correctedPopulationRows.push(current
      ? {
        ...current,
        value,
        metric: definitionById.get(fieldId)?.metric ?? null,
        updated_at: now,
      }
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
      });
  }
}
const expectedAllSeasonsFields = new Set(Object.keys(stagedPopulationGroups[0].values));
const clearedPopulationRows = before.populationValues
  .filter((row) => row.population_group_id === existingAllSeasonsGroup.id && !expectedAllSeasonsFields.has(row.field_id))
  .map((row) => ({
    ...row,
    value: null,
    updated_at: now,
  }));
const populationRowsToUpsert = [...correctedPopulationRows, ...clearedPopulationRows];

try {
  const updatedFields = requireData(
    await supabase.from('extraction_fields').upsert(fieldRows).select('id,extraction_id,field_id,value,status'),
    'corrected extraction field upsert',
  );
  if (updatedFields.length !== fieldRows.length) throw new Error('Corrected extraction field count mismatch');
  const updatedAllSeasonsGroup = requireData(
    await supabase
      .from('population_groups')
      .update({ label: 'All seasons', updated_at: now })
      .eq('id', existingAllSeasonsGroup.id)
      .eq('paper_id', PAPER_ID)
      .eq('position', 0)
      .eq('label', 'Total')
      .select('*'),
    'All seasons group correction',
  );
  if (updatedAllSeasonsGroup.length !== 1) throw new Error('All seasons group correction affected an unexpected row count');
  const insertedGroups = requireData(
    await supabase.from('population_groups').insert(newGroupRows).select('*'),
    'annual population group insert',
  );
  if (insertedGroups.length !== 6) throw new Error(`Expected six inserted annual groups, found ${insertedGroups.length}`);
  const updatedPopulationRows = requireData(
    await supabase.from('population_values').upsert(populationRowsToUpsert).select('id,field_id,value,population_group_id'),
    'corrected population value upsert',
  );
  if (updatedPopulationRows.length !== populationRowsToUpsert.length) {
    throw new Error('Corrected population value upsert count mismatch');
  }
  const correctedMetadata = {
    ...(paperBefore.metadata ?? {}),
    populationLabels: stagedPopulationGroups.map((group) => group.label),
    populationHash: createPopulationSignature(stagedPopulationGroups),
  };
  const paperRows = requireData(
    await supabase
      .from('papers')
      .update({ metadata: correctedMetadata, updated_at: now })
      .eq('id', PAPER_ID)
      .eq('assigned_study_id', STUDY_ID)
      .eq('status', 'processing')
      .eq('assigned_to', PROFILE_ID)
      .eq('updated_at', paperBefore.updated_at)
      .select('id,assigned_study_id,status,assigned_to,updated_at,metadata'),
    'guarded corrected paper metadata update',
  );
  if (paperRows.length !== 1) throw new Error('Corrected paper metadata update affected an unexpected row count');

  correctionAudit.correctionApplyResult = {
    result: 'passed',
    scope: 'S4800 only',
    existingExtractionIdsPreserved: before.extractions.map((row) => row.id),
    updatedExtractionFieldIds: updatedFields.map((row) => row.id),
    clearedExtractionFieldIds: updatedFields.filter((row) => row.value === null).map((row) => row.id),
    relabelledPopulationGroupId: existingAllSeasonsGroup.id,
    insertedPopulationGroupIds: insertedGroups.map((row) => row.id),
    updatedOrInsertedPopulationValueIds: updatedPopulationRows.map((row) => row.id),
    clearedPopulationValueIds: clearedPopulationRows.map((row) => row.id),
    paperUpdate: paperRows[0],
    backlogWrites: 0,
    screeningWrites: 0,
    resolverWrites: 0,
    promotionWrites: 0,
    fileWrites: 0,
  };
  correctionAudit.correctionHistory[0].correctedAt = paperRows[0].updated_at;
} catch (error) {
  correctionAudit.phase = 'correction_apply_failed';
  correctionAudit.correctionApplyResult = {
    result: 'failed',
    error: error instanceof Error ? error.message : String(error),
    recovery: 'No automatic destructive compensation was attempted. Use correctionPreState and the exact inserted IDs visible in live state to prepare a separately approved rollback.',
  };
  fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(correctionAudit, null, 2)}\n`);
  throw error;
}

const after = await fetchSnapshot();
const paperAfter = after.papers[0];
const protectedAfterHash = stableHash(protectedScreeningState(after));
const liveFieldByKey = new Map(
  after.extractionFields.map((row) => {
    const extraction = after.extractions.find((candidate) => candidate.id === row.extraction_id);
    return [`${extraction?.tab}.${row.field_id}`, row];
  }),
);
const liveGroupByPosition = new Map(after.populationGroups.map((row) => [row.position, row]));
const livePopulationValueByKey = new Map(
  after.populationValues.map((row) => {
    const group = after.populationGroups.find((candidate) => candidate.id === row.population_group_id);
    return [`${group?.position}.${row.field_id}`, row];
  }),
);
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
const expectedKeys = new Set(
  stagedPopulationGroups.flatMap((group) =>
    Object.keys(group.values).map((fieldId) => `${group.position}.${fieldId}`)),
);
const unexpectedNonblankPopulationValues = [...livePopulationValueByKey.entries()].flatMap(([key, row]) =>
  !expectedKeys.has(key) && row.value !== null && String(row.value).trim()
    ? [{ key, value: row.value, id: row.id }]
    : []);
const unexpectedNullPopulationValues = [...livePopulationValueByKey.entries()].flatMap(([key, row]) =>
  !expectedKeys.has(key) && row.value === null
    ? []
    : !expectedKeys.has(key)
      ? [{ key, value: row.value, id: row.id }]
      : []);
const findings = [];
if (!sameIds(after.extractions.map((row) => row.id), priorAudit.applyResult.insertedExtractionIds)) {
  findings.push('Original extraction IDs changed');
}
if (!sameIds(after.extractionFields.map((row) => row.id), priorAudit.applyResult.insertedExtractionFieldIds)) {
  findings.push('Original extraction-field IDs changed');
}
if (after.populationGroups.length !== 7) findings.push('Population group count is not seven');
if (sourceToLiveFieldTransferMismatches.length) findings.push('Source-to-live field mismatches found');
if (populationLayoutMismatches.length) findings.push('Population layout mismatches found');
if (structuredDualWriteMismatches.length) findings.push('Structured dual-write mismatches found');
if (unexpectedNonblankPopulationValues.length || unexpectedNullPopulationValues.length) {
  findings.push('Unexpected nonblank population values found');
}
if (after.populationValues.filter((row) => row.value !== null && String(row.value).trim()).length !== 135) {
  findings.push('Nonblank population value count is not 135');
}
if (paperAfter.status !== 'processing' || paperAfter.assigned_to !== PROFILE_ID) {
  findings.push('Assignment or processing status changed');
}
if (liveFieldByKey.get('studyDetails.studyId')?.value !== STUDY_ID) findings.push('studyId changed');
if (
  paperAfter.primary_file_sha256 !== FILE_SHA256
  || after.paperFiles.find((row) => row.id === FILE_ID)?.file_sha256 !== FILE_SHA256
) findings.push('Primary source hash changed');
if (protectedAfterHash !== protectedBeforeHash) findings.push('Protected screening or promotion state changed');
if (JSON.stringify(paperAfter.metadata?.populationLabels) !== JSON.stringify(staged.populationLabels)) {
  findings.push('Paper populationLabels metadata mismatch');
}
if (paperAfter.metadata?.populationHash !== createPopulationSignature(stagedPopulationGroups)) {
  findings.push('Paper populationHash metadata mismatch');
}

correctionAudit.phase = findings.length ? 'correction_integrity_gate_failed' : 'complete';
correctionAudit.postState = after;
correctionAudit.integrityGate = {
  result: findings.length ? 'failed' : 'passed',
  scope: 'S4800 only',
  findings: findings.map((message) => ({ severity: 'blocker', message })),
  sourceToLiveFieldTransferMismatches,
  populationLayoutMismatches,
  structuredDualWriteMismatches,
  unexpectedNonblankPopulationValues,
  clearedNullPopulationValueRows: after.populationValues
    .filter((row) => row.value === null)
    .map((row) => ({ id: row.id, fieldId: row.field_id, populationGroupId: row.population_group_id })),
  extractionRows: after.extractions.length,
  extractionFields: after.extractionFields.length,
  reportedExtractionFields: after.extractionFields.filter((row) => row.status === 'reported').length,
  notReportedExtractionFields: after.extractionFields.filter((row) => row.status === 'not_reported').length,
  populationGroups: after.populationGroups.length,
  physicalPopulationValueRows: after.populationValues.length,
  nonblankPopulationValues: after.populationValues.filter((row) => row.value !== null && String(row.value).trim()).length,
  populationLabels: after.populationGroups.map((row) => row.label),
  originalExtractionIdsPreserved: sameIds(
    after.extractions.map((row) => row.id),
    priorAudit.applyResult.insertedExtractionIds,
  ),
  originalExtractionFieldIdsPreserved: sameIds(
    after.extractionFields.map((row) => row.id),
    priorAudit.applyResult.insertedExtractionFieldIds,
  ),
  sourceHashMatchesLivePaper:
    paperAfter.primary_file_sha256 === FILE_SHA256
    && after.paperFiles.find((row) => row.id === FILE_ID)?.file_sha256 === FILE_SHA256,
  studyIdMatchesAssignedStudyId: liveFieldByKey.get('studyDetails.studyId')?.value === paperAfter.assigned_study_id,
  assignmentIsAbdelRahmanBabiker: paperAfter.assigned_to === PROFILE_ID,
  statusIsProcessing: paperAfter.status === 'processing',
  protectedScreeningSignatureBeforeSha256: protectedBeforeHash,
  protectedScreeningSignatureAfterSha256: protectedAfterHash,
  protectedScreeningUnchanged: protectedAfterHash === protectedBeforeHash,
  backlogWrites: 0,
  screeningWrites: 0,
  resolverWrites: 0,
  promotionWrites: 0,
  fileWrites: 0,
};
correctionAudit.backlogReadySummary = [
  'S4800 remains processing and assigned to AbdelRahman Babiker.',
  'Population layout: All seasons / 2013 / 2014 / 2015 / 2016 / 2017 / 2018.',
  'Table 3 annual player counts, mean ages, exposures, injury counts, incidence, recurrence, and compatible muscle/thigh structured values are aligned across seven rows.',
  'The All seasons sample-size line is blank because 209 is player-seasons, not a unique-player count.',
  'Annual recurrence counts use Table 3 all-injury columns; the overall 30% rate is 12/40 nonoperatively treated legs.',
  'No separate time-loss subset, time-loss incidence duplicate, target-diagnosis duplicate, numeric season length, burden, CI, or illness values were retained.',
  'Tables 1-7 and Figure 1 were scanned; no backlog Markdown write was made.',
].join(' ');
correctionAudit.readyFor = findings.length ? 'Blocked pending correction' : 'Human extraction review';
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(correctionAudit, null, 2)}\n`);
console.log(JSON.stringify({
  auditPath: AUDIT_PATH,
  correctionApplyResult: correctionAudit.correctionApplyResult,
  integrityGate: correctionAudit.integrityGate,
  backlogReadySummary: correctionAudit.backlogReadySummary,
  readyFor: correctionAudit.readyFor,
}, null, 2));
if (findings.length) process.exit(1);
