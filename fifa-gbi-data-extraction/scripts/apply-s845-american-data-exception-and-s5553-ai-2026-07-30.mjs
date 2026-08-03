import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUN_DIR = path.join(
  ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/final-pass-remaining-2026-07-30',
);
const APPLY = process.argv.includes('--apply');
const ABDEL_ID = '00000000-0000-0000-0000-000000000001';
const ABDEL_NAME = 'AbdelRahman Babiker';
const S5553_ID = 'ad405aa3-ac09-47d1-98a6-da6113728980';
const S845_ID = 'b72f7871-06f8-47da-8a20-6cfc8ba320fb';
const S5553_HASH = 'b11a11f68fa80fb43b1c6f8c13c1e60b0707ef427e6037081d741cd9947d5f9c';
const S845_HASH = '9c20b69fc67831357ff85c91775e16e3190e968460c699ffef61e5ca15b7a105';
const NOTE =
  'User-approved American-data exception. Extract from the authoritative NCAA agency/source data. The attached open-access 2022 poster is supporting identity evidence for the same NCAA ISP 2014/15–2018/19 dataset and exact headline counts/rates; it is not the exact 2024 journal full text.';
const recommendationPath = path.join(
  RUN_DIR,
  's5553/rendered/s5553-full-text-ai-recommendation.normalized.json',
);
const mapperPath =
  '/Users/abdelbabiker/.codex/skills/fifa-full-text-screening-review/scripts/apply_recommendations_to_supabase.mjs';

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

const env = loadEnv(path.join(ROOT, '.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { mapRecommendation } = await import(pathToFileURL(mapperPath).href);
const recommendationPayload = JSON.parse(fs.readFileSync(recommendationPath, 'utf8'));
const recommendation = recommendationPayload.recommendations[0];
const mappedAi = mapRecommendation(recommendation, recommendationPayload.criteriaVersion);
const runSlug = new Date().toISOString().replace(/[:.]/g, '-');
const journalPath = path.join(RUN_DIR, `s845-exception-s5553-ai-journal-${runSlug}.ndjson`);
const resultPath = path.join(RUN_DIR, `s845-exception-s5553-ai-result-${runSlug}.json`);

const { data: records, error: recordsError } = await supabase
  .from('screening_records')
  .select('*')
  .in('id', [S5553_ID, S845_ID]);
if (recordsError || records?.length !== 2) throw new Error(`Target read failed: ${recordsError?.message ?? 'count'}`);
const byId = new Map(records.map((row) => [row.id, row]));
const s5553 = byId.get(S5553_ID);
const s845 = byId.get(S845_ID);
if (
  s5553.assigned_study_id !== 'S5553'
  || s5553.stage !== 'full_text'
  || s5553.file_sha256 !== S5553_HASH
  || s5553.metadata?.awaitingFullTextPdf !== false
  || s5553.ai_status !== 'not_run'
) throw new Error('S5553 is not in the expected post-upload, pre-AI state');
if (
  recommendation.recordId !== S5553_ID
  || recommendation.pdfSha256 !== S5553_HASH
  || recommendation.criteriaVersion !== 'fifa-gbi-full-text-v8-2026-06-23'
) throw new Error('S5553 recommendation identity or criteria mismatch');
if (
  s845.assigned_study_id !== 'S845'
  || s845.stage !== 'full_text'
  || s845.file_sha256 !== S845_HASH
  || s845.metadata?.awaitingFullTextPdf !== false
  || s845.promoted_paper_id
  || s845.manual_decision
) throw new Error('S845 is not in the expected post-upload, pre-promotion state');
const { data: existingPaper, error: paperCheckError } = await supabase
  .from('papers')
  .select('id')
  .eq('assigned_study_id', 'S845');
if (paperCheckError || existingPaper.length) throw new Error('S845 paper already exists or could not be checked');

const dryRun = {
  apply: APPLY,
  checks: {
    s5553RecommendationMapped: true,
    s5553PdfTraceable: true,
    s845ReferencePdfTraceable: true,
    s845NoExistingPaper: true,
    s845ExceptionNoteExplicit: true,
  },
};
if (!APPLY) {
  fs.writeFileSync(resultPath, `${JSON.stringify(dryRun, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ ...dryRun, resultPath }, null, 2));
  process.exit(0);
}

const results = [];
const aiNow = new Date().toISOString();
const { data: aiUpdated, error: aiError } = await supabase
  .from('screening_records')
  .update({ ...mappedAi, ai_reviewed_at: aiNow, updated_at: aiNow })
  .eq('id', S5553_ID)
  .eq('updated_at', s5553.updated_at)
  .eq('file_sha256', S5553_HASH)
  .eq('ai_status', 'not_run')
  .select('*');
if (aiError || aiUpdated?.length !== 1) throw new Error(`S5553 guarded AI update failed: ${aiError?.message ?? 'count'}`);
results.push({
  studyId: 'S5553',
  status: 'ai_applied_verified',
  decision: aiUpdated[0].ai_suggested_decision,
  criteriaVersion: aiUpdated[0].ai_criteria_version,
  model: aiUpdated[0].ai_model,
  pdfSha256: aiUpdated[0].file_sha256,
  rowUpdatedAt: aiUpdated[0].updated_at,
});
fs.appendFileSync(journalPath, `${JSON.stringify({ at: new Date().toISOString(), ...results.at(-1) })}\n`);

const paperId = crypto.randomUUID();
const fileId = crypto.randomUUID();
const now = new Date().toISOString();
fs.appendFileSync(journalPath, `${JSON.stringify({
  at: now,
  status: 's845_promotion_planned',
  screeningRecordId: S845_ID,
  paperId,
  fileId,
  priorScreeningUpdatedAt: s845.updated_at,
})}\n`);
const decision = {
  reviewerProfileId: ABDEL_ID,
  reviewerName: ABDEL_NAME,
  decision: 'include',
  reason: NOTE,
  decidedAt: now,
};
const paperMetadata = {
  ...s845.metadata,
  screeningRecordId: S845_ID,
  screeningStage: 'full_text',
  screeningDecision: 'include',
  screeningDecisionReason: NOTE,
  screeningPromotedAt: now,
  analysisSourceTreatment: 'american_data',
  americanDataSourceBasis: 'authoritative NCAA agency/source data',
  attachedReferenceOnly: true,
  attachedReferenceIdentityNote: s845.metadata?.fullTextPdfIdentityNote,
  userApprovedExtractionException: true,
};
const { error: insertPaperError } = await supabase.from('papers').insert({
  id: paperId,
  assigned_study_id: 'S845',
  title: s845.title,
  extracted_title: s845.title,
  lead_author: s845.lead_author,
  journal: s845.journal,
  year: s845.year,
  doi: s845.doi,
  normalized_doi: s845.normalized_doi,
  duplicate_key_v2: s845.metadata?.duplicateKeyV2 ?? null,
  title_fingerprint: s845.metadata?.titleFingerprint ?? null,
  dedupe_review_status: 'clean',
  primary_file_sha256: S845_HASH,
  original_file_name: s845.original_file_name,
  status: 'american_data',
  storage_bucket: s845.storage_bucket,
  storage_object_path: s845.storage_object_path,
  uploaded_by: ABDEL_ID,
  assigned_to: ABDEL_ID,
  uploaded_at: now,
  updated_at: now,
  metadata: paperMetadata,
});
if (insertPaperError) throw new Error(`S845 paper creation failed: ${insertPaperError.message}`);
const { error: fileError } = await supabase.from('paper_files').insert({
  id: fileId,
  paper_id: paperId,
  name: s845.file_name,
  original_file_name: s845.original_file_name,
  size: s845.size,
  mime_type: s845.mime_type,
  uploaded_at: now,
  storage_bucket: s845.storage_bucket,
  storage_object_path: s845.storage_object_path,
  file_sha256: S845_HASH,
});
if (fileError) throw new Error(`S845 paper-file link failed: ${fileError.message}`);
const { error: noteError } = await supabase.from('paper_notes').insert({
  id: crypto.randomUUID(),
  paper_id: paperId,
  body: NOTE,
  created_at: now,
});
if (noteError) throw new Error(`S845 extraction note failed: ${noteError.message}`);
const { data: primaryUpdated, error: primaryError } = await supabase
  .from('papers')
  .update({ primary_file_id: fileId, updated_at: now })
  .eq('id', paperId)
  .eq('status', 'american_data')
  .select('*');
if (primaryError || primaryUpdated?.length !== 1) throw new Error('S845 primary file update failed');
const { data: screeningUpdated, error: screeningError } = await supabase
  .from('screening_records')
  .update({
    manual_decision: 'include',
    manual_reason: NOTE,
    manual_decided_by: ABDEL_ID,
    manual_decided_at: now,
    metadata: {
      ...s845.metadata,
      fullTextDecisions: [decision],
      fullTextDecisionAudit: [{
        ...decision,
        action: 'user_approved_american_data_exception',
        resolutionBefore: 'pending',
      }],
      fullTextResolution: 'promoted',
      userApprovedExtractionException: {
        at: now,
        basis: 'authoritative NCAA agency/source data',
        attachedReferenceOnly: true,
        note: NOTE,
      },
    },
    promoted_paper_id: paperId,
    promoted_by: ABDEL_ID,
    promoted_at: now,
    updated_at: now,
  })
  .eq('id', S845_ID)
  .eq('updated_at', s845.updated_at)
  .eq('file_sha256', S845_HASH)
  .is('promoted_paper_id', null)
  .is('manual_decision', null)
  .select('*');
if (screeningError || screeningUpdated?.length !== 1) throw new Error('S845 guarded screening promotion audit failed');
results.push({
  studyId: 'S845',
  status: 'promoted_american_data_verified',
  screeningRecordId: S845_ID,
  paperId,
  paperFileId: fileId,
  pdfSha256: S845_HASH,
  paperStatus: primaryUpdated[0].status,
  assignedTo: primaryUpdated[0].assigned_to,
  note: NOTE,
  screeningUpdatedAt: screeningUpdated[0].updated_at,
});
fs.appendFileSync(journalPath, `${JSON.stringify({ at: new Date().toISOString(), ...results.at(-1) })}\n`);
fs.writeFileSync(resultPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  apply: true,
  recommendationPath,
  journalPath,
  results,
}, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ apply: true, resultPath, journalPath, results }, null, 2));
