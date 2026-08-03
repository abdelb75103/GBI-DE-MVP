#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(APP_ROOT, '.env.local');
const AUDIT_DIR = path.join(
  APP_ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/extraction-gate-audit-2026-07-30',
);
const SNAPSHOT_PATH = path.join(
  AUDIT_DIR,
  'blocked-gate-snapshot-2026-07-30T18-16-12-749Z.json',
);
const PAYLOAD_PATH = path.join(AUDIT_DIR, 'bridge-extraction-payload-2026-07-30.json');
const BACKLOG_PATH = path.join(
  APP_ROOT,
  'docs/second-search-extraction-review-backlog-2026-07-03.md',
);
const VERSION = 'full-text-ai-one-human-bridge-2026-07-30-v1';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const PRIMARY_IDS = ['S683', 'S2761', 'S3931', 'S4859', 'S4860'];
const ALL_IDS = [...PRIMARY_IDS.slice(0, 1), 'S2699', ...PRIMARY_IDS.slice(1)];
const CORE_TABS = new Set([
  'studyDetails',
  'participantCharacteristics',
  'definitions',
  'exposure',
]);
const TABS = [
  'studyDetails',
  'participantCharacteristics',
  'definitions',
  'exposure',
  'injuryOutcome',
  'illnessOutcome',
  'injuryTissueType',
  'injuryLocation',
  'illnessRegion',
  'illnessEtiology',
];

function loadEnv(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function deterministicUuid(key) {
  const bytes = Buffer.from(crypto.createHash('sha256').update(key).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function query(supabase, table, columns, configure) {
  let request = supabase.from(table).select(columns);
  if (configure) request = configure(request);
  const { data, error } = await request;
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}

function withoutBridgeMetadata(row, baselineUpdatedAt) {
  const clone = structuredClone(row);
  if (clone.metadata) delete clone.metadata.extractionBridge20260730;
  clone.updated_at = baselineUpdatedAt;
  return clone;
}

function rowsHash(rows) {
  return stableHash([...rows].sort((a, b) => String(a.id).localeCompare(String(b.id))));
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const baseline = snapshot.exactLiveSnapshot;
  const payload = JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
  const env = loadEnv(ENV_PATH);
  const [
    { extractionFieldDefinitions },
    { createPopulationSignature, derivePopulationGroups },
    { normalizeGlobalFieldValue },
  ] = await Promise.all([
    import('../src/lib/extraction/schema.ts'),
    import('../src/lib/extraction/populations.ts'),
    import('../src/lib/extraction/normalize.ts'),
  ]);
  const definitionById = new Map(extractionFieldDefinitions.map((item) => [item.id, item]));
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const recordIds = baseline.screeningRecords.map((row) => row.id);
  const [
    screeningRecords,
    screeningVotes,
    papers,
    recentPapers,
    recentFiles,
    recentExtractions,
    recentFields,
    recentGroups,
    recentValues,
    recentNotes,
  ] = await Promise.all([
    query(supabase, 'screening_records', '*', (request) => request.in('id', recordIds)),
    query(supabase, 'screening_votes', '*', (request) => request.in('screening_record_id', recordIds)),
    query(supabase, 'papers', '*', (request) => request.in('assigned_study_id', [...ALL_IDS, 'S845'])),
    query(supabase, 'papers', 'id,assigned_study_id,updated_at', (request) => request.gte('updated_at', snapshot.generatedAt)),
    query(supabase, 'paper_files', 'id,paper_id,uploaded_at', (request) => request.gte('uploaded_at', snapshot.generatedAt)),
    query(supabase, 'extractions', 'id,paper_id,created_at,updated_at', (request) => request.gte('created_at', snapshot.generatedAt)),
    query(supabase, 'extraction_fields', 'id,extraction_id,updated_at', (request) => request.gte('updated_at', snapshot.generatedAt)),
    query(supabase, 'population_groups', 'id,paper_id,created_at,updated_at', (request) => request.gte('created_at', snapshot.generatedAt)),
    query(supabase, 'population_values', 'id,paper_id,created_at,updated_at', (request) => request.gte('created_at', snapshot.generatedAt)),
    query(supabase, 'paper_notes', 'id,paper_id,created_at', (request) => request.gte('created_at', snapshot.generatedAt)),
  ]);
  const paperByStudyId = new Map(papers.map((paper) => [paper.assigned_study_id, paper]));
  const targetPaperIds = new Set(ALL_IDS.map((id) => paperByStudyId.get(id)?.id).filter(Boolean));
  const primaryPaperIds = new Set(PRIMARY_IDS.map((id) => paperByStudyId.get(id)?.id).filter(Boolean));
  const targetExtractionIds = new Set(
    PRIMARY_IDS.flatMap((studyId) => TABS.map((tab) => deterministicUuid(`${VERSION}:${studyId}:extraction:${tab}`))),
  );

  const screeningChecks = [];
  const baselineRecordById = new Map(baseline.screeningRecords.map((row) => [row.id, row]));
  for (const current of screeningRecords) {
    const before = baselineRecordById.get(current.id);
    const target = ALL_IDS.includes(current.assigned_study_id);
    const comparable = target
      ? withoutBridgeMetadata(current, before.updated_at)
      : current;
    const includeVotes = screeningVotes.filter(
      (vote) => vote.screening_record_id === current.id && vote.decision === 'include',
    );
    const excludeVotes = screeningVotes.filter(
      (vote) => vote.screening_record_id === current.id && vote.decision === 'exclude',
    );
    screeningChecks.push({
      studyId: current.assigned_study_id,
      target,
      protectedRowUnchanged: stableHash(comparable) === stableHash(before),
      bridgeCompleted: target
        ? current.metadata?.extractionBridge20260730?.version === VERSION
          && current.metadata?.extractionBridge20260730?.status === 'completed'
        : current.metadata?.extractionBridge20260730 === before.metadata?.extractionBridge20260730,
      includeVotes: includeVotes.length,
      excludeVotes: excludeVotes.length,
      pendingSecondHuman: target
        ? current.metadata?.fullTextResolution === 'pending'
          && current.manual_decision === before.manual_decision
          && current.promoted_paper_id === before.promoted_paper_id
        : null,
    });
  }
  const votesUnchanged = rowsHash(screeningVotes) === rowsHash(baseline.screeningVotes);

  const paperChecks = [];
  const allPaperFiles = await query(
    supabase,
    'paper_files',
    '*',
    (request) => request.in('paper_id', [...targetPaperIds]),
  );
  for (const studyId of ALL_IDS) {
    const paper = paperByStudyId.get(studyId);
    if (!paper) throw new Error(`${studyId}: promoted paper missing.`);
    const files = allPaperFiles.filter((file) => file.paper_id === paper.id);
    const payloadItem = payload.papers.find((item) => item.studyId === studyId)
      ?? payload.systematicReview;
    const file = files[0];
    let downloadedSha256 = null;
    let storageError = null;
    if (file) {
      const { data, error } = await supabase.storage
        .from(file.storage_bucket)
        .download(file.storage_object_path);
      storageError = error?.message ?? null;
      if (data) downloadedSha256 = sha256(Buffer.from(await data.arrayBuffer()));
    }
    paperChecks.push({
      studyId,
      paperId: paper.id,
      status: paper.status,
      assignmentMatched: paper.assigned_to === PROFILE_ID,
      bridgeVersionMatched: paper.metadata?.temporaryExtractionPromotionVersion === VERSION,
      referenceCheckingOnly: paper.metadata?.referenceCheckingOnly,
      oneFile: files.length === 1,
      primaryLinkMatched:
        files.length === 1
        && paper.primary_file_id === file.id
        && paper.primary_file_sha256 === file.file_sha256,
      expectedSha256: payloadItem.source.sha256,
      downloadedSha256,
      fileHashMatched:
        files.length === 1
        && file.file_sha256 === payloadItem.source.sha256
        && downloadedSha256 === payloadItem.source.sha256,
      storageError,
    });
  }

  const extractionChecks = [];
  for (const item of payload.papers) {
    const paper = paperByStudyId.get(item.studyId);
    const [extractions, groups, values, notes] = await Promise.all([
      query(supabase, 'extractions', '*', (request) => request.eq('paper_id', paper.id)),
      query(supabase, 'population_groups', '*', (request) => request.eq('paper_id', paper.id)),
      query(supabase, 'population_values', '*', (request) => request.eq('paper_id', paper.id)),
      query(supabase, 'paper_notes', '*', (request) => request.eq('paper_id', paper.id)),
    ]);
    const extractionIds = extractions.map((row) => row.id);
    const fields = await query(
      supabase,
      'extraction_fields',
      '*',
      (request) => request.in('extraction_id', extractionIds),
    );
    const extractionByTab = new Map(extractions.map((row) => [row.tab, row]));
    const expectedFields = [];
    for (const tab of TABS) {
      const itemFields = { ...(item.fields[tab] ?? {}) };
      if (CORE_TABS.has(tab)) {
        for (const definition of extractionFieldDefinitions.filter((candidate) => candidate.tab === tab)) {
          if (!(definition.id in itemFields)) itemFields[definition.id] = null;
        }
      }
      for (const [fieldId, rawValue] of Object.entries(itemFields)) {
        const definition = definitionById.get(fieldId);
        expectedFields.push({
          id: deterministicUuid(`${VERSION}:${item.studyId}:field:${tab}:${fieldId}`),
          extraction_id: deterministicUuid(`${VERSION}:${item.studyId}:extraction:${tab}`),
          field_id: fieldId,
          value: fieldId === 'studyId'
            ? item.studyId
            : normalizeGlobalFieldValue(fieldId, rawValue == null ? null : String(rawValue)),
          metric: definition?.metric ?? null,
          status: rawValue == null || rawValue === '' ? 'not_reported' : 'reported',
          updated_by: PROFILE_ID,
        });
      }
    }
    const actualFieldComparable = fields.map((field) => ({
      id: field.id,
      extraction_id: field.extraction_id,
      field_id: field.field_id,
      value: field.value,
      metric: field.metric,
      status: field.status,
      updated_by: field.updated_by,
    }));
    const populationInput = expectedFields.map((field) => ({
      fieldId: field.field_id,
      value: field.value,
      metric: field.metric,
    }));
    const expectedGroups = derivePopulationGroups(populationInput);
    expectedGroups.forEach((group, index) => {
      group.label = item.populationLabels[index];
    });
    const orderedGroups = [...groups].sort((a, b) => a.position - b.position);
    const actualPopulation = orderedGroups.map((group) => ({
      label: group.label,
      position: group.position,
      values: Object.fromEntries(
        values
          .filter((value) => value.population_group_id === group.id)
          .map((value) => [value.field_id, value.value]),
      ),
    }));
    const expectedPopulation = expectedGroups.map((group, position) => ({
      label: group.label,
      position,
      values: group.values,
    }));
    extractionChecks.push({
      studyId: item.studyId,
      status: paper.status,
      tenTabs:
        extractions.length === TABS.length
        && TABS.every((tab) => extractionByTab.get(tab)?.id === deterministicUuid(`${VERSION}:${item.studyId}:extraction:${tab}`)),
      fieldCount: fields.length,
      expectedFieldCount: expectedFields.length,
      fieldsMatched: rowsHash(actualFieldComparable) === rowsHash(expectedFields),
      populationLabelsMatched: stableHash(orderedGroups.map((group) => group.label)) === stableHash(item.populationLabels),
      populationDualWriteMatched: stableHash(actualPopulation) === stableHash(expectedPopulation),
      populationHashMatched: paper.metadata?.populationHash === createPopulationSignature(expectedGroups),
      oneEvidenceNote: notes.length === 1 && notes[0].body === item.note,
      extractionBridgeApplied:
        paper.metadata?.extractionBridge20260730?.version === VERSION
        && paper.metadata?.extractionBridge20260730?.stageBStatus === 'applied_pending_verification',
    });
  }

  const systematicPaper = paperByStudyId.get('S2699');
  const [systematicExtractions, systematicGroups, systematicValues, systematicNotes] = await Promise.all([
    query(supabase, 'extractions', '*', (request) => request.eq('paper_id', systematicPaper.id)),
    query(supabase, 'population_groups', '*', (request) => request.eq('paper_id', systematicPaper.id)),
    query(supabase, 'population_values', '*', (request) => request.eq('paper_id', systematicPaper.id)),
    query(supabase, 'paper_notes', '*', (request) => request.eq('paper_id', systematicPaper.id)),
  ]);
  const systematicReviewCheck = {
    status: systematicPaper.status,
    referenceCheckingOnly: systematicPaper.metadata?.referenceCheckingOnly === true,
    zeroExtractionRows: systematicExtractions.length === 0,
    zeroPopulationGroups: systematicGroups.length === 0,
    zeroPopulationValues: systematicValues.length === 0,
    oneReferenceNote:
      systematicNotes.length === 1
      && systematicNotes[0].body === payload.systematicReview.note,
  };

  const s845 = paperByStudyId.get('S845');
  const [s845Files, s845Extractions, s845Groups, s845Values, s845Notes] = await Promise.all([
    query(supabase, 'paper_files', '*', (request) => request.eq('paper_id', s845.id)),
    query(supabase, 'extractions', '*', (request) => request.eq('paper_id', s845.id)),
    query(supabase, 'population_groups', '*', (request) => request.eq('paper_id', s845.id)),
    query(supabase, 'population_values', '*', (request) => request.eq('paper_id', s845.id)),
    query(supabase, 'paper_notes', '*', (request) => request.eq('paper_id', s845.id)),
  ]);
  const s845Baseline = baseline.papers.find((paper) => paper.assigned_study_id === 'S845');
  const s845Check = {
    paperUnchanged: stableHash(s845) === stableHash(s845Baseline),
    status: s845.status,
    primaryFileCleared:
      s845.primary_file_id === null
      && s845.primary_file_sha256 === null
      && s845.storage_object_path === null,
    oneReferenceFile:
      s845Files.length === 1
      && s845Files[0].file_sha256 === '9c20b69fc67831357ff85c91775e16e3190e968460c699ffef61e5ca15b7a105',
    zeroExtractionRows: s845Extractions.length === 0,
    zeroPopulationRows: s845Groups.length === 0 && s845Values.length === 0,
    warningNote:
      s845Notes.length === 1
      && s845Notes[0].body.includes('not the exact 2024 journal full text'),
  };

  const backlogText = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const backlogChecks = Object.fromEntries(ALL_IDS.map((studyId) => [
    studyId,
    new RegExp(`^\\| ${studyId} \\| .*\\| ⏲️ pending_review \\|`, 'm').test(backlogText),
  ]));

  const outOfScopeRecent = {
    papers: recentPapers.filter((row) => !targetPaperIds.has(row.id)),
    paperFiles: recentFiles.filter((row) => !targetPaperIds.has(row.paper_id)),
    extractions: recentExtractions.filter((row) => !primaryPaperIds.has(row.paper_id)),
    extractionFields: recentFields.filter((row) => !targetExtractionIds.has(row.extraction_id)),
    populationGroups: recentGroups.filter((row) => !primaryPaperIds.has(row.paper_id)),
    populationValues: recentValues.filter((row) => !primaryPaperIds.has(row.paper_id)),
    paperNotes: recentNotes.filter((row) => !targetPaperIds.has(row.paper_id)),
  };

  const passed = (
    screeningRecords.length === baseline.screeningRecords.length
    && screeningChecks.every((check) => (
      check.protectedRowUnchanged
      && check.bridgeCompleted
      && (!check.target || (check.includeVotes === 1 && check.excludeVotes === 0 && check.pendingSecondHuman))
    ))
    && votesUnchanged
    && paperChecks.every((check) => (
      check.assignmentMatched
      && check.bridgeVersionMatched
      && check.oneFile
      && check.primaryLinkMatched
      && check.fileHashMatched
      && check.status === (check.studyId === 'S2699' ? 'systematic_review' : 'processing')
      && check.referenceCheckingOnly === (check.studyId === 'S2699')
    ))
    && extractionChecks.every((check) => (
      check.status === 'processing'
      && check.tenTabs
      && check.fieldCount === check.expectedFieldCount
      && check.fieldsMatched
      && check.populationLabelsMatched
      && check.populationDualWriteMatched
      && check.populationHashMatched
      && check.oneEvidenceNote
      && check.extractionBridgeApplied
    ))
    && Object.entries(systematicReviewCheck).every(([key, value]) => (
      key === 'status' ? value === 'systematic_review' : value === true
    ))
    && s845Check.paperUnchanged
    && s845Check.status === 'american_data'
    && Object.entries(s845Check)
      .filter(([key]) => !['paperUnchanged', 'status'].includes(key))
      .every(([, value]) => value === true)
    && Object.values(backlogChecks).every(Boolean)
    && Object.values(outOfScopeRecent).every((rows) => rows.length === 0)
  );
  const output = {
    artifactType: 'Exact-six bridge extraction final verification',
    generatedAt: new Date().toISOString(),
    version: VERSION,
    passed,
    snapshotPath: SNAPSHOT_PATH,
    payloadPath: PAYLOAD_PATH,
    screening: {
      votesUnchanged,
      checks: screeningChecks,
    },
    papers: paperChecks,
    extractions: extractionChecks,
    systematicReview: systematicReviewCheck,
    s845: s845Check,
    backlog: backlogChecks,
    outOfScopeRecent,
  };
  const outputPath = path.join(
    AUDIT_DIR,
    `bridge-final-verification-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ passed, outputPath, output }, null, 2));
  if (!passed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
