import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_DATA_DIR = path.join(
  APP_ROOT,
  'data',
  'source-family-overlap-audit',
  '2026-07-27',
);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function resolveArgumentPath(value, fallback) {
  return value ? path.resolve(process.cwd(), value) : fallback;
}

const DATA_DIR = resolveArgumentPath(argumentValue('--data-dir'), DEFAULT_DATA_DIR);
const INPUT_PATH = resolveArgumentPath(
  argumentValue('--input'),
  path.join(DEFAULT_DATA_DIR, 'analysis-source-treatment-input-2026-07-27.json'),
);
const PRE_APPLY_PATH = resolveArgumentPath(
  argumentValue('--snapshot'),
  path.join(DATA_DIR, 'source-family-pre-apply-live-snapshot-2026-07-27.json'),
);
const FINAL_AUDIT_PATH = resolveArgumentPath(
  argumentValue('--audit'),
  path.join(DATA_DIR, 'source-family-final-live-integrity-audit-2026-07-27.json'),
);
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');

for (const line of fs.readFileSync(path.join(APP_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const studyIds = input.papers.map((paper) => paper.studyId);
const noteBodies = new Set(input.papers.map((paper) => paper.note));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sortDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map(sortDeep)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
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
  const serialized = JSON.stringify(sortDeep(value));
  return crypto
    .createHash('sha256')
    .update(serialized === undefined ? 'undefined' : serialized)
    .digest('hex');
}

async function selectInChunks(table, columns, key, values, orderColumns = []) {
  const rows = [];
  for (const batch of chunks(values, 50)) {
    let query = supabase.from(table).select(columns).in(key, batch);
    for (const orderColumn of orderColumns) query = query.order(orderColumn);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function loadState() {
  const papers = await selectInChunks(
    'papers',
    'id,assigned_study_id,title,extracted_title,lead_author,journal,year,doi,normalized_doi,duplicate_key_v2,title_fingerprint,dedupe_review_status,status,assigned_to,flag_reason,primary_file_id,primary_file_sha256,storage_bucket,storage_object_path,original_file_name,metadata,uploaded_at,updated_at',
    'assigned_study_id',
    studyIds,
    ['assigned_study_id'],
  );
  const paperIds = papers.map((paper) => paper.id);
  const [notes, files, extractions, groups, screeningRecords] = await Promise.all([
    selectInChunks('paper_notes', 'id,paper_id,body,created_at', 'paper_id', paperIds, ['paper_id', 'created_at']),
    selectInChunks(
      'paper_files',
      'id,paper_id,name,original_file_name,size,mime_type,storage_bucket,storage_object_path,file_sha256,uploaded_at',
      'paper_id',
      paperIds,
      ['paper_id', 'uploaded_at'],
    ),
    selectInChunks(
      'extractions',
      'id,paper_id,tab,model,created_at,updated_at,extraction_fields(id,extraction_id,field_id,value,status,metric,confidence,page_hint,source_quote,updated_at,updated_by)',
      'paper_id',
      paperIds,
      ['paper_id', 'tab'],
    ),
    selectInChunks(
      'population_groups',
      'id,paper_id,tab,label,position,created_at,updated_at,population_values(id,population_group_id,paper_id,field_id,value,metric,unit,source_field_id,created_at,updated_at)',
      'paper_id',
      paperIds,
      ['paper_id', 'position'],
    ),
    selectInChunks(
      'screening_records',
      'id,stage,assigned_study_id,manual_decision,manual_reason,manual_decided_by,manual_decided_at,promoted_paper_id,promoted_by,promoted_at,metadata,updated_at',
      'assigned_study_id',
      studyIds,
      ['assigned_study_id', 'stage'],
    ),
  ]);
  const screeningIds = screeningRecords.map((record) => record.id);
  const screeningVotes = screeningIds.length > 0
    ? await selectInChunks(
        'screening_votes',
        'id,screening_record_id,vote_order,vote_role,reviewer_profile_id,reviewer_name,decision,reason,decided_at,updated_at',
        'screening_record_id',
        screeningIds,
        ['screening_record_id', 'vote_order'],
      )
    : [];
  return {
    papers,
    notes,
    files,
    extractions,
    groups,
    screeningRecords,
    screeningVotes,
  };
}

function metadataWithoutTreatment(metadata) {
  const preserved = { ...(metadata ?? {}) };
  delete preserved.analysisSourceTreatment;
  return preserved;
}

function protectedState(state) {
  return {
    papers: state.papers.map((paper) => ({
      id: paper.id,
      assigned_study_id: paper.assigned_study_id,
      title: paper.title,
      extracted_title: paper.extracted_title,
      lead_author: paper.lead_author,
      journal: paper.journal,
      year: paper.year,
      doi: paper.doi,
      normalized_doi: paper.normalized_doi,
      duplicate_key_v2: paper.duplicate_key_v2,
      title_fingerprint: paper.title_fingerprint,
      dedupe_review_status: paper.dedupe_review_status,
      status: paper.status,
      assigned_to: paper.assigned_to,
      flag_reason: paper.flag_reason,
      primary_file_id: paper.primary_file_id,
      primary_file_sha256: paper.primary_file_sha256,
      storage_bucket: paper.storage_bucket,
      storage_object_path: paper.storage_object_path,
      original_file_name: paper.original_file_name,
      uploaded_at: paper.uploaded_at,
      metadata: metadataWithoutTreatment(paper.metadata),
    })),
    existingNotes: state.notes.filter((note) => !noteBodies.has(note.body)),
    files: state.files,
    extractions: state.extractions,
    groups: state.groups,
    screeningRecords: state.screeningRecords,
    screeningVotes: state.screeningVotes,
  };
}

function protectedHashes(state) {
  const protectedValue = protectedState(state);
  return {
    aggregate: stableHash(protectedValue),
    papers: stableHash(protectedValue.papers),
    existingNotes: stableHash(protectedValue.existingNotes),
    files: stableHash(protectedValue.files),
    extractions: stableHash(protectedValue.extractions),
    groups: stableHash(protectedValue.groups),
    screeningRecords: stableHash(protectedValue.screeningRecords),
    screeningVotes: stableHash(protectedValue.screeningVotes),
  };
}

function supportedRowPolicyUpgrade(existing, intended) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return false;
  if (existing.role !== intended.role) return false;
  if ((existing.includeInAnalysisExport !== false) !== intended.includeInAnalysisExport) return false;
  if (stableHash(existing.sourceLinks ?? []) !== stableHash(intended.sourceLinks ?? [])) return false;
  if ((existing.populationTreatments ?? []).length > 0) return false;
  return true;
}

function buildPlan(state) {
  const blockers = [];
  const paperByStudyId = new Map(state.papers.map((paper) => [paper.assigned_study_id, paper]));
  const notesByPaper = new Map();
  for (const note of state.notes) {
    const current = notesByPaper.get(note.paper_id) ?? [];
    current.push(note);
    notesByPaper.set(note.paper_id, current);
  }

  if (state.papers.length !== studyIds.length) {
    blockers.push(`Expected ${studyIds.length} live papers, found ${state.papers.length}`);
  }

  const paperPlans = [];
  for (const item of input.papers) {
    const paper = paperByStudyId.get(item.studyId);
    if (!paper) {
      blockers.push(`Missing live paper ${item.studyId}`);
      continue;
    }
    const existingTreatment = paper.metadata?.analysisSourceTreatment;
    const treatmentAlreadyExact = stableHash(existingTreatment) === stableHash(item.intendedTreatment);
    const allowedUpgrade = item.allowRowPolicyUpgrade
      && supportedRowPolicyUpgrade(existingTreatment, item.intendedTreatment);
    if (existingTreatment && !treatmentAlreadyExact && !allowedUpgrade) {
      blockers.push(`${item.studyId}: existing analysisSourceTreatment conflicts with staged treatment`);
    }

    const paperNotes = notesByPaper.get(paper.id) ?? [];
    const exactNotes = paperNotes.filter((note) => note.body === item.note);
    if (exactNotes.length > 1) {
      blockers.push(`${item.studyId}: staged note already exists ${exactNotes.length} times`);
    }

    const groups = state.groups
      .filter((group) => group.paper_id === paper.id)
      .sort((left, right) => left.position - right.position);
    const treatment = item.intendedTreatment;
    if (treatment.requireCompletePopulationMap) {
      if (groups.length !== treatment.populationTreatments.length) {
        blockers.push(`${item.studyId}: row policy has ${treatment.populationTreatments.length} rows, live has ${groups.length}`);
      }
      const treatmentPositions = new Set();
      for (const row of treatment.populationTreatments) {
        if (treatmentPositions.has(row.populationPosition)) {
          blockers.push(`${item.studyId}: duplicate treatment position ${row.populationPosition}`);
        }
        treatmentPositions.add(row.populationPosition);
        const group = groups.find((candidate) => candidate.position === row.populationPosition);
        if (!group || group.label !== row.expectedLabel) {
          blockers.push(`${item.studyId}: row ${row.populationPosition} is no longer ${row.expectedLabel}`);
          continue;
        }
        const values = new Map((group.population_values ?? []).map((value) => [value.field_id, value.value]));
        for (const [fieldId, expectedValue] of Object.entries(row.expectedValues)) {
          if (values.get(fieldId) !== expectedValue) {
            blockers.push(
              `${item.studyId}: row ${row.populationPosition} drifted at ${fieldId}; expected ${JSON.stringify(expectedValue)}, found ${JSON.stringify(values.get(fieldId))}`,
            );
          }
        }
      }
      if (groups.some((group) => !treatmentPositions.has(group.position))) {
        blockers.push(`${item.studyId}: row policy does not cover every live population row`);
      }
    }

    for (const exclusion of treatment.populationExclusions ?? []) {
      const row = treatment.populationTreatments.find((candidate) =>
        candidate.populationPosition === exclusion.populationPosition
        && candidate.tournamentKey === exclusion.tournamentKey
      );
      if (!row || row.includeInAnalysisExport) {
        blockers.push(`${item.studyId}: exclusion ${exclusion.tournamentKey} lacks a matching excluded row`);
      }
    }

    paperPlans.push({
      item,
      paper,
      treatmentAlreadyExact,
      noteAlreadyExact: exactNotes.length === 1,
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    papers: paperPlans,
    protectedHashes: protectedHashes(state),
  };
}

function compactRestoreSnapshot(state, plan) {
  return {
    artifactType: 'Source-family overlap pre-apply live snapshot and rollback reference',
    generatedAt: new Date().toISOString(),
    writeBoundary: input.writeBoundary,
    studyIds,
    paperCount: state.papers.length,
    protectedHashes: plan.protectedHashes,
    protectedCounts: {
      papers: state.papers.length,
      existingNotes: protectedState(state).existingNotes.length,
      files: state.files.length,
      extractions: state.extractions.length,
      groups: state.groups.length,
      populationValues: state.groups.reduce(
        (sum, group) => sum + (group.population_values?.length ?? 0),
        0,
      ),
      screeningRecords: state.screeningRecords.length,
      screeningVotes: state.screeningVotes.length,
    },
    rollback: {
      warning: 'Rollback is destructive and is not authorised by this workflow.',
      method: 'Restore only each paper priorMetadata and remove only note IDs inserted by this batch.',
      papers: plan.papers.map(({ item, paper }) => ({
        studyId: item.studyId,
        paperId: paper.id,
        priorMetadata: paper.metadata ?? {},
        intendedTreatment: item.intendedTreatment,
        stagedNoteBody: item.note,
      })),
    },
    protectedState: protectedState(state),
  };
}

async function applyPlan(plan) {
  const metadataWrites = [];
  const insertedNotes = [];
  for (const paperPlan of plan.papers) {
    const { item, paper } = paperPlan;
    if (!paperPlan.treatmentAlreadyExact) {
      const metadata = {
        ...(paper.metadata ?? {}),
        analysisSourceTreatment: item.intendedTreatment,
      };
      const { data, error } = await supabase
        .from('papers')
        .update({ metadata })
        .eq('id', paper.id)
        .eq('updated_at', paper.updated_at)
        .select('id,updated_at');
      if (error) throw error;
      assert(data?.length === 1, `${item.studyId}: concurrent paper update blocked metadata write`);
      metadataWrites.push(item.studyId);
    }
    if (!paperPlan.noteAlreadyExact) {
      const { data, error } = await supabase
        .from('paper_notes')
        .insert({ paper_id: paper.id, body: item.note })
        .select('id,paper_id,body,created_at')
        .single();
      if (error) throw error;
      insertedNotes.push({
        studyId: item.studyId,
        ...data,
      });
    }
  }
  return { metadataWrites, insertedNotes };
}

const before = await loadState();
const beforePlan = buildPlan(before);
const preApplySnapshot = compactRestoreSnapshot(before, beforePlan);
fs.mkdirSync(DATA_DIR, { recursive: true });
const pendingWriteCount = beforePlan.papers.filter(
  (paper) => !paper.treatmentAlreadyExact || !paper.noteAlreadyExact,
).length;
if (!VERIFY && (APPLY || pendingWriteCount > 0)) {
  fs.writeFileSync(PRE_APPLY_PATH, `${JSON.stringify(preApplySnapshot, null, 2)}\n`);
}

if (!APPLY) {
  const result = {
    mode: VERIFY ? 'verify' : 'dry-run',
    ready: beforePlan.ready,
    blockers: beforePlan.blockers,
    paperCount: beforePlan.papers.length,
    metadataWritesNeeded: beforePlan.papers.filter((paper) => !paper.treatmentAlreadyExact).length,
    notesNeeded: beforePlan.papers.filter((paper) => !paper.noteAlreadyExact).length,
    preApplyPath: PRE_APPLY_PATH,
    protectedHashes: beforePlan.protectedHashes,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
} else {
  assert(beforePlan.ready, `Apply blocked:\n${beforePlan.blockers.join('\n')}`);
  const writeResult = await applyPlan(beforePlan);
  const after = await loadState();
  const afterPlan = buildPlan(after);
  const afterHashes = protectedHashes(after);
  const integrityFailures = [...afterPlan.blockers];
  if (afterHashes.aggregate !== beforePlan.protectedHashes.aggregate) {
    integrityFailures.push('Protected aggregate hash changed');
  }
  for (const [category, beforeHash] of Object.entries(beforePlan.protectedHashes)) {
    if (afterHashes[category] !== beforeHash) {
      integrityFailures.push(`Protected ${category} hash changed`);
    }
  }
  const exactTreatmentMismatches = afterPlan.papers
    .filter(({ item, paper }) =>
      stableHash(paper.metadata?.analysisSourceTreatment) !== stableHash(item.intendedTreatment)
    )
    .map(({ item }) => item.studyId);
  if (exactTreatmentMismatches.length > 0) {
    integrityFailures.push(`Treatment mismatches: ${exactTreatmentMismatches.join(', ')}`);
  }
  const noteMismatches = afterPlan.papers
    .filter((paper) => !paper.noteAlreadyExact)
    .map(({ item }) => item.studyId);
  if (noteMismatches.length > 0) {
    integrityFailures.push(`Note mismatches: ${noteMismatches.join(', ')}`);
  }

  const excludedStudyIds = input.papers
    .filter((paper) => !paper.intendedTreatment.includeInAnalysisExport)
    .map((paper) => paper.studyId)
    .sort();
  const includedStudyIds = input.papers
    .filter((paper) => paper.intendedTreatment.includeInAnalysisExport)
    .map((paper) => paper.studyId)
    .sort();
  const excludedRows = input.papers.flatMap((paper) =>
    paper.intendedTreatment.populationTreatments
      .filter((row) => !row.includeInAnalysisExport)
      .map((row) => ({
        studyId: paper.studyId,
        populationPosition: row.populationPosition,
        expectedLabel: row.expectedLabel,
        sourceKey: row.tournamentKey,
      }))
  );
  const audit = {
    artifactType: 'Source-family overlap final live integrity audit',
    generatedAt: new Date().toISOString(),
    result: integrityFailures.length === 0 ? 'PASS' : 'FAIL',
    integrityFailures,
    writeBoundary: input.writeBoundary,
    requestedPaperCount: input.papers.length,
    metadataWriteCount: writeResult.metadataWrites.length,
    noteInsertCount: writeResult.insertedNotes.length,
    metadataWrites: writeResult.metadataWrites,
    insertedNotes: writeResult.insertedNotes,
    includedStudyIds,
    excludedStudyIds,
    excludedRows,
    protectedHashesBefore: beforePlan.protectedHashes,
    protectedHashesAfter: afterHashes,
    preApplyPath: PRE_APPLY_PATH,
  };
  fs.writeFileSync(FINAL_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({
    result: audit.result,
    integrityFailures,
    requestedPaperCount: audit.requestedPaperCount,
    metadataWriteCount: audit.metadataWriteCount,
    noteInsertCount: audit.noteInsertCount,
    includedStudyCount: includedStudyIds.length,
    excludedStudyCount: excludedStudyIds.length,
    excludedRowCount: excludedRows.length,
    protectedHashesBefore: audit.protectedHashesBefore,
    protectedHashesAfter: audit.protectedHashesAfter,
    finalAuditPath: FINAL_AUDIT_PATH,
  }, null, 2));
  if (integrityFailures.length > 0) process.exitCode = 1;
}
