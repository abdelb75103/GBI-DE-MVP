import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const envPath = path.join(appRoot, '.env.local');
const auditDir = path.join(repoRoot, 'Data Analysis', 'Data Cleaning', 'audit', 'uefa-master');
const preApplyAuditPath = path.join(
  auditDir,
  'uefa-master-population-metadata-repair-pre-apply-2026-07-27.json',
);
const finalAuditPath = path.join(
  auditDir,
  'uefa-master-population-metadata-repair-live-audit-2026-07-27.json',
);

const masterStudyId = 'UEFA-ECIS-MASTER';
const expectedProfileId = '00000000-0000-0000-0000-000000000001';
const expectedStatus = 'uefa_master_extraction';
const expectedPdfSha256 = '068f6701500025720e386390f79a23473803aa17bcb695e135abcde9684fa7e6';
const expectedS5151Values = {
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
};

const populationFieldIds = new Set([
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

function shouldIncludeField(fieldId) {
  return populationFieldIds.has(fieldId)
    || fieldId.includes('_prevalence')
    || fieldId.includes('_incidence')
    || fieldId.includes('_burden')
    || fieldId.includes('_severityMeanDays')
    || fieldId.includes('_severityTotalDays')
    || fieldId.startsWith('injury')
    || fieldId.startsWith('illness');
}

function derivePopulationGroups(extractions, labels) {
  const groups = new Map();
  for (const extraction of extractions) {
    for (const field of extraction.extraction_fields ?? []) {
      if (!field.value || !shouldIncludeField(field.field_id)) continue;
      for (const [index, line] of field.value.split(/\r?\n/).entries()) {
        const value = line.trim();
        if (!value) continue;
        if (!groups.has(index)) {
          groups.set(index, { position: index, label: labels[index] ?? `Row ${index + 1}`, values: {} });
        }
        groups.get(index).values[field.field_id] = value;
      }
    }
  }
  return Array.from(groups.values())
    .filter((group) => Object.values(group.values).some((value) => value?.trim()))
    .sort((left, right) => left.position - right.position);
}

function createPopulationSignature(groups) {
  if (groups.length === 0) return null;
  return JSON.stringify(
    groups
      .map((group) => ({
        position: group.position,
        label: group.label,
        values: Object.keys(group.values)
          .sort()
          .reduce((values, fieldId) => {
            values[fieldId] = group.values[fieldId] ?? null;
            return values;
          }, {}),
      }))
      .sort((left, right) => left.position - right.position),
  );
}

function signatureRowCount(signature) {
  if (typeof signature !== 'string') return 0;
  try {
    const parsed = JSON.parse(signature);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
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
    .select('id,assigned_study_id,status,assigned_to,primary_file_id,primary_file_sha256,storage_object_path,metadata')
    .eq('assigned_study_id', masterStudyId)
    .single();
  if (paperError) throw paperError;

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

  const labels = (groups ?? []).map((group) => group.label);
  const derivedGroups = derivePopulationGroups(extractions ?? [], labels);
  const nextSignature = createPopulationSignature(derivedGroups);
  return {
    paper,
    groups: groups ?? [],
    extractions: extractions ?? [],
    labels,
    derivedGroups,
    nextSignature,
    extractionDataHash: stableHash({ groups: groups ?? [], extractions: extractions ?? [] }),
  };
}

function validate(state) {
  const blockers = [];
  if (state.paper.assigned_to !== expectedProfileId) blockers.push('Master assignment is not AbdelRahman Babiker.');
  if (state.paper.status !== expectedStatus) blockers.push(`Master status is ${state.paper.status}.`);
  if (state.paper.primary_file_sha256 !== expectedPdfSha256) blockers.push('Master PDF hash is not the 12-page version.');
  if (state.groups.length !== 20) blockers.push(`Expected 20 live groups, found ${state.groups.length}.`);
  if (state.derivedGroups.length !== 20) {
    blockers.push(`Expected 20 groups derived from extraction fields, found ${state.derivedGroups.length}.`);
  }
  if (state.labels.some((label) => !label?.trim())) blockers.push('One or more live population labels are blank.');

  const liveS5151 = state.groups.find((group) => group.position === 19);
  const derivedS5151 = state.derivedGroups.find((group) => group.position === 19);
  if (liveS5151?.label !== 'S5151 ECIS men 2022/23 World Cup-season all injuries') {
    blockers.push(`Unexpected live S5151 label ${liveS5151?.label ?? 'missing'}.`);
  }
  const liveS5151Values = new Map(
    (liveS5151?.population_values ?? []).map((value) => [value.field_id, value.value?.trim() ?? '']),
  );
  for (const [fieldId, expectedValue] of Object.entries(expectedS5151Values)) {
    if (liveS5151Values.get(fieldId) !== expectedValue) {
      blockers.push(`Live S5151 population value mismatch for ${fieldId}.`);
    }
    if (derivedS5151?.values[fieldId] !== expectedValue) {
      blockers.push(`Canonical S5151 extraction value mismatch for ${fieldId}.`);
    }
  }

  return {
    blockers,
    ready: blockers.length === 0,
    currentSignatureRows: signatureRowCount(state.paper.metadata?.populationHash),
    intendedSignatureRows: signatureRowCount(state.nextSignature),
    currentLabels: Array.isArray(state.paper.metadata?.populationLabels)
      ? state.paper.metadata.populationLabels.length
      : 0,
    intendedLabels: state.labels.length,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const supabase = getSupabase();
  const before = await loadState(supabase);
  const validation = validate(before);
  if (!validation.ready) {
    console.log(JSON.stringify({ mode: apply ? 'apply-blocked' : 'dry-run-blocked', validation }, null, 2));
    process.exitCode = 1;
    return;
  }

  const preApplyAudit = {
    artifactType: 'UEFA ECIS master population metadata repair pre-apply snapshot',
    date: '2026-07-27',
    scope: 'papers.metadata.populationHash and populationLabels only',
    paperId: before.paper.id,
    assignedStudyId: before.paper.assigned_study_id,
    validation,
    existingMetadata: {
      populationHash: before.paper.metadata?.populationHash ?? null,
      populationLabels: before.paper.metadata?.populationLabels ?? null,
    },
    intendedMetadata: {
      populationHash: before.nextSignature,
      populationLabels: before.labels,
    },
    extractionDataHash: before.extractionDataHash,
    primaryFileSha256: before.paper.primary_file_sha256,
    rollback: 'Restore existingMetadata on the same paper row; no extraction or population row restoration is required.',
  };

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      validation,
      intendedLabels: before.labels,
      extractionDataHash: before.extractionDataHash,
      primaryFileSha256: before.paper.primary_file_sha256,
    }, null, 2));
    return;
  }

  fs.writeFileSync(preApplyAuditPath, `${JSON.stringify(preApplyAudit, null, 2)}\n`, 'utf8');
  const now = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await supabase
    .from('papers')
    .update({
      metadata: {
        ...(before.paper.metadata ?? {}),
        populationHash: before.nextSignature,
        populationLabels: before.labels,
        populationMetadataReconciledAt: now,
      },
      updated_at: now,
    })
    .eq('id', before.paper.id)
    .select('id');
  if (updateError) throw updateError;
  if ((updatedRows ?? []).length !== 1) {
    throw new Error(`Expected one updated paper row, received ${(updatedRows ?? []).length}.`);
  }

  const after = await loadState(supabase);
  const findings = [];
  if (after.paper.metadata?.populationHash !== before.nextSignature) findings.push('populationHash does not match the 20-row signature.');
  if (JSON.stringify(after.paper.metadata?.populationLabels) !== JSON.stringify(before.labels)) {
    findings.push('populationLabels do not match the 20 live labels.');
  }
  if (after.extractionDataHash !== before.extractionDataHash) findings.push('Extraction or population data changed.');
  if (after.paper.primary_file_sha256 !== before.paper.primary_file_sha256) findings.push('Primary PDF hash changed.');
  if (after.paper.status !== before.paper.status) findings.push('Master status changed.');
  if (after.paper.assigned_to !== before.paper.assigned_to) findings.push('Master assignment changed.');

  const gate = {
    result: findings.length === 0 ? 'passed' : 'failed',
    findings,
    populationHashRows: signatureRowCount(after.paper.metadata?.populationHash),
    populationLabelCount: after.paper.metadata?.populationLabels?.length ?? 0,
    s5151Label: after.paper.metadata?.populationLabels?.[19] ?? null,
    extractionDataUnchanged: after.extractionDataHash === before.extractionDataHash,
    primaryPdfUnchanged: after.paper.primary_file_sha256 === before.paper.primary_file_sha256,
    statusPreserved: after.paper.status === before.paper.status,
    assignmentPreserved: after.paper.assigned_to === before.paper.assigned_to,
  };
  const finalAudit = {
    artifactType: 'UEFA ECIS master population metadata repair live audit',
    date: '2026-07-27',
    trigger: 'Independent PDF-refresh review found a stale 19-row populationHash after the earlier S5151 additive reconciliation.',
    scope: 'Metadata-only correction to protect the 20-row master from an unnecessary future population rebuild.',
    preApplyAuditPath,
    write: {
      papersRowsUpdated: updatedRows.length,
      metadataKeysUpdated: ['populationHash', 'populationLabels', 'populationMetadataReconciledAt'],
      extractionFields: 0,
      populationGroups: 0,
      populationValues: 0,
      paperFiles: 0,
      storageObjects: 0,
      screeningRecords: 0,
      screeningVotes: 0,
    },
    integrityGate: gate,
    rollback: preApplyAudit.rollback,
    readyFor: gate.result === 'passed' ? 'Human methodology review' : 'Blocker correction',
  };
  fs.writeFileSync(finalAuditPath, `${JSON.stringify(finalAudit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ mode: 'applied', gate, artefacts: { preApplyAuditPath, finalAuditPath } }, null, 2));
  process.exitCode = gate.result === 'passed' ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
