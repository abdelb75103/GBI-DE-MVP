import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUN_DIR = path.join(
  ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/final-pass-remaining-2026-07-30',
);
const SNAPSHOT_PATH = path.join(RUN_DIR, 'pre-write-snapshot-s5553-s845.json');
const APPLY = process.argv.includes('--apply');
const ATTACHED_BY = 'codex:final-pass-2026-07-30';

const targets = [
  {
    studyId: 'S5553',
    recordId: 'ad405aa3-ac09-47d1-98a6-da6113728980',
    localPath: path.join(RUN_DIR, 'approved-live-files/S5553-corresponding-full-report.pdf'),
    sourceUrl: 'https://epub.uni-regensburg.de/79387/1/e003003.full.pdf',
    expectedSha256: 'b11a11f68fa80fb43b1c6f8c13c1e60b0707ef427e6037081d741cd9947d5f9c',
    identityNote:
      'Verified later full report of the same Bundesliga registry: all five abstract authors recur; same 2022/23 male cohort, 503 injuries, 176 illnesses, prospective monthly medical reporting, DFL and VBG support. The report expands the registry to women.',
  },
  {
    studyId: 'S845',
    recordId: 'b72f7871-06f8-47da-8a20-6cfc8ba320fb',
    localPath: path.join(RUN_DIR, 'approved-live-files/S845-matching-reference-poster.pdf'),
    sourceUrl: 'https://europepmc.org/api/getPdf?pmcid=PMC9344175',
    expectedSha256: '9c20b69fc67831357ff85c91775e16e3190e968460c699ffef61e5ca15b7a105',
    identityNote:
      'Supporting open-access 2022 NCAA poster for the same NCAA ISP 2014/15–2018/19 dataset and exact headline counts/rates. This is not the exact 2024 journal article. Authoritative NCAA agency/source data is the extraction basis under the user-approved American-data exception.',
  },
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

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const env = loadEnv(path.join(ROOT, '.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const beforeById = new Map(snapshot.screeningRecords.map((row) => [row.id, row]));
const runSlug = new Date().toISOString().replace(/[:.]/g, '-');
const journalPath = path.join(RUN_DIR, `s5553-s845-upload-journal-${runSlug}.ndjson`);
const resultPath = path.join(RUN_DIR, `s5553-s845-upload-result-${runSlug}.json`);
const results = [];

for (const target of targets) {
  const before = beforeById.get(target.recordId);
  if (!before || before.assigned_study_id !== target.studyId) throw new Error(`${target.studyId}: snapshot mismatch`);
  const { data: current, error: readError } = await supabase
    .from('screening_records')
    .select('*')
    .eq('id', target.recordId)
    .single();
  if (readError) throw new Error(`${target.studyId}: read failed: ${readError.message}`);
  const buffer = fs.readFileSync(target.localPath);
  if (!buffer.subarray(0, 2048).includes(Buffer.from('%PDF'))) throw new Error(`${target.studyId}: invalid PDF`);
  const actualHash = sha256(buffer);
  if (actualHash !== target.expectedSha256) throw new Error(`${target.studyId}: local hash mismatch`);
  if (
    current.updated_at !== before.updated_at
    || current.assigned_study_id !== target.studyId
    || current.stage !== 'full_text'
    || current.storage_object_path
    || current.file_sha256
    || current.metadata?.awaitingFullTextPdf !== true
  ) {
    throw new Error(`${target.studyId}: current row is not the snapshotted awaiting-PDF placeholder`);
  }
  const { data: duplicateScreening, error: duplicateScreeningError } = await supabase
    .from('screening_records')
    .select('id,assigned_study_id')
    .eq('file_sha256', actualHash);
  if (duplicateScreeningError) throw new Error(`${target.studyId}: duplicate screening check failed`);
  const { data: duplicatePapers, error: duplicatePapersError } = await supabase
    .from('papers')
    .select('id,assigned_study_id')
    .eq('primary_file_sha256', actualHash);
  if (duplicatePapersError) throw new Error(`${target.studyId}: duplicate paper check failed`);
  if (duplicateScreening.length || duplicatePapers.length) throw new Error(`${target.studyId}: PDF hash already exists live`);

  if (!APPLY) {
    results.push({ studyId: target.studyId, status: 'dry_run_passed', sha256: actualHash });
    continue;
  }

  const safeName = `${target.studyId}-${path.basename(target.localPath)}`;
  const objectPath = `${crypto.randomUUID()}/${Date.now()}-${safeName}`;
  fs.appendFileSync(journalPath, `${JSON.stringify({
    at: new Date().toISOString(),
    status: 'storage_upload_planned',
    ...target,
    localPath: target.localPath,
    objectPath,
    sha256: actualHash,
  })}\n`);
  const { error: uploadError } = await supabase.storage.from('papers').upload(objectPath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw new Error(`${target.studyId}: storage upload failed: ${uploadError.message}`);
  const { data: stored, error: downloadError } = await supabase.storage.from('papers').download(objectPath);
  if (downloadError || !stored || sha256(Buffer.from(await stored.arrayBuffer())) !== actualHash) {
    throw new Error(`${target.studyId}: storage readback verification failed`);
  }
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('screening_records')
    .update({
      storage_bucket: 'papers',
      storage_object_path: objectPath,
      data_base64: null,
      file_name: safeName,
      original_file_name: path.basename(target.localPath),
      mime_type: 'application/pdf',
      size: buffer.length,
      file_sha256: actualHash,
      metadata: {
        ...current.metadata,
        awaitingFullTextPdf: false,
        fullTextPdfAttachedAt: now,
        fullTextPdfAttachedBy: ATTACHED_BY,
        fullTextPdfSourceUrl: target.sourceUrl,
        fullTextPdfIdentityNote: target.identityNote,
      },
      updated_at: now,
    })
    .eq('id', target.recordId)
    .eq('updated_at', current.updated_at)
    .is('storage_object_path', null)
    .is('file_sha256', null)
    .select('*');
  if (updateError || updated?.length !== 1) {
    throw new Error(`${target.studyId}: guarded row update failed; storage object is preserved at ${objectPath}`);
  }
  const result = {
    studyId: target.studyId,
    recordId: target.recordId,
    status: 'uploaded_verified',
    sourceUrl: target.sourceUrl,
    localPath: target.localPath,
    objectPath,
    sha256: actualHash,
    rowUpdatedAt: updated[0].updated_at,
  };
  results.push(result);
  fs.appendFileSync(journalPath, `${JSON.stringify({ at: new Date().toISOString(), ...result })}\n`);
}

fs.writeFileSync(resultPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  apply: APPLY,
  snapshotPath: SNAPSHOT_PATH,
  journalPath: APPLY ? journalPath : null,
  results,
}, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ apply: APPLY, resultPath, results }, null, 2));
