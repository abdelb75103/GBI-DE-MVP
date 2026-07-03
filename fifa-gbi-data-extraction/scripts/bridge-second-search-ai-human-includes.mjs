import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const PROFILE_NAME = 'AbdelRahman Babiker';
const SECOND_LABEL = 'Second search - Ishanka - 2026-05-26';
const ROOT = path.resolve(import.meta.dirname, '..');
const AUDIT_DIR = path.join(
  ROOT,
  'data/full-text-pdf-retrieval/temporary-extraction-promotion-2026-07-03',
);

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 10);
const explicitStudyIds = new Set(
  (process.argv.find((arg) => arg.startsWith('--study-ids='))?.split('=')[1] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const auditFileName = explicitStudyIds.size
  ? `second-search-full-text-ai-human-include-temporary-extraction-${[...explicitStudyIds].join('-').toLowerCase()}-${APPLY ? 'live-apply' : 'dry-run'}-audit-2026-07-03.json`
  : `second-search-full-text-ai-human-include-temporary-extraction-first-${LIMIT}-${APPLY ? 'live-apply' : 'dry-run'}-audit-2026-07-03.json`;
const AUDIT_PATH = path.join(AUDIT_DIR, auditFileName);

const loadEnv = () => {
  const envPath = path.join(ROOT, '.env.local');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

const sidNumber = (sid) => Number(String(sid ?? '').replace(/\D+/g, '')) || Number.MAX_SAFE_INTEGER;
const isSecondSearch = (metadata) =>
  metadata?.searchBatch === 'second' || String(metadata?.searchBatchLabel ?? '').includes(SECOND_LABEL);

const fullTextDecisions = (record) =>
  Array.isArray(record.metadata?.fullTextDecisions)
    ? record.metadata.fullTextDecisions.filter((decision) =>
        decision &&
        ['include', 'exclude'].includes(decision.decision) &&
        decision.reviewerProfileId &&
        decision.decidedAt)
    : [];

const hasAttachedFile = (record) => Boolean(record.storage_object_path || record.data_base64);
const protectedScreeningSnapshot = (record) => ({
  aiStatus: record.ai_status,
  aiSuggestedDecision: record.ai_suggested_decision,
  aiReason: record.ai_reason,
  aiEvidenceQuote: record.ai_evidence_quote,
  aiSourceLocation: record.ai_source_location,
  aiConfidence: record.ai_confidence,
  aiModel: record.ai_model,
  aiCriteriaVersion: record.ai_criteria_version,
  aiRawResponse: record.ai_raw_response,
  aiError: record.ai_error,
  aiReviewedAt: record.ai_reviewed_at,
  manualDecision: record.manual_decision,
  manualReason: record.manual_reason,
  manualDecidedBy: record.manual_decided_by,
  manualDecidedAt: record.manual_decided_at,
  promotedPaperId: record.promoted_paper_id,
  promotedBy: record.promoted_by,
  promotedAt: record.promoted_at,
  titleAbstractDecisions: record.metadata?.titleAbstractDecisions ?? null,
  fullTextDecisions: record.metadata?.fullTextDecisions ?? null,
  fullTextDecisionAudit: record.metadata?.fullTextDecisionAudit ?? null,
  fullTextResolution: record.metadata?.fullTextResolution ?? null,
});

const buildPaperPayload = (record, now) => ({
  id: crypto.randomUUID(),
  assigned_study_id: record.assigned_study_id,
  title: record.title,
  extracted_title: record.title,
  lead_author: record.lead_author,
  journal: record.journal,
  year: record.year,
  doi: record.doi,
  normalized_doi: record.normalized_doi ?? record.metadata?.normalizedDoi ?? null,
  duplicate_key_v2: record.metadata?.duplicateKeyV2 ?? null,
  title_fingerprint: record.metadata?.titleFingerprint ?? null,
  dedupe_review_status: 'clean',
  status: 'processing',
  storage_bucket: record.storage_bucket ?? 'papers',
  storage_object_path: record.storage_object_path,
  primary_file_sha256: record.file_sha256,
  original_file_name: record.original_file_name ?? record.file_name,
  uploaded_by: record.created_by ?? PROFILE_ID,
  assigned_to: PROFILE_ID,
  uploaded_at: now,
  updated_at: now,
  metadata: {
    ...record.metadata,
    searchBatch: 'second',
    searchBatchLabel: record.metadata?.searchBatchLabel ?? SECOND_LABEL,
    screeningRecordId: record.id,
    screeningStage: record.stage,
    temporaryExtractionPromotion: true,
    temporaryExtractionPromotedAt: now,
    temporaryExtractionPromotedBy: PROFILE_ID,
    temporaryExtractionPromotedByName: PROFILE_NAME,
    temporaryExtractionReason: 'AI include plus one human include; awaiting second human full-text review',
  },
});

const buildFilePayload = (record, paperId, now) => ({
  id: crypto.randomUUID(),
  paper_id: paperId,
  name: record.file_name ?? `${record.assigned_study_id}.pdf`,
  original_file_name: record.original_file_name ?? record.file_name ?? `${record.assigned_study_id}.pdf`,
  size: record.size ?? 0,
  mime_type: record.mime_type ?? 'application/pdf',
  uploaded_at: now,
  storage_bucket: record.storage_bucket ?? 'papers',
  storage_object_path: record.storage_object_path,
  data_base64: record.data_base64,
  public_url: null,
  file_sha256: record.file_sha256,
});

loadEnv();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars.');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: records, error: recordError } = await supabase
  .from('screening_records')
  .select([
    'id',
    'stage',
    'assigned_study_id',
    'title',
    'lead_author',
    'journal',
    'year',
    'doi',
    'normalized_doi',
    'storage_bucket',
    'storage_object_path',
    'data_base64',
    'file_name',
    'original_file_name',
    'mime_type',
    'size',
    'file_sha256',
    'created_by',
    'ai_status',
    'ai_suggested_decision',
    'ai_reason',
    'ai_evidence_quote',
    'ai_source_location',
    'ai_confidence',
    'ai_model',
    'ai_criteria_version',
    'ai_raw_response',
    'ai_error',
    'ai_reviewed_at',
    'manual_decision',
    'manual_reason',
    'manual_decided_by',
    'manual_decided_at',
    'promoted_paper_id',
    'promoted_by',
    'promoted_at',
    'metadata',
  ].join(','))
  .eq('stage', 'full_text')
  .eq('ai_status', 'completed')
  .eq('ai_suggested_decision', 'include')
  .is('manual_decision', null)
  .is('promoted_paper_id', null);

if (recordError) throw recordError;

const { data: papers, error: paperError } = await supabase
  .from('papers')
  .select('id, assigned_study_id, primary_file_sha256');
if (paperError) throw paperError;

const existingStudyIds = new Set((papers ?? []).map((paper) => paper.assigned_study_id));
const existingHashes = new Set((papers ?? []).map((paper) => paper.primary_file_sha256).filter(Boolean));

const selected = [];
const skipped = [];

for (const record of [...(records ?? [])].sort((a, b) => sidNumber(a.assigned_study_id) - sidNumber(b.assigned_study_id))) {
  if (explicitStudyIds.size && !explicitStudyIds.has(record.assigned_study_id)) {
    continue;
  }
  const decisions = fullTextDecisions(record);
  const includeVotes = decisions.filter((decision) => decision.decision === 'include').length;
  const excludeVotes = decisions.filter((decision) => decision.decision === 'exclude').length;
  const reasons = [];

  if (!isSecondSearch(record.metadata)) reasons.push('not_second_search');
  if (!hasAttachedFile(record)) reasons.push('missing_attached_file');
  if (includeVotes !== 1) reasons.push(`include_vote_count_${includeVotes}`);
  if (excludeVotes !== 0) reasons.push(`exclude_vote_count_${excludeVotes}`);
  if (existingStudyIds.has(record.assigned_study_id)) reasons.push('paper_study_id_exists');
  if (record.file_sha256 && existingHashes.has(record.file_sha256)) reasons.push('paper_file_hash_exists');

  if (reasons.length) {
    skipped.push({ studyId: record.assigned_study_id, reasons });
    continue;
  }

  selected.push({
    record,
    decisions,
    before: protectedScreeningSnapshot(record),
  });
  if (selected.length >= LIMIT && !explicitStudyIds.size) break;
}

const audit = {
  scope: 'Second search temporary extraction bridge for AI include plus one human include',
  mode: APPLY ? 'apply' : 'dry-run',
  generatedAt: new Date().toISOString(),
  selectionRule: {
    searchBatch: SECOND_LABEL,
    aiStatus: 'completed',
    aiSuggestedDecision: 'include',
    humanIncludeVotes: 1,
    humanExcludeVotes: 0,
    manualDecision: null,
    promotedPaperId: null,
    hasAttachedFile: true,
    limit: LIMIT,
  },
  selected: [],
  skippedBeforeLimit: skipped,
  protectedScreeningFieldsChanged: false,
};

for (const item of selected) {
  const now = new Date().toISOString();
  const paperPayload = buildPaperPayload(item.record, now);
  const filePayload = buildFilePayload(item.record, paperPayload.id, now);
  const entry = {
    studyId: item.record.assigned_study_id,
    screeningRecordId: item.record.id,
    title: item.record.title,
    aiModel: item.record.ai_model,
    aiCriteriaVersion: item.record.ai_criteria_version,
    fileSha256: item.record.file_sha256,
    storageBucket: item.record.storage_bucket,
    storageObjectPath: item.record.storage_object_path,
    before: item.before,
    humanDecisions: item.decisions,
    createdPaperId: APPLY ? paperPayload.id : null,
    createdFileId: APPLY ? filePayload.id : null,
    applied: false,
  };

  if (APPLY) {
    let paperInserted = false;
    let fileInserted = false;
    try {
      const { error: insertPaperError } = await supabase.from('papers').insert(paperPayload);
      if (insertPaperError) throw new Error(`${item.record.assigned_study_id}: failed to create paper: ${insertPaperError.message}`);
      paperInserted = true;

      const { error: insertFileError } = await supabase.from('paper_files').insert(filePayload);
      if (insertFileError) throw new Error(`${item.record.assigned_study_id}: failed to attach file: ${insertFileError.message}`);
      fileInserted = true;

      const { error: updatePaperError } = await supabase
        .from('papers')
        .update({
          primary_file_id: filePayload.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paperPayload.id);
      if (updatePaperError) throw new Error(`${item.record.assigned_study_id}: failed to set primary file: ${updatePaperError.message}`);
    } catch (applyError) {
      const cleanupErrors = [];
      if (fileInserted) {
        const { error } = await supabase.from('paper_files').delete().eq('id', filePayload.id);
        if (error) cleanupErrors.push(error);
      }
      if (paperInserted) {
        const { error } = await supabase.from('papers').delete().eq('id', paperPayload.id);
        if (error) cleanupErrors.push(error);
      }
      if (cleanupErrors.length) {
        throw new AggregateError([applyError, ...cleanupErrors], `${item.record.assigned_study_id}: bridge apply and cleanup failed`);
      }
      throw applyError;
    }

    const { data: after, error: afterError } = await supabase
      .from('screening_records')
      .select([
        'ai_status',
        'ai_suggested_decision',
        'ai_reason',
        'ai_evidence_quote',
        'ai_source_location',
        'ai_confidence',
        'ai_model',
        'ai_criteria_version',
        'ai_raw_response',
        'ai_error',
        'ai_reviewed_at',
        'manual_decision',
        'manual_reason',
        'manual_decided_by',
        'manual_decided_at',
        'promoted_paper_id',
        'promoted_by',
        'promoted_at',
        'metadata',
      ].join(','))
      .eq('id', item.record.id)
      .single();
    if (afterError) throw afterError;

    entry.after = protectedScreeningSnapshot(after);
    entry.applied = true;
    audit.protectedScreeningFieldsChanged ||= JSON.stringify(entry.before) !== JSON.stringify(entry.after);
  }

  audit.selected.push(entry);
}

fs.mkdirSync(AUDIT_DIR, { recursive: true });
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

console.log(`${APPLY ? 'applied' : 'dry-run'} selected=${audit.selected.length} audit=${AUDIT_PATH}`);
console.log(audit.selected.map((item) => item.studyId).join(', '));
if (audit.protectedScreeningFieldsChanged) {
  throw new Error('Protected screening fields changed.');
}
