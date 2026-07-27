import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATE = '2026-07-27';
const OUT_DIR = path.join(ROOT, 'data', 'aspetar-reconciliation');
const INPUT_PATH = path.join(OUT_DIR, `aspetar-anchor-reconciliation-input-${DATE}.json`);
const SNAPSHOT_PATH = path.join(OUT_DIR, `aspetar-pre-apply-live-rollback-snapshot-${DATE}.json`);
const OUTPUT_PATH = path.join(OUT_DIR, `aspetar-final-live-integrity-audit-${DATE}.json`);
const BACKLOG_PATHS = [
  path.join(ROOT, 'docs', 'review-backlog.md'),
  path.join(ROOT, 'docs', 'second-search-extraction-review-backlog-2026-07-03.md'),
];

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const jiti = createJiti(import.meta.url, {
  alias: {
    '@': path.join(ROOT, 'src'),
  },
});
const { extractionFieldDefinitions } = await jiti.import('../src/lib/extraction/schema.ts');
const { derivePopulationGroups } = await jiti.import('../src/lib/extraction/populations.ts');
const { normalizeGlobalFieldValue } = await jiti.import('../src/lib/extraction/normalize.ts');

const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const before = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const definitionById = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));
const requestedIds = before.fixedMembership;
const appliedIds = input.fixedBatchMembership;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: papers, error: paperError } = await supabase
  .from('papers')
  .select(`
    id,assigned_study_id,status,flag_reason,assigned_to,primary_file_id,metadata,
    paper_files!paper_files_paper_id_fkey(*),
    extractions(*,extraction_fields(*)),
    population_groups(*,population_values(*))
  `)
  .in('assigned_study_id', requestedIds)
  .order('assigned_study_id');
if (paperError) throw paperError;

const paperIds = (papers ?? []).map((paper) => paper.id);
const { data: notes, error: notesError } = await supabase
  .from('paper_notes')
  .select('id,paper_id,body,created_at')
  .in('paper_id', paperIds)
  .order('created_at');
if (notesError) throw notesError;

const liveByStudyId = new Map((papers ?? []).map((paper) => [paper.assigned_study_id, paper]));
const beforeByStudyId = new Map(before.papers.map((paper) => [paper.assigned_study_id, paper]));
const inputByStudyId = new Map(input.papers.map((paper) => [paper.studyId, paper]));
const notesByPaperId = new Map();
for (const note of notes ?? []) {
  const rows = notesByPaperId.get(note.paper_id) ?? [];
  rows.push(note);
  notesByPaperId.set(note.paper_id, rows);
}

const protectedKeys = [
  'fullTextDecisions',
  'fullTextDecisionAudit',
  'fullTextResolution',
  'screeningDecision',
  'screeningResolution',
  'titleAbstractDecisions',
  'titleAbstractResolution',
  'screeningPromotedAt',
  'temporaryExtractionPromotion',
  'temporaryExtractionPromotedAt',
];

function protectedSnapshot(rows) {
  return rows.map((paper) => ({
    studyId: paper.assigned_study_id,
    values: Object.fromEntries(protectedKeys.map((key) => [key, paper.metadata?.[key] ?? null])),
  }));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sourceSignature(paper) {
  const source = paper.paper_files;
  if (!source) return null;
  return {
    id: source.id,
    paper_id: source.paper_id,
    name: source.name,
    file_sha256: source.file_sha256,
    checksum_sha256: source.checksum_sha256,
    storage_bucket: source.storage_bucket,
    storage_object_path: source.storage_object_path,
    size: source.size,
    mime_type: source.mime_type,
  };
}

function extractionFieldMap(paper) {
  const values = new Map();
  const recordsByFieldId = new Map();
  for (const extraction of paper.extractions ?? []) {
    for (const field of extraction.extraction_fields ?? []) {
      const value = field.value == null ? null : String(field.value);
      const records = recordsByFieldId.get(field.field_id) ?? [];
      records.push({ tab: extraction.tab, value });
      recordsByFieldId.set(field.field_id, records);
      const canonicalTab = definitionById.get(field.field_id)?.tab;
      if (!values.has(field.field_id) || extraction.tab === canonicalTab) {
        values.set(field.field_id, value);
      }
    }
  }
  const conflictingAliases = [...recordsByFieldId.entries()]
    .filter(([, records]) => new Set(records.map((record) => record.value)).size > 1)
    .map(([fieldId, records]) => ({ fieldId, records }));
  return { values, recordsByFieldId, conflictingAliases };
}

function stagedFieldMap(item) {
  const values = new Map();
  for (const fields of Object.values(item.fields ?? {})) {
    for (const [fieldId, value] of Object.entries(fields)) {
      values.set(fieldId, normalizeGlobalFieldValue(fieldId, value));
    }
  }
  return values;
}

function sortedGroups(paper) {
  return [...(paper.population_groups ?? [])].sort((a, b) => a.position - b.position);
}

function expectedPopulationGroups(fieldMap, labels) {
  const groups = derivePopulationGroups(
    [...fieldMap.entries()].map(([fieldId, value]) => ({
      fieldId,
      value,
      metric: definitionById.get(fieldId)?.metric ?? null,
    })),
  );
  groups.forEach((group, index) => {
    group.label = labels[index] ?? group.label;
  });
  return groups;
}

function comparePopulationGroups(expected, actual) {
  const mismatches = [];
  if (expected.length !== actual.length) {
    mismatches.push({ kind: 'group_count', expected: expected.length, actual: actual.length });
  }
  const max = Math.max(expected.length, actual.length);
  for (let index = 0; index < max; index += 1) {
    const expectedGroup = expected[index];
    const actualGroup = actual[index];
    if (!expectedGroup || !actualGroup) continue;
    if (expectedGroup.position !== actualGroup.position || expectedGroup.label !== actualGroup.label) {
      mismatches.push({
        kind: 'group_identity',
        index,
        expected: { position: expectedGroup.position, label: expectedGroup.label },
        actual: { position: actualGroup.position, label: actualGroup.label },
      });
    }
    const actualValues = new Map(
      (actualGroup.population_values ?? []).map((value) => [value.field_id, value.value == null ? null : String(value.value)]),
    );
    const fieldIds = new Set([...Object.keys(expectedGroup.values), ...actualValues.keys()]);
    for (const fieldId of fieldIds) {
      const expectedValue = expectedGroup.values[fieldId] ?? null;
      const actualValue = actualValues.get(fieldId) ?? null;
      if (expectedValue !== actualValue) {
        mismatches.push({ kind: 'population_value', index, fieldId, expected: expectedValue, actual: actualValue });
      }
    }
  }
  return mismatches;
}

const failures = [];
const warnings = [];
const paperAudits = [];

const exactMembership = [...liveByStudyId.keys()].sort().join('|') === [...requestedIds].sort().join('|');
if (!exactMembership) failures.push('The live Aspetar-family membership differs from the fixed 11-paper ledger.');

const currentProtectedSnapshot = protectedSnapshot(papers ?? []);
const protectedSignature = hash(currentProtectedSnapshot);
if (protectedSignature !== before.protectedScreeningSignatureSha256) {
  failures.push('Protected screening metadata signature changed.');
}

for (const studyId of requestedIds) {
  const live = liveByStudyId.get(studyId);
  const prior = beforeByStudyId.get(studyId);
  if (!live || !prior) {
    failures.push(`${studyId}: missing from live or rollback snapshot.`);
    continue;
  }

  const preservation = {
    status: live.status === prior.status,
    flagReason: live.flag_reason === prior.flag_reason,
    assignment: live.assigned_to === prior.assigned_to,
    primaryFileId: live.primary_file_id === prior.primary_file_id,
    sourceFile: JSON.stringify(sourceSignature(live)) === JSON.stringify(sourceSignature(prior)),
  };
  for (const [key, passed] of Object.entries(preservation)) {
    if (!passed) failures.push(`${studyId}: protected ${key} changed.`);
  }

  const audit = {
    studyId,
    role: inputByStudyId.has(studyId) ? 'applied anchor' : 'audit-only source',
    status: live.status,
    assignedTo: live.assigned_to,
    sourceFileId: live.paper_files?.id ?? null,
    sourceSha256: live.paper_files?.file_sha256 ?? live.paper_files?.checksum_sha256 ?? null,
    preservation,
  };

  if (inputByStudyId.has(studyId)) {
    const staged = inputByStudyId.get(studyId);
    const liveFields = extractionFieldMap(live);
    const expectedFields = stagedFieldMap(staged);
    const fieldMismatches = [];
    const unknownStagedFieldIds = [];
    for (const [fieldId, expectedValue] of expectedFields) {
      if (!definitionById.has(fieldId)) unknownStagedFieldIds.push(fieldId);
      const actualValue = liveFields.values.get(fieldId) ?? null;
      if (expectedValue !== actualValue) {
        fieldMismatches.push({ fieldId, expected: expectedValue, actual: actualValue });
      }
    }
    if (liveFields.conflictingAliases.length) {
      failures.push(`${studyId}: conflicting extraction-field aliases remain: ${liveFields.conflictingAliases.map((item) => item.fieldId).join(', ')}.`);
    }
    if (unknownStagedFieldIds.length) {
      failures.push(`${studyId}: unknown staged field IDs: ${unknownStagedFieldIds.join(', ')}.`);
    }
    if (fieldMismatches.length) {
      failures.push(`${studyId}: ${fieldMismatches.length} staged extraction fields differ from live.`);
    }

    const expectedGroups = expectedPopulationGroups(liveFields.values, staged.populationLabels);
    const actualGroups = sortedGroups(live);
    const populationMismatches = comparePopulationGroups(expectedGroups, actualGroups);
    if (populationMismatches.length) {
      failures.push(`${studyId}: ${populationMismatches.length} extraction/population dual-write mismatches.`);
    }

    const studyIdValue = liveFields.values.get('studyId') ?? null;
    if (studyIdValue !== studyId) {
      failures.push(`${studyId}: extraction studyId is ${studyIdValue ?? 'missing'}.`);
    }
    const matchingNotes = (notesByPaperId.get(live.id) ?? []).filter((note) => note.body === staged.note);
    if (matchingNotes.length !== 1) {
      failures.push(`${studyId}: expected exactly one matching dated reconciliation note, found ${matchingNotes.length}.`);
    }

    const priorFields = extractionFieldMap(prior).values;
    let newFields = 0;
    let changedFields = 0;
    let unchangedFields = 0;
    for (const [fieldId, value] of liveFields.values) {
      if (!priorFields.has(fieldId)) newFields += 1;
      else if (priorFields.get(fieldId) !== value) changedFields += 1;
      else unchangedFields += 1;
    }
    const priorPopulationValues = sortedGroups(prior)
      .reduce((count, group) => count + (group.population_values?.length ?? 0), 0);
    const livePopulationValues = actualGroups
      .reduce((count, group) => count + (group.population_values?.length ?? 0), 0);

    let retainedPrefixMismatches = [];
    if (studyId === 'S2824') {
      retainedPrefixMismatches = [...priorFields.entries()]
        .filter(([, value]) => value != null && String(value).trim())
        .filter(([fieldId, value]) => {
          const current = liveFields.values.get(fieldId);
          return current !== value && !String(current ?? '').startsWith(`${value}\n`);
        })
        .map(([fieldId]) => fieldId);
      if (retainedPrefixMismatches.length) {
        failures.push(`S2824: prior anchor values were not retained as prefixes for ${retainedPrefixMismatches.join(', ')}.`);
      }
    }

    audit.liveData = {
      extractionFields: liveFields.values.size,
      stagedFieldsChecked: expectedFields.size,
      newFields,
      changedFields,
      unchangedFields,
      populationGroupsBefore: prior.population_groups?.length ?? 0,
      populationGroupsAfter: actualGroups.length,
      populationValuesBefore: priorPopulationValues,
      populationValuesAfter: livePopulationValues,
    };
    audit.fieldMismatches = fieldMismatches;
    audit.conflictingExtractionFieldAliases = liveFields.conflictingAliases;
    audit.unknownStagedFieldIds = unknownStagedFieldIds;
    audit.populationMismatches = populationMismatches;
    audit.retainedPriorPrefixMismatches = retainedPrefixMismatches;
    audit.matchingReconciliationNotes = matchingNotes.map((note) => ({
      id: note.id,
      createdAt: note.created_at,
    }));
  }
  paperAudits.push(audit);
}

for (const backlogPath of BACKLOG_PATHS) {
  const text = fs.readFileSync(backlogPath, 'utf8');
  if (!text.includes('Aspetar ASPREV source-family reconciliation') && !text.includes('Reconciled under S2824')) {
    failures.push(`Backlog update marker missing from ${backlogPath}.`);
  }
}

const audit = {
  artifactType: 'Aspetar ASPREV focused live integrity audit',
  date: DATE,
  result: failures.length ? 'failed' : warnings.length ? 'passed_with_warnings' : 'passed',
  architecture: {
    professionalQslAnchor: 'S2824',
    academyAnchor: 'S261',
    afcMulticountryAnchor: 'S602',
    syntheticMasterCreated: false,
  },
  fixedFamilyMembership: requestedIds,
  fixedApplyMembership: appliedIds,
  checks: {
    exactFamilyMembership: exactMembership,
    protectedScreeningSignatureBefore: before.protectedScreeningSignatureSha256,
    protectedScreeningSignatureAfter: protectedSignature,
    protectedScreeningMetadataUnchanged: protectedSignature === before.protectedScreeningSignatureSha256,
    statusesAssignmentsFlagsAndSourcesUnchanged: !failures.some((failure) => failure.includes('protected ')),
    stagedFieldsMatchLive: !failures.some((failure) => failure.includes('staged extraction fields')),
    extractionPopulationDualWritesMatch: !failures.some((failure) => failure.includes('dual-write mismatches')),
    studyIdsMatchAssignments: !failures.some((failure) => failure.includes('extraction studyId')),
    datedAuditNotesPresentOnce: !failures.some((failure) => failure.includes('matching dated reconciliation note')),
    relevantBacklogsUpdated: !failures.some((failure) => failure.includes('Backlog update marker')),
  },
  paperAudits,
  warnings,
  failures,
  rollbackSnapshot: SNAPSHOT_PATH,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  result: audit.result,
  output: OUTPUT_PATH,
  checks: audit.checks,
  liveData: Object.fromEntries(
    paperAudits.filter((paper) => paper.liveData).map((paper) => [paper.studyId, paper.liveData]),
  ),
  warnings,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
