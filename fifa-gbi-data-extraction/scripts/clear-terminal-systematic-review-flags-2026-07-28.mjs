import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const REVIEW_DATE = '2026-07-28';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_DIR = path.join(
  APP_DIR,
  'data',
  'live-extraction',
  'systematic-review-flag-cleanup-2026-07-28',
);
const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  `terminal-systematic-review-flags-${APPLY ? `live-apply-${RUN_ID}` : 'dry-run'}-audit.json`,
);

const require = createRequire(import.meta.url);
const { createClient } = (() => {
  try {
    return require('@supabase/supabase-js');
  } catch (localError) {
    const canonicalPackage = path.join(
      '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main/fifa-gbi-data-extraction',
      'node_modules',
      '@supabase',
      'supabase-js',
    );
    if (!fs.existsSync(canonicalPackage)) throw localError;
    return require(canonicalPackage);
  }
})();

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

const localEnvPath = path.join(APP_DIR, '.env.local');
const canonicalEnvPath =
  '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main/fifa-gbi-data-extraction/.env.local';
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : canonicalEnvPath;
const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Required Supabase credentials are missing from .env.local');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};

const canonicalise = (value) => {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalise(child)]),
    );
  }
  return value;
};

const stableHash = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(canonicalise(value)))
  .digest('hex');

const sortedRows = (rows) => [...rows].sort((left, right) => (
  JSON.stringify(canonicalise(left)).localeCompare(JSON.stringify(canonicalise(right)))
));

const paperProtectedHash = (paper) => {
  const { flag_reason: _flagReason, updated_at: _updatedAt, ...protectedColumns } = paper;
  return stableHash(protectedColumns);
};

const marksSystematicReview = (reason) => (
  /\bsystematic\b[\s\S]{0,40}\breviews?\b/i.test(reason)
  || /\breviews?\b[\s\S]{0,40}\bsystematic\b/i.test(reason)
);

const marksMentalHealthSystematicReview = (reason) => {
  const normalised = reason.replace(/[–—]/g, '-');
  return /\bmental[\s-]+health\b/i.test(normalised) && marksSystematicReview(normalised);
};

const isTarget = (paper) => {
  if (!paper.flag_reason || paper.status === 'archived') return false;
  if (paper.status === 'systematic_review') return marksSystematicReview(paper.flag_reason);
  return paper.status === 'mental_health' && marksMentalHealthSystematicReview(paper.flag_reason);
};

const fetchCandidateUniverse = async () => requireData(
  await supabase
    .from('papers')
    .select('*')
    .neq('status', 'archived')
    .not('flag_reason', 'is', null)
    .order('assigned_study_id'),
  'candidate universe',
);

const fetchSnapshot = async (papers) => {
  const paperIds = papers.map((paper) => paper.id);
  const studyIds = papers.map((paper) => paper.assigned_study_id);
  if (!paperIds.length) {
    return {
      papers: [],
      paperFiles: [],
      paperNotes: [],
      extractions: [],
      extractionFields: [],
      populationGroups: [],
      populationValues: [],
      screeningRecords: [],
      screeningVotes: [],
      aiReviewDecisions: [],
    };
  }

  const [
    paperRows,
    paperFiles,
    paperNotes,
    extractions,
    populationGroups,
    populationValues,
    screeningByPaper,
    screeningByStudy,
    aiReviewDecisions,
  ] = await Promise.all([
    supabase.from('papers').select('*').in('id', paperIds).order('assigned_study_id'),
    supabase.from('paper_files').select('*').in('paper_id', paperIds).order('paper_id'),
    supabase.from('paper_notes').select('*').in('paper_id', paperIds).order('paper_id'),
    supabase.from('extractions').select('*').in('paper_id', paperIds).order('paper_id'),
    supabase.from('population_groups').select('*').in('paper_id', paperIds).order('paper_id'),
    supabase.from('population_values').select('*').in('paper_id', paperIds).order('paper_id'),
    supabase.from('screening_records').select('*').in('promoted_paper_id', paperIds).order('id'),
    supabase.from('screening_records').select('*').in('assigned_study_id', studyIds).order('id'),
    supabase.from('ai_review_decisions').select('*').in('paper_id', paperIds).order('paper_id'),
  ]);

  const extractionRows = requireData(extractions, 'extractions snapshot');
  const screeningRecords = [
    ...new Map(
      [
        ...requireData(screeningByPaper, 'screening-by-paper snapshot'),
        ...requireData(screeningByStudy, 'screening-by-study snapshot'),
      ].map((row) => [row.id, row]),
    ).values(),
  ].sort((left, right) => left.id.localeCompare(right.id));

  const [extractionFields, screeningVotes] = await Promise.all([
    extractionRows.length
      ? supabase
        .from('extraction_fields')
        .select('*')
        .in('extraction_id', extractionRows.map((row) => row.id))
        .order('extraction_id')
      : Promise.resolve({ data: [], error: null }),
    screeningRecords.length
      ? supabase
        .from('screening_votes')
        .select('*')
        .in('screening_record_id', screeningRecords.map((row) => row.id))
        .order('screening_record_id')
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    papers: requireData(paperRows, 'papers snapshot'),
    paperFiles: requireData(paperFiles, 'paper files snapshot'),
    paperNotes: requireData(paperNotes, 'paper notes snapshot'),
    extractions: extractionRows,
    extractionFields: requireData(extractionFields, 'extraction fields snapshot'),
    populationGroups: requireData(populationGroups, 'population groups snapshot'),
    populationValues: requireData(populationValues, 'population values snapshot'),
    screeningRecords,
    screeningVotes: requireData(screeningVotes, 'screening votes snapshot'),
    aiReviewDecisions: requireData(aiReviewDecisions, 'AI review decisions snapshot'),
  };
};

const snapshotHashes = (snapshot) => ({
  paperProtected: Object.fromEntries(
    snapshot.papers.map((paper) => [paper.assigned_study_id, paperProtectedHash(paper)]),
  ),
  paperFiles: stableHash(sortedRows(snapshot.paperFiles)),
  paperNotes: stableHash(sortedRows(snapshot.paperNotes)),
  extractions: stableHash(sortedRows(snapshot.extractions)),
  extractionFields: stableHash(sortedRows(snapshot.extractionFields)),
  populationGroups: stableHash(sortedRows(snapshot.populationGroups)),
  populationValues: stableHash(sortedRows(snapshot.populationValues)),
  screeningRecords: stableHash(sortedRows(snapshot.screeningRecords)),
  screeningVotes: stableHash(sortedRows(snapshot.screeningVotes)),
  aiReviewDecisions: stableHash(sortedRows(snapshot.aiReviewDecisions)),
});

const candidateUniverse = await fetchCandidateUniverse();
const candidates = candidateUniverse.filter(isTarget);
const before = await fetchSnapshot(candidates);

if (before.papers.length !== candidates.length) {
  throw new Error(`Snapshot returned ${before.papers.length} of ${candidates.length} target papers`);
}

for (const candidate of candidates) {
  const paper = before.papers.find((row) => row.id === candidate.id);
  if (!paper) throw new Error(`${candidate.assigned_study_id}: target missing from snapshot`);
  if (!isTarget(paper)) throw new Error(`${candidate.assigned_study_id}: target no longer meets criteria`);
  if (paper.status !== candidate.status || paper.flag_reason !== candidate.flag_reason) {
    throw new Error(`${candidate.assigned_study_id}: status or flag reason changed during preflight`);
  }
}

const audit = {
  schemaVersion: 1,
  task: 'Clear redundant systematic-review flag reasons from already-terminal live extraction records',
  date: REVIEW_DATE,
  mode: APPLY ? 'live_apply' : 'dry_run',
  criteria: {
    archivedExcluded: true,
    systematicReview:
      'status is systematic_review and flag_reason explicitly contains systematic review',
    mentalHealth:
      'status is mental_health and flag_reason explicitly contains both mental health and systematic review',
  },
  candidateUniverseCount: candidateUniverse.length,
  candidateUniverse: candidateUniverse.map((paper) => ({
    id: paper.id,
    assignedStudyId: paper.assigned_study_id,
    status: paper.status,
    flagReason: paper.flag_reason,
    explicitlyMentionsSystematicReview: marksSystematicReview(paper.flag_reason ?? ''),
    explicitlyMentionsMentalHealth: /\bmental[\s-]+health\b/i.test(paper.flag_reason ?? ''),
    selected: isTarget(paper),
  })),
  systematicReviewMentionUniverse: candidateUniverse
    .filter((paper) => marksSystematicReview(paper.flag_reason ?? ''))
    .map((paper) => ({
      id: paper.id,
      assignedStudyId: paper.assigned_study_id,
      status: paper.status,
      flagReason: paper.flag_reason,
      selected: isTarget(paper),
    })),
  targets: candidates.map((paper) => ({
    id: paper.id,
    assignedStudyId: paper.assigned_study_id,
    status: paper.status,
    flagReason: paper.flag_reason,
    updatedAt: paper.updated_at,
  })),
  before,
  beforeHashes: snapshotHashes(before),
  apply: [],
  after: null,
  afterHashes: null,
  integrityGate: null,
  rollback: {
    ready: true,
    source: 'before.papers in this audit file',
    action:
      'Restore only each original flag_reason, guarded by exact id, assigned_study_id, preserved status, null flag_reason, and the updated_at returned by apply.',
  },
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (APPLY) {
  const changed = [];
  try {
    for (const target of audit.targets) {
      const result = await supabase
        .from('papers')
        .update({ flag_reason: null })
        .eq('id', target.id)
        .eq('assigned_study_id', target.assignedStudyId)
        .eq('status', target.status)
        .eq('flag_reason', target.flagReason)
        .eq('updated_at', target.updatedAt)
        .select('id,assigned_study_id,status,flag_reason,updated_at');
      const rows = requireData(result, `${target.assignedStudyId} guarded flag clear`);
      if (rows.length !== 1) {
        throw new Error(`${target.assignedStudyId}: guarded update affected ${rows.length} rows`);
      }
      audit.apply.push(rows[0]);
      changed.push({ target, applied: rows[0] });
      fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
    }

    const after = await fetchSnapshot(candidates);
    const afterUniverse = await fetchCandidateUniverse();
    const afterHashes = snapshotHashes(after);
    const failures = [];

    for (const target of audit.targets) {
      const paper = after.papers.find((row) => row.id === target.id);
      if (!paper) {
        failures.push(`${target.assignedStudyId}: missing after apply`);
        continue;
      }
      if (paper.flag_reason !== null) failures.push(`${target.assignedStudyId}: flag_reason is not null`);
      if (paper.status !== target.status) failures.push(`${target.assignedStudyId}: status changed`);
      if (afterHashes.paperProtected[target.assignedStudyId]
        !== audit.beforeHashes.paperProtected[target.assignedStudyId]) {
        failures.push(`${target.assignedStudyId}: a protected papers column changed`);
      }
    }

    for (const key of [
      'paperFiles',
      'paperNotes',
      'extractions',
      'extractionFields',
      'populationGroups',
      'populationValues',
      'screeningRecords',
      'screeningVotes',
      'aiReviewDecisions',
    ]) {
      if (afterHashes[key] !== audit.beforeHashes[key]) failures.push(`${key}: protected rows changed`);
    }

    const remainingTargetIds = afterUniverse.filter(isTarget).map((paper) => paper.assigned_study_id);
    if (remainingTargetIds.length) {
      failures.push(`Target-matching flag reasons remain: ${remainingTargetIds.join(', ')}`);
    }

    audit.after = after;
    audit.afterHashes = afterHashes;
    audit.integrityGate = {
      passed: failures.length === 0,
      targetCount: audit.targets.length,
      appliedCount: audit.apply.length,
      allFlagReasonsNull: after.papers.every((paper) => paper.flag_reason === null),
      allStatusesPreserved: audit.targets.every((target) => (
        after.papers.find((paper) => paper.id === target.id)?.status === target.status
      )),
      protectedPaperColumnsPreserved: audit.targets.every((target) => (
        afterHashes.paperProtected[target.assignedStudyId]
        === audit.beforeHashes.paperProtected[target.assignedStudyId]
      )),
      protectedChildTablesPreserved: failures.every((failure) => !failure.includes('protected rows changed')),
      noMatchingFlagsRemain: remainingTargetIds.length === 0,
      failures,
    };
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
    if (failures.length) throw new Error(`Live integrity gate failed: ${failures.join('; ')}`);
  } catch (error) {
    audit.failure = {
      message: error instanceof Error ? error.message : String(error),
      compensation: [],
      verification: null,
    };

    for (const { target, applied } of [...changed].reverse()) {
      try {
        const result = await supabase
          .from('papers')
          .update({ flag_reason: target.flagReason })
          .eq('id', target.id)
          .eq('assigned_study_id', target.assignedStudyId)
          .eq('status', target.status)
          .is('flag_reason', null)
          .eq('updated_at', applied.updated_at)
          .select('id,assigned_study_id,status,flag_reason,updated_at');
        const rows = result.error ? [] : (result.data ?? []);
        audit.failure.compensation.push({
          assignedStudyId: target.assignedStudyId,
          restored: !result.error
            && rows.length === 1
            && rows[0].flag_reason === target.flagReason,
          error: result.error?.message ?? null,
          rows,
        });
      } catch (compensationError) {
        audit.failure.compensation.push({
          assignedStudyId: target.assignedStudyId,
          restored: false,
          error: compensationError instanceof Error
            ? compensationError.message
            : String(compensationError),
          rows: [],
        });
      }
    }

    try {
      const verification = await supabase
        .from('papers')
        .select('id,assigned_study_id,status,flag_reason')
        .in('id', changed.map(({ target }) => target.id))
        .order('assigned_study_id');
      const rows = verification.error ? [] : (verification.data ?? []);
      audit.failure.verification = {
        error: verification.error?.message ?? null,
        rows,
        allRestored: !verification.error && changed.every(({ target }) => {
          const row = rows.find((candidate) => candidate.id === target.id);
          return row?.status === target.status && row?.flag_reason === target.flagReason;
        }),
      };
    } catch (verificationError) {
      audit.failure.verification = {
        error: verificationError instanceof Error
          ? verificationError.message
          : String(verificationError),
        rows: [],
        allRestored: false,
      };
    }

    try {
      fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
    } catch {
      // The original error remains primary; live compensation evidence is retained in memory.
    }
    throw error;
  }
}

console.log(JSON.stringify({
  mode: audit.mode,
  auditPath: OUTPUT_PATH,
  targetCount: audit.targets.length,
  targets: audit.targets.map((target) => ({
    assignedStudyId: target.assignedStudyId,
    status: target.status,
    flagReason: target.flagReason,
  })),
  integrityGate: audit.integrityGate,
}, null, 2));
