import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
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
const recordId = 'b72f7871-06f8-47da-8a20-6cfc8ba320fb';
const paperId = 'ec094fd1-73a5-43f6-b7e6-5ce58d3e508a';
const fileId = 'c35be44b-da3b-4bd8-bf53-cbc97fcca2d2';
const expectedHash = '9c20b69fc67831357ff85c91775e16e3190e968460c699ffef61e5ca15b7a105';
const [{ data: screening, error: screeningError }, { data: paper, error: paperError }, { data: file, error: fileError }] =
  await Promise.all([
    supabase.from('screening_records').select('*').eq('id', recordId).single(),
    supabase.from('papers').select('*').eq('id', paperId).single(),
    supabase.from('paper_files').select('*').eq('id', fileId).single(),
  ]);
if (screeningError || paperError || fileError) throw new Error('S845 reference-only repair preflight read failed');
const paperIsPrimary = paper.primary_file_id === fileId && paper.primary_file_sha256 === expectedHash;
const paperIsRepaired =
  paper.primary_file_id === null
  && paper.primary_file_sha256 === null
  && paper.storage_object_path === null
  && paper.metadata?.referenceAttachment?.fileId === fileId;
if (
  screening.promoted_paper_id !== paperId
  || screening.file_sha256 !== expectedHash
  || screening.manual_decision !== null
  || paper.status !== 'american_data'
  || (!paperIsPrimary && !paperIsRepaired)
  || file.paper_id !== paperId
  || file.file_sha256 !== expectedHash
) throw new Error('S845 is not in the exact primary-reference state expected for repair');
const referenceAttachment = {
  kind: 'supporting_reference',
  citationTitle: 'Poster 190: Epidemiology of Hamstring Tears in NCAA Sports: 2014/15–2018/19',
  citationDoi: '10.1177/2325967121S00751',
  targetArticleDoi: '10.1097/JSM.0000000000001240',
  sourceUrl: 'https://europepmc.org/api/getPdf?pmcid=PMC9344175',
  storageBucket: file.storage_bucket,
  storageObjectPath: file.storage_object_path,
  fileId,
  sha256: expectedHash,
  size: file.size,
  exactJournalFullText: false,
  extractionSource: false,
  identityBasis:
    'Same NCAA ISP 2014/15–2018/19 dataset, overlapping authors, and exact headline counts and rates.',
};
const extractionBasis = {
  kind: 'authoritative_agency_source',
  organisation: 'National Collegiate Athletic Association',
  programme: 'NCAA Injury Surveillance Program',
  datasetPeriod: '2014/15–2018/19',
  useAttachedReferenceForExtraction: false,
  userApprovedException: true,
};
const now = new Date().toISOString();
const {
  analysisSourceTreatment: _invalidAnalysisSourceTreatment,
  ...paperMetadata
} = paper.metadata ?? {};
let paperUpdated = [paper];
if (paperIsPrimary) {
  const result = await supabase
    .from('papers')
    .update({
      primary_file_id: null,
      primary_file_sha256: null,
      original_file_name: null,
      storage_bucket: paper.storage_bucket,
      storage_object_path: null,
      metadata: {
        ...paperMetadata,
        referenceAttachment,
        extractionBasis,
        attachedReferenceOnly: true,
      },
      updated_at: now,
    })
    .eq('id', paperId)
    .eq('updated_at', paper.updated_at)
    .eq('primary_file_id', fileId)
    .eq('primary_file_sha256', expectedHash)
    .select('*');
  if (result.error || result.data?.length !== 1) {
    throw new Error(`Guarded S845 paper primary-reference repair failed: ${result.error?.message ?? 'guard count'}`);
  }
  paperUpdated = result.data;
}
const { data: screeningUpdated, error: screeningUpdateError } = await supabase
  .from('screening_records')
  .update({
    storage_bucket: null,
    storage_object_path: null,
    data_base64: null,
    file_name: null,
    original_file_name: null,
    mime_type: null,
    size: null,
    file_sha256: null,
    metadata: {
      ...screening.metadata,
      awaitingFullTextPdf: true,
      referenceAttachment,
      extractionBasis,
      fullTextPdfSourceUrl: null,
      fullTextPdfAttachedAt: null,
      fullTextPdfAttachedBy: null,
      fullTextPdfIdentityNote: null,
      attachedReferenceOnly: true,
    },
    updated_at: now,
  })
  .eq('id', recordId)
  .eq('updated_at', screening.updated_at)
  .eq('promoted_paper_id', paperId)
  .eq('file_sha256', expectedHash)
  .is('manual_decision', null)
  .select('*');
if (screeningUpdateError || screeningUpdated?.length !== 1) {
  throw new Error(`Guarded S845 screening primary-reference repair failed: ${screeningUpdateError?.message ?? 'guard count'}; paper repair is preserved`);
}
console.log(JSON.stringify({
  repaired: true,
  studyId: 'S845',
  paperId,
  fileIdPreservedAsReference: true,
  storageObjectPreserved: referenceAttachment.storageObjectPath,
  screeningPrimaryFileCleared: screeningUpdated[0].storage_object_path === null,
  paperPrimaryFileCleared: paperUpdated[0].primary_file_id === null,
  referenceAttachment,
  extractionBasis,
  invalidAnalysisSourceTreatmentRemoved: paperUpdated[0].metadata?.analysisSourceTreatment === undefined,
}, null, 2));
