import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const REVIEWER_ID = '00000000-0000-0000-0000-000000000001';
const REVIEWER_NAME = 'AbdelRahman Babiker';
const REVIEW_DATE = '2026-07-27';
const untouchedStudyIds = [
  'S1368',
  'S4620',
  'S647',
  'S1444',
  'S2391',
  'S1041',
  'S389',
  'S390',
  'S899',
  'S982',
  'S487',
  'S016',
];

const targets = {
  S1914: {
    disposition: 'no_exposure',
    paperId: '5a3599d2-34ba-4bf1-98b1-6972630f9c40',
    expectedFlag: 'Exclude - retrosepctive questionnaire',
  },
  S5004: {
    disposition: 'no_exposure',
    paperId: 'dd8bbe78-ce2a-4a48-be61-47b5fcfa57f1',
    expectedFlag: 'athlete days - para football though so might keep because data is scarce',
  },
  S2506: {
    disposition: 'return_to_full_text',
    paperId: '757aa5ae-371f-4236-b50c-608e4a0d3c18',
    screeningId: 'e4b15e8c-173d-4351-9c53-592725a3b691',
    expectedFlag: 'Wrong Outcomes - Exclude',
    exclusionReason: 'Wrong outcomes',
    reason: 'Wrong outcomes: the study reports well-being questionnaire outcomes, not injury or illness epidemiology.',
    note: 'Retrospectively returned from extraction on 2026-07-27 after source verification. The paper evaluates muscle soreness, stress, mood, fatigue, sleep quality and a composite well-being index during four congested matches. Injury is discussed only as background risk; no injury or illness epidemiology outcome is reported. The two original full-text include votes are preserved as immutable audit history.',
  },
  S2826: {
    disposition: 'return_to_full_text',
    paperId: 'bb99cfe2-66a9-4204-9a0b-2690f7b93f6e',
    screeningId: '98f9680c-0c67-4bfa-81a4-aaa6aebe7371',
    expectedFlag: 'Exclude - public data from noisefeed.com',
    exclusionReason: 'Public or otherwise ineligible data source',
    reason: 'Primary injury outcomes were obtained from Noisefeed, a third-party football injury repository.',
    note: 'Retrospectively returned from extraction on 2026-07-27 after source verification. The Methods state that the Noisefeed injury repository was used to gather the knee-ligament injury incidence and severity data for the five leagues. The paper does not demonstrate eligible prospective injury collection by participating team medical staff. The two original full-text include votes are preserved as immutable audit history.',
  },
};

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

const fetchSnapshot = async () => {
  const paperIds = Object.values(targets).map((target) => target.paperId);
  const screeningIds = Object.values(targets)
    .map((target) => target.screeningId)
    .filter(Boolean);

  const papers = requireData(
    await supabase.from('papers').select('*').in('id', paperIds).order('assigned_study_id'),
    'papers snapshot',
  );
  const untouchedPapers = requireData(
    await supabase.from('papers').select('*').in('assigned_study_id', untouchedStudyIds).order('assigned_study_id'),
    'untouched papers snapshot',
  );
  const screeningRecords = requireData(
    await supabase.from('screening_records').select('*').in('id', screeningIds).order('assigned_study_id'),
    'screening snapshot',
  );
  const screeningVotes = requireData(
    await supabase.from('screening_votes').select('*').in('screening_record_id', screeningIds).order('vote_order'),
    'screening votes snapshot',
  );
  const paperFiles = requireData(
    await supabase.from('paper_files').select('*').in('paper_id', paperIds).order('paper_id'),
    'paper files snapshot',
  );
  const paperNotes = requireData(
    await supabase.from('paper_notes').select('*').in('paper_id', paperIds).order('created_at'),
    'paper notes snapshot',
  );
  const extractions = requireData(
    await supabase.from('extractions').select('*').in('paper_id', paperIds).order('paper_id'),
    'extractions snapshot',
  );
  const extractionFields = extractions.length
    ? requireData(
      await supabase.from('extraction_fields').select('*').in('extraction_id', extractions.map((row) => row.id)).order('extraction_id'),
      'extraction fields snapshot',
    )
    : [];
  const populationGroups = requireData(
    await supabase.from('population_groups').select('*').in('paper_id', paperIds).order('paper_id'),
    'population groups snapshot',
  );
  const populationValues = requireData(
    await supabase.from('population_values').select('*').in('paper_id', paperIds).order('paper_id'),
    'population values snapshot',
  );
  const aiReviewDecisions = requireData(
    await supabase.from('ai_review_decisions').select('*').in('paper_id', paperIds).order('paper_id'),
    'AI review decisions snapshot',
  );
  const uploadQueueReferences = requireData(
    await supabase.from('paper_upload_queue').select('*').in('paper_id', paperIds).order('paper_id'),
    'upload queue references snapshot',
  );

  return {
    papers,
    untouchedPapers,
    screeningRecords,
    screeningVotes,
    paperFiles,
    paperNotes,
    extractions,
    extractionFields,
    populationGroups,
    populationValues,
    aiReviewDecisions,
    uploadQueueReferences,
  };
};

const assertPreconditions = (snapshot) => {
  for (const [studyId, target] of Object.entries(targets)) {
    const paper = snapshot.papers.find((row) => row.id === target.paperId);
    if (!paper) throw new Error(`${studyId}: paper not found`);
    if (paper.assigned_study_id !== studyId) throw new Error(`${studyId}: paper ID mismatch`);
    if (paper.status !== 'flagged') throw new Error(`${studyId}: expected flagged, found ${paper.status}`);
    if (paper.flag_reason !== target.expectedFlag) throw new Error(`${studyId}: flag reason changed`);
    if (paper.assigned_to !== REVIEWER_ID) throw new Error(`${studyId}: assignment changed`);

    if (target.disposition === 'return_to_full_text') {
      const screening = snapshot.screeningRecords.find((row) => row.id === target.screeningId);
      if (!screening) throw new Error(`${studyId}: screening record not found`);
      if (screening.promoted_paper_id !== target.paperId) throw new Error(`${studyId}: promotion link changed`);
      const decisions = Array.isArray(screening.metadata?.fullTextDecisions)
        ? screening.metadata.fullTextDecisions
        : [];
      if (decisions.length !== 2 || decisions.some((decision) => decision.decision !== 'include')) {
        throw new Error(`${studyId}: expected exactly two preserved include decisions`);
      }
      if (screening.metadata?.extractionReturn) throw new Error(`${studyId}: already has extractionReturn metadata`);
    }
  }
};

const returnMetadata = (screening, studyId, target, returnedAt) => {
  const metadata = screening.metadata ?? {};
  const decisions = metadata.fullTextDecisions;
  const audit = Array.isArray(metadata.fullTextDecisionAudit) ? metadata.fullTextDecisionAudit : [];
  const reviewNotes = Array.isArray(metadata.fullTextReviewNotes) ? metadata.fullTextReviewNotes : [];
  const noteId = `${studyId.toLowerCase()}-retrospective-return-${REVIEW_DATE}`;

  return {
    ...metadata,
    extractionReturn: {
      status: 'excluded',
      reason: target.reason,
      note: target.note,
      returnedAt,
      returnedBy: REVIEWER_ID,
      disposition: 'archived',
      archivedPaperId: target.paperId,
      originalFullTextDecisions: decisions,
    },
    fullTextResolution: 'excluded',
    fullTextDecisionsOriginalBeforeRetrospectiveReturn:
      metadata.fullTextDecisionsOriginalBeforeRetrospectiveReturn ?? decisions,
    fullTextDecisionAudit: [
      ...audit,
      {
        action: 'retrospective_return_from_extraction',
        reason: target.exclusionReason,
        note: target.note,
        decision: 'exclude',
        decidedAt: returnedAt,
        reviewerName: REVIEWER_NAME,
        resolutionBefore: metadata.fullTextResolution ?? 'ready_for_extraction',
        reviewerProfileId: REVIEWER_ID,
      },
    ],
    fullTextReviewNotes: [
      ...reviewNotes,
      {
        id: noteId,
        body: target.note,
        createdAt: returnedAt,
        createdBy: REVIEWER_ID,
        createdByName: REVIEWER_NAME,
      },
    ],
  };
};

const updatePaper = async (studyId, target, before, values) => {
  const paper = before.papers.find((row) => row.id === target.paperId);
  const result = await supabase
    .from('papers')
    .update(values)
    .eq('id', target.paperId)
    .eq('assigned_study_id', studyId)
    .eq('status', 'flagged')
    .eq('flag_reason', target.expectedFlag)
    .eq('updated_at', paper.updated_at)
    .select('id,assigned_study_id,status,flag_reason,assigned_to');
  const rows = requireData(result, `${studyId} paper update`);
  if (rows.length !== 1) throw new Error(`${studyId}: guarded paper update affected ${rows.length} rows`);
  return rows[0];
};

const rollback = async (before, changedPaperIds, changedScreeningIds) => {
  const errors = [];
  for (const id of changedScreeningIds.reverse()) {
    const row = before.screeningRecords.find((candidate) => candidate.id === id);
    const { error } = await supabase
      .from('screening_records')
      .update({
        metadata: row.metadata,
        promoted_paper_id: row.promoted_paper_id,
        promoted_by: row.promoted_by,
        promoted_at: row.promoted_at,
      })
      .eq('id', id);
    if (error) errors.push(`screening ${id}: ${error.message}`);
  }
  for (const id of changedPaperIds.reverse()) {
    const row = before.papers.find((candidate) => candidate.id === id);
    const { error } = await supabase
      .from('papers')
      .update({ status: row.status, flag_reason: row.flag_reason, assigned_to: row.assigned_to })
      .eq('id', id);
    if (error) errors.push(`paper ${id}: ${error.message}`);
  }
  if (errors.length) throw new Error(`Automatic rollback failed: ${errors.join('; ')}`);
};

const before = await fetchSnapshot();
assertPreconditions(before);

const audit = {
  schemaVersion: 1,
  task: 'Flagged-paper adjudication and reversible full-text return',
  date: REVIEW_DATE,
  mode: APPLY ? 'live_apply' : 'dry_run',
  model: 'GPT-5 Codex',
  decisions: Object.fromEntries(
    Object.entries(targets).map(([studyId, target]) => [studyId, {
      disposition: target.disposition,
      paperId: target.paperId,
      screeningId: target.screeningId ?? null,
      exclusionReason: target.exclusionReason ?? null,
      reason: target.reason ?? null,
    }]),
  ),
  before,
  apply: [],
  integrityGate: null,
  rollback: {
    automaticOnApplyFailure: true,
    path: 'Restore each affected paper status/flag/assignment and each returned screening record metadata/promotion fields from the exact before snapshot in this audit. No child or storage rows are deleted.',
  },
};

if (APPLY) {
  const changedPaperIds = [];
  const changedScreeningIds = [];
  const returnedAt = new Date().toISOString();

  try {
    for (const studyId of ['S1914', 'S5004']) {
      const target = targets[studyId];
      audit.apply.push(await updatePaper(studyId, target, before, { status: 'no_exposure', flag_reason: null }));
      changedPaperIds.push(target.paperId);
    }

    for (const studyId of ['S2506', 'S2826']) {
      const target = targets[studyId];
      audit.apply.push(await updatePaper(studyId, target, before, { status: 'archived', flag_reason: null }));
      changedPaperIds.push(target.paperId);

      const screening = before.screeningRecords.find((row) => row.id === target.screeningId);
      const metadata = returnMetadata(screening, studyId, target, returnedAt);
      const result = await supabase
        .from('screening_records')
        .update({
          metadata,
          promoted_paper_id: null,
          promoted_by: null,
          promoted_at: null,
        })
        .eq('id', target.screeningId)
        .eq('stage', 'full_text')
        .eq('promoted_paper_id', target.paperId)
        .eq('updated_at', screening.updated_at)
        .select('id,assigned_study_id,promoted_paper_id,promoted_by,promoted_at,metadata');
      const rows = requireData(result, `${studyId} screening update`);
      if (rows.length !== 1) throw new Error(`${studyId}: guarded screening update affected ${rows.length} rows`);
      audit.apply.push(rows[0]);
      changedScreeningIds.push(target.screeningId);
    }
  } catch (error) {
    await rollback(before, changedPaperIds, changedScreeningIds);
    throw error;
  }

  const after = await fetchSnapshot();
  const beforeVotes = JSON.stringify(before.screeningVotes);
  const afterVotes = JSON.stringify(after.screeningVotes);
  const beforeChildren = JSON.stringify({
    paperFiles: before.paperFiles,
    paperNotes: before.paperNotes,
    extractions: before.extractions,
    extractionFields: before.extractionFields,
    populationGroups: before.populationGroups,
    populationValues: before.populationValues,
    aiReviewDecisions: before.aiReviewDecisions,
    uploadQueueReferences: before.uploadQueueReferences,
  });
  const afterChildren = JSON.stringify({
    paperFiles: after.paperFiles,
    paperNotes: after.paperNotes,
    extractions: after.extractions,
    extractionFields: after.extractionFields,
    populationGroups: after.populationGroups,
    populationValues: after.populationValues,
    aiReviewDecisions: after.aiReviewDecisions,
    uploadQueueReferences: after.uploadQueueReferences,
  });
  const protectedScreeningState = (row) => {
    const {
      updated_at: _updatedAt,
      promoted_paper_id: _promotedPaperId,
      promoted_by: _promotedBy,
      promoted_at: _promotedAt,
      metadata,
      ...columns
    } = row;
    const {
      extractionReturn: _extractionReturn,
      fullTextResolution: _fullTextResolution,
      fullTextDecisionAudit: _fullTextDecisionAudit,
      fullTextReviewNotes: _fullTextReviewNotes,
      fullTextDecisionsOriginalBeforeRetrospectiveReturn: _originalDecisions,
      ...protectedMetadata
    } = metadata ?? {};
    return { ...columns, metadata: protectedMetadata };
  };

  const expected = {
    S1914: { paperStatus: 'no_exposure', flagReason: null },
    S5004: { paperStatus: 'no_exposure', flagReason: null },
    S2506: { paperStatus: 'archived', flagReason: null, screeningResolution: 'excluded' },
    S2826: { paperStatus: 'archived', flagReason: null, screeningResolution: 'excluded' },
  };
  const checks = Object.entries(expected).map(([studyId, values]) => {
    const target = targets[studyId];
    const paper = after.papers.find((row) => row.id === target.paperId);
    const screening = target.screeningId
      ? after.screeningRecords.find((row) => row.id === target.screeningId)
      : null;
    return {
      studyId,
      paperStatusMatches: paper?.status === values.paperStatus,
      flagCleared: paper?.flag_reason === values.flagReason,
      assignmentPreserved: paper?.assigned_to === REVIEWER_ID,
      screeningResolutionMatches: screening
        ? screening.metadata?.extractionReturn?.status === values.screeningResolution
          && screening.metadata?.fullTextResolution === values.screeningResolution
          && screening.promoted_paper_id === null
          && screening.promoted_by === null
          && screening.promoted_at === null
        : true,
      originalDecisionsPreserved: screening
        ? JSON.stringify(screening.metadata?.fullTextDecisions)
          === JSON.stringify(before.screeningRecords.find((row) => row.id === target.screeningId)?.metadata?.fullTextDecisions)
        : true,
      protectedScreeningStatePreserved: screening
        ? JSON.stringify(protectedScreeningState(screening))
          === JSON.stringify(protectedScreeningState(before.screeningRecords.find((row) => row.id === target.screeningId)))
        : true,
    };
  });
  audit.integrityGate = {
    checks,
    screeningVotesUnchanged: beforeVotes === afterVotes,
    childAndStorageReferencesUnchanged: beforeChildren === afterChildren,
    explicitlyUntouchedPapersUnchanged:
      JSON.stringify(before.untouchedPapers) === JSON.stringify(after.untouchedPapers),
    passed: checks.every((check) => Object.entries(check)
      .filter(([key]) => key !== 'studyId')
      .every(([, value]) => value === true))
      && beforeVotes === afterVotes
      && beforeChildren === afterChildren
      && JSON.stringify(before.untouchedPapers) === JSON.stringify(after.untouchedPapers),
    after,
  };
  if (!audit.integrityGate.passed) {
    await rollback(before, changedPaperIds, changedScreeningIds);
    throw new Error('Integrity gate failed; automatic rollback completed');
  }
}

const outputDir = path.join(APP_DIR, 'data', 'second-search-extraction', 'adjudication-2026-07-27');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(
  outputDir,
  `flagged-paper-adjudication-${APPLY ? 'live-apply' : 'dry-run'}-audit-2026-07-27.json`,
);
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify({
  mode: audit.mode,
  outputPath,
  integrityGatePassed: audit.integrityGate?.passed ?? null,
  decisions: audit.decisions,
}, null, 2));
