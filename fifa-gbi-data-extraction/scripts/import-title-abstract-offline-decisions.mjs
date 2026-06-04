#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';

const RESERVATION_KEY = 'titleAbstractOfflineReservation';
const AWAITING_FULL_TEXT_PDF_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');
const MAX_NOTE_CHARS = 500;
const SELECT_COLUMNS = '*';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith('--')) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

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
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing offline decisions.');
}

const inputPath = path.resolve(String(args.get('input') || ''));
if (!inputPath || inputPath === process.cwd()) {
  throw new Error('Pass --input /path/to/offline-decisions.json.');
}

const reviewerProfileId = String(args.get('reviewer-profile-id') || '').trim();
if (!reviewerProfileId) {
  throw new Error('Pass --reviewer-profile-id <profile-id>.');
}

const apply = Boolean(args.get('apply'));
const allowStale = Boolean(args.get('allow-stale'));
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const metadataObject = (metadata) => metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};

const getDecisions = (metadata) => {
  const decisions = metadataObject(metadata).titleAbstractDecisions;
  return Array.isArray(decisions)
    ? decisions.filter((decision) =>
      decision &&
      typeof decision === 'object' &&
      decision.reviewerProfileId &&
      ['include', 'exclude', 'flag'].includes(decision.decision) &&
      decision.decidedAt
    ).slice(0, 3)
    : [];
};

const getResolution = (record, decisions = getDecisions(record.metadata)) => {
  const metadata = metadataObject(record.metadata);
  if (metadata.titleAbstractPromotedRecordId) return 'promoted_to_full_text';
  const resolver = decisions.find((decision) => decision.action === 'resolver_decision') ?? decisions[2];
  if (resolver?.decision === 'flag') return 'flagged';
  if (resolver) return resolver.decision === 'include' ? 'ready_for_full_text' : 'excluded';
  const reviewerVotes = decisions.filter((decision) => decision.action !== 'resolver_decision');
  if (reviewerVotes.some((decision) => decision.decision === 'flag')) return 'flagged';
  const human = reviewerVotes.find((decision) => decision.decision === 'include' || decision.decision === 'exclude');
  if (!human) return 'pending';
  const ai = record.ai_status === 'completed' && ['include', 'exclude'].includes(record.ai_suggested_decision)
    ? record.ai_suggested_decision
    : null;
  if (!ai) return 'pending';
  if (human.decision === ai) return ai === 'include' ? 'ready_for_full_text' : 'excluded';
  return 'needs_resolver';
};

const reviewerHasVoted = (metadata, profileId) =>
  getDecisions(metadata).some((decision) => decision.action !== 'resolver_decision' && decision.reviewerProfileId === profileId);

const hasAnyHumanVote = (metadata) =>
  getDecisions(metadata).some((decision) => decision.action !== 'resolver_decision');

const normalizeDoi = (doi) => String(doi ?? '').trim().toLowerCase().replace(/^doi:\s*/i, '');

const normalizeText = (text) => String(text ?? '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\w\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const duplicateKey = (title, author, year) => sha256(`${normalizeText(title)}|${normalizeText(author)}|${String(year ?? '').trim()}`);
const titleFingerprint = (title) => normalizeText(title);

const findFullTextPromotionWarnings = async (record) => {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id, assigned_study_id, title, lead_author, year, doi, normalized_doi')
      .eq('stage', 'full_text')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to check full-text duplicates for ${record.assigned_study_id}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const sourceDoi = normalizeDoi(record.normalized_doi ?? record.doi);
  const sourceKey = duplicateKey(record.title, record.lead_author, record.year);
  return rows.flatMap((candidate) => {
    const candidateDoi = normalizeDoi(candidate.normalized_doi ?? candidate.doi);
    const candidateKey = duplicateKey(candidate.title, candidate.lead_author, candidate.year);
    if (sourceDoi && candidateDoi && sourceDoi === candidateDoi) {
      return [{
        matchedStudyId: candidate.assigned_study_id,
        matchedTitle: candidate.title,
        reason: 'doi',
      }];
    }
    if (sourceKey === candidateKey) {
      return [{
        matchedStudyId: candidate.assigned_study_id,
        matchedTitle: candidate.title,
        reason: 'title_author_year',
      }];
    }
    return [];
  });
};

const loadReviewer = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', reviewerProfileId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load reviewer profile: ${error.message}`);
  if (!data) throw new Error(`Reviewer profile not found: ${reviewerProfileId}`);
  return data;
};

const loadRecord = async (id) => {
  const { data, error } = await supabase
    .from('screening_records')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load screening record ${id}: ${error.message}`);
  return data;
};

const validatePayload = (payload) => {
  if (!payload || typeof payload !== 'object') throw new Error('Decision JSON must be an object.');
  if (!payload.packId || typeof payload.packId !== 'string') throw new Error('Decision JSON is missing packId.');
  if (payload.reviewerProfileId !== reviewerProfileId) {
    throw new Error(`Decision JSON reviewerProfileId (${payload.reviewerProfileId}) does not match --reviewer-profile-id (${reviewerProfileId}).`);
  }
  if (!Array.isArray(payload.decisions)) throw new Error('Decision JSON must contain decisions array.');
  const seen = new Set();
  return payload.decisions.map((decision, index) => {
    if (!decision || typeof decision !== 'object') throw new Error(`Decision ${index + 1} is invalid.`);
    if (!decision.recordId || typeof decision.recordId !== 'string') throw new Error(`Decision ${index + 1} is missing recordId.`);
    if (seen.has(decision.recordId)) throw new Error(`Duplicate decision for recordId ${decision.recordId}.`);
    seen.add(decision.recordId);
    if (!['include', 'exclude', 'flag'].includes(decision.decision)) throw new Error(`Decision ${index + 1} has invalid decision value.`);
    const note = String(decision.note ?? '').trim();
    if (decision.decision === 'flag' && !note) throw new Error(`Flag decision for ${decision.studyId ?? decision.recordId} requires a note.`);
    if (note.length > MAX_NOTE_CHARS) throw new Error(`Decision note for ${decision.studyId ?? decision.recordId} exceeds ${MAX_NOTE_CHARS} characters.`);
    return {
      recordId: decision.recordId,
      studyId: decision.studyId ?? null,
      decision: decision.decision,
      note,
      sourceUpdatedAt: decision.sourceUpdatedAt,
      decidedAt: decision.decidedAt || new Date().toISOString(),
    };
  });
};

const classifyDecision = async (decision, packId) => {
  const record = await loadRecord(decision.recordId);
  if (!record) return { status: 'missing', decision, reason: 'Record not found.' };
  const metadata = metadataObject(record.metadata);
  const existingDecisions = getDecisions(metadata);
  const reservation = metadata[RESERVATION_KEY];
  if (record.stage !== 'title_abstract') return { status: 'skipped', decision, record, reason: 'Record is no longer title_abstract.' };
  if (metadata.titleAbstractPromotedRecordId) return { status: 'skipped', decision, record, reason: 'Record already moved to full text.' };
  if (!reservation || reservation.status !== 'active') return { status: 'skipped', decision, record, reason: 'Record does not have an active offline reservation.' };
  if (reservation.packId !== packId) return { status: 'skipped', decision, record, reason: `Record is reserved to pack ${reservation.packId}, not ${packId}.` };
  if (reservation.reviewerProfileId !== reviewerProfileId) return { status: 'skipped', decision, record, reason: 'Record is reserved to another reviewer.' };
  if (reviewerHasVoted(metadata, reviewerProfileId)) return { status: 'skipped', decision, record, reason: 'Reviewer has already voted.' };
  if (hasAnyHumanVote(metadata)) return { status: 'skipped', decision, record, reason: 'Record already has a human reviewer vote.' };
  if (existingDecisions.length > 0) return { status: 'skipped', decision, record, reason: 'Record already has a title/abstract decision entry.' };
  if (!allowStale && decision.sourceUpdatedAt && record.updated_at !== decision.sourceUpdatedAt) {
    return { status: 'stale', decision, record, reason: `Record changed after export (${decision.sourceUpdatedAt} -> ${record.updated_at}).` };
  }
  return { status: 'ready', decision, record, reason: 'Ready to apply.' };
};

const promoteTitleAbstractRecord = async (record, profileId) => {
  const now = new Date().toISOString();
  const sourceMetadata = metadataObject(record.metadata);
  const duplicateWarnings = await findFullTextPromotionWarnings(record);
  const payload = {
    stage: 'full_text',
    assigned_study_id: record.assigned_study_id,
    title: record.title,
    abstract: record.abstract,
    lead_author: record.lead_author,
    journal: record.journal,
    year: record.year,
    doi: record.doi,
    normalized_doi: normalizeDoi(record.normalized_doi ?? record.doi) || null,
    source_label: record.source_label ?? 'title-abstract-screening',
    source_record_id: record.source_record_id,
    data_base64: AWAITING_FULL_TEXT_PDF_SENTINEL,
    file_name: null,
    original_file_name: null,
    mime_type: null,
    size: null,
    file_sha256: null,
    created_by: profileId,
    metadata: {
      ...sourceMetadata,
      duplicateKeyV2: duplicateKey(record.title, record.lead_author, record.year),
      titleFingerprint: titleFingerprint(record.title),
      titleAbstractRecordId: record.id,
      titleAbstractStudyId: record.assigned_study_id,
      titleAbstractPromotedAt: now,
      titleAbstractPromotedBy: profileId,
      awaitingFullTextPdf: true,
    },
    notes: record.notes,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from('screening_records')
    .insert(payload)
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to create full-text placeholder for ${record.assigned_study_id}: ${error?.message ?? 'No row returned'}`);
  return { id: data.id, duplicateWarnings };
};

const applyDecision = async ({ record, decision }, reviewer) => {
  const now = new Date().toISOString();
  const metadata = metadataObject(record.metadata);
  const decisions = getDecisions(metadata).filter((entry) => entry.action !== 'resolver_decision').slice(0, 1);
  decisions.push({
    reviewerProfileId,
    reviewerName: reviewer.full_name ?? null,
    decision: decision.decision,
    note: decision.note || null,
    decidedAt: now,
    action: 'reviewer_vote',
  });
  const resolution = getResolution(record, decisions);
  const finalDecision = decisions.find((entry) => entry.action !== 'resolver_decision');
  const manualDecision = resolution === 'ready_for_full_text'
    ? 'include'
    : resolution === 'excluded'
      ? 'exclude'
      : null;
  const nextMetadata = {
    ...metadata,
    titleAbstractDecisions: decisions,
    titleAbstractResolution: resolution,
    [RESERVATION_KEY]: {
      ...metadata[RESERVATION_KEY],
      status: 'completed',
      completedAt: now,
    },
  };
  const manualReason = manualDecision === 'exclude'
    ? Array.from(new Set(decisions.filter((entry) => entry.decision === 'exclude').map((entry) => entry.note).filter(Boolean))).join(' / ') || 'Excluded at title/abstract screening'
    : null;
  const { data: updated, error } = await supabase
    .from('screening_records')
    .update({
      metadata: nextMetadata,
      manual_decision: manualDecision,
      manual_reason: manualReason,
      manual_decided_by: finalDecision?.reviewerProfileId ?? reviewerProfileId,
      manual_decided_at: finalDecision ? now : null,
      updated_at: now,
    })
    .eq('id', record.id)
    .eq('updated_at', record.updated_at)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Failed to apply decision to ${record.assigned_study_id}: ${error.message}`);
  if (!updated) {
    return {
      skipped: true,
      status: 'stale_after_classify',
      reason: 'Record changed after dry-run classification and before apply.',
      record,
      resolution: null,
      fullTextRecordId: null,
    };
  }
  if (resolution !== 'ready_for_full_text') {
    return { record: updated, resolution, fullTextRecordId: null };
  }
  const promotion = await promoteTitleAbstractRecord(updated, reviewerProfileId);
  const fullTextRecordId = promotion.id;
  const promotedMetadata = {
    ...metadataObject(updated.metadata),
    titleAbstractPromotedRecordId: fullTextRecordId,
    titleAbstractPromotedAt: new Date().toISOString(),
    titleAbstractPromotedBy: reviewerProfileId,
  };
  const { data: promoted, error: promoteUpdateError } = await supabase
    .from('screening_records')
    .update({ metadata: promotedMetadata, updated_at: new Date().toISOString() })
    .eq('id', updated.id)
    .eq('updated_at', updated.updated_at)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (promoteUpdateError) {
    throw new Error(`Failed to mark ${record.assigned_study_id} as promoted: ${promoteUpdateError.message}`);
  }
  if (!promoted) {
    // The full-text placeholder exists at this point; keep this failure loud so
    // the title/abstract source can be manually linked instead of overwritten.
    throw new Error(`Full-text placeholder ${fullTextRecordId} was created, but ${record.assigned_study_id} changed before it could be linked. Manual repair is required.`);
  }
  return { record: promoted, resolution: 'promoted_to_full_text', fullTextRecordId, duplicateWarnings: promotion.duplicateWarnings };
};

const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const decisions = validatePayload(payload);
const reviewer = await loadReviewer();
const classified = [];
for (const decision of decisions) {
  classified.push(await classifyDecision(decision, payload.packId));
}

const summary = classified.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}, {});

console.log(`Pack ID: ${payload.packId}`);
console.log(`Decisions in file: ${decisions.length}`);
console.log(`Dry-run summary: ${JSON.stringify(summary)}`);
for (const item of classified.filter((entry) => entry.status !== 'ready')) {
  console.log(`${item.status.toUpperCase()}: ${item.decision.studyId ?? item.decision.recordId} - ${item.reason}`);
}

if (!apply) {
  console.log('No database changes were made. Re-run with --apply to import ready decisions.');
  process.exit(classified.some((entry) => entry.status === 'stale' || entry.status === 'missing') ? 1 : 0);
}

let applied = 0;
let skippedDuringApply = 0;
for (const item of classified.filter((entry) => entry.status === 'ready')) {
  const result = await applyDecision(item, reviewer);
  if (result.skipped) {
    skippedDuringApply += 1;
    console.log(`SKIPPED: ${item.record.assigned_study_id} - ${result.reason}`);
    continue;
  }
  applied += 1;
  console.log(`APPLIED: ${item.record.assigned_study_id} -> ${item.decision.decision} (${result.resolution})`);
  for (const warning of result.duplicateWarnings ?? []) {
    console.log(`WARNING: ${item.record.assigned_study_id} may duplicate ${warning.matchedStudyId} by ${warning.reason}: ${warning.matchedTitle}`);
  }
}
console.log(`Applied ${applied} decisions. Skipped ${classified.length - applied}.`);
if (skippedDuringApply > 0) {
  console.log(`Skipped during apply because records changed after classification: ${skippedDuringApply}.`);
}
