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
const APPLY = process.argv.includes('--apply');
const SCREENING_ID = 'b72f7871-06f8-47da-8a20-6cfc8ba320fb';
const PAPER_ID = 'ec094fd1-73a5-43f6-b7e6-5ce58d3e508a';
const FILE_ID = 'c35be44b-da3b-4bd8-bf53-cbc97fcca2d2';
const NOTE_ID = 'ceac4dbc-3272-47de-ba6d-ecdb8df8f585';
const FILE_SHA256 = '9c20b69fc67831357ff85c91775e16e3190e968460c699ffef61e5ca15b7a105';
const EXPECTED_BEFORE =
  'User-approved American-data exception. Extract from the authoritative NCAA agency/source data.';
const EXPECTED_AFTER =
  'User-approved American-data exception. Extract from the authoritative NCAA agency/source data. '
  + 'The attached poster is supporting identity evidence only and is not the exact 2024 journal full text; '
  + 'it is not an extraction source.';

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

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function one(supabase, table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error || !data) {
    throw new Error(`${table} ${id} read failed: ${error?.message ?? 'missing row'}`);
  }
  return data;
}

function protectedSnapshot({ screening, paper, file, votes }) {
  return {
    screening,
    paper,
    file,
    votes,
  };
}

async function readState(supabase) {
  const [screening, paper, file, note] = await Promise.all([
    one(supabase, 'screening_records', SCREENING_ID),
    one(supabase, 'papers', PAPER_ID),
    one(supabase, 'paper_files', FILE_ID),
    one(supabase, 'paper_notes', NOTE_ID),
  ]);
  const { data: votes, error: votesError } = await supabase
    .from('screening_votes')
    .select('*')
    .eq('screening_record_id', SCREENING_ID)
    .order('id');
  if (votesError) throw new Error(`screening_votes read failed: ${votesError.message}`);
  return { screening, paper, file, note, votes: votes ?? [] };
}

function assertContract(state, allowedNoteBodies) {
  const { screening, paper, file, note, votes } = state;
  const checks = {
    screeningLinked: screening.promoted_paper_id === PAPER_ID,
    screeningPrimaryCleared:
      screening.file_sha256 === null
      && screening.storage_object_path === null
      && screening.metadata?.awaitingFullTextPdf === true,
    noHumanVoteFabrication:
      votes.length === 0
      && screening.manual_decision === null
      && screening.manual_decided_by === null,
    paperAmericanData: paper.status === 'american_data',
    paperPrimaryCleared:
      paper.primary_file_id === null
      && paper.primary_file_sha256 === null
      && paper.storage_object_path === null,
    referenceMetadata:
      paper.metadata?.referenceAttachment?.fileId === FILE_ID
      && paper.metadata?.referenceAttachment?.sha256 === FILE_SHA256
      && paper.metadata?.referenceAttachment?.exactJournalFullText === false
      && paper.metadata?.referenceAttachment?.extractionSource === false,
    extractionBasis:
      paper.metadata?.extractionBasis?.kind === 'authoritative_agency_source'
      && paper.metadata?.extractionBasis?.useAttachedReferenceForExtraction === false,
    referenceFile:
      file.paper_id === PAPER_ID
      && file.file_sha256 === FILE_SHA256
      && Boolean(file.storage_bucket && file.storage_object_path),
    exactNote: note.paper_id === PAPER_ID && allowedNoteBodies.includes(note.body),
  };
  if (!Object.values(checks).every(Boolean)) {
    throw new Error(`S845 reference-only contract preflight failed: ${JSON.stringify(checks)}`);
  }
  return checks;
}

async function main() {
  const env = loadEnv(ENV_PATH);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables.');
  }
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const before = await readState(supabase);
  const beforeChecks = assertContract(before, [EXPECTED_BEFORE, EXPECTED_AFTER]);
  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(before.file.storage_bucket)
    .download(before.file.storage_object_path);
  if (downloadError || !downloaded) {
    throw new Error(`S845 reference download failed: ${downloadError?.message ?? 'no data'}`);
  }
  const downloadedSha256 = sha256(Buffer.from(await downloaded.arrayBuffer()));
  if (downloadedSha256 !== FILE_SHA256) {
    throw new Error('S845 reference object hash mismatch.');
  }

  let writeStatus = before.note.body === EXPECTED_AFTER ? 'already_repaired' : 'planned';
  if (APPLY && writeStatus === 'planned') {
    const { data, error } = await supabase
      .from('paper_notes')
      .update({ body: EXPECTED_AFTER })
      .eq('id', NOTE_ID)
      .eq('paper_id', PAPER_ID)
      .eq('created_at', before.note.created_at)
      .eq('body', EXPECTED_BEFORE)
      .select('*');
    if (error || data?.length !== 1) {
      throw new Error(`Guarded S845 note repair failed: ${error?.message ?? 'guard count'}`);
    }
    writeStatus = 'applied';
  }

  const after = APPLY ? await readState(supabase) : before;
  const afterChecks = assertContract(
    after,
    APPLY ? [EXPECTED_AFTER] : [EXPECTED_BEFORE, EXPECTED_AFTER],
  );
  const protectedBefore = protectedSnapshot(before);
  const protectedAfter = protectedSnapshot(after);
  const protectedStateUnchanged =
    stableHash(protectedBefore) === stableHash(protectedAfter);
  if (!protectedStateUnchanged) {
    throw new Error('A protected S845 row changed during the note repair.');
  }
  const passed =
    Object.values(beforeChecks).every(Boolean)
    && Object.values(afterChecks).every(Boolean)
    && downloadedSha256 === FILE_SHA256
    && protectedStateUnchanged
    && (!APPLY || after.note.body === EXPECTED_AFTER);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outputPath = path.join(
    OUT_DIR,
    `s845-reference-note-${APPLY ? 'apply' : 'dry-run'}-${timestampSlug()}.json`,
  );
  fs.writeFileSync(outputPath, `${JSON.stringify({
    artifactType: 'Guarded S845 reference-only note repair',
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry_run',
    passed,
    writeStatus,
    target: {
      screeningRecordId: SCREENING_ID,
      paperId: PAPER_ID,
      paperFileId: FILE_ID,
      paperNoteId: NOTE_ID,
    },
    beforeNote: before.note,
    afterNote: after.note,
    referenceObject: {
      bucket: before.file.storage_bucket,
      objectPath: before.file.storage_object_path,
      expectedSha256: FILE_SHA256,
      downloadedSha256,
      hashMatched: downloadedSha256 === FILE_SHA256,
    },
    protectedStateHashBefore: stableHash(protectedBefore),
    protectedStateHashAfter: stableHash(protectedAfter),
    protectedStateUnchanged,
    checks: { before: beforeChecks, after: afterChecks },
    rollback: {
      recoverable: true,
      source: 'beforeNote',
      action:
        'Guarded paper_notes update from EXPECTED_AFTER back to beforeNote.body. '
        + 'Execute only with explicit destructive-action approval.',
    },
  }, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ outputPath, passed, writeStatus }, null, 2));
  if (!passed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
