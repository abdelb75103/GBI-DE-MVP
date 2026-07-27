import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const envPath = path.join(appRoot, '.env.local');
const masterPdfPath = path.join(repoRoot, 'output', 'pdf', 'UEFA_ECIS_Men_Master_Extraction.pdf');
const localAuditPath = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'audit',
  'uefa-master',
  'uefa-men-second-search-methodology-appendix-local-audit-2026-07-27.json',
);
const preApplyAuditPath = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'audit',
  'uefa-master',
  'uefa-men-second-search-methodology-page-pre-apply-live-snapshot-2026-07-27.json',
);
const finalAuditPath = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'audit',
  'uefa-master',
  'uefa-men-second-search-methodology-page-live-apply-audit-2026-07-27.json',
);

const masterStudyId = 'UEFA-ECIS-MASTER';
const expectedProfileId = '00000000-0000-0000-0000-000000000001';
const expectedStatus = 'uefa_master_extraction';
const expectedPriorPdfSha256 = '7effd081c1afac526fe7e24236eb6ca02821558d6da8ea3194abfa6d0f91004c';
const candidateStudyIds = ['S1091', 'S112', 'S200', 'S2391', 'S4839', 'S5151', 'S5338'];

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
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
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

async function loadState(supabase) {
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,status,assigned_to,primary_file_id,primary_file_sha256,storage_bucket,storage_object_path,original_file_name,metadata')
    .eq('assigned_study_id', masterStudyId)
    .single();
  if (paperError) throw paperError;

  const { data: file, error: fileError } = await supabase
    .from('paper_files')
    .select('id,paper_id,name,original_file_name,size,mime_type,storage_bucket,storage_object_path,file_sha256')
    .eq('id', paper.primary_file_id)
    .single();
  if (fileError) throw fileError;

  const { data: groups, error: groupError } = await supabase
    .from('population_groups')
    .select('id,paper_id,tab,label,position,population_values(id,population_group_id,paper_id,field_id,value,metric,unit,source_field_id)')
    .eq('paper_id', paper.id)
    .order('position');
  if (groupError) throw groupError;

  const { data: extractions, error: extractionError } = await supabase
    .from('extractions')
    .select('id,paper_id,tab,model,extraction_fields(id,field_id,value,status,metric,confidence,page_hint,source_quote,updated_by)')
    .eq('paper_id', paper.id)
    .order('tab');
  if (extractionError) throw extractionError;

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
    paper,
    file,
    groups: groups ?? [],
    extractions: extractions ?? [],
    screeningRecords: screeningRecords ?? [],
    screeningVotes,
    extractionHash: stableHash({ groups: groups ?? [], extractions: extractions ?? [] }),
    protectedScreeningHash: stableHash({
      records: screeningRecords ?? [],
      votes: screeningVotes,
    }),
  };
}

function validateBefore(state, localAudit, newPdfSha256) {
  const blockers = [];
  if (state.paper.assigned_to !== expectedProfileId) blockers.push('Master assignment is not AbdelRahman Babiker.');
  if (state.paper.status !== expectedStatus) blockers.push(`Master status is ${state.paper.status}.`);
  if (state.paper.primary_file_sha256 !== expectedPriorPdfSha256) {
    blockers.push(`Unexpected current live PDF hash ${state.paper.primary_file_sha256}.`);
  }
  if (state.file.file_sha256 !== expectedPriorPdfSha256) blockers.push('Current paper_files hash does not match the prior PDF.');
  if (state.groups.length !== 20) blockers.push(`Expected 20 live groups, found ${state.groups.length}.`);
  if (localAudit.input?.sha256 !== expectedPriorPdfSha256 || localAudit.input?.pages !== 11) {
    blockers.push('Local appendix audit does not identify the expected 11-page input.');
  }
  if (localAudit.output?.sha256 !== newPdfSha256 || localAudit.output?.pages !== 12) {
    blockers.push('Local appendix audit does not identify the staged 12-page output.');
  }
  if (localAudit.output?.existingPageSignaturesPreserved !== true) {
    blockers.push('Local appendix audit did not confirm preservation of the existing page signatures.');
  }
  if (newPdfSha256 === expectedPriorPdfSha256) blockers.push('Staged PDF is identical to the current live PDF.');
  return { blockers, ready: blockers.length === 0 };
}

async function updateLivePdf(supabase, before, pdfBuffer, newPdfSha256) {
  const now = new Date().toISOString();
  const objectPath = `${before.paper.id}/${Date.now()}-UEFA_ECIS_Men_Master_Extraction.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('papers')
    .upload(objectPath, pdfBuffer, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(`Failed to upload the 12-page master PDF: ${uploadError.message}`);

  const { data: updatedFileRows, error: fileError } = await supabase
    .from('paper_files')
    .update({
      name: 'UEFA_ECIS_Men_Master_Extraction.pdf',
      original_file_name: 'UEFA_ECIS_Men_Master_Extraction.pdf',
      size: pdfBuffer.length,
      mime_type: 'application/pdf',
      uploaded_at: now,
      storage_bucket: 'papers',
      storage_object_path: objectPath,
      file_sha256: newPdfSha256,
    })
    .eq('id', before.file.id)
    .select('id');
  if (fileError) throw new Error(`Failed to update the live paper_files row: ${fileError.message}`);
  if ((updatedFileRows ?? []).length !== 1) {
    throw new Error(`Expected one updated paper_files row, received ${(updatedFileRows ?? []).length}.`);
  }

  const { data: updatedPaperRows, error: paperError } = await supabase
    .from('papers')
    .update({
      primary_file_id: before.file.id,
      primary_file_sha256: newPdfSha256,
      storage_bucket: 'papers',
      storage_object_path: objectPath,
      original_file_name: 'UEFA_ECIS_Men_Master_Extraction.pdf',
      metadata: {
        ...(before.paper.metadata ?? {}),
        mensSecondSearchMethodologyAppendix: {
          appliedAt: now,
          pagesBefore: 11,
          pagesAfter: 12,
          includedSupplement: 'S5151',
          auditOnly: ['S4839', 'S2391'],
          separateWorkspace: ['S5338'],
          womensBoundaryCheck: 'S1091 duplicate alias of S112',
          priorPrimaryFileSha256: expectedPriorPdfSha256,
          priorStorageObjectPath: before.paper.storage_object_path,
          localAuditPath: 'Data Analysis/Data Cleaning/audit/uefa-master/uefa-men-second-search-methodology-appendix-local-audit-2026-07-27.json',
        },
      },
      updated_at: now,
    })
    .eq('id', before.paper.id)
    .select('id');
  if (paperError) throw new Error(`Failed to update the live paper pointer: ${paperError.message}`);
  if ((updatedPaperRows ?? []).length !== 1) {
    throw new Error(`Expected one updated papers row, received ${(updatedPaperRows ?? []).length}.`);
  }

  return {
    objectPath,
    fileId: before.file.id,
    appliedAt: now,
    mutationCounts: {
      storageObjectsUploaded: 1,
      paperFilesRowsUpdated: updatedFileRows.length,
      papersRowsUpdated: updatedPaperRows.length,
    },
  };
}

function verifyAfter(before, after, newPdfSha256, applyResult) {
  const findings = [];
  if (after.paper.primary_file_sha256 !== newPdfSha256) findings.push('Live paper hash does not match the 12-page PDF.');
  if (after.file.file_sha256 !== newPdfSha256) findings.push('paper_files hash does not match the 12-page PDF.');
  if (after.file.storage_object_path !== applyResult.objectPath) findings.push('paper_files object path does not match the uploaded version.');
  if (after.paper.storage_object_path !== applyResult.objectPath) findings.push('Paper object path does not match the uploaded version.');
  if (after.paper.primary_file_id !== before.paper.primary_file_id) findings.push('Primary file ID changed unexpectedly.');
  if (after.extractionHash !== before.extractionHash) findings.push('Extraction rows or fields changed during the PDF-only refresh.');
  if (after.protectedScreeningHash !== before.protectedScreeningHash) findings.push('Protected screening state changed.');
  if (after.groups.length !== 20) findings.push(`Expected 20 live groups after refresh, found ${after.groups.length}.`);
  if (after.paper.assigned_to !== before.paper.assigned_to) findings.push('Master assignment changed.');
  if (after.paper.status !== before.paper.status) findings.push('Master status changed.');
  return {
    result: findings.length === 0 ? 'passed' : 'failed',
    findings,
    pdfHashMatchesLivePaper: after.paper.primary_file_sha256 === newPdfSha256,
    sourceFileAttached: after.file.file_sha256 === newPdfSha256,
    extractionDataUnchanged: after.extractionHash === before.extractionHash,
    exactMasterMembership: { expectedRows: 20, liveRows: after.groups.length },
    assignmentPreserved: after.paper.assigned_to === before.paper.assigned_to,
    statusPreserved: after.paper.status === before.paper.status,
    protectedScreeningUnchanged: after.protectedScreeningHash === before.protectedScreeningHash,
    protectedScreeningHash: after.protectedScreeningHash,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const supabase = getSupabase();
  const pdfBuffer = fs.readFileSync(masterPdfPath);
  const newPdfSha256 = sha256Buffer(pdfBuffer);
  const localAudit = JSON.parse(fs.readFileSync(localAuditPath, 'utf8'));
  const before = await loadState(supabase);
  const validation = validateBefore(before, localAudit, newPdfSha256);

  if (!validation.ready) {
    console.log(JSON.stringify({ mode: apply ? 'apply-blocked' : 'dry-run-blocked', validation }, null, 2));
    process.exitCode = 1;
    return;
  }

  const preApplyAudit = {
    artifactType: 'UEFA ECIS men second-search methodology page pre-apply live snapshot',
    date: '2026-07-27',
    scope: 'PDF attachment only; no extraction, population, status, assignment, or screening write',
    paper: before.paper,
    file: before.file,
    rowCount: before.groups.length,
    extractionHash: before.extractionHash,
    protectedScreeningHash: before.protectedScreeningHash,
    stagedPdf: {
      path: masterPdfPath,
      sha256: newPdfSha256,
      pages: localAudit.output.pages,
    },
    rollback: {
      priorPrimaryFileSha256: before.paper.primary_file_sha256,
      priorStorageObjectPath: before.paper.storage_object_path,
      localBackupPath: localAudit.input.path,
      localBackupSha256: localAudit.input.sha256,
    },
  };

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', validation, preApplyAudit }, null, 2));
    return;
  }

  fs.writeFileSync(preApplyAuditPath, `${JSON.stringify(preApplyAudit, null, 2)}\n`, 'utf8');
  const applyResult = await updateLivePdf(supabase, before, pdfBuffer, newPdfSha256);
  const after = await loadState(supabase);
  const gate = verifyAfter(before, after, newPdfSha256, applyResult);
  const finalAudit = {
    artifactType: 'UEFA ECIS men second-search methodology page live apply audit',
    date: '2026-07-27',
    scope: 'Append one methodology page and refresh the live master PDF only',
    methodologyConclusion: {
      includedSupplement: 'S5151',
      auditOnly: ['S4839', 'S2391'],
      separateWorkspace: ['S5338'],
      womensBoundaryCheck: 'S1091 duplicate alias of S112',
      masterAnchor: 'S200 remains the historical all-injury ECIS men anchor for overlapping periods.',
    },
    localAudit,
    preApplyAuditPath,
    applyResult: {
      ...applyResult,
      pdfSha256: newPdfSha256,
      pages: 12,
      size: pdfBuffer.length,
    },
    integrityGate: gate,
    rollback: preApplyAudit.rollback,
    writes: {
      ...applyResult.mutationCounts,
      extractionFields: 0,
      populationGroups: 0,
      populationValues: 0,
      screeningRecords: 0,
      screeningVotes: 0,
    },
    readyFor: gate.result === 'passed' ? 'Human methodology review' : 'Blocker correction',
  };
  fs.writeFileSync(finalAuditPath, `${JSON.stringify(finalAudit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    mode: 'applied',
    applyResult: finalAudit.applyResult,
    gate,
    artefacts: { preApplyAuditPath, finalAuditPath },
  }, null, 2));
  process.exitCode = gate.result === 'passed' ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
