#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = process.cwd();
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const DEFAULT_ENV_PATH = path.join(APP_ROOT, '.env.local');
const DEFAULT_MAPPING_PATH = path.join(
  REPO_ROOT,
  'outputs/title-abstract-promotion-repair-2026-07-30/apply-result.json',
);
const DEFAULT_OUT_DIR = path.join(
  APP_ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30',
);
const FULL_TEXT_AI_APPLY_MODULE =
  '/Users/abdelbabiker/.codex/skills/fifa-full-text-screening-review/scripts/apply_recommendations_to_supabase.mjs';
const AWAITING_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');
const EXPECTED_CRITERIA_VERSION = 'fifa-gbi-full-text-v8-2026-06-23';
const ATTACHED_BY = 'codex:promoted-title-abstract-2026-07-30';
const STUDY_IDS = [
  'S683',
  'S845',
  'S907',
  'S925',
  'S1148',
  'S1503',
  'S1521',
  'S1564',
  'S1582',
  'S1666',
  'S1795',
  'S2699',
  'S2761',
  'S3098',
  'S3493',
  'S3592',
  'S3661',
  'S3713',
  'S3776',
  'S3931',
  'S4023',
  'S4111',
  'S4724',
  'S4859',
  'S4860',
  'S4987',
  'S5148',
];
const AI_FIELDS = [
  'ai_status',
  'ai_suggested_decision',
  'ai_reason',
  'ai_evidence_quote',
  'ai_source_location',
  'ai_confidence',
  'ai_model',
  'ai_criteria_version',
  'ai_raw_response',
  'ai_reviewed_at',
  'ai_error',
];
const HUMAN_FIELDS = [
  'manual_decision',
  'manual_reason',
  'manual_decided_by',
  'manual_decided_at',
  'promoted_paper_id',
  'promoted_by',
  'promoted_at',
  'notes',
];
const IDENTITY_FIELDS = [
  'id',
  'stage',
  'assigned_study_id',
  'title',
  'lead_author',
  'year',
  'journal',
  'doi',
  'normalized_doi',
  'source',
];

function parseArgs(argv) {
  const [command, ...rest] = argv.slice(2);
  const args = { command };
  for (const token of rest) {
    const match = token.match(/^--([^=]+)=(.*)$/s);
    if (match) args[match[1]] = match[2];
    else if (token.startsWith('--')) args[token.slice(2)] = true;
    else throw new Error(`Unexpected argument: ${token}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveUploadResultArg(args) {
  return args.uploadResult ?? args['upload-result'];
}

function writeJsonNew(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
}

function appendJournal(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function pendingStorageUploadsFromEntries(entries) {
  const pending = new Map();
  for (const entry of entries) {
    if (
      ['storage_upload_planned', 'storage_uploaded_pending_row_update'].includes(entry?.status)
    ) {
      if (!entry.recordId || !entry.studyId || !entry.objectPath || !entry.sha256) {
        throw new Error('Upload journal contains an incomplete pending-storage entry.');
      }
      pending.set(entry.recordId, entry);
      continue;
    }
    if (
      ['uploaded_verified', 'already_uploaded_same_hash'].includes(entry?.status)
      && entry?.recordId
    ) {
      pending.delete(entry.recordId);
    }
  }
  return pending;
}

function readUploadJournal(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Resume journal does not exist: ${filePath}`);
  }
  const entries = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Resume journal has invalid JSON on line ${index + 1}.`);
      }
    });
  return {
    entries,
    pendingStorageUploads: pendingStorageUploadsFromEntries(entries),
  };
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

function stableHash(value) {
  return sha256(Buffer.from(JSON.stringify(sorted(value))));
}

function timestampsEqual(left, right) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function aiFieldsMatch(actual, expected, { ignoreReviewedAt = false } = {}) {
  return AI_FIELDS.every((field) => {
    if (field === 'ai_reviewed_at') {
      if (ignoreReviewedAt) return Number.isFinite(Date.parse(actual[field]));
      return timestampsEqual(actual[field], expected[field]);
    }
    return stableHash(actual[field] ?? null) === stableHash(expected[field] ?? null);
  });
}

function pick(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row?.[field] ?? null]));
}

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

function createSupabase(envPath) {
  const env = loadEnv(envPath);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function loadTargetMapping(mappingPath) {
  const payload = readJson(mappingPath);
  const rows = payload.applied ?? [];
  const mapping = rows.map((row) => ({
    studyId: row.assignedStudyId,
    recordId: row.fullTextRecordId,
    sourceRecordId: row.sourceRecordId,
    sourceDecisionHash: row.sourceDecisionHash,
  }));
  const actualStudyIds = mapping.map((row) => row.studyId).sort();
  const expectedStudyIds = [...STUDY_IDS].sort();
  if (
    payload.completed !== true
    || payload.failure
    || mapping.length !== STUDY_IDS.length
    || JSON.stringify(actualStudyIds) !== JSON.stringify(expectedStudyIds)
  ) {
    throw new Error('Authoritative promotion mapping does not contain the exact completed 27-record scope.');
  }
  if (new Set(mapping.map((row) => row.recordId)).size !== STUDY_IDS.length) {
    throw new Error('Authoritative promotion mapping contains duplicate full-text UUIDs.');
  }
  return mapping;
}

async function pagedSelect(supabase, table, columns, configure = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const query = configure(supabase.from(table).select(columns)).range(from, from + 999);
    const { data, error } = await query;
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function isAwaiting(record) {
  return (
    record.metadata?.awaitingFullTextPdf === true
    && !record.storage_object_path
    && !record.file_sha256
    && record.data_base64 === AWAITING_SENTINEL
  );
}

function assertExactTargetRows(rows, mapping, { requireAwaiting = false } = {}) {
  if (rows.length !== mapping.length) {
    throw new Error(`Expected ${mapping.length} target rows, found ${rows.length}.`);
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const target of mapping) {
    const row = byId.get(target.recordId);
    if (!row) throw new Error(`${target.studyId}: mapped record ${target.recordId} is missing.`);
    if (row.assigned_study_id !== target.studyId || row.stage !== 'full_text') {
      throw new Error(`${target.studyId}: UUID identity or stage mismatch.`);
    }
    if (requireAwaiting && !isAwaiting(row)) {
      throw new Error(`${target.studyId}: mapped record is not the expected awaiting-PDF placeholder.`);
    }
  }
}

async function readTargetRows(supabase, mapping) {
  const ids = mapping.map((row) => row.recordId);
  const { data, error } = await supabase
    .from('screening_records')
    .select('*')
    .in('id', ids)
    .order('assigned_study_id');
  if (error) throw new Error(`Target screening read failed: ${error.message}`);
  return data ?? [];
}

async function readTargetVotes(supabase, mapping) {
  const ids = mapping.map((row) => row.recordId);
  const { data, error } = await supabase
    .from('screening_votes')
    .select('*')
    .in('screening_record_id', ids)
    .order('screening_record_id')
    .order('decided_at');
  if (error) throw new Error(`Target screening vote read failed: ${error.message}`);
  return data ?? [];
}

async function snapshot(args, supabase, mapping, outDir) {
  const targets = await readTargetRows(supabase, mapping);
  const allowMixedState = args['allow-mixed-state'] === true;
  assertExactTargetRows(targets, mapping, { requireAwaiting: !allowMixedState });
  const [
    targetVotes,
    allScreeningStamps,
    allScreeningVotes,
    allPaperStamps,
  ] = await Promise.all([
    readTargetVotes(supabase, mapping),
    pagedSelect(
      supabase,
      'screening_records',
      'id,assigned_study_id,stage,updated_at',
      (query) => query.order('id'),
    ),
    pagedSelect(supabase, 'screening_votes', '*', (query) => query.order('id')),
    pagedSelect(
      supabase,
      'papers',
      'id,assigned_study_id,updated_at',
      (query) => query.order('id'),
    ),
  ]);
  const payload = {
    scope: allowMixedState
      ? 'Exact 27 promoted full-text records, mixed-state pre-write rollback snapshot'
      : 'Exact 27 newly promoted full-text placeholders, pre-write rollback snapshot',
    generatedAt: new Date().toISOString(),
    mappingPath: path.resolve(args.mapping ?? DEFAULT_MAPPING_PATH),
    studyIds: STUDY_IDS,
    mapping,
    targetRows: targets,
    targetVotes,
    globalBaselines: {
      screeningRecordStamps: allScreeningStamps,
      screeningVotesHash: stableHash(allScreeningVotes),
      screeningVoteCount: allScreeningVotes.length,
      paperStamps: allPaperStamps,
    },
    rollback: {
      rowRestore:
        'Restore each target row from targetRows only after guarding against the exact post-apply updated_at values. The snapshot is the recoverable source.',
      storage:
        'Uploads use new unique paths with upsert false. Removing orphaned or rolled-back storage objects is destructive and is not automatic.',
    },
  };
  const snapshotPath = path.join(outDir, `pre-write-snapshot-${timestampSlug()}.json`);
  writeJsonNew(snapshotPath, payload);

  const queue = mapping.map((target) => {
    const row = targets.find((candidate) => candidate.id === target.recordId);
    return {
      studyId: target.studyId,
      recordId: target.recordId,
      sourceRecordId: target.sourceRecordId,
      title: row.title,
      leadAuthor: row.lead_author,
      year: row.year,
      journal: row.journal,
      doi: row.doi,
      normalizedDoi: row.normalized_doi,
      retrievalStatus: 'pending',
      sourceUrl: null,
      localPath: null,
      validation: null,
      uploadStatus: 'pending',
      uploadHash: null,
      aiStatus: 'pending',
      aiDecision: null,
      aiReason: null,
      aiCriteria: null,
      aiModel: null,
      error: null,
      manualNextStep: null,
    };
  });
  const queuePath = path.join(outDir, `retrieval-queue-${timestampSlug()}.json`);
  writeJsonNew(queuePath, {
    scope: 'Exact 27 newly promoted full-text records, retrieval queue',
    generatedAt: new Date().toISOString(),
    snapshotPath,
    records: queue,
  });
  console.log(JSON.stringify({ snapshotPath, queuePath, targets: targets.length }, null, 2));
}

function validateManifest(manifest, mapping) {
  const rows = manifest.records ?? manifest;
  if (!Array.isArray(rows) || rows.length !== mapping.length) {
    throw new Error(`Upload manifest must contain exactly ${mapping.length} rows.`);
  }
  const expectedByStudy = new Map(mapping.map((row) => [row.studyId, row]));
  const seen = new Set();
  for (const row of rows) {
    const target = expectedByStudy.get(row.studyId);
    if (!target || target.recordId !== row.recordId || seen.has(row.studyId)) {
      throw new Error(`Manifest contains an invalid or duplicate target: ${row.studyId ?? 'missing study ID'}.`);
    }
    seen.add(row.studyId);
    if (row.retrievalStatus === 'accepted') validateAcceptedCandidate(row);
  }
  return rows;
}

function validateAcceptedCandidate(item) {
  if (!item.localPath || !path.isAbsolute(item.localPath)) {
    throw new Error(`${item.studyId}: accepted candidate needs an absolute localPath.`);
  }
  if (!item.sourceUrl) throw new Error(`${item.studyId}: accepted candidate needs a source URL.`);
  const validation = item.validation ?? {};
  if (
    validation.pdfSignature !== true
    || validation.identityVerified !== true
    || validation.legalAccess !== true
    || !Array.isArray(validation.identityEvidence)
    || validation.identityEvidence.length === 0
  ) {
    throw new Error(`${item.studyId}: accepted candidate is missing PDF, identity, legal-access, or evidence validation.`);
  }
  if (![
    'full_paper',
    'conference_abstract',
    'supplement_abstract',
    'letter',
    'editorial',
    'protocol',
    'case_report',
  ].includes(validation.documentType)) {
    throw new Error(`${item.studyId}: accepted candidate has an unsupported documentType.`);
  }
  if (
    item.studyId === 'S1795'
    && !(validation.titleMatch === true && validation.authorMatch === true && validation.contentMatch === true)
  ) {
    throw new Error('S1795 requires title, author, and content evidence; DOI evidence is insufficient.');
  }
}

function inspectLocalPdf(item) {
  const buffer = fs.readFileSync(item.localPath);
  if (buffer.length < 1000 || !buffer.subarray(0, 2048).includes(Buffer.from('%PDF'))) {
    throw new Error(`${item.studyId}: local candidate is not a real PDF.`);
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8');
  if (/<!doctype html|<html[\s>]/i.test(head)) {
    throw new Error(`${item.studyId}: local candidate contains HTML rather than PDF content.`);
  }
  const info = spawnSync('pdfinfo', [item.localPath], { encoding: 'utf8', timeout: 15000 });
  if (info.status !== 0) throw new Error(`${item.studyId}: pdfinfo rejected the candidate.`);
  const pages = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  if (!Number.isFinite(pages) || pages < 1) throw new Error(`${item.studyId}: PDF has no readable page count.`);
  return { buffer, sha256: sha256(buffer), size: buffer.length, pages };
}

function assertIdentityUnchanged(before, current, studyId) {
  const expected = pick(before, IDENTITY_FIELDS);
  const actual = pick(current, IDENTITY_FIELDS);
  if (stableHash(expected) !== stableHash(actual)) {
    throw new Error(`${studyId}: copied bibliographic identity changed since the pre-write snapshot.`);
  }
}

function classifyUploadRowState(before, current, item, expectedHash) {
  assertIdentityUnchanged(before, current, item.studyId);
  if (
    current.file_sha256 === expectedHash
    && current.storage_bucket
    && current.storage_object_path
    && current.metadata?.awaitingFullTextPdf === false
  ) {
    if (current.metadata?.fullTextPdfAttachedBy !== ATTACHED_BY) {
      throw new Error(`${item.studyId}: same-hash attachment was not created by this guarded workflow.`);
    }
    return 'already_uploaded_same_hash';
  }
  if (isAwaiting(current) && current.updated_at === before.updated_at) {
    return 'awaiting_upload';
  }
  throw new Error(`${item.studyId}: refusing to overwrite a non-placeholder or changed record.`);
}

async function downloadVerifiedStorageObject(supabase, bucket, objectPath, expectedHash, studyId) {
  const { data: downloaded, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !downloaded) {
    throw new Error(`${studyId}: storage object could not be downloaded for hash verification.`);
  }
  const buffer = Buffer.from(await downloaded.arrayBuffer());
  if (sha256(buffer) !== expectedHash) {
    throw new Error(`${studyId}: storage object hash does not match the accepted local PDF.`);
  }
  return buffer;
}

async function ensureJournalledStorageObject(supabase, pending, local, studyId) {
  const storage = supabase.storage.from('papers');
  const existing = await storage.download(pending.objectPath);
  if (!existing.error && existing.data) {
    const buffer = Buffer.from(await existing.data.arrayBuffer());
    if (sha256(buffer) !== local.sha256) {
      throw new Error(`${studyId}: journalled storage object has an unexpected hash.`);
    }
    return { objectPath: pending.objectPath, reusedExistingObject: true };
  }
  if (pending.status === 'storage_uploaded_pending_row_update') {
    throw new Error(`${studyId}: journal says storage upload completed, but its object is unreadable.`);
  }

  const { error: uploadError } = await storage.upload(pending.objectPath, local.buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) {
    try {
      await downloadVerifiedStorageObject(
        supabase,
        'papers',
        pending.objectPath,
        local.sha256,
        studyId,
      );
      return {
        objectPath: pending.objectPath,
        reusedExistingObject: true,
        confirmedAfterAmbiguousUploadResponse: true,
      };
    } catch {
      throw new Error(`${studyId}: storage upload failed: ${uploadError.message}`);
    }
  }
  await downloadVerifiedStorageObject(
    supabase,
    'papers',
    pending.objectPath,
    local.sha256,
    studyId,
  );
  return { objectPath: pending.objectPath, reusedExistingObject: false };
}

async function upload(args, supabase, mapping, outDir) {
  if (!args.manifest || !args.snapshot) {
    throw new Error('upload requires --manifest and --snapshot.');
  }
  const manifest = readJson(path.resolve(args.manifest));
  const items = validateManifest(manifest, mapping);
  const pre = readJson(path.resolve(args.snapshot));
  const beforeById = new Map(pre.targetRows.map((row) => [row.id, row]));
  const currentTargets = await readTargetRows(supabase, mapping);
  assertExactTargetRows(currentTargets, mapping);
  const currentById = new Map(currentTargets.map((row) => [row.id, row]));
  const acceptedHashes = new Map();

  for (const item of items) {
    const before = beforeById.get(item.recordId);
    const current = currentById.get(item.recordId);
    if (!before || !current) throw new Error(`${item.studyId}: missing preflight row.`);
    assertIdentityUnchanged(before, current, item.studyId);
    if (item.retrievalStatus !== 'accepted') {
      if (!isAwaiting(current) || current.updated_at !== before.updated_at) {
        throw new Error(`${item.studyId}: unresolved placeholder changed after the pre-write snapshot.`);
      }
      continue;
    }
    const local = inspectLocalPdf(item);
    if (item.sha256 && item.sha256 !== local.sha256) {
      throw new Error(`${item.studyId}: manifest hash does not match the local PDF.`);
    }
    const rowState = classifyUploadRowState(before, current, item, local.sha256);
    const sameRunStudyId = acceptedHashes.get(local.sha256);
    if (sameRunStudyId && item.validation?.allowDuplicateHash !== true) {
      throw new Error(`${item.studyId}: PDF hash duplicates ${sameRunStudyId} in this upload run.`);
    }
    acceptedHashes.set(local.sha256, item.studyId);
    if (rowState === 'already_uploaded_same_hash') continue;
    const duplicateRows = await pagedSelect(
      supabase,
      'screening_records',
      'id,assigned_study_id,file_sha256',
      (query) => query.eq('file_sha256', local.sha256),
    );
    const { data: duplicatePapers, error: duplicatePaperError } = await supabase
      .from('papers')
      .select('id,assigned_study_id,primary_file_sha256')
      .eq('primary_file_sha256', local.sha256);
    if (duplicatePaperError) throw new Error(`Duplicate paper-hash check failed: ${duplicatePaperError.message}`);
    const duplicates = [
      ...duplicateRows.map((row) => `screening:${row.assigned_study_id}:${row.id}`),
      ...(duplicatePapers ?? []).map((row) => `paper:${row.assigned_study_id}:${row.id}`),
    ];
    if (duplicates.length && item.validation?.allowDuplicateHash !== true) {
      throw new Error(`${item.studyId}: PDF hash already exists at ${duplicates.join(', ')}.`);
    }
    if (
      duplicates.length
      && (!item.validation?.duplicateHashReason || !item.validation?.identityEvidence?.length)
    ) {
      throw new Error(`${item.studyId}: allowed duplicate hash requires an explicit reason and identity evidence.`);
    }
  }

  const journalPath = args['resume-journal']
    ? path.resolve(args['resume-journal'])
    : path.join(outDir, `upload-journal-${timestampSlug()}.ndjson`);
  const pendingStorageUploads = args['resume-journal']
    ? readUploadJournal(journalPath).pendingStorageUploads
    : new Map();
  appendJournal(journalPath, {
    at: new Date().toISOString(),
    status: args['resume-journal'] ? 'upload_resume_started' : 'upload_run_started',
    snapshotPath: path.resolve(args.snapshot),
    manifestPath: path.resolve(args.manifest),
  });
  console.log(JSON.stringify({
    journalPath,
    resumeJournal: Boolean(args['resume-journal']),
    pendingStorageObjects: pendingStorageUploads.size,
  }, null, 2));
  const results = [];

  for (const item of items) {
    if (item.retrievalStatus !== 'accepted') {
      const skipped = {
        studyId: item.studyId,
        recordId: item.recordId,
        status: 'unresolved',
        reason: item.error ?? item.manualNextStep ?? 'No accepted candidate.',
      };
      results.push(skipped);
      appendJournal(journalPath, { at: new Date().toISOString(), ...skipped });
      continue;
    }

    const before = beforeById.get(item.recordId);
    if (!before) throw new Error(`${item.studyId}: missing pre-write snapshot row.`);
    const [current] = await readTargetRows(supabase, [mapping.find((row) => row.recordId === item.recordId)]);
    assertIdentityUnchanged(before, current, item.studyId);
    const local = inspectLocalPdf(item);
    if (item.sha256 && item.sha256 !== local.sha256) {
      throw new Error(`${item.studyId}: manifest hash does not match the local PDF.`);
    }
    const rowState = classifyUploadRowState(before, current, item, local.sha256);
    if (rowState === 'already_uploaded_same_hash') {
      await downloadVerifiedStorageObject(
        supabase,
        current.storage_bucket,
        current.storage_object_path,
        local.sha256,
        item.studyId,
      );
      const already = {
        studyId: item.studyId,
        recordId: item.recordId,
        status: 'already_uploaded_same_hash',
        objectPath: current.storage_object_path,
        sha256: local.sha256,
      };
      results.push(already);
      appendJournal(journalPath, { at: new Date().toISOString(), ...already });
      continue;
    }

    const duplicateRows = await pagedSelect(
      supabase,
      'screening_records',
      'id,assigned_study_id,file_sha256',
      (query) => query.eq('file_sha256', local.sha256),
    );
    const { data: duplicatePapers, error: duplicatePaperError } = await supabase
      .from('papers')
      .select('id,assigned_study_id,primary_file_sha256')
      .eq('primary_file_sha256', local.sha256);
    if (duplicatePaperError) throw new Error(`Duplicate paper-hash check failed: ${duplicatePaperError.message}`);
    const duplicates = [
      ...duplicateRows.map((row) => `screening:${row.assigned_study_id}:${row.id}`),
      ...(duplicatePapers ?? []).map((row) => `paper:${row.assigned_study_id}:${row.id}`),
    ];
    if (duplicates.length && item.validation?.allowDuplicateHash !== true) {
      throw new Error(`${item.studyId}: PDF hash already exists at ${duplicates.join(', ')}.`);
    }
    if (
      duplicates.length
      && (!item.validation?.duplicateHashReason || !item.validation?.identityEvidence?.length)
    ) {
      throw new Error(`${item.studyId}: allowed duplicate hash requires an explicit reason and identity evidence.`);
    }

    const safeFileName = `${item.studyId}-${path.basename(item.localPath)}`
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 180);
    let pendingStorage = pendingStorageUploads.get(item.recordId);
    if (pendingStorage) {
      if (
        pendingStorage.studyId !== item.studyId
        || pendingStorage.sha256 !== local.sha256
      ) {
        throw new Error(`${item.studyId}: pending storage journal identity or hash mismatch.`);
      }
    } else {
      pendingStorage = {
        at: new Date().toISOString(),
        studyId: item.studyId,
        recordId: item.recordId,
        status: 'storage_upload_planned',
        objectPath: `${crypto.randomUUID()}/${Date.now()}-${safeFileName}`,
        sha256: local.sha256,
      };
      appendJournal(journalPath, pendingStorage);
      pendingStorageUploads.set(item.recordId, pendingStorage);
    }
    const storageResolution = await ensureJournalledStorageObject(
      supabase,
      pendingStorage,
      local,
      item.studyId,
    );
    const { objectPath } = storageResolution;
    appendJournal(journalPath, {
      at: new Date().toISOString(),
      studyId: item.studyId,
      recordId: item.recordId,
      status: 'storage_uploaded_pending_row_update',
      objectPath,
      sha256: local.sha256,
      resumedExistingObject: storageResolution.reusedExistingObject,
      confirmedAfterAmbiguousUploadResponse:
        storageResolution.confirmedAfterAmbiguousUploadResponse ?? false,
    });

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('screening_records')
      .update({
        storage_bucket: 'papers',
        storage_object_path: objectPath,
        data_base64: null,
        file_name: safeFileName,
        original_file_name: path.basename(item.localPath),
        mime_type: 'application/pdf',
        size: local.size,
        file_sha256: local.sha256,
        metadata: {
          ...(current.metadata ?? {}),
          awaitingFullTextPdf: false,
          fullTextPdfAttachedAt: now,
          fullTextPdfAttachedBy: ATTACHED_BY,
          fullTextPdfSourceUrl: item.sourceUrl,
        },
        updated_at: now,
      })
      .eq('id', item.recordId)
      .eq('assigned_study_id', item.studyId)
      .eq('stage', 'full_text')
      .eq('updated_at', current.updated_at)
      .is('storage_object_path', null)
      .is('file_sha256', null)
      .select('*');
    if (updateError || updated?.length !== 1) {
      throw new Error(
        `${item.studyId}: guarded row update failed; the new object ${objectPath} is preserved as an auditable orphan.`,
      );
    }

    const row = updated[0];
    assertIdentityUnchanged(before, row, item.studyId);
    const storedBuffer = await downloadVerifiedStorageObject(
      supabase,
      'papers',
      objectPath,
      local.sha256,
      item.studyId,
    );
    const storedHash = sha256(storedBuffer);
    if (
      storedHash !== local.sha256
      || row.file_sha256 !== local.sha256
      || row.storage_object_path !== objectPath
      || row.metadata?.awaitingFullTextPdf !== false
    ) {
      throw new Error(`${item.studyId}: upload verification failed.`);
    }
    const result = {
      studyId: item.studyId,
      recordId: item.recordId,
      status: 'uploaded_verified',
      sourceUrl: item.sourceUrl,
      localPath: item.localPath,
      documentType: item.validation.documentType,
      objectPath,
      sha256: local.sha256,
      size: local.size,
      pages: local.pages,
      identityHash: stableHash(pick(row, IDENTITY_FIELDS)),
    };
    results.push(result);
    appendJournal(journalPath, { at: new Date().toISOString(), ...result });
    pendingStorageUploads.delete(item.recordId);
  }

  const resultPath = path.join(outDir, `upload-result-${timestampSlug()}.json`);
  writeJsonNew(resultPath, {
    scope: 'Serial guarded PDF uploads for exact 27-record promoted full-text scope',
    generatedAt: new Date().toISOString(),
    snapshotPath: path.resolve(args.snapshot),
    manifestPath: path.resolve(args.manifest),
    journalPath,
    results,
  });
  console.log(JSON.stringify({ resultPath, journalPath, results: results.length }, null, 2));
}

function mergeRetrieval(args, mapping, outDir) {
  if (!args.queue || !args['worker-results']) {
    throw new Error('merge-retrieval requires --queue and at least three --worker-results paths.');
  }
  const queuePath = path.resolve(args.queue);
  const queue = readJson(queuePath);
  const workerResultPaths = args['worker-results']
    .split(',')
    .map((value) => path.resolve(value.trim()))
    .filter(Boolean);
  if (workerResultPaths.length < 3) {
    throw new Error('merge-retrieval requires at least three worker result paths.');
  }
  const expectedByStudy = new Map(mapping.map((row) => [row.studyId, row]));
  const recordsById = new Map();
  for (const filePath of workerResultPaths) {
    const payload = readJson(filePath);
    const rows = payload.records ?? payload;
    if (!Array.isArray(rows)) throw new Error(`${filePath}: worker result has no records array.`);
    for (const row of rows) {
      const target = expectedByStudy.get(row.studyId);
      if (!target || target.recordId !== row.recordId) {
        throw new Error(`${filePath}: result contains an out-of-scope target.`);
      }
      recordsById.set(row.recordId, row);
    }
  }
  const workerRecords = [...recordsById.values()];
  validateManifest({ records: workerRecords }, mapping);
  const queueById = new Map(queue.records.map((row) => [row.recordId, row]));
  const records = workerRecords.map((row) => {
    const queued = queueById.get(row.recordId);
    if (!queued) throw new Error(`${row.studyId}: worker result is absent from the source queue.`);
    if (row.retrievalStatus === 'accepted') {
      const inspected = inspectLocalPdf(row);
      if (row.sha256 !== inspected.sha256) {
        throw new Error(`${row.studyId}: worker hash does not match the accepted local PDF.`);
      }
      if (row.validation.pages !== inspected.pages) {
        throw new Error(`${row.studyId}: worker page count does not match pdfinfo.`);
      }
    }
    return {
      ...queued,
      ...row,
      uploadStatus: 'pending',
      uploadHash: null,
      aiStatus: 'pending',
      aiDecision: null,
      aiReason: null,
      aiCriteria: null,
      aiModel: null,
    };
  }).sort((a, b) => STUDY_IDS.indexOf(a.studyId) - STUDY_IDS.indexOf(b.studyId));
  const resultPath = path.join(outDir, `retrieval-manifest-${timestampSlug()}.json`);
  writeJsonNew(resultPath, {
    scope: 'Merged read-only retrieval evidence for exact 27 promoted full-text records',
    generatedAt: new Date().toISOString(),
    queuePath,
    workerResultPaths,
    records,
  });
  console.log(JSON.stringify({
    resultPath,
    counts: records.reduce((acc, row) => {
      acc[row.retrievalStatus] = (acc[row.retrievalStatus] ?? 0) + 1;
      return acc;
    }, {}),
  }, null, 2));
}

function exactResultMap(rows, mapping, label) {
  if (!Array.isArray(rows) || rows.length !== mapping.length) {
    throw new Error(`${label} must contain exactly ${mapping.length} rows.`);
  }
  const expected = new Set(mapping.map((row) => row.recordId));
  const result = new Map();
  for (const row of rows) {
    if (!expected.has(row.recordId) || result.has(row.recordId)) {
      throw new Error(`${label} contains an unexpected or duplicate record: ${row.recordId}.`);
    }
    result.set(row.recordId, row);
  }
  return result;
}

function buildFinalManifest({
  retrievalManifest,
  uploadResult,
  recommendationsPayload,
  aiResult,
  verification,
  sourcePaths = {},
}, mapping) {
  const retrievalRows = validateManifest(retrievalManifest, mapping);
  const uploadById = exactResultMap(uploadResult.results, mapping, 'Upload result');
  const verificationById = exactResultMap(verification.results, mapping, 'Final verification');
  const acceptedMapping = mapping.filter((target) => (
    retrievalRows.some((row) => (
      row.recordId === target.recordId && row.retrievalStatus === 'accepted'
    ))
  ));
  const recommendations = recommendationsPayload.recommendations ?? recommendationsPayload;
  const recommendationById = exactResultMap(
    recommendations,
    acceptedMapping,
    'AI recommendations',
  );
  const aiById = exactResultMap(aiResult.results, acceptedMapping, 'AI apply result');
  if (verification.passed !== true) throw new Error('Final verification did not pass.');

  const records = retrievalRows.map((row) => {
    const upload = uploadById.get(row.recordId);
    const verified = verificationById.get(row.recordId);
    if (row.retrievalStatus !== 'accepted') {
      if (
        upload.status !== 'unresolved'
        || verified.checks?.fileAttached !== false
        || verified.checks?.unresolvedAiFieldsUnchanged !== true
        || recommendationById.has(row.recordId)
        || aiById.has(row.recordId)
      ) {
        throw new Error(`${row.studyId}: unresolved final state is inconsistent.`);
      }
      return {
        ...row,
        uploadStatus: 'unresolved',
        uploadHash: null,
        storageObjectPath: null,
        aiStatus: 'not_run_no_adequate_full_text',
        aiDecision: null,
        aiReason: null,
        aiCriteria: null,
        aiModel: null,
      };
    }

    const recommendation = recommendationById.get(row.recordId);
    const ai = aiById.get(row.recordId);
    if (
      !['uploaded_verified', 'already_uploaded_same_hash'].includes(upload.status)
      || !['ai_applied_verified', 'already_ai_applied_verified'].includes(ai.status)
      || verified.checks?.fileAttached !== true
      || verified.checks?.storageReadableAndHashMatched !== true
      || verified.checks?.aiTraceableToVerifiedFile !== true
      || upload.sha256 !== row.sha256
      || verified.fileSha256 !== row.sha256
      || recommendation.pdfSha256 !== row.sha256
      || ai.pdfSha256 !== row.sha256
      || recommendation.criteriaVersion !== EXPECTED_CRITERIA_VERSION
      || ai.criteriaVersion !== EXPECTED_CRITERIA_VERSION
      || recommendation.decision !== ai.decision
    ) {
      throw new Error(`${row.studyId}: attached final state is inconsistent.`);
    }
    return {
      ...row,
      uploadStatus: 'uploaded_verified',
      uploadHash: row.sha256,
      storageObjectPath: upload.objectPath,
      aiStatus: 'applied_verified',
      aiDecision: recommendation.decision,
      aiReason: recommendation.reason,
      aiCriteria: recommendation.criteriaVersion,
      aiModel: recommendation.model,
    };
  });

  return {
    scope: 'Resumable final manifest for exact 27 promoted full-text records',
    generatedAt: new Date().toISOString(),
    criteriaVersion: EXPECTED_CRITERIA_VERSION,
    counts: {
      total: records.length,
      uploadedVerified: records.filter((row) => row.uploadStatus === 'uploaded_verified').length,
      unresolved: records.filter((row) => row.uploadStatus === 'unresolved').length,
      aiAppliedVerified: records.filter((row) => row.aiStatus === 'applied_verified').length,
      aiNotRunNoAdequateFullText:
        records.filter((row) => row.aiStatus === 'not_run_no_adequate_full_text').length,
    },
    sourcePaths,
    records,
  };
}

function finaliseManifest(args, mapping, outDir) {
  for (const required of ['manifest', 'upload-result', 'recommendations', 'ai-result', 'verification']) {
    if (!args[required]) throw new Error(`finalise-manifest requires --${required}.`);
  }
  const sourcePaths = Object.fromEntries(
    ['manifest', 'upload-result', 'recommendations', 'ai-result', 'verification']
      .map((argument) => [argument, path.resolve(args[argument])]),
  );
  const payload = buildFinalManifest({
    retrievalManifest: readJson(sourcePaths.manifest),
    uploadResult: readJson(sourcePaths['upload-result']),
    recommendationsPayload: readJson(sourcePaths.recommendations),
    aiResult: readJson(sourcePaths['ai-result']),
    verification: readJson(sourcePaths.verification),
    sourcePaths,
  }, mapping);
  const resultPath = path.join(outDir, `final-manifest-${timestampSlug()}.json`);
  writeJsonNew(resultPath, payload);
  console.log(JSON.stringify({ resultPath, counts: payload.counts }, null, 2));
}

async function applyAi(args, supabase, mapping, outDir) {
  const uploadResultArg = resolveUploadResultArg(args);
  if (!args.recommendations || !args.snapshot || !uploadResultArg) {
    throw new Error('apply-ai requires --recommendations, --snapshot, and --upload-result.');
  }
  const payload = readJson(path.resolve(args.recommendations));
  const recommendations = payload.recommendations ?? payload;
  const pre = readJson(path.resolve(args.snapshot));
  const uploadResult = readJson(path.resolve(uploadResultArg));
  const attached = new Map(
    uploadResult.results
      .filter((row) => ['uploaded_verified', 'already_uploaded_same_hash'].includes(row.status))
      .map((row) => [row.recordId, row]),
  );
  if (!Array.isArray(recommendations) || recommendations.length !== attached.size) {
    throw new Error('AI recommendations must cover every and only successfully attached record.');
  }
  const targetById = new Map(mapping.map((row) => [row.recordId, row]));
  const beforeById = new Map(pre.targetRows.map((row) => [row.id, row]));
  const { mapRecommendation } = await import(pathToFileURL(FULL_TEXT_AI_APPLY_MODULE).href);
  const journalPath = path.join(outDir, `ai-apply-journal-${timestampSlug()}.ndjson`);
  const results = [];

  for (const item of recommendations) {
    const target = targetById.get(item.recordId);
    const uploadRow = attached.get(item.recordId);
    const before = beforeById.get(item.recordId);
    if (
      !target
      || !uploadRow
      || !before
      || target.studyId !== item.studyId
      || item.criteriaVersion !== EXPECTED_CRITERIA_VERSION
    ) {
      throw new Error(`${item.studyId ?? item.recordId}: AI recommendation is outside the accepted attached scope.`);
    }
    const [current] = await readTargetRows(supabase, [target]);
    assertIdentityUnchanged(before, current, item.studyId);
    if (
      !current.storage_object_path
      || current.metadata?.awaitingFullTextPdf !== false
      || current.file_sha256 !== item.pdfSha256
      || current.file_sha256 !== uploadRow.sha256
    ) {
      throw new Error(`${item.studyId}: AI recommendation is not traceable to the verified attached PDF.`);
    }
    const mapped = mapRecommendation(item, payload.criteriaVersion);
    if (stableHash(pick(current, AI_FIELDS)) !== stableHash(pick(before, AI_FIELDS))) {
      if (!aiFieldsMatch(current, mapped, { ignoreReviewedAt: true })) {
        throw new Error(`${item.studyId}: AI fields changed since the pre-write snapshot.`);
      }
      for (const field of HUMAN_FIELDS) {
        if (stableHash(current[field] ?? null) !== stableHash(before[field] ?? null)) {
          throw new Error(`${item.studyId}: protected human/manual field changed: ${field}.`);
        }
      }
      const already = {
        studyId: item.studyId,
        recordId: item.recordId,
        status: 'already_ai_applied_verified',
        decision: item.decision,
        reason: item.reason,
        criteriaVersion: item.criteriaVersion,
        model: item.model,
        pdfSha256: item.pdfSha256,
        aiReviewedAt: current.ai_reviewed_at,
      };
      results.push(already);
      appendJournal(journalPath, { at: new Date().toISOString(), ...already });
      continue;
    }

    const now = new Date().toISOString();
    const update = { ...mapped, updated_at: now };
    const { data: updated, error } = await supabase
      .from('screening_records')
      .update(update)
      .eq('id', item.recordId)
      .eq('assigned_study_id', item.studyId)
      .eq('stage', 'full_text')
      .eq('updated_at', current.updated_at)
      .eq('file_sha256', item.pdfSha256)
      .select('*');
    if (error || updated?.length !== 1) {
      throw new Error(`${item.studyId}: guarded AI-only update affected an unexpected row count.`);
    }
    const row = updated[0];
    assertIdentityUnchanged(before, row, item.studyId);
    if (!aiFieldsMatch(row, mapped)) {
      throw new Error(`${item.studyId}: AI field readback mismatch.`);
    }
    for (const field of HUMAN_FIELDS) {
      if (stableHash(row[field] ?? null) !== stableHash(before[field] ?? null)) {
        throw new Error(`${item.studyId}: protected human/manual field changed: ${field}.`);
      }
    }
    const result = {
      studyId: item.studyId,
      recordId: item.recordId,
      status: 'ai_applied_verified',
      decision: item.decision,
      reason: item.reason,
      criteriaVersion: item.criteriaVersion,
      model: item.model,
      pdfSha256: item.pdfSha256,
      aiReviewedAt: row.ai_reviewed_at,
    };
    results.push(result);
    appendJournal(journalPath, { at: new Date().toISOString(), ...result });
  }

  const resultPath = path.join(outDir, `ai-apply-result-${timestampSlug()}.json`);
  writeJsonNew(resultPath, {
    scope: 'Serial guarded AI-only writes for exact attached promoted full-text records',
    generatedAt: new Date().toISOString(),
    recommendationsPath: path.resolve(args.recommendations),
    results,
  });
  console.log(JSON.stringify({ resultPath, journalPath, results: results.length }, null, 2));
}

async function verify(args, supabase, mapping, outDir) {
  if (!args.snapshot) throw new Error('verify requires --snapshot.');
  const pre = readJson(path.resolve(args.snapshot));
  const beforeById = new Map(pre.targetRows.map((row) => [row.id, row]));
  const targets = await readTargetRows(supabase, mapping);
  assertExactTargetRows(targets, mapping);
  const currentVotes = await readTargetVotes(supabase, mapping);
  const [
    allScreeningStamps,
    allScreeningVotes,
    allPaperStamps,
  ] = await Promise.all([
    pagedSelect(
      supabase,
      'screening_records',
      'id,assigned_study_id,stage,updated_at',
      (query) => query.order('id'),
    ),
    pagedSelect(supabase, 'screening_votes', '*', (query) => query.order('id')),
    pagedSelect(
      supabase,
      'papers',
      'id,assigned_study_id,updated_at',
      (query) => query.order('id'),
    ),
  ]);
  const targetIds = new Set(mapping.map((row) => row.recordId));
  const oldOutOfScope = pre.globalBaselines.screeningRecordStamps
    .filter((row) => !targetIds.has(row.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const newOutOfScope = allScreeningStamps
    .filter((row) => !targetIds.has(row.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const results = [];

  for (const row of targets) {
    const before = beforeById.get(row.id);
    const checks = {
      identityUnchanged: stableHash(pick(row, IDENTITY_FIELDS)) === stableHash(pick(before, IDENTITY_FIELDS)),
      humanFieldsUnchanged: stableHash(pick(row, HUMAN_FIELDS)) === stableHash(pick(before, HUMAN_FIELDS)),
      titleAbstractDecisionsUnchanged:
        stableHash(row.metadata?.titleAbstractDecisions ?? null)
        === stableHash(before.metadata?.titleAbstractDecisions ?? null),
      targetVotesUnchanged:
        stableHash(currentVotes.filter((vote) => vote.screening_record_id === row.id))
        === stableHash(pre.targetVotes.filter((vote) => vote.screening_record_id === row.id)),
      fileAttached:
        Boolean(row.storage_bucket && row.storage_object_path && row.file_sha256)
        && row.metadata?.awaitingFullTextPdf === false,
      storageReadableAndHashMatched: false,
      aiTraceableToVerifiedFile: false,
      unresolvedAiFieldsUnchanged: false,
    };
    if (checks.fileAttached) {
      const { data: downloaded, error } = await supabase.storage
        .from(row.storage_bucket)
        .download(row.storage_object_path);
      if (!error && downloaded) {
        const buffer = Buffer.from(await downloaded.arrayBuffer());
        checks.storageReadableAndHashMatched = sha256(buffer) === row.file_sha256;
      }
      checks.aiTraceableToVerifiedFile = (
        row.ai_status === 'completed'
        && ['include', 'exclude', 'unsure'].includes(row.ai_suggested_decision)
        && row.ai_criteria_version === EXPECTED_CRITERIA_VERSION
        && row.ai_raw_response?.recordId === row.id
        && row.ai_raw_response?.studyId === row.assigned_study_id
        && row.ai_raw_response?.pdfSha256 === row.file_sha256
        && row.ai_raw_response?.criteriaVersion === EXPECTED_CRITERIA_VERSION
        && row.ai_raw_response?.decision === row.ai_suggested_decision
        && row.ai_raw_response?.model === row.ai_model
      );
    } else {
      checks.unresolvedAiFieldsUnchanged = (
        stableHash(pick(row, AI_FIELDS)) === stableHash(pick(before, AI_FIELDS))
      );
    }
    results.push({
      studyId: row.assigned_study_id,
      recordId: row.id,
      fileSha256: row.file_sha256,
      storageObjectPath: row.storage_object_path,
      aiStatus: row.ai_status,
      aiDecision: row.ai_suggested_decision,
      aiCriteriaVersion: row.ai_criteria_version,
      aiModel: row.ai_model,
      checks,
    });
  }

  const globalChecks = {
    exactTargetCount: targets.length === STUDY_IDS.length,
    outOfScopeScreeningRecordStampsUnchanged: stableHash(oldOutOfScope) === stableHash(newOutOfScope),
    screeningVotesGloballyUnchanged:
      allScreeningVotes.length === pre.globalBaselines.screeningVoteCount
      && stableHash(allScreeningVotes) === pre.globalBaselines.screeningVotesHash,
    papersUnchanged: stableHash(allPaperStamps) === stableHash(pre.globalBaselines.paperStamps),
  };
  const passed = (
    Object.values(globalChecks).every(Boolean)
    && results.every((result) => (
      result.checks.identityUnchanged
      && result.checks.humanFieldsUnchanged
      && result.checks.titleAbstractDecisionsUnchanged
      && result.checks.targetVotesUnchanged
      && (
        result.checks.fileAttached
          ? result.checks.storageReadableAndHashMatched && result.checks.aiTraceableToVerifiedFile
          : result.checks.unresolvedAiFieldsUnchanged
      )
    ))
  );
  const resultPath = path.join(outDir, `final-verification-${timestampSlug()}.json`);
  writeJsonNew(resultPath, {
    scope: 'Final verification for exact 27 newly promoted full-text records',
    generatedAt: new Date().toISOString(),
    passed,
    globalChecks,
    results,
  });
  console.log(JSON.stringify({ resultPath, passed, globalChecks }, null, 2));
  if (!passed) process.exitCode = 2;
}

async function main() {
  const args = parseArgs(process.argv);
  if (![
    'snapshot',
    'merge-retrieval',
    'upload',
    'apply-ai',
    'verify',
    'finalise-manifest',
  ].includes(args.command)) {
    console.error(
      'Usage: node scripts/run-promoted-full-text-screening-2026-07-30.mjs '
      + '<snapshot|merge-retrieval|upload|apply-ai|verify|finalise-manifest> '
      + '[--env=PATH] [--mapping=PATH] [--out-dir=PATH] [--resume-journal=PATH]',
    );
    return 1;
  }
  const envPath = path.resolve(args.env ?? DEFAULT_ENV_PATH);
  const mappingPath = path.resolve(args.mapping ?? DEFAULT_MAPPING_PATH);
  const outDir = path.resolve(args['out-dir'] ?? DEFAULT_OUT_DIR);
  const mapping = loadTargetMapping(mappingPath);
  if (args.command === 'merge-retrieval') {
    mergeRetrieval(args, mapping, outDir);
    return 0;
  }
  if (args.command === 'finalise-manifest') {
    finaliseManifest(args, mapping, outDir);
    return 0;
  }
  const supabase = createSupabase(envPath);
  if (args.command === 'snapshot') await snapshot(args, supabase, mapping, outDir);
  if (args.command === 'upload') await upload(args, supabase, mapping, outDir);
  if (args.command === 'apply-ai') await applyAi(args, supabase, mapping, outDir);
  if (args.command === 'verify') await verify(args, supabase, mapping, outDir);
  return process.exitCode ?? 0;
}

export {
  ATTACHED_BY,
  AWAITING_SENTINEL,
  STUDY_IDS,
  aiFieldsMatch,
  assertExactTargetRows,
  buildFinalManifest,
  classifyUploadRowState,
  ensureJournalledStorageObject,
  isAwaiting,
  loadTargetMapping,
  pendingStorageUploadsFromEntries,
  resolveUploadResultArg,
  stableHash,
  timestampsEqual,
  validateAcceptedCandidate,
  validateManifest,
};

const isMain = (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
);
if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.stack || error.message || error);
      process.exitCode = 1;
    });
}
