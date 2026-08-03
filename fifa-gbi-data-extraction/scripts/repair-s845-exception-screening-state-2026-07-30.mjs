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
const { data: current, error: readError } = await supabase
  .from('screening_records')
  .select('*')
  .eq('id', recordId)
  .single();
if (readError) throw new Error(readError.message);
if (
  current.assigned_study_id !== 'S845'
  || current.promoted_paper_id !== paperId
  || current.manual_decision !== 'include'
  || current.manual_decided_by !== '00000000-0000-0000-0000-000000000001'
  || current.metadata?.userApprovedExtractionException?.attachedReferenceOnly !== true
) throw new Error('S845 is not in the exact split-brain state expected for repair');
const { data: votes, error: votesError } = await supabase
  .from('screening_votes')
  .select('id')
  .eq('screening_record_id', recordId);
if (votesError || votes.length !== 0) throw new Error('S845 authoritative votes are not empty');
const {
  fullTextDecisions: _fullTextDecisions,
  fullTextDecisionAudit: _fullTextDecisionAudit,
  ...metadataWithoutManualMirrors
} = current.metadata;
const now = new Date().toISOString();
const { data: updated, error: updateError } = await supabase
  .from('screening_records')
  .update({
    manual_decision: null,
    manual_reason: null,
    manual_decided_by: null,
    manual_decided_at: null,
    metadata: {
      ...metadataWithoutManualMirrors,
      fullTextResolution: 'promoted',
    },
    updated_at: now,
  })
  .eq('id', recordId)
  .eq('updated_at', current.updated_at)
  .eq('promoted_paper_id', paperId)
  .eq('manual_decision', 'include')
  .select('*');
if (updateError || updated?.length !== 1) throw new Error(`Guarded repair failed: ${updateError?.message ?? 'count'}`);
console.log(JSON.stringify({
  repaired: true,
  studyId: 'S845',
  recordId,
  paperId,
  manualFieldsRestoredToPreWriteNull: true,
  authoritativeVotesRemainEmpty: true,
  exceptionMetadataPreserved:
    updated[0].metadata?.userApprovedExtractionException?.attachedReferenceOnly === true,
  promotedPaperPreserved: updated[0].promoted_paper_id === paperId,
  updatedAt: updated[0].updated_at,
}, null, 2));
