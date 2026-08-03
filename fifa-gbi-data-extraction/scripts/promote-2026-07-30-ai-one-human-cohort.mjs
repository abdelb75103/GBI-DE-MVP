#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(APP_ROOT, '.env.local');
const OUT_DIR = path.join(
  APP_ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/extraction-gate-audit-2026-07-30',
);
const VERSION = 'full-text-ai-one-human-bridge-2026-07-30-v1';
const CRITERIA_VERSION = 'fifa-gbi-full-text-v8-2026-06-23';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const PROFILE_NAME = 'AbdelRahman Babiker';
const TARGETS = [
  'S683',
  'S2699',
  'S2761',
  'S3931',
  'S4859',
  'S4860',
];
const SYSTEMATIC_REVIEW_ID = 'S2699';
const APPLY = process.argv.includes('--apply');
const snapshotArg = process.argv.find((arg) => arg.startsWith('--snapshot='));
if (!snapshotArg) {
  throw new Error('Usage: node scripts/promote-2026-07-30-ai-one-human-cohort.mjs --snapshot=/absolute/path.json [--apply]');
}
const SNAPSHOT_PATH = path.resolve(snapshotArg.slice('--snapshot='.length));

function loadEnv(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
  return env;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function withoutBridge(metadata) {
  const { extractionBridge20260730: _bridge, ...rest } = metadata ?? {};
  return rest;
}

function protectedScreening(record) {
  return {
    id: record.id,
    stage: record.stage,
    assignedStudyId: record.assigned_study_id,
    aiStatus: record.ai_status,
    aiDecision: record.ai_suggested_decision,
    aiCriteriaVersion: record.ai_criteria_version,
    aiModel: record.ai_model,
    aiRawResponse: record.ai_raw_response,
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
    metadataWithoutBridge: withoutBridge(record.metadata),
    storageBucket: record.storage_bucket,
    storageObjectPath: record.storage_object_path,
    fileSha256: record.file_sha256,
    mimeType: record.mime_type,
    size: record.size,
  };
}

async function query(supabase, table, columns, configure) {
  let request = supabase.from(table).select(columns);
  if (configure) request = configure(request);
  const { data, error } = await request;
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}

async function pagedQuery(supabase, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await query(
      supabase,
      table,
      columns,
      (request) => request.order('id').range(from, from + 999),
    );
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function readRecord(supabase, recordId) {
  const rows = await query(
    supabase,
    'screening_records',
    '*',
    (request) => request.eq('id', recordId),
  );
  if (rows.length !== 1) throw new Error(`Expected one screening row for ${recordId}.`);
  return rows[0];
}

async function readVotes(supabase, recordId) {
  return query(
    supabase,
    'screening_votes',
    '*',
    (request) => request.eq('screening_record_id', recordId).order('id'),
  );
}

function assertVotes(studyId, votes) {
  const reviewerVotes = votes.filter((vote) => vote.vote_role === 'reviewer_vote');
  const includeVotes = reviewerVotes.filter((vote) => vote.decision === 'include');
  const excludeVotes = reviewerVotes.filter((vote) => vote.decision === 'exclude');
  const otherVotes = votes.filter((vote) => vote.vote_role !== 'reviewer_vote');
  if (
    reviewerVotes.length !== 1
    || includeVotes.length !== 1
    || excludeVotes.length !== 0
    || otherVotes.length !== 0
    || includeVotes[0].vote_order !== 1
  ) {
    throw new Error(`${studyId}: relational vote gate changed.`);
  }
}

function assertRecord(studyId, record, snapshotRecord) {
  if (
    record.assigned_study_id !== studyId
    || record.stage !== 'full_text'
    || record.ai_status !== 'completed'
    || record.ai_suggested_decision !== 'include'
    || record.ai_criteria_version !== CRITERIA_VERSION
    || record.manual_decision !== null
    || record.promoted_paper_id !== null
    || record.metadata?.fullTextResolution !== 'pending'
    || record.metadata?.awaitingFullTextPdf !== false
    || !record.storage_bucket
    || !record.storage_object_path
    || !record.file_sha256
  ) {
    throw new Error(`${studyId}: screening gate changed.`);
  }
  if (
    stableHash(protectedScreening(record))
    !== stableHash(protectedScreening(snapshotRecord))
  ) {
    throw new Error(`${studyId}: protected screening state differs from the approved snapshot.`);
  }
}

function buildPaper(record, paperId, now) {
  const status = record.assigned_study_id === SYSTEMATIC_REVIEW_ID
    ? 'systematic_review'
    : 'processing';
  return {
    id: paperId,
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
    status,
    storage_bucket: record.storage_bucket,
    storage_object_path: record.storage_object_path,
    primary_file_sha256: record.file_sha256,
    original_file_name: record.original_file_name ?? record.file_name,
    uploaded_by: record.created_by ?? PROFILE_ID,
    assigned_to: PROFILE_ID,
    uploaded_at: now,
    updated_at: now,
    metadata: {
      ...record.metadata,
      screeningRecordId: record.id,
      screeningStage: record.stage,
      temporaryExtractionPromotion: true,
      temporaryExtractionPromotionVersion: VERSION,
      temporaryExtractionPromotedAt: now,
      temporaryExtractionPromotedBy: PROFILE_ID,
      temporaryExtractionPromotedByName: PROFILE_NAME,
      temporaryExtractionReason:
        'Approved exact-cohort AI include plus one human include; awaiting second human full-text review',
      humanFullTextReviewStillPending: true,
      referenceCheckingOnly: record.assigned_study_id === SYSTEMATIC_REVIEW_ID,
    },
  };
}

function buildFile(record, paperId, fileId, now) {
  return {
    id: fileId,
    paper_id: paperId,
    name: record.file_name ?? `${record.assigned_study_id}.pdf`,
    original_file_name:
      record.original_file_name
      ?? record.file_name
      ?? `${record.assigned_study_id}.pdf`,
    size: record.size ?? 0,
    mime_type: record.mime_type ?? 'application/pdf',
    uploaded_at: now,
    storage_bucket: record.storage_bucket,
    storage_object_path: record.storage_object_path,
    data_base64: record.data_base64,
    public_url: null,
    file_sha256: record.file_sha256,
  };
}

function appendJournal(filePath, payload) {
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

async function assertGlobalDuplicates(supabase, record, allowedPaperId = null) {
  const [papers, files] = await Promise.all([
    pagedQuery(
      supabase,
      'papers',
      'id,assigned_study_id,primary_file_sha256',
    ),
    pagedQuery(
      supabase,
      'paper_files',
      'id,paper_id,file_sha256',
    ),
  ]);
  const duplicatePapers = papers.filter((paper) => (
    paper.id !== allowedPaperId
    && (
      paper.assigned_study_id === record.assigned_study_id
      || (
        record.file_sha256
        && paper.primary_file_sha256 === record.file_sha256
      )
    )
  ));
  const duplicateFiles = files.filter((file) => (
    file.paper_id !== allowedPaperId
    && record.file_sha256
    && file.file_sha256 === record.file_sha256
  ));
  if (duplicatePapers.length || duplicateFiles.length) {
    throw new Error(
      `${record.assigned_study_id}: global duplicate guard failed: `
      + JSON.stringify({ duplicatePapers, duplicateFiles }),
    );
  }
  return {
    papersCount: papers.length,
    filesCount: files.length,
    papersHash: stableHash(papers),
    filesHash: stableHash(files),
  };
}

async function verifyStorage(supabase, record) {
  const { data, error } = await supabase.storage
    .from(record.storage_bucket)
    .download(record.storage_object_path);
  if (error || !data) {
    throw new Error(`${record.assigned_study_id}: storage download failed.`);
  }
  const downloadedSha256 = sha256(Buffer.from(await data.arrayBuffer()));
  if (downloadedSha256 !== record.file_sha256) {
    throw new Error(`${record.assigned_study_id}: storage hash mismatch.`);
  }
  return downloadedSha256;
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  if (
    snapshot.gate?.supported !== false
    || JSON.stringify(snapshot.exactPredicateIds) !== JSON.stringify(TARGETS)
  ) {
    throw new Error('Snapshot does not contain the approved exact six-record scope.');
  }
  const snapshotByStudyId = new Map(
    snapshot.exactLiveSnapshot.screeningRecords
      .filter((record) => TARGETS.includes(record.assigned_study_id))
      .map((record) => [record.assigned_study_id, record]),
  );
  if (snapshotByStudyId.size !== TARGETS.length) {
    throw new Error('Snapshot is missing an approved screening row.');
  }

  const env = loadEnv(ENV_PATH);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables.');
  }
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runSlug = timestampSlug();
  const journalPath = path.join(
    OUT_DIR,
    `bridge-${APPLY ? 'apply' : 'dry-run'}-${runSlug}.ndjson`,
  );
  const auditPath = path.join(
    OUT_DIR,
    `bridge-${APPLY ? 'apply' : 'dry-run'}-${runSlug}.json`,
  );
  const audit = {
    artifactType: 'Versioned exact-cohort AI plus one-human extraction bridge',
    version: VERSION,
    mode: APPLY ? 'apply' : 'dry_run',
    generatedAt: new Date().toISOString(),
    snapshotPath: SNAPSHOT_PATH,
    targets: [],
    passed: false,
    failure: null,
    rollback: {
      screeningAuditMetadata: 'Recoverable from the approved snapshot with exact updated_at guards.',
      insertedRows:
        'Created paper/file rows are recoverable but deletion is destructive and requires explicit approval.',
    },
  };

  try {
    for (const studyId of TARGETS) {
      const snapshotRecord = snapshotByStudyId.get(studyId);
      let record = await readRecord(supabase, snapshotRecord.id);
      const votesBefore = await readVotes(supabase, record.id);
      assertRecord(studyId, record, snapshotRecord);
      assertVotes(studyId, votesBefore);
      const storageSha256 = await verifyStorage(supabase, record);
      const bridge = record.metadata?.extractionBridge20260730 ?? null;
      let paperId = bridge?.paperId ?? crypto.randomUUID();
      let fileId = bridge?.fileId ?? crypto.randomUUID();
      const duplicateBaseline = await assertGlobalDuplicates(
        supabase,
        record,
        bridge?.paperId ?? null,
      );
      const targetAudit = {
        studyId,
        screeningRecordId: record.id,
        protectedBeforeHash: stableHash(protectedScreening(record)),
        votesBeforeHash: stableHash(votesBefore),
        storageSha256,
        duplicateBaseline,
        paperId: APPLY ? paperId : null,
        fileId: APPLY ? fileId : null,
        steps: [],
      };
      audit.targets.push(targetAudit);

      if (!APPLY) {
        targetAudit.steps.push('validated_for_apply');
        continue;
      }

      if (!bridge) {
        const reservedAt = new Date().toISOString();
        const reservation = {
          version: VERSION,
          status: 'reserved',
          reservedAt,
          reservedBy: PROFILE_ID,
          reservedByName: PROFILE_NAME,
          sourceSnapshot: SNAPSHOT_PATH,
          paperId,
          fileId,
          screeningUpdatedAtBeforeReservation: record.updated_at,
        };
        const { data, error } = await supabase
          .from('screening_records')
          .update({
            metadata: {
              ...record.metadata,
              extractionBridge20260730: reservation,
            },
            updated_at: reservedAt,
          })
          .eq('id', record.id)
          .eq('updated_at', record.updated_at)
          .is('manual_decision', null)
          .is('promoted_paper_id', null)
          .select('*');
        if (error || data?.length !== 1) {
          throw new Error(`${studyId}: reservation compare-and-swap failed.`);
        }
        record = data[0];
        targetAudit.steps.push('reservation_written');
        appendJournal(journalPath, {
          at: new Date().toISOString(),
          studyId,
          step: 'reservation_written',
          paperId,
          fileId,
        });
      } else {
        if (
          bridge.version !== VERSION
          || !['reserved', 'completed'].includes(bridge.status)
          || !bridge.paperId
          || !bridge.fileId
        ) {
          throw new Error(`${studyId}: incompatible bridge reservation exists.`);
        }
        paperId = bridge.paperId;
        fileId = bridge.fileId;
        targetAudit.paperId = paperId;
        targetAudit.fileId = fileId;
        targetAudit.steps.push(`resume_${bridge.status}`);
      }

      let paperRows = await query(
        supabase,
        'papers',
        '*',
        (request) => request.eq('id', paperId),
      );
      if (paperRows.length === 0) {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('papers')
          .insert(buildPaper(record, paperId, now))
          .select('*');
        if (error || data?.length !== 1) {
          throw new Error(`${studyId}: paper insert failed: ${error?.message ?? 'guard count'}`);
        }
        paperRows = data;
        targetAudit.steps.push('paper_inserted');
        appendJournal(journalPath, {
          at: new Date().toISOString(),
          studyId,
          step: 'paper_inserted',
          paperId,
        });
      }
      const paper = paperRows[0];
      if (
        paper.assigned_study_id !== studyId
        || paper.primary_file_sha256 !== record.file_sha256
        || paper.metadata?.temporaryExtractionPromotionVersion !== VERSION
        || paper.metadata?.screeningRecordId !== record.id
        || paper.assigned_to !== PROFILE_ID
        || paper.status !== (
          studyId === SYSTEMATIC_REVIEW_ID ? 'systematic_review' : 'processing'
        )
      ) {
        throw new Error(`${studyId}: existing bridge paper does not match the reservation.`);
      }

      let fileRows = await query(
        supabase,
        'paper_files',
        '*',
        (request) => request.eq('paper_id', paperId),
      );
      if (fileRows.length === 0) {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('paper_files')
          .insert(buildFile(record, paperId, fileId, now))
          .select('*');
        if (error || data?.length !== 1) {
          throw new Error(`${studyId}: paper file insert failed: ${error?.message ?? 'guard count'}`);
        }
        fileRows = data;
        targetAudit.steps.push('paper_file_inserted');
        appendJournal(journalPath, {
          at: new Date().toISOString(),
          studyId,
          step: 'paper_file_inserted',
          paperId,
          fileId,
        });
      }
      if (
        fileRows.length !== 1
        || fileRows[0].id !== fileId
        || fileRows[0].file_sha256 !== record.file_sha256
        || fileRows[0].storage_object_path !== record.storage_object_path
      ) {
        throw new Error(`${studyId}: bridge paper file does not match the reservation.`);
      }

      let currentPaper = paper;
      if (paper.primary_file_id === null) {
        const updatedAt = new Date().toISOString();
        const { data, error } = await supabase
          .from('papers')
          .update({
            primary_file_id: fileId,
            updated_at: updatedAt,
          })
          .eq('id', paperId)
          .eq('updated_at', paper.updated_at)
          .is('primary_file_id', null)
          .select('*');
        if (error || data?.length !== 1) {
          throw new Error(`${studyId}: primary-file compare-and-swap failed.`);
        }
        [currentPaper] = data;
        targetAudit.steps.push('primary_file_linked');
        appendJournal(journalPath, {
          at: new Date().toISOString(),
          studyId,
          step: 'primary_file_linked',
          paperId,
          fileId,
        });
      }
      if (currentPaper.primary_file_id !== fileId) {
        throw new Error(`${studyId}: paper primary file is not the reserved file.`);
      }

      record = await readRecord(supabase, record.id);
      const currentBridge = record.metadata?.extractionBridge20260730;
      if (currentBridge?.status !== 'completed') {
        const completedAt = new Date().toISOString();
        const completedBridge = {
          ...currentBridge,
          status: 'completed',
          completedAt,
          paperId,
          fileId,
        };
        const { data, error } = await supabase
          .from('screening_records')
          .update({
            metadata: {
              ...record.metadata,
              extractionBridge20260730: completedBridge,
            },
            updated_at: completedAt,
          })
          .eq('id', record.id)
          .eq('updated_at', record.updated_at)
          .is('manual_decision', null)
          .is('promoted_paper_id', null)
          .select('*');
        if (error || data?.length !== 1) {
          throw new Error(`${studyId}: completion compare-and-swap failed.`);
        }
        record = data[0];
        targetAudit.steps.push('reservation_completed');
        appendJournal(journalPath, {
          at: new Date().toISOString(),
          studyId,
          step: 'reservation_completed',
          paperId,
          fileId,
        });
      }

      const votesAfter = await readVotes(supabase, record.id);
      assertRecord(studyId, record, snapshotRecord);
      assertVotes(studyId, votesAfter);
      if (stableHash(votesAfter) !== stableHash(votesBefore)) {
        throw new Error(`${studyId}: relational votes changed during promotion.`);
      }
      const completedBridge = record.metadata?.extractionBridge20260730;
      if (
        completedBridge?.version !== VERSION
        || completedBridge?.status !== 'completed'
        || completedBridge?.paperId !== paperId
        || completedBridge?.fileId !== fileId
      ) {
        throw new Error(`${studyId}: completed bridge audit is invalid.`);
      }
      targetAudit.protectedAfterHash = stableHash(protectedScreening(record));
      targetAudit.votesAfterHash = stableHash(votesAfter);
      targetAudit.steps.push('verified');
    }
    audit.passed = true;
  } catch (error) {
    audit.failure = error instanceof Error ? error.stack : String(error);
  }

  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({
    auditPath,
    journalPath,
    mode: audit.mode,
    passed: audit.passed,
    targets: audit.targets.map((target) => ({
      studyId: target.studyId,
      paperId: target.paperId,
      fileId: target.fileId,
      steps: target.steps,
    })),
    failure: audit.failure,
  }, null, 2));
  if (!audit.passed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
