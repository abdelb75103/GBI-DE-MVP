import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUN_DIR = path.join(
  ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/final-pass-remaining-2026-07-30',
);
const baseline = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'pre-write-snapshot-s5553-s845.json'), 'utf8'));
const before = new Map(baseline.screeningRecords.map((row) => [row.assigned_study_id, row]));
const env = {};
for (const raw of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index < 1) continue;
  env[line.slice(0, index)] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ids = [
  'ad405aa3-ac09-47d1-98a6-da6113728980',
  'b72f7871-06f8-47da-8a20-6cfc8ba320fb',
];
const { data: rows, error: rowError } = await supabase.from('screening_records').select('*').in('id', ids);
if (rowError || rows?.length !== 2) throw new Error(`Target verification read failed: ${rowError?.message ?? 'count'}`);
const current = new Map(rows.map((row) => [row.assigned_study_id, row]));
const s5553 = current.get('S5553');
const s845 = current.get('S845');
const expected = {
  S5553: 'b11a11f68fa80fb43b1c6f8c13c1e60b0707ef427e6037081d741cd9947d5f9c',
  S845: '9c20b69fc67831357ff85c91775e16e3190e968460c699ffef61e5ca15b7a105',
};
const storageChecks = {};
for (const row of rows) {
  const bucket = row.assigned_study_id === 'S845'
    ? row.metadata?.referenceAttachment?.storageBucket
    : row.storage_bucket;
  const objectPath = row.assigned_study_id === 'S845'
    ? row.metadata?.referenceAttachment?.storageObjectPath
    : row.storage_object_path;
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  const hash = data
    ? crypto.createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex')
    : null;
  storageChecks[row.assigned_study_id] = {
    readable: !error && Boolean(data),
    hash,
    matched: hash === expected[row.assigned_study_id],
  };
}
const { data: votes, error: voteError } = await supabase
  .from('screening_votes')
  .select('*')
  .in('screening_record_id', ids);
if (voteError) throw new Error(`Vote verification failed: ${voteError.message}`);
const { data: paper, error: paperError } = await supabase
  .from('papers')
  .select('*')
  .eq('assigned_study_id', 'S845')
  .single();
if (paperError) throw new Error(`S845 paper verification failed: ${paperError.message}`);
const [{ data: files, error: filesError }, { data: notes, error: notesError }] = await Promise.all([
  supabase.from('paper_files').select('*').eq('paper_id', paper.id),
  supabase.from('paper_notes').select('*').eq('paper_id', paper.id),
]);
if (filesError || notesError) throw new Error('S845 paper child verification failed');
const protectedFields = [
  'title',
  'lead_author',
  'year',
  'journal',
  'doi',
  'normalized_doi',
  'stage',
  'assigned_study_id',
  'source',
  'created_by',
  'created_at',
];
const protectedIdentityUnchanged = Object.fromEntries(['S5553', 'S845'].map((studyId) => [
  studyId,
  protectedFields.every((field) => JSON.stringify(before.get(studyId)[field]) === JSON.stringify(current.get(studyId)[field])),
]));
const titleAbstractMetadataUnchanged = Object.fromEntries(['S5553', 'S845'].map((studyId) => {
  const a = before.get(studyId).metadata;
  const b = current.get(studyId).metadata;
  const unchanged = [a.titleAbstractRecordId, a.titleAbstractResolution, a.titleAbstractDecisions]
    .map(JSON.stringify)
    .every((value, index) => value === [
      b.titleAbstractRecordId,
      b.titleAbstractResolution,
      b.titleAbstractDecisions,
    ].map(JSON.stringify)[index]);
  return [studyId, unchanged];
}));
const { data: concurrentRows, error: concurrentError } = await supabase
  .from('screening_records')
  .select('id,assigned_study_id,stage,updated_at')
  .gte('updated_at', '2026-07-30T16:45:03.126Z')
  .not('id', 'in', `(${ids.join(',')})`);
if (concurrentError) throw new Error(`Concurrent-write audit failed: ${concurrentError.message}`);
const checks = {
  storageChecks,
  protectedIdentityUnchanged,
  titleAbstractMetadataUnchanged,
  noScreeningVotesCreated: votes.length === 0,
  s5553: {
    attached: s5553.file_sha256 === expected.S5553 && s5553.metadata?.awaitingFullTextPdf === false,
    aiCompleted: s5553.ai_status === 'completed',
    aiDecision: s5553.ai_suggested_decision,
    aiCriteriaVersion: s5553.ai_criteria_version,
    aiHashTraceable: s5553.ai_raw_response?.pdfSha256 === expected.S5553,
    manualFieldsUnchanged:
      s5553.manual_decision === before.get('S5553').manual_decision
      && s5553.promoted_paper_id === before.get('S5553').promoted_paper_id,
  },
  s845: {
    referenceStored:
      s845.metadata?.referenceAttachment?.sha256 === expected.S845
      && s845.metadata?.referenceAttachment?.exactJournalFullText === false
      && s845.metadata?.referenceAttachment?.extractionSource === false,
    screeningPrimaryFileCleared:
      s845.file_sha256 === null
      && s845.storage_object_path === null
      && s845.data_base64 === null
      && s845.metadata?.awaitingFullTextPdf === true,
    promotedPaperLinked: s845.promoted_paper_id === paper.id,
    manualFieldsRestored:
      s845.manual_decision === before.get('S845').manual_decision
      && s845.manual_reason === before.get('S845').manual_reason
      && s845.manual_decided_by === before.get('S845').manual_decided_by
      && s845.manual_decided_at === before.get('S845').manual_decided_at,
    paperStatus: paper.status,
    assignedTo: paper.assigned_to,
    paperPrimaryFileCleared:
      paper.primary_file_id === null
      && paper.primary_file_sha256 === null
      && paper.storage_object_path === null,
    extractionBasis:
      paper.metadata?.extractionBasis?.kind === 'authoritative_agency_source'
      && paper.metadata?.extractionBasis?.useAttachedReferenceForExtraction === false,
    invalidAnalysisSourceTreatmentRemoved: paper.metadata?.analysisSourceTreatment === undefined,
    oneFileLinked: files.length === 1 && files[0].file_sha256 === expected.S845,
    notePresent:
      notes.length === 1
      && notes[0].body.includes('authoritative NCAA agency/source data')
      && notes[0].body.includes('not the exact 2024 journal full text'),
    exceptionMetadataPresent: s845.metadata?.userApprovedExtractionException?.attachedReferenceOnly === true,
  },
  concurrentlyUpdatedOutOfScopeScreeningRows: concurrentRows,
};
const passed = (
  Object.values(storageChecks).every((check) => check.readable && check.matched)
  && Object.values(protectedIdentityUnchanged).every(Boolean)
  && Object.values(titleAbstractMetadataUnchanged).every(Boolean)
  && checks.noScreeningVotesCreated
  && checks.s5553.attached
  && checks.s5553.aiCompleted
  && checks.s5553.aiDecision === 'include'
  && checks.s5553.aiCriteriaVersion === 'fifa-gbi-full-text-v8-2026-06-23'
  && checks.s5553.aiHashTraceable
  && checks.s5553.manualFieldsUnchanged
  && checks.s845.referenceStored
  && checks.s845.screeningPrimaryFileCleared
  && checks.s845.promotedPaperLinked
  && checks.s845.manualFieldsRestored
  && checks.s845.paperStatus === 'american_data'
  && checks.s845.assignedTo === '00000000-0000-0000-0000-000000000001'
  && checks.s845.paperPrimaryFileCleared
  && checks.s845.extractionBasis
  && checks.s845.invalidAnalysisSourceTreatmentRemoved
  && checks.s845.oneFileLinked
  && checks.s845.notePresent
  && checks.s845.exceptionMetadataPresent
);
const outputPath = path.join(RUN_DIR, `s5553-s845-final-verification-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), passed, checks }, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ passed, outputPath, checks }, null, 2));
if (!passed) process.exitCode = 1;
