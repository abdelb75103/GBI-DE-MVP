#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import { finalizeTitleAbstractRecommendation } from './title_abstract_supabase_finalize.mjs';

const require = createRequire(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/package.json'));
const { createClient } = require('@supabase/supabase-js');

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the e2e verifier.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const runId = `E2E-${Date.now()}`;
let titleAbstractId = null;
let fullTextId = null;

const migrationHint = `
Apply the title/abstract AI-human migration, or at minimum run:

alter table public.screening_records
  drop constraint if exists screening_records_assigned_study_id_key;

create unique index if not exists screening_records_stage_assigned_study_id_key
  on public.screening_records (stage, assigned_study_id);
`;

const fail = (message) => {
  throw new Error(`Title/abstract AI-human e2e failed: ${message}`);
};

try {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .limit(1);
  if (profileError) fail(`could not load a reviewer profile: ${profileError.message}`);
  const profile = profiles?.[0];
  if (!profile?.id) fail('no profile exists to use as the temporary human reviewer');

  const decidedAt = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('screening_records')
    .insert({
      stage: 'title_abstract',
      assigned_study_id: runId,
      title: 'Temporary e2e football injury surveillance record',
      abstract: 'Prospective injury surveillance in competitive football players.',
      lead_author: 'E2E',
      journal: 'Temporary Verification',
      year: '2026',
      source_label: 'title-abstract-ai-human-e2e',
      source_record_id: runId,
      ai_status: 'completed',
      ai_suggested_decision: 'include',
      ai_reason: 'Temporary e2e include recommendation for AI-human title/abstract finalization.',
      ai_confidence: 0.99,
      ai_model: 'local e2e verifier',
      ai_criteria_version: 'e2e',
      ai_raw_response: {
        recordId: runId,
        decision: 'include',
        reason: 'Temporary e2e include recommendation.',
        confidence: 0.99,
      },
      ai_reviewed_at: decidedAt,
      created_by: profile.id,
      metadata: {
        titleAbstractDecisions: [{
          reviewerProfileId: profile.id,
          reviewerName: profile.full_name ?? 'E2E Reviewer',
          decision: 'include',
          note: 'Temporary e2e include vote.',
          decidedAt,
          action: 'reviewer_vote',
        }],
      },
    })
    .select('id')
    .single();
  if (insertError) fail(`could not insert temporary title/abstract record. Has the migration been applied? ${insertError.message}`);
  titleAbstractId = inserted.id;

  let finalized;
  try {
    finalized = await finalizeTitleAbstractRecommendation(supabase, titleAbstractId, { quiet: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('screening_records_assigned_study_id_key')) {
      fail(`the remote database still has the old global assigned_study_id unique constraint. ${migrationHint}`);
    }
    throw error;
  }
  if (finalized.resolution !== 'promoted_to_full_text' || !finalized.fullTextRecordId) {
    fail(`expected promoted_to_full_text, got ${JSON.stringify(finalized)}`);
  }
  fullTextId = finalized.fullTextRecordId;

  const { data: titleAbstract, error: titleError } = await supabase
    .from('screening_records')
    .select('manual_decision, metadata')
    .eq('id', titleAbstractId)
    .single();
  if (titleError) fail(`could not reload title/abstract record: ${titleError.message}`);
  if (titleAbstract.manual_decision !== 'include') fail(`manual_decision should be include, got ${titleAbstract.manual_decision}`);
  if (titleAbstract.metadata?.titleAbstractPromotedRecordId !== fullTextId) fail('title/abstract promoted record id was not recorded');

  const { data: fullText, error: fullTextError } = await supabase
    .from('screening_records')
    .select('stage, assigned_study_id, metadata')
    .eq('id', fullTextId)
    .single();
  if (fullTextError) fail(`could not reload full-text record: ${fullTextError.message}`);
  if (fullText.stage !== 'full_text') fail(`promoted record stage should be full_text, got ${fullText.stage}`);
  if (fullText.assigned_study_id !== runId) fail(`promoted study id mismatch: ${fullText.assigned_study_id}`);
  if (fullText.metadata?.awaitingFullTextPdf !== true) fail('promoted full-text record should await PDF upload');

  console.log(`E2E passed: ${runId} promoted from title/abstract to full-text placeholder.`);
} finally {
  if (fullTextId) {
    await supabase.from('screening_records').delete().eq('id', fullTextId);
  }
  if (titleAbstractId) {
    await supabase.from('screening_records').delete().eq('id', titleAbstractId);
  }
}
