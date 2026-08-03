import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
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
  timestampsEqual,
  validateAcceptedCandidate,
  validateManifest,
} from '../scripts/run-promoted-full-text-screening-2026-07-30.mjs';

const mappingPath = path.resolve(
  '..',
  'outputs/title-abstract-promotion-repair-2026-07-30/apply-result.json',
);

test('authoritative mapping resolves the exact 27-record scope', () => {
  const mapping = loadTargetMapping(mappingPath);
  assert.equal(mapping.length, 27);
  assert.deepEqual(mapping.map((row) => row.studyId).sort(), [...STUDY_IDS].sort());
  assert.equal(new Set(mapping.map((row) => row.recordId)).size, 27);
});

test('awaiting guard requires the sentinel and no attached object or hash', () => {
  assert.equal(isAwaiting({
    metadata: { awaitingFullTextPdf: true },
    storage_object_path: null,
    file_sha256: null,
    data_base64: AWAITING_SENTINEL,
  }), true);
  assert.equal(isAwaiting({
    metadata: { awaitingFullTextPdf: true },
    storage_object_path: 'already/attached.pdf',
    file_sha256: null,
    data_base64: AWAITING_SENTINEL,
  }), false);
});

test('target guard permits an identity-verified mixed-state snapshot only when explicitly requested', () => {
  const mapping = [{ studyId: 'S683', recordId: 'record-1' }];
  const attached = [{
    id: 'record-1',
    assigned_study_id: 'S683',
    stage: 'full_text',
    metadata: { awaitingFullTextPdf: false },
    storage_object_path: 'workflow/object.pdf',
    file_sha256: 'accepted-hash',
  }];
  assert.doesNotThrow(() => assertExactTargetRows(attached, mapping));
  assert.throws(
    () => assertExactTargetRows(attached, mapping, { requireAwaiting: true }),
    /not the expected awaiting-PDF placeholder/,
  );
});

test('AI apply accepts the documented kebab-case upload-result argument and legacy camelCase', () => {
  assert.equal(
    resolveUploadResultArg({ 'upload-result': '/tmp/upload-result.json' }),
    '/tmp/upload-result.json',
  );
  assert.equal(
    resolveUploadResultArg({ uploadResult: '/tmp/legacy-upload-result.json' }),
    '/tmp/legacy-upload-result.json',
  );
});

test('upload row state permits a guarded same-hash rerun without permitting external overwrite', () => {
  const item = { studyId: 'S683' };
  const before = {
    id: 'record-1',
    stage: 'full_text',
    assigned_study_id: 'S683',
    updated_at: '2026-07-30T13:01:10.000Z',
  };
  const attached = {
    ...before,
    updated_at: '2026-07-30T13:02:10.000Z',
    storage_bucket: 'papers',
    storage_object_path: 'workflow/object.pdf',
    file_sha256: 'accepted-hash',
    metadata: {
      awaitingFullTextPdf: false,
      fullTextPdfAttachedBy: ATTACHED_BY,
    },
  };
  assert.equal(
    classifyUploadRowState(before, attached, item, 'accepted-hash'),
    'already_uploaded_same_hash',
  );
  assert.throws(
    () => classifyUploadRowState(
      before,
      {
        ...attached,
        metadata: {
          awaitingFullTextPdf: false,
          fullTextPdfAttachedBy: 'another-workflow',
        },
      },
      item,
      'accepted-hash',
    ),
    /not created by this guarded workflow/,
  );
});

test('upload row state keeps unchanged placeholders resumable and rejects partial attachment state', () => {
  const item = { studyId: 'S683' };
  const before = {
    id: 'record-1',
    stage: 'full_text',
    assigned_study_id: 'S683',
    updated_at: '2026-07-30T13:01:10.000Z',
  };
  const awaiting = {
    ...before,
    metadata: { awaitingFullTextPdf: true },
    storage_object_path: null,
    file_sha256: null,
    data_base64: AWAITING_SENTINEL,
  };
  assert.equal(
    classifyUploadRowState(before, awaiting, item, 'accepted-hash'),
    'awaiting_upload',
  );
  assert.throws(
    () => classifyUploadRowState(
      before,
      { ...awaiting, storage_object_path: 'partial/object.pdf' },
      item,
      'accepted-hash',
    ),
    /refusing to overwrite/,
  );
});

test('crash after storage upload but before completion journal reuses the planned object path', async () => {
  const buffer = Buffer.from('%PDF-1.7\ncrash-resume-fixture\n');
  const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const plannedEntry = {
    status: 'storage_upload_planned',
    studyId: 'S683',
    recordId: 'record-1',
    objectPath: 'pending/object.pdf',
    sha256: expectedHash,
  };
  const pending = pendingStorageUploadsFromEntries([plannedEntry]);
  assert.deepEqual(pending.get('record-1'), plannedEntry);
  let uploadCalls = 0;
  const supabase = {
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([buffer]), error: null }),
        upload: async () => {
          uploadCalls += 1;
          return { error: null };
        },
      }),
    },
  };
  const resolution = await ensureJournalledStorageObject(
    supabase,
    plannedEntry,
    { buffer, sha256: expectedHash },
    'S683',
  );
  assert.deepEqual(resolution, {
    objectPath: plannedEntry.objectPath,
    reusedExistingObject: true,
  });
  assert.equal(uploadCalls, 0);
});

test('verified completion clears both planned and uploaded crash-recovery journal states', () => {
  const plannedEntry = {
    status: 'storage_upload_planned',
    studyId: 'S683',
    recordId: 'record-1',
    objectPath: 'pending/object.pdf',
    sha256: 'accepted-hash',
  };
  const uploadedEntry = {
    ...plannedEntry,
    status: 'storage_uploaded_pending_row_update',
  };
  const completed = pendingStorageUploadsFromEntries([
    plannedEntry,
    uploadedEntry,
    {
      status: 'uploaded_verified',
      studyId: 'S683',
      recordId: 'record-1',
    },
  ]);
  assert.equal(completed.has('record-1'), false);
});

test('manifest guard rejects any target outside the authoritative UUID mapping', () => {
  const mapping = loadTargetMapping(mappingPath);
  const records = mapping.map((row) => ({
    studyId: row.studyId,
    recordId: row.recordId,
    retrievalStatus: 'unresolved',
  }));
  records[0] = { ...records[0], recordId: crypto.randomUUID() };
  assert.throws(
    () => validateManifest({ records }, mapping),
    /invalid or duplicate target/,
  );
});

test('S1795 cannot be accepted from DOI evidence alone', () => {
  assert.throws(
    () => validateAcceptedCandidate({
      studyId: 'S1795',
      localPath: '/tmp/S1795.pdf',
      sourceUrl: 'https://example.test/S1795.pdf',
      validation: {
        pdfSignature: true,
        identityVerified: true,
        legalAccess: true,
        documentType: 'supplement_abstract',
        identityEvidence: ['DOI match only'],
        doiMatch: true,
        titleMatch: false,
        authorMatch: false,
        contentMatch: false,
      },
    }),
    /requires title, author, and content evidence/,
  );
});

test('accepted candidates require legal, identity, PDF, and document-type evidence', () => {
  assert.doesNotThrow(() => validateAcceptedCandidate({
    studyId: 'S683',
    localPath: '/tmp/S683.pdf',
    sourceUrl: 'https://example.test/S683.pdf',
    validation: {
      pdfSignature: true,
      identityVerified: true,
      legalAccess: true,
      legalAccessType: 'publisher_open_access',
      documentType: 'full_paper',
      identityEvidence: ['Exact title and DOI appear on page 1'],
      titleMatch: true,
      authorMatch: true,
      doiMatch: true,
      contentMatch: true,
    },
  }));
});

test('AI readback accepts equivalent PostgreSQL timestamp serialisations only', () => {
  assert.equal(
    timestampsEqual('2026-07-30T13:19:55.440Z', '2026-07-30T13:19:55.44+00:00'),
    true,
  );
  assert.equal(
    timestampsEqual('2026-07-30T13:19:55.440Z', '2026-07-30T13:19:56.440Z'),
    false,
  );
});

test('AI resume matching still requires every non-timestamp field to match', () => {
  const expected = Object.fromEntries([
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
  ].map((field) => [field, null]));
  expected.ai_status = 'completed';
  expected.ai_suggested_decision = 'include';
  expected.ai_reviewed_at = '2026-07-30T13:19:56.440Z';
  const actual = {
    ...expected,
    ai_reviewed_at: '2026-07-30T13:19:55.44+00:00',
  };
  assert.equal(aiFieldsMatch(actual, expected, { ignoreReviewedAt: true }), true);
  assert.equal(aiFieldsMatch(actual, expected), false);
  assert.equal(
    aiFieldsMatch({ ...actual, ai_reason: 'unexpected' }, expected, { ignoreReviewedAt: true }),
    false,
  );
});

test('final resumable manifest reconciles all 27 retrieval, upload, AI, and verification rows', () => {
  const auditRoot = path.resolve(
    'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30',
  );
  const read = (relativePath) => JSON.parse(
    fs.readFileSync(path.join(auditRoot, relativePath), 'utf8'),
  );
  const payload = buildFinalManifest({
    retrievalManifest: read('retrieval-manifest-2026-07-30T12-59-48-974Z.json'),
    uploadResult: read('upload-result-2026-07-30T13-02-23-072Z.json'),
    recommendationsPayload: read(
      'ai-review/coordinator-reviewed-rendered-v2/'
      + 'full-text-ai-recommendations.normalized.json',
    ),
    aiResult: read('ai-apply-result-2026-07-30T13-21-36-645Z.json'),
    verification: read('final-verification-2026-07-30T13-42-40-776Z.json'),
  }, loadTargetMapping(mappingPath));
  assert.deepEqual(payload.counts, {
    total: 27,
    uploadedVerified: 14,
    unresolved: 13,
    aiAppliedVerified: 14,
    aiNotRunNoAdequateFullText: 13,
  });
  assert.equal(
    payload.records.every((row) => (
      row.studyId
      && row.recordId
      && row.retrievalStatus
      && row.uploadStatus
      && row.aiStatus
      && (
        row.uploadStatus === 'uploaded_verified'
          ? row.uploadHash && row.aiDecision && row.aiReason && row.aiCriteria && row.aiModel
          : row.error && row.manualNextStep
      )
    )),
    true,
  );
});
