import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(
  APP_ROOT,
  'data',
  'tournament-family-reconciliation',
  '2026-07-27',
);
const INPUT_PATH = path.join(DATA_DIR, 'analysis-source-treatment-input-2026-07-27.json');
const ROW_INPUT_PATH = path.join(
  DATA_DIR,
  'analysis-tournament-row-treatment-input-2026-07-27.json',
);
const PRE_APPLY_PATH = path.join(
  DATA_DIR,
  'analysis-tournament-row-treatment-pre-apply-snapshot-2026-07-27.json',
);
const FINAL_AUDIT_PATH = path.join(
  DATA_DIR,
  'analysis-tournament-row-treatment-final-live-audit-2026-07-27.json',
);
const POST_APPLY_VERIFICATION_PATH = path.join(
  DATA_DIR,
  'analysis-tournament-row-treatment-post-apply-verification-2026-07-27.json',
);
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');

for (const line of fs.readFileSync(path.join(APP_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const rowInput = JSON.parse(fs.readFileSync(ROW_INPUT_PATH, 'utf8'));
const studyIds = Array.from(new Set([
  ...input.papers.map((paper) => paper.studyId),
  ...input.sourceLinks.flatMap((link) => [link.sourceStudyId, link.anchorStudyId]),
  ...input.populationExclusions.flatMap((exclusion) => [
    exclusion.studyId,
    exclusion.anchorStudyId,
  ].filter(Boolean)),
]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  return crypto.createHash('sha256').update(JSON.stringify(sortDeep(value))).digest('hex');
}

function treatmentFor(studyId) {
  const paper = input.papers.find((candidate) => candidate.studyId === studyId);
  const rowPolicy = rowInput.papers.find((candidate) => candidate.studyId === studyId);
  assert(paper, `Input paper ${studyId} is missing`);
  return {
    version: rowPolicy ? rowInput.version : '2026-07-27',
    role: paper.analysisRole,
    includeInAnalysisExport: paper.includeInAnalysisExport,
    sourceLinks: input.sourceLinks
      .filter((link) => link.sourceStudyId === studyId)
      .map((link) => ({
        anchorStudyId: link.anchorStudyId,
        relationship: link.relationship,
        tournamentKey: link.tournamentKey,
        notes: link.notes,
      })),
    populationExclusions: input.populationExclusions
      .filter((exclusion) => exclusion.studyId === studyId)
      .map((exclusion) => ({
        populationPosition: exclusion.populationPosition,
        expectedLabel: exclusion.expectedLabel,
        anchorStudyId: exclusion.anchorStudyId,
        tournamentKey: exclusion.tournamentKey,
        notes: exclusion.notes,
      })),
    ...(rowPolicy
      ? {
          requireCompletePopulationMap: rowPolicy.requireCompletePopulationMap,
          populationTreatments: rowPolicy.rows,
        }
      : {}),
  };
}

function isSupportedRowPolicyUpgrade(studyId, existing, intended) {
  const rowPolicy = rowInput.papers.find((candidate) => candidate.studyId === studyId);
  if (!rowPolicy) return false;
  const intendedBeforeRowPolicy = { ...intended };
  delete intendedBeforeRowPolicy.requireCompletePopulationMap;
  delete intendedBeforeRowPolicy.populationTreatments;
  intendedBeforeRowPolicy.version = '2026-07-27';
  return stableHash(existing) === stableHash(intendedBeforeRowPolicy);
}

function isSupportedFutsalKeyCorrection(existing, intended) {
  if (existing?.version !== rowInput.version || !Array.isArray(existing.populationTreatments)) {
    return false;
  }
  const corrected = structuredClone(existing);
  for (const row of corrected.populationTreatments) {
    row.tournamentKey = row.tournamentKey.replace(
      'FIFA Futsal World Championship',
      'FIFA Futsal World Cup',
    );
  }
  return stableHash(corrected) === stableHash(intended);
}

function metadataWithoutAnalysisTreatment(metadata) {
  const preserved = { ...(metadata ?? {}) };
  delete preserved.analysisSourceTreatment;
  return preserved;
}

async function loadState() {
  const { data: papers, error: papersError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,status,assigned_to,flag_reason,metadata,primary_file_id,updated_at')
    .in('assigned_study_id', studyIds)
    .order('assigned_study_id');
  if (papersError) throw papersError;

  const paperIds = (papers ?? []).map((paper) => paper.id);
  const { data: notes, error: notesError } = await supabase
    .from('paper_notes')
    .select('id,paper_id,body,created_at')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('created_at');
  if (notesError) throw notesError;

  const { data: files, error: filesError } = await supabase
    .from('paper_files')
    .select('id,paper_id,name,original_file_name,size,mime_type,storage_bucket,storage_object_path,file_sha256,uploaded_at')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('uploaded_at');
  if (filesError) throw filesError;

  const { data: extractions, error: extractionsError } = await supabase
    .from('extractions')
    .select('id,paper_id,tab,model,created_at,updated_at,extraction_fields(id,extraction_id,field_id,value,status,metric,confidence,page_hint,source_quote,updated_at,updated_by)')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('tab');
  if (extractionsError) throw extractionsError;

  const { data: groups, error: groupsError } = await supabase
    .from('population_groups')
    .select('id,paper_id,tab,label,position,created_at,updated_at,population_values(id,population_group_id,paper_id,field_id,value,metric,unit,source_field_id,created_at,updated_at)')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('position');
  if (groupsError) throw groupsError;

  const { data: screeningRecords, error: screeningError } = await supabase
    .from('screening_records')
    .select('id,stage,assigned_study_id,manual_decision,manual_reason,manual_decided_by,manual_decided_at,promoted_paper_id,promoted_by,promoted_at,metadata,updated_at')
    .in('assigned_study_id', studyIds)
    .order('assigned_study_id')
    .order('stage');
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
    notes: notes ?? [],
    files: files ?? [],
    extractions: extractions ?? [],
    groups: groups ?? [],
    screeningRecords: screeningRecords ?? [],
    screeningVotes,
  };
}

function protectedState(state) {
  return {
    papers: state.papers.map((paper) => ({
      id: paper.id,
      assigned_study_id: paper.assigned_study_id,
      title: paper.title,
      status: paper.status,
      assigned_to: paper.assigned_to,
      flag_reason: paper.flag_reason,
      metadata: metadataWithoutAnalysisTreatment(paper.metadata),
      primary_file_id: paper.primary_file_id,
    })),
    files: state.files,
    extractions: state.extractions,
    groups: state.groups,
    screeningRecords: state.screeningRecords,
    screeningVotes: state.screeningVotes,
  };
}

function buildPlan(state) {
  const blockers = [];
  const paperByStudyId = new Map(state.papers.map((paper) => [paper.assigned_study_id, paper]));

  for (const studyId of studyIds) {
    if (!paperByStudyId.has(studyId)) blockers.push(`Live paper ${studyId} is missing`);
  }

  for (const treatment of input.papers) {
    const paper = paperByStudyId.get(treatment.studyId);
    if (!paper) continue;
    const existing = paper.metadata?.analysisSourceTreatment;
    const intended = treatmentFor(treatment.studyId);
    if (
      existing
      && stableHash(existing) !== stableHash(intended)
      && !isSupportedRowPolicyUpgrade(treatment.studyId, existing, intended)
      && !isSupportedFutsalKeyCorrection(existing, intended)
    ) {
      blockers.push(
        `${treatment.studyId}: existing analysisSourceTreatment metadata conflicts with the staged treatment`,
      );
    }
  }

  for (const exclusion of input.populationExclusions) {
    const paper = paperByStudyId.get(exclusion.studyId);
    if (!paper) continue;
    const group = state.groups.find((row) =>
      row.paper_id === paper.id && row.position === exclusion.populationPosition
    );
    if (!group || group.label !== exclusion.expectedLabel) {
      blockers.push(
        `${exclusion.studyId}: population position ${exclusion.populationPosition} is not ${exclusion.expectedLabel}`,
      );
    }
  }

  for (const paperPolicy of rowInput.papers) {
    const paper = paperByStudyId.get(paperPolicy.studyId);
    if (!paper) continue;
    const groups = state.groups
      .filter((group) => group.paper_id === paper.id)
      .sort((left, right) => left.position - right.position);
    if (
      paperPolicy.requireCompletePopulationMap
      && groups.length !== paperPolicy.rows.length
    ) {
      blockers.push(
        `${paperPolicy.studyId}: row policy has ${paperPolicy.rows.length} rows but live data has ${groups.length}`,
      );
      continue;
    }
    for (const rowPolicy of paperPolicy.rows) {
      const group = groups.find((candidate) => candidate.position === rowPolicy.populationPosition);
      if (!group || group.label !== rowPolicy.expectedLabel) {
        blockers.push(
          `${paperPolicy.studyId}: row ${rowPolicy.populationPosition} is not ${rowPolicy.expectedLabel}`,
        );
        continue;
      }
      for (const [fieldId, expectedValue] of Object.entries(rowPolicy.expectedValues)) {
        const value = (group.population_values ?? []).find(
          (candidate) => candidate.field_id === fieldId,
        )?.value;
        if (value !== expectedValue) {
          blockers.push(
            `${paperPolicy.studyId}: ${rowPolicy.tournamentKey} expected ${fieldId}=${expectedValue}, found ${value ?? 'missing'}`,
          );
        }
      }
    }
  }

  return {
    blockers,
    ready: blockers.length === 0,
    paperByStudyId,
    protectedHash: stableHash(protectedState(state)),
  };
}

async function applyPlan(plan, state) {
  assert(plan.ready, `Pre-apply blockers:\n${plan.blockers.join('\n')}`);
  const operations = {
    paperMetadataUpdated: [],
    paperMetadataAlreadyPresent: [],
    notesInserted: [],
    notesAlreadyPresent: [],
  };

  for (const paperInput of input.papers) {
    const paper = plan.paperByStudyId.get(paperInput.studyId);
    const intendedTreatment = treatmentFor(paperInput.studyId);
    const existingTreatment = paper.metadata?.analysisSourceTreatment;
    if (existingTreatment && stableHash(existingTreatment) === stableHash(intendedTreatment)) {
      operations.paperMetadataAlreadyPresent.push(paperInput.studyId);
    } else {
      const { data, error } = await supabase
        .from('papers')
        .update({
          metadata: {
            ...(paper.metadata ?? {}),
            analysisSourceTreatment: intendedTreatment,
          },
        })
        .eq('id', paper.id)
        .eq('updated_at', paper.updated_at)
        .select('id');
      if (error) throw error;
      assert(data?.length === 1, `${paperInput.studyId}: conditional metadata update did not affect exactly one paper`);
      operations.paperMetadataUpdated.push(paperInput.studyId);
    }

    const noteExists = state.notes.some((note) => note.paper_id === paper.id && note.body === paperInput.note);
    if (noteExists) {
      operations.notesAlreadyPresent.push(paperInput.studyId);
    } else {
      const { error } = await supabase.from('paper_notes').insert({
        paper_id: paper.id,
        body: paperInput.note,
      });
      if (error) throw error;
      operations.notesInserted.push(paperInput.studyId);
    }
  }

  return operations;
}

function verifyFinalState(state, beforeHash) {
  const plan = buildPlan(state);
  assert(plan.ready, `Final-state blockers:\n${plan.blockers.join('\n')}`);
  assert(plan.protectedHash === beforeHash, 'Protected screening or extraction state changed');

  for (const paperInput of input.papers) {
    const paper = plan.paperByStudyId.get(paperInput.studyId);
    assert(
      stableHash(paper.metadata?.analysisSourceTreatment) === stableHash(treatmentFor(paperInput.studyId)),
      `${paperInput.studyId}: analysis source metadata mismatch`,
    );
    assert(
      state.notes.some((note) => note.paper_id === paper.id && note.body === paperInput.note),
      `${paperInput.studyId}: analysis treatment note is missing`,
    );
  }

  return {
    protectedHash: plan.protectedHash,
    paperCount: input.papers.length,
    sourceLinkCount: input.sourceLinks.length,
    populationExclusionCount: input.populationExclusions.length,
    populationTreatmentCount: rowInput.papers.reduce(
      (count, paper) => count + paper.rows.length,
      0,
    ),
    screeningRecordCount: state.screeningRecords.length,
    screeningVoteCount: state.screeningVotes.length,
    extractionCount: state.extractions.length,
    populationGroupCount: state.groups.length,
  };
}

const before = await loadState();
const plan = buildPlan(before);
assert(!(APPLY && VERIFY), 'Choose either --apply or --verify');

if (VERIFY) {
  const baseline = JSON.parse(fs.readFileSync(PRE_APPLY_PATH, 'utf8'));
  const verification = verifyFinalState(before, baseline.protectedHash);
  const anchorStudyIds = Array.from(
    new Set(input.sourceLinks.map((link) => link.anchorStudyId)),
  ).sort();
  const reverseLinkChecks = await Promise.all(anchorStudyIds.map(async (anchorStudyId) => {
    const expectedSourceStudyIds = input.sourceLinks
      .filter((link) => link.anchorStudyId === anchorStudyId)
      .map((link) => link.sourceStudyId)
      .sort();
    const { data: linkedSources, error: linkedSourcesError } = await supabase
      .from('papers')
      .select('assigned_study_id')
      .contains('metadata', {
        analysisSourceTreatment: {
          sourceLinks: [{ anchorStudyId }],
        },
      });
    if (linkedSourcesError) throw linkedSourcesError;
    const sourceStudyIds = (linkedSources ?? [])
      .map((paper) => paper.assigned_study_id)
      .sort();
    assert(
      stableHash(sourceStudyIds) === stableHash(expectedSourceStudyIds),
      `${anchorStudyId}: reverse source-link lookup mismatch`,
    );
    return { anchorStudyId, sourceStudyIds };
  }));
  const representativeAnchor = 'S277';
  const representativeReverseLinkCheck = reverseLinkChecks.find(
    (check) => check.anchorStudyId === representativeAnchor,
  );
  assert(representativeReverseLinkCheck, `${representativeAnchor}: reverse-link check is missing`);
  const { data: projectedPaper, error: projectionError } = await supabase
    .from('papers')
    .select('assigned_study_id,analysis_source_treatment:metadata->analysisSourceTreatment')
    .eq('assigned_study_id', representativeAnchor)
    .single();
  if (projectionError) throw projectionError;
  assert(
    projectedPaper.analysis_source_treatment?.role === 'anchor',
    `${representativeAnchor}: compact dashboard metadata projection mismatch`,
  );
  const postApplyVerification = {
    generatedAt: new Date().toISOString(),
    result: 'PASS',
    verification,
    reverseLinkChecks,
    compactProjectionCheck: {
      studyId: projectedPaper.assigned_study_id,
      role: projectedPaper.analysis_source_treatment.role,
      includeInAnalysisExport: projectedPaper.analysis_source_treatment.includeInAnalysisExport,
    },
  };
  fs.writeFileSync(
    POST_APPLY_VERIFICATION_PATH,
    `${JSON.stringify(postApplyVerification, null, 2)}\n`,
  );
  console.log(JSON.stringify(postApplyVerification, null, 2));
  process.exit(0);
}

const preApply = {
  generatedAt: new Date().toISOString(),
  mode: APPLY ? 'pre-apply' : 'dry-run',
  inputPath: path.relative(APP_ROOT, INPUT_PATH),
  rowInputPath: path.relative(APP_ROOT, ROW_INPUT_PATH),
  ready: plan.ready,
  blockers: plan.blockers,
  protectedHash: plan.protectedHash,
  protectedState: protectedState(before),
  intendedPaperCount: input.papers.length,
  intendedSourceLinkCount: input.sourceLinks.length,
  intendedPopulationExclusionCount: input.populationExclusions.length,
  intendedPopulationTreatmentCount: rowInput.papers.reduce(
    (count, paper) => count + paper.rows.length,
    0,
  ),
};
fs.writeFileSync(PRE_APPLY_PATH, `${JSON.stringify(preApply, null, 2)}\n`);

if (!APPLY) {
  console.log(JSON.stringify(preApply, null, 2));
  process.exit(plan.ready ? 0 : 1);
}

const operations = await applyPlan(plan, before);
const after = await loadState();
const verification = verifyFinalState(after, plan.protectedHash);
const finalAudit = {
  generatedAt: new Date().toISOString(),
  inputPath: path.relative(APP_ROOT, INPUT_PATH),
  rowInputPath: path.relative(APP_ROOT, ROW_INPUT_PATH),
  preApplySnapshotPath: path.relative(APP_ROOT, PRE_APPLY_PATH),
  operations,
  verification,
  result: 'PASS',
};
fs.writeFileSync(FINAL_AUDIT_PATH, `${JSON.stringify(finalAudit, null, 2)}\n`);
console.log(JSON.stringify(finalAudit, null, 2));
