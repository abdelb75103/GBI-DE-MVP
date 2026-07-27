import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const envPath = path.join(appRoot, '.env.local');
const auditDir = path.join(repoRoot, 'Data Analysis', 'Data Cleaning', 'audit', 'uefa-master');
const sourceAuditPath = path.join(auditDir, 'uefa-master-source-audit.json');
const masterPdfPath = path.join(repoRoot, 'output', 'pdf', 'UEFA_ECIS_Men_Master_Extraction.pdf');
const preApplyAuditPath = path.join(
  auditDir,
  'uefa-second-search-reconciliation-pre-apply-live-snapshot-2026-07-27.json',
);
const finalAuditPath = path.join(
  auditDir,
  'uefa-second-search-reconciliation-final-live-integrity-audit-2026-07-27.json',
);

const masterStudyId = 'UEFA-ECIS-MASTER';
const existingMasterRowCount = 19;
const expectedProfileId = '00000000-0000-0000-0000-000000000001';
const expectedOldMasterPdfSha256 = '83eed53e214b5c005a3e8cf4229bdb629d2e227eac81f06bd4695d63af881fcc';
const candidateStudyIds = ['S1091', 'S112', 'S200', 'S2391', 'S4839', 'S5151', 'S5338'];
const expectedSourceFiles = {
  S1091: {
    path: path.join(appRoot, 'tmp', 'full-text-pdf-retrieval', 'S1091-bc2bd537f8.pdf'),
    sha256: 'bc2bd537f868e7226ddc7c3c9362738e10f7e35e60a518d6618bab619fe5cb26',
  },
  S2391: {
    path: path.join(
      appRoot,
      'data',
      'full-text-pdf-retrieval',
      'atlas-ucd-session-2026-06-24',
      'post-login-cache-upload',
      'files',
      'S2391-a-higher-thigh-muscle-injury-incidence-in-professional-male-soccer-players-returning-to-play-after-anterior-cr.pdf',
    ),
    sha256: 'a2d780d73fe1319a015d1839b4927acd1e52c02df14804077c042f967ecc3d0b',
  },
  S4839: {
    path: path.join(appRoot, 'tmp', 'full-text-pdf-retrieval', 'S4839-5201ad56e3.pdf'),
    sha256: '5201ad56e31f1a16f34cd41132d815cb9dbf303eea2eb424232102be0958d4df',
  },
  S5151: {
    path: path.join(appRoot, 'tmp', 'full-text-pdf-retrieval', 'S5151-569a6530a1.pdf'),
    sha256: '569a6530a1d2e0185b7149582314e6dd8b200f4b2f7401239e80eb951d939a2a',
  },
};

const stagedRow = {
  label: 'S5151 ECIS men 2022/23 World Cup-season all injuries',
  position: existingMasterRowCount,
  sourceStudyId: 'S5151',
  fields: {
    studyId: masterStudyId,
    sex: 'male - 2022/23 World Cup-season supplement',
    sampleSizePlayers: '913',
    numberOfTeams: '29',
    observationDuration: '2022/23',
    numberOfSeasons: '1',
    totalExposure: '176790',
    injuryTotalCount: '1123',
    injuryIncidenceTraining: '3.5 (95% CI 3.2-3.9)',
    injuryIncidenceMatch: '21.1 (95% CI 19.5-22.9)',
    injuryTimeLossTotal: '26418',
  },
};

const tabsByFieldId = new Map([
  ['studyId', 'studyDetails'],
  ['sex', 'participantCharacteristics'],
  ['sampleSizePlayers', 'participantCharacteristics'],
  ['numberOfTeams', 'participantCharacteristics'],
  ['observationDuration', 'participantCharacteristics'],
  ['numberOfSeasons', 'exposure'],
  ['totalExposure', 'exposure'],
  ['injuryTotalCount', 'injuryOutcome'],
  ['injuryIncidenceTraining', 'injuryOutcome'],
  ['injuryIncidenceMatch', 'injuryOutcome'],
  ['injuryTimeLossTotal', 'injuryOutcome'],
]);

function loadEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equals = trimmed.indexOf('=');
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortDeep(child)]),
    );
  }
  return value;
}

function stableHash(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(sortDeep(value))));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getSupabase() {
  const env = loadEnvFile(envPath);
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function loadLiveState(supabase) {
  const requestedIds = [masterStudyId, ...candidateStudyIds];
  const { data: papers, error: paperError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,lead_author,journal,year,doi,normalized_doi,status,assigned_to,flag_reason,primary_file_id,primary_file_sha256,storage_bucket,storage_object_path,original_file_name,metadata')
    .in('assigned_study_id', requestedIds)
    .order('assigned_study_id');
  if (paperError) throw paperError;

  const byStudyId = new Map((papers ?? []).map((paper) => [paper.assigned_study_id, paper]));
  for (const studyId of requestedIds) {
    assert(byStudyId.has(studyId), `Missing live paper ${studyId}`);
  }
  const master = byStudyId.get(masterStudyId);

  const { data: files, error: fileError } = await supabase
    .from('paper_files')
    .select('id,paper_id,name,original_file_name,size,mime_type,storage_bucket,storage_object_path,file_sha256')
    .in('paper_id', (papers ?? []).map((paper) => paper.id))
    .order('uploaded_at');
  if (fileError) throw fileError;

  const { data: extractions, error: extractionError } = await supabase
    .from('extractions')
    .select('id,paper_id,tab,model,extraction_fields(id,field_id,value,status,metric,confidence,page_hint,source_quote,updated_at,updated_by)')
    .eq('paper_id', master.id);
  if (extractionError) throw extractionError;

  const { data: groups, error: groupError } = await supabase
    .from('population_groups')
    .select('id,paper_id,tab,label,position,created_at,updated_at,population_values(id,population_group_id,paper_id,field_id,value,metric,unit,source_field_id,created_at,updated_at)')
    .eq('paper_id', master.id)
    .order('position');
  if (groupError) throw groupError;

  const { data: screeningRecords, error: screeningError } = await supabase
    .from('screening_records')
    .select('id,stage,assigned_study_id,manual_decision,manual_reason,manual_decided_by,manual_decided_at,promoted_paper_id,promoted_by,promoted_at,metadata,updated_at')
    .in('assigned_study_id', candidateStudyIds)
    .order('assigned_study_id')
    .order('id');
  if (screeningError) throw screeningError;

  const screeningIds = (screeningRecords ?? []).map((record) => record.id);
  let screeningVotes = [];
  if (screeningIds.length > 0) {
    const { data, error } = await supabase
      .from('screening_votes')
      .select('id,screening_record_id,vote_order,vote_role,reviewer_profile_id,reviewer_name,decision,reason,decided_at,updated_at')
      .in('screening_record_id', screeningIds)
      .order('screening_record_id')
      .order('vote_order');
    if (error) throw error;
    screeningVotes = data ?? [];
  }

  return {
    papers: papers ?? [],
    byStudyId,
    files: files ?? [],
    master,
    extractions: extractions ?? [],
    groups: groups ?? [],
    screeningRecords: screeningRecords ?? [],
    screeningVotes,
  };
}

function flattenFields(state) {
  return state.extractions.flatMap((extraction) =>
    (extraction.extraction_fields ?? []).map((field) => ({
      ...field,
      tab: extraction.tab,
      extractionId: extraction.id,
    })),
  );
}

function compactPaper(paper) {
  return {
    id: paper.id,
    assignedStudyId: paper.assigned_study_id,
    title: paper.title,
    leadAuthor: paper.lead_author,
    journal: paper.journal,
    year: paper.year,
    doi: paper.doi,
    normalizedDoi: paper.normalized_doi,
    status: paper.status,
    assignedTo: paper.assigned_to,
    flagReason: paper.flag_reason,
    primaryFileId: paper.primary_file_id,
    primaryFileSha256: paper.primary_file_sha256,
    storageBucket: paper.storage_bucket,
    storageObjectPath: paper.storage_object_path,
    originalFileName: paper.original_file_name,
    metadataHash: stableHash(paper.metadata ?? {}),
  };
}

function buildPreApplySnapshot(state, localHashes) {
  return {
    artifactType: 'UEFA ECIS/WECIS second-search pre-apply live snapshot',
    date: '2026-07-27',
    scope: `${masterStudyId} additive S5151 row only; S1091, S4839, S2391, and S5338 are ledger-only`,
    stagedRow,
    sourceHashes: localHashes,
    papers: state.papers.map(compactPaper),
    masterFiles: state.files.filter((file) => file.paper_id === state.master.id),
    masterMetadata: state.master.metadata ?? {},
    masterExtractionRestoreSnapshot: state.extractions,
    masterPopulationRestoreSnapshot: state.groups,
    protectedScreening: {
      recordCount: state.screeningRecords.length,
      voteCount: state.screeningVotes.length,
      hash: stableHash({ records: state.screeningRecords, votes: state.screeningVotes }),
      records: state.screeningRecords,
      votes: state.screeningVotes,
    },
  };
}

function validateState(state, localHashes, sourceAudit) {
  const blockers = [];
  const existingS5151Group = state.groups.find((group) => group.label === stagedRow.label);
  const s112 = state.byStudyId.get('S112');
  const s1091 = state.byStudyId.get('S1091');

  if (s112.doi !== '10.1136/bjsports-2023-107133' || s1091.doi !== s112.doi) {
    blockers.push('S1091 and S112 do not have the expected matching WECIS DOI.');
  }
  if (state.master.assigned_to !== expectedProfileId) {
    blockers.push(`Master is assigned to ${state.master.assigned_to ?? 'nobody'}, not AbdelRahman Babiker.`);
  }
  if (state.master.status !== 'uefa_master_extraction') {
    blockers.push(`Master status is ${state.master.status}, not uefa_master_extraction.`);
  }
  if (state.master.primary_file_sha256 !== expectedOldMasterPdfSha256 && !existingS5151Group) {
    blockers.push(`Unexpected pre-apply master PDF hash ${state.master.primary_file_sha256}.`);
  }
  if (!existingS5151Group && state.groups.length !== existingMasterRowCount) {
    blockers.push(`Expected ${existingMasterRowCount} existing master rows, found ${state.groups.length}.`);
  }
  if (existingS5151Group && existingS5151Group.position !== stagedRow.position) {
    blockers.push(`Existing S5151 row is at position ${existingS5151Group.position}, expected ${stagedRow.position}.`);
  }

  const fieldsById = new Map(flattenFields(state).map((field) => [field.field_id, field]));
  if (!existingS5151Group) {
    for (const fieldId of Object.keys(stagedRow.fields)) {
      const existing = fieldsById.get(fieldId);
      if (!existing) {
        blockers.push(`Missing existing master extraction field ${fieldId}.`);
        continue;
      }
      const lineCount = typeof existing.value === 'string' ? existing.value.split('\n').length : 0;
      if (lineCount !== existingMasterRowCount) {
        blockers.push(`Field ${fieldId} has ${lineCount} lines; expected ${existingMasterRowCount} before append.`);
      }
      if (existing.tab !== tabsByFieldId.get(fieldId)) {
        blockers.push(`Field ${fieldId} is on tab ${existing.tab}, expected ${tabsByFieldId.get(fieldId)}.`);
      }
    }
  }

  for (const [studyId, expected] of Object.entries(expectedSourceFiles)) {
    const paper = state.byStudyId.get(studyId);
    if (localHashes[studyId] !== expected.sha256) {
      blockers.push(`Local ${studyId} PDF hash does not match the registered expected hash.`);
    }
    if (paper.primary_file_sha256 && paper.primary_file_sha256 !== expected.sha256) {
      blockers.push(`Live ${studyId} primary PDF hash does not match the inspected local PDF.`);
    }
  }

  const ledger = sourceAudit.second_search_source_family_ledger ?? {};
  const expectedClassifications = {
    S1091: 'duplicate alias',
    S5151: 'included supplement',
    S4839: 'audit-only',
    S2391: 'audit-only',
    S5338: 'separate workspace',
  };
  for (const [studyId, classification] of Object.entries(expectedClassifications)) {
    if (ledger[studyId]?.classification !== classification) {
      blockers.push(`Source audit classification for ${studyId} is not ${classification}.`);
    }
  }

  return {
    blockers,
    ready: blockers.length === 0,
    existingS5151Group: Boolean(existingS5151Group),
    masterRowCount: state.groups.length,
    masterFieldCount: flattenFields(state).length,
    protectedScreeningHash: stableHash({
      records: state.screeningRecords,
      votes: state.screeningVotes,
    }),
  };
}

async function applyAdditiveRow(supabase, state, preApplySnapshot, newPdfBuffer, newPdfSha256) {
  const now = new Date().toISOString();
  const fieldsById = new Map(flattenFields(state).map((field) => [field.field_id, field]));
  const existingS5151Group = state.groups.find((group) => group.label === stagedRow.label);
  let groupId = existingS5151Group?.id ?? null;

  if (!groupId) {
    groupId = crypto.randomUUID();
    const { error: groupError } = await supabase.from('population_groups').insert({
      id: groupId,
      paper_id: state.master.id,
      tab: 'participantCharacteristics',
      label: stagedRow.label,
      position: stagedRow.position,
      created_at: now,
      updated_at: now,
    });
    if (groupError) throw new Error(`Failed to insert S5151 population group: ${groupError.message}`);

    const populationValues = Object.entries(stagedRow.fields).map(([fieldId, value]) => ({
      id: crypto.randomUUID(),
      population_group_id: groupId,
      paper_id: state.master.id,
      field_id: fieldId,
      value,
      metric: null,
      unit: null,
      source_field_id: fieldId,
      created_at: now,
      updated_at: now,
    }));
    const { error: valuesError } = await supabase.from('population_values').insert(populationValues);
    if (valuesError) throw new Error(`Failed to insert S5151 population values: ${valuesError.message}`);

    for (const [fieldId, rowValue] of Object.entries(stagedRow.fields)) {
      const existing = fieldsById.get(fieldId);
      const priorValue = existing.value ?? '';
      const newValue = `${priorValue}\n${rowValue}`;
      const existingSources = existing.source_quote?.trim();
      const existingPageHint = existing.page_hint?.trim();
      const { error } = await supabase
        .from('extraction_fields')
        .update({
          value: newValue,
          status: 'reported',
          confidence: existing.confidence ?? 0.95,
          source_quote: [
            existingSources,
            'S5151 additive supplement: directly reported 2022/23 full-season value; row 20 preserves S200 as the anchor and does not pool historical or World Cup subgroup contrasts.',
          ].filter(Boolean).join(' '),
          page_hint: [existingPageHint, 'S5151 pp. 2-5 and Table 1'].filter(Boolean).join('; '),
          updated_at: now,
          updated_by: null,
        })
        .eq('id', existing.id);
      if (error) throw new Error(`Failed to append S5151 value to ${fieldId}: ${error.message}`);
    }
  }

  const versionedObjectPath = `${state.master.id}/${Date.now()}-UEFA_ECIS_Men_Master_Extraction.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('papers')
    .upload(versionedObjectPath, newPdfBuffer, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(`Failed to upload refreshed master PDF: ${uploadError.message}`);

  const existingFile = state.files.find((file) => file.id === state.master.primary_file_id);
  assert(existingFile, 'Live master primary paper_files row is missing.');
  const { error: fileError } = await supabase
    .from('paper_files')
    .update({
    name: 'UEFA_ECIS_Men_Master_Extraction.pdf',
    original_file_name: 'UEFA_ECIS_Men_Master_Extraction.pdf',
    size: newPdfBuffer.length,
    mime_type: 'application/pdf',
    uploaded_at: now,
    storage_bucket: 'papers',
    storage_object_path: versionedObjectPath,
    file_sha256: newPdfSha256,
    })
    .eq('id', existingFile.id);
  if (fileError) throw new Error(`Failed to update refreshed master PDF record: ${fileError.message}`);

  const { error: paperError } = await supabase
    .from('papers')
    .update({
      primary_file_id: existingFile.id,
      primary_file_sha256: newPdfSha256,
      storage_bucket: 'papers',
      storage_object_path: versionedObjectPath,
      original_file_name: 'UEFA_ECIS_Men_Master_Extraction.pdf',
      metadata: {
        ...(state.master.metadata ?? {}),
        secondSearchUefaReconciliation: {
          appliedAt: now,
          includedSupplement: 'S5151',
          duplicateAlias: 'S1091 -> S112',
          auditOnly: ['S4839', 'S2391'],
          separateWorkspace: ['S5338'],
          sourceAuditPath: 'Data Analysis/Data Cleaning/audit/uefa-master/uefa-master-source-audit.json',
          preApplyAuditPath: 'Data Analysis/Data Cleaning/audit/uefa-master/uefa-second-search-reconciliation-pre-apply-live-snapshot-2026-07-27.json',
          priorPrimaryFileId: preApplySnapshot.papers.find(
            (paper) => paper.assignedStudyId === masterStudyId,
          )?.primaryFileId,
          priorPrimaryFileSha256: expectedOldMasterPdfSha256,
        },
      },
      updated_at: now,
    })
    .eq('id', state.master.id);
  if (paperError) throw new Error(`Failed to update master paper pointer/metadata: ${paperError.message}`);

  return {
    populationGroupId: groupId,
    populationGroupCreated: !existingS5151Group,
    insertedPopulationValues: existingS5151Group ? 0 : Object.keys(stagedRow.fields).length,
    updatedExtractionFields: existingS5151Group ? 0 : Object.keys(stagedRow.fields).length,
    refreshedPrimaryFile: {
      id: existingFile.id,
      storageObjectPath: versionedObjectPath,
      sha256: newPdfSha256,
      size: newPdfBuffer.length,
    },
    priorStorageObjectRetained: true,
  };
}

function verifyFinalState(before, after, newPdfSha256) {
  const findings = [];
  const dualWriteMismatchFieldIds = new Set();
  const afterGroup = after.groups.find((group) => group.label === stagedRow.label);
  if (!afterGroup) findings.push({ severity: 'blocker', message: 'S5151 population group is missing.' });
  if (after.groups.length !== existingMasterRowCount + 1) {
    findings.push({
      severity: 'blocker',
      message: `Expected ${existingMasterRowCount + 1} master rows, found ${after.groups.length}.`,
    });
  }
  if (afterGroup?.position !== stagedRow.position) {
    findings.push({ severity: 'blocker', message: `S5151 row position is ${afterGroup?.position}.` });
  }

  const groupValues = new Map(
    (afterGroup?.population_values ?? []).map((value) => [value.field_id, value.value]),
  );
  const afterFields = new Map(flattenFields(after).map((field) => [field.field_id, field]));
  for (const [fieldId, expectedValue] of Object.entries(stagedRow.fields)) {
    if (groupValues.get(fieldId) !== expectedValue) {
      dualWriteMismatchFieldIds.add(fieldId);
      findings.push({
        severity: 'blocker',
        message: `Population value mismatch for ${fieldId}: ${groupValues.get(fieldId)}.`,
      });
    }
    const field = afterFields.get(fieldId);
    const lines = typeof field?.value === 'string' ? field.value.split('\n') : [];
    if (lines.length !== existingMasterRowCount + 1 || lines[stagedRow.position] !== expectedValue) {
      dualWriteMismatchFieldIds.add(fieldId);
      findings.push({
        severity: 'blocker',
        message: `Extraction field mismatch for ${fieldId}: ${lines.length} lines, row value ${lines[stagedRow.position]}.`,
      });
    }
  }

  const studyId = afterFields.get('studyId')?.value?.split('\n')[stagedRow.position];
  if (studyId !== masterStudyId) {
    findings.push({ severity: 'blocker', message: `Row 20 studyId is ${studyId}.` });
  }
  if (after.master.assigned_to !== expectedProfileId) {
    findings.push({ severity: 'blocker', message: 'Master assignment changed unexpectedly.' });
  }
  if (after.master.status !== 'uefa_master_extraction') {
    findings.push({ severity: 'blocker', message: 'Master status changed unexpectedly.' });
  }
  if (after.master.primary_file_sha256 !== newPdfSha256) {
    findings.push({ severity: 'blocker', message: 'Refreshed primary PDF hash does not match live paper.' });
  }
  const matchingFile = after.files.find(
    (file) => file.id === after.master.primary_file_id && file.file_sha256 === newPdfSha256,
  );
  if (!matchingFile) {
    findings.push({ severity: 'blocker', message: 'Refreshed primary PDF is not attached in paper_files.' });
  }

  const beforeScreeningHash = stableHash({
    records: before.screeningRecords,
    votes: before.screeningVotes,
  });
  const afterScreeningHash = stableHash({
    records: after.screeningRecords,
    votes: after.screeningVotes,
  });
  if (beforeScreeningHash !== afterScreeningHash) {
    findings.push({ severity: 'blocker', message: 'Protected screening state changed.' });
  }

  return {
    result: findings.some((finding) => finding.severity === 'blocker') ? 'failed' : 'passed',
    findings,
    exactMasterMembership: {
      expectedRows: existingMasterRowCount + 1,
      liveRows: after.groups.length,
      s5151Position: afterGroup?.position ?? null,
    },
    sourceToLiveFieldTransferMismatches: findings.filter((finding) =>
      finding.message.includes('mismatch for'),
    ).length,
    populationLayoutMismatches: findings.filter((finding) =>
      finding.message.includes('population group') || finding.message.includes('row position'),
    ).length,
    structuredDualWriteMismatches: dualWriteMismatchFieldIds.size,
    sourceHashMatchesLivePaper: after.master.primary_file_sha256 === newPdfSha256,
    studyIdMatchesAssignedStudyId: studyId === masterStudyId,
    assignmentPreserved: after.master.assigned_to === expectedProfileId,
    statusPreserved: after.master.status === 'uefa_master_extraction',
    sourceFileAttached: Boolean(matchingFile),
    protectedScreeningUnchanged: beforeScreeningHash === afterScreeningHash,
    protectedScreeningHash: afterScreeningHash,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify');
  const supabase = getSupabase();
  const sourceAudit = JSON.parse(fs.readFileSync(sourceAuditPath, 'utf8'));
  const newPdfBuffer = fs.readFileSync(masterPdfPath);
  const newPdfSha256 = sha256Buffer(newPdfBuffer);
  const localHashes = Object.fromEntries(
    Object.entries(expectedSourceFiles).map(([studyId, expected]) => [
      studyId,
      sha256File(expected.path),
    ]),
  );

  const before = await loadLiveState(supabase);
  const validation = validateState(before, localHashes, sourceAudit);
  if (!validation.ready && !verifyOnly) {
    console.log(JSON.stringify({ mode: apply ? 'apply-blocked' : 'dry-run', validation, stagedRow }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (verifyOnly) {
    const gate = verifyFinalState(before, before, newPdfSha256);
    console.log(JSON.stringify({ mode: 'verify-only', gate }, null, 2));
    process.exitCode = gate.result === 'passed' ? 0 : 1;
    return;
  }

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      validation,
      stagedRow,
      localMasterPdf: {
        path: masterPdfPath,
        sha256: newPdfSha256,
        differsFromCurrentLivePdf: newPdfSha256 !== before.master.primary_file_sha256,
      },
      rollback: {
        existingRowsAndFields: `Restore from ${preApplyAuditPath}`,
        existingPrimaryFile: {
          id: before.master.primary_file_id,
          sha256: before.master.primary_file_sha256,
          objectPath: before.master.storage_object_path,
        },
        newPdfIsVersioned: true,
        priorStorageObjectAndLocalBackupWillRemainRecoverable: true,
      },
    }, null, 2));
    return;
  }

  const preApplySnapshot = fs.existsSync(preApplyAuditPath)
    ? JSON.parse(fs.readFileSync(preApplyAuditPath, 'utf8'))
    : buildPreApplySnapshot(before, localHashes);
  assert(
    preApplySnapshot.masterPopulationRestoreSnapshot?.length === existingMasterRowCount,
    `Existing pre-apply snapshot does not contain the expected ${existingMasterRowCount} master rows.`,
  );
  assert(
    preApplySnapshot.papers?.find((paper) => paper.assignedStudyId === masterStudyId)
      ?.primaryFileSha256 === expectedOldMasterPdfSha256,
    'Existing pre-apply snapshot does not identify the expected prior master PDF.',
  );
  assert(
    preApplySnapshot.protectedScreening?.hash === validation.protectedScreeningHash,
    'Existing pre-apply snapshot protected-screening hash does not match current live state.',
  );
  if (!fs.existsSync(preApplyAuditPath)) {
    fs.writeFileSync(preApplyAuditPath, `${JSON.stringify(preApplySnapshot, null, 2)}\n`, 'utf8');
  }

  const applyResult = await applyAdditiveRow(
    supabase,
    before,
    preApplySnapshot,
    newPdfBuffer,
    newPdfSha256,
  );
  const after = await loadLiveState(supabase);
  const gate = verifyFinalState(before, after, newPdfSha256);
  const finalAudit = {
    artifactType: 'UEFA ECIS/WECIS second-search focused live reconciliation audit',
    date: '2026-07-27',
    scope: `${masterStudyId} additive S5151 row and versioned PDF only`,
    sourceCoverage: {
      S1091: 'Full PDF, DOI, article identity, Table 2, and live file metadata compared with S112.',
      S5151: 'Full PDF, methods, results, Table 1, Table 2, figures, discussion, and limitations scanned.',
      S4839: 'Full PDF, methods, Figure 1, Table 1 continuation, Table 2, discussion, and limitations scanned.',
      S2391: 'Full PDF, methods, exposure definition, Tables 1-4, discussion, and limitations scanned.',
      S5338: 'Live title/source metadata checked; retained outside ECIS/WECIS as a UEFA tournament paper.',
    },
    ledgerDecisions: sourceAudit.second_search_source_family_ledger,
    stagedRow,
    protectedScreening: {
      preApplyHash: preApplySnapshot.protectedScreening.hash,
      postApplyHash: gate.protectedScreeningHash,
      postApplyUnchanged: preApplySnapshot.protectedScreening.hash === gate.protectedScreeningHash,
      screeningWrites: 0,
      resolverWrites: 0,
      promotionWrites: 0,
    },
    applyResult,
    integrityGate: gate,
    rollback: {
      preApplyAuditPath,
      priorStorageObjectRetained: true,
      priorPrimaryFileId: preApplySnapshot.papers.find(
        (paper) => paper.assignedStudyId === masterStudyId,
      )?.primaryFileId,
      priorPrimaryFileSha256: preApplySnapshot.papers.find(
        (paper) => paper.assignedStudyId === masterStudyId,
      )?.primaryFileSha256,
      priorStorageObjectPath: preApplySnapshot.papers.find(
        (paper) => paper.assignedStudyId === masterStudyId,
      )?.storageObjectPath,
    },
    readyFor: gate.result === 'passed' ? 'Human extraction review' : 'Blocker correction',
  };
  fs.writeFileSync(finalAuditPath, `${JSON.stringify(finalAudit, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    mode: 'applied',
    applyResult,
    gate,
    artefacts: { preApplyAuditPath, finalAuditPath },
  }, null, 2));
  process.exitCode = gate.result === 'passed' ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
