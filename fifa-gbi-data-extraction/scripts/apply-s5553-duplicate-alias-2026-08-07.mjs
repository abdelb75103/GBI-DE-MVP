/**
 * Record screening record S5553 as a duplicate alias of paper S4703.
 *
 * Metadata-only write on one screening_records row. No promotion, no papers row,
 * no extraction, no vote or resolver change. Run without flags for a read-only
 * dry run; pass --apply to perform the guarded metadata merge.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const AUDIT_DIR = path.join(REPO_ROOT, 'Data Analysis/Data Cleaning/audit/s5553-duplicate-alias');
const PRE_APPLY_PATH = path.join(AUDIT_DIR, 'pre-apply-live-snapshot-2026-08-07.json');
const FINAL_AUDIT_PATH = path.join(AUDIT_DIR, 'final-live-audit-2026-08-07.json');
const DRY_RUN_PATH = path.join(AUDIT_DIR, 'dry-run-preview-2026-08-07.json');

const APPLY = process.argv.includes('--apply');
const RECORD_ID = 'ad405aa3-ac09-47d1-98a6-da6113728980';
const ALIAS_STUDY_ID = 'S5553';
const CANONICAL_STUDY_ID = 'S4703';
const CANONICAL_PAPER_ID = 'b2ff2b6c-42d8-492a-a970-c0502640ffbf';
const CANONICAL_DOI = '10.1136/bmjsem-2025-003003';
const ALIAS_DOI = '10.1016/j.orthtr.2024.03.009';
const ATTACHED_PDF_SHA256 = 'b11a11f68fa80fb43b1c6f8c13c1e60b0707ef427e6037081d741cd9947d5f9c';
const ATTACHED_PDF_PATH = '6f7615e8-8f7d-465a-9084-a8ea62b2da3a/1785429903511-S5553-S5553-corresponding-full-report.pdf';
const AUDIT_KEY = 'duplicateAliasAudit20260807';
const DECIDED_AT = '2026-08-07T00:00:00.000Z';

const PROTECTED_COLUMNS = [
  'manual_decision',
  'manual_reason',
  'manual_decided_by',
  'manual_decided_at',
  'promoted_paper_id',
  'promoted_by',
  'promoted_at',
  'ta_resolution',
  'stage',
  'assigned_study_id',
  'file_sha256',
  'storage_bucket',
  'storage_object_path',
  'ai_suggested_decision',
  'ai_confidence',
  'ai_criteria_version',
];
const PROTECTED_METADATA_KEYS = [
  'fullTextDecisions',
  'fullTextDecisionAudit',
  'fullTextResolution',
];

function loadEnv(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
  return env;
}

/** Order-insensitive canonical JSON, because Postgres jsonb does not preserve key order. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value ?? null;
}

function stable(value) {
  return JSON.stringify(canonical(value));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

const env = loadEnv(path.join(ROOT, '.env.local'));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase URL or service role key in .env.local');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function readLiveState() {
  const [record, votes, aliasPapers, canonicalPaper] = await Promise.all([
    supabase.from('screening_records').select('*').eq('id', RECORD_ID).maybeSingle(),
    supabase.from('screening_votes').select('*').eq('screening_record_id', RECORD_ID).order('id'),
    supabase.from('papers').select('id,assigned_study_id,status').eq('assigned_study_id', ALIAS_STUDY_ID),
    supabase.from('papers').select('*').eq('id', CANONICAL_PAPER_ID).maybeSingle(),
  ]);
  for (const [label, result] of [
    ['screening_records', record],
    ['screening_votes', votes],
    ['papers(alias)', aliasPapers],
    ['papers(canonical)', canonicalPaper],
  ]) {
    if (result.error) throw new Error(`${label} read failed: ${result.error.message}`);
  }
  if (!record.data) throw new Error('S5553 screening record not found');
  if (!canonicalPaper.data) throw new Error('S4703 canonical paper not found');

  const { data: extractions, error: extractionsError } = await supabase
    .from('extractions')
    .select('id,tab')
    .eq('paper_id', CANONICAL_PAPER_ID)
    .order('tab');
  if (extractionsError) throw new Error(`extractions read failed: ${extractionsError.message}`);
  const extractionIds = extractions.map((row) => row.id);
  let fieldCount = 0;
  if (extractionIds.length) {
    const { count, error: fieldsError } = await supabase
      .from('extraction_fields')
      .select('id', { count: 'exact', head: true })
      .in('extraction_id', extractionIds);
    if (fieldsError) throw new Error(`extraction_fields read failed: ${fieldsError.message}`);
    fieldCount = count ?? 0;
  }

  return {
    record: record.data,
    votes: votes.data ?? [],
    aliasPapers: aliasPapers.data ?? [],
    canonicalPaper: canonicalPaper.data,
    canonicalExtractions: extractions,
    canonicalFieldCount: fieldCount,
  };
}

function evaluateAssertions(state) {
  const record = state.record;
  return [
    { name: 'record_found', pass: record.id === RECORD_ID, observed: record.id },
    { name: 'assigned_study_id_is_S5553', pass: record.assigned_study_id === ALIAS_STUDY_ID, observed: record.assigned_study_id },
    { name: 'stage_is_full_text', pass: record.stage === 'full_text', observed: record.stage },
    { name: 'manual_decision_is_null', pass: record.manual_decision === null, observed: record.manual_decision },
    { name: 'promoted_paper_id_is_null', pass: record.promoted_paper_id === null, observed: record.promoted_paper_id },
    { name: 'ta_resolution_ready_for_full_text', pass: record.ta_resolution === 'ready_for_full_text', observed: record.ta_resolution },
    { name: 'attached_pdf_sha256_matches', pass: record.file_sha256 === ATTACHED_PDF_SHA256, observed: record.file_sha256 },
    { name: 'attached_pdf_path_matches', pass: record.storage_object_path === ATTACHED_PDF_PATH, observed: record.storage_object_path },
    { name: 'ai_suggested_decision_include', pass: record.ai_suggested_decision === 'include', observed: record.ai_suggested_decision },
    { name: 'ai_criteria_version_v8', pass: record.ai_criteria_version === 'fifa-gbi-full-text-v8-2026-06-23', observed: record.ai_criteria_version },
    { name: 'no_papers_row_for_S5553', pass: state.aliasPapers.length === 0, observed: state.aliasPapers.length },
    { name: 'canonical_paper_is_S4703', pass: state.canonicalPaper.assigned_study_id === CANONICAL_STUDY_ID, observed: state.canonicalPaper.assigned_study_id },
    { name: 'canonical_paper_doi_matches', pass: (state.canonicalPaper.doi ?? '').toLowerCase().includes(CANONICAL_DOI), observed: state.canonicalPaper.doi },
    { name: 'canonical_paper_status_extracted', pass: state.canonicalPaper.status === 'extracted', observed: state.canonicalPaper.status },
    { name: 'canonical_extraction_tabs_present', pass: state.canonicalExtractions.length > 0, observed: state.canonicalExtractions.length },
    {
      // Idempotent: absent is the first-run case, identical means this apply already ran.
      name: 'audit_key_absent_or_identical',
      pass: !(AUDIT_KEY in (state.record.metadata ?? {}))
        || stable(state.record.metadata[AUDIT_KEY]) === stable(auditValue),
      observed: AUDIT_KEY in (state.record.metadata ?? {}) ? 'present_identical_or_conflicting' : 'absent',
    },
  ];
}

const auditValue = {
  classification: 'duplicate_alias',
  aliasStudyId: ALIAS_STUDY_ID,
  aliasScreeningRecordId: RECORD_ID,
  canonicalStudyId: CANONICAL_STUDY_ID,
  canonicalPaperId: CANONICAL_PAPER_ID,
  canonicalDoi: CANONICAL_DOI,
  aliasDoi: ALIAS_DOI,
  decision: 'not_promoted_not_extracted',
  reason:
    'The S5553 Embase record is the German conference abstract of the same German professional football injury registry that is already extracted live as paper S4703, and the PDF attached to S5553 is in fact the S4703 full report, so promoting or extracting S5553 would double-count 1,514 players and 865 injuries.',
  evidence: [
    'S5553 Embase record: Szymski D, Krutsch W, Huber L, Weber J, Alt V, "Erstellung eines Verletzungsregisters im Profifussball - Studiendesign und Perspektiven", Sports Orthopaedics and Traumatology, DOI 10.1016/j.orthtr.2024.03.009 (German conference abstract).',
    'PDF attached to S5553 resolves to the BMJ Open Sport & Exercise Medicine full report (DOI 10.1136/bmjsem-2025-003003), source URL https://epub.uni-regensburg.de/79387/1/e003003.full.pdf, not the abstract.',
    'That full report is already live as paper S4703 (Huber L 2026, BMJ Open Sport & Exercise Medicine, DOI 10.1136/bmjsem-2025-003003, status extracted, nine extraction tabs present).',
    'Matching counts: sampleSizePlayers 1514/963/551, numberOfTeams 54/33/21, injuryTotalCount 865/503/362.',
    "Matching design: men's 2022/23 and women's 2023/24 first registry seasons, Germany, professional 1st and 2nd Bundesliga.",
  ],
  attachedPdfSha256: ATTACHED_PDF_SHA256,
  attachedPdfStorageObjectPath: ATTACHED_PDF_PATH,
  sourceOfTruth: 'S4703 remains the single source of truth for the German Bundesliga injury registry.',
  protectedStateChanged: false,
  decidedBy: 'AbdelRahman Babiker',
  decidedAt: DECIDED_AT,
  appliedBy: 'claude-opus-5 delegated worker',
  backlogRef: 'docs/second-search-extraction-review-backlog-2026-07-03.md#s5553-duplicate-alias-reconciliation',
  reviewState: 'pending_review',
};

const before = await readLiveState();
const assertions = evaluateAssertions(before);
const failed = assertions.filter((item) => !item.pass);

// Write-once: a rerun must never overwrite the true pre-write state.
if (!fs.existsSync(PRE_APPLY_PATH)) {
  writeJson(PRE_APPLY_PATH, {
    generatedAt: new Date().toISOString(),
    purpose: 'Exact pre-write live snapshot before the S5553 duplicate-alias metadata-only merge',
    apply: APPLY,
    screeningRecord: before.record,
    screeningVotes: before.votes,
    papersWithAssignedStudyIdS5553: before.aliasPapers,
    canonicalPaperS4703: before.canonicalPaper,
    canonicalExtractionTabs: before.canonicalExtractions,
    canonicalExtractionFieldCount: before.canonicalFieldCount,
    assertions,
  });
}
const preApplySnapshot = JSON.parse(fs.readFileSync(PRE_APPLY_PATH, 'utf8'));

if (failed.length) {
  console.error(JSON.stringify({ blocked: true, preApplyPath: PRE_APPLY_PATH, failed }, null, 2));
  process.exit(1);
}

if (!APPLY) {
  writeJson(DRY_RUN_PATH, {
    generatedAt: new Date().toISOString(),
    apply: false,
    preApplyPath: PRE_APPLY_PATH,
    plannedMetadataKey: AUDIT_KEY,
    plannedMetadataValue: auditValue,
    existingMetadataKeys: Object.keys(before.record.metadata ?? {}).sort(),
    assertions,
  });
  console.log(JSON.stringify({
    apply: false,
    preApplyPath: PRE_APPLY_PATH,
    dryRunPath: DRY_RUN_PATH,
    assertionsPassed: assertions.length,
  }, null, 2));
  process.exit(0);
}

const alreadyApplied = stable(before.record.metadata?.[AUDIT_KEY]) === stable(auditValue);
if (!alreadyApplied) {
  const mergedMetadata = { ...(before.record.metadata ?? {}), [AUDIT_KEY]: auditValue };
  const { data: updatedRows, error: updateError } = await supabase
    .from('screening_records')
    .update({ metadata: mergedMetadata })
    .eq('id', RECORD_ID)
    .eq('updated_at', before.record.updated_at)
    .eq('assigned_study_id', ALIAS_STUDY_ID)
    .eq('file_sha256', ATTACHED_PDF_SHA256)
    .is('manual_decision', null)
    .is('promoted_paper_id', null)
    .select('*');
  if (updateError || updatedRows?.length !== 1) {
    throw new Error(`Guarded metadata merge failed: ${updateError?.message ?? 'row count'}`);
  }
}

// Compare against the persisted pre-write baseline, not this run's read.
const baseline = {
  record: preApplySnapshot.screeningRecord,
  votes: preApplySnapshot.screeningVotes,
  canonicalPaper: preApplySnapshot.canonicalPaperS4703,
  canonicalExtractions: preApplySnapshot.canonicalExtractionTabs,
  canonicalFieldCount: preApplySnapshot.canonicalExtractionFieldCount,
};
const after = await readLiveState();
const appliedValue = after.record.metadata?.[AUDIT_KEY] ?? null;

const protectedColumnChecks = PROTECTED_COLUMNS.map((column) => ({
  column,
  before: baseline.record[column] ?? null,
  after: after.record[column] ?? null,
  unchanged: stable(baseline.record[column]) === stable(after.record[column]),
}));
const protectedMetadataChecks = PROTECTED_METADATA_KEYS.concat(
  Object.keys(baseline.record.metadata ?? {}).filter((key) => key.startsWith('titleAbstract')),
).map((key) => ({
  key,
  unchanged: stable(baseline.record.metadata?.[key]) === stable(after.record.metadata?.[key]),
  presentBefore: key in (baseline.record.metadata ?? {}),
  presentAfter: key in (after.record.metadata ?? {}),
}));
const untouchedMetadataKeys = Object.keys(baseline.record.metadata ?? {});
const allPriorMetadataIdentical = untouchedMetadataKeys.every(
  (key) => stable(baseline.record.metadata?.[key]) === stable(after.record.metadata?.[key]),
);

const finalAudit = {
  generatedAt: new Date().toISOString(),
  apply: true,
  screeningRecordId: RECORD_ID,
  aliasStudyId: ALIAS_STUDY_ID,
  canonicalStudyId: CANONICAL_STUDY_ID,
  preApplyPath: PRE_APPLY_PATH,
  metadataKeyWritten: AUDIT_KEY,
  updateSkippedAsAlreadyApplied: alreadyApplied,
  metadataKeyBefore: baseline.record.metadata?.[AUDIT_KEY] ?? null,
  metadataKeyAfter: appliedValue,
  metadataKeyMatchesIntended: stable(appliedValue) === stable(auditValue),
  metadataKeysBefore: untouchedMetadataKeys.sort(),
  metadataKeysAfter: Object.keys(after.record.metadata ?? {}).sort(),
  allPriorMetadataKeysByteIdentical: allPriorMetadataIdentical,
  protectedColumnChecks,
  protectedMetadataChecks,
  screeningVotesUnchanged: stable(baseline.votes) === stable(after.votes),
  screeningVotesBefore: baseline.votes,
  screeningVotesAfter: after.votes,
  papersWithAssignedStudyIdS5553After: after.aliasPapers,
  zeroPapersForS5553: after.aliasPapers.length === 0,
  canonicalPaperUnchanged: stable(baseline.canonicalPaper) === stable(after.canonicalPaper),
  canonicalPaperStatusBefore: baseline.canonicalPaper.status,
  canonicalPaperStatusAfter: after.canonicalPaper.status,
  canonicalExtractionTabCountBefore: baseline.canonicalExtractions.length,
  canonicalExtractionTabCountAfter: after.canonicalExtractions.length,
  canonicalExtractionFieldCountBefore: baseline.canonicalFieldCount,
  canonicalExtractionFieldCountAfter: after.canonicalFieldCount,
  recordUpdatedAtBefore: baseline.record.updated_at,
  recordUpdatedAtAfter: after.record.updated_at,
  assertionsBeforeWrite: assertions,
};
finalAudit.pass = Boolean(
  finalAudit.metadataKeyMatchesIntended
    && finalAudit.allPriorMetadataKeysByteIdentical
    && finalAudit.protectedColumnChecks.every((item) => item.unchanged)
    && finalAudit.protectedMetadataChecks.every((item) => item.unchanged)
    && finalAudit.screeningVotesUnchanged
    && finalAudit.zeroPapersForS5553
    && finalAudit.canonicalPaperUnchanged
    && finalAudit.canonicalExtractionTabCountBefore === finalAudit.canonicalExtractionTabCountAfter
    && finalAudit.canonicalExtractionFieldCountBefore === finalAudit.canonicalExtractionFieldCountAfter,
);
writeJson(FINAL_AUDIT_PATH, finalAudit);

console.log(JSON.stringify({
  apply: true,
  pass: finalAudit.pass,
  preApplyPath: PRE_APPLY_PATH,
  finalAuditPath: FINAL_AUDIT_PATH,
  metadataKeyWritten: AUDIT_KEY,
  zeroPapersForS5553: finalAudit.zeroPapersForS5553,
  screeningVotesUnchanged: finalAudit.screeningVotesUnchanged,
  canonicalPaperUnchanged: finalAudit.canonicalPaperUnchanged,
}, null, 2));
if (!finalAudit.pass) process.exit(1);
