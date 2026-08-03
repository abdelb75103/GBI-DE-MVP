#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const MAPPING_PATH = path.join(
  REPO_ROOT,
  'outputs/title-abstract-promotion-repair-2026-07-30/apply-result.json',
);
const OUT_DIR = path.join(
  APP_ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/extraction-gate-audit-2026-07-30',
);
const BACKLOG_PATH = path.join(
  APP_ROOT,
  'docs/second-search-extraction-review-backlog-2026-07-03.md',
);
const ENV_PATH = path.join(APP_ROOT, '.env.local');
const EXPECTED_CRITERIA = 'fifa-gbi-full-text-v8-2026-06-23';
const EXCLUDED_EXCEPTION_ID = 'S845';

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

async function query(supabase, table, columns, configure) {
  let request = supabase.from(table).select(columns);
  if (configure) request = configure(request);
  const { data, error } = await request;
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}

async function pagedQuery(supabase, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await query(
      supabase,
      table,
      columns,
      (request) => request.range(from, from + 999),
    );
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function authoritativeFullTextVotes(record, relationalVotes) {
  const matchingRelational = relationalVotes
    .filter((vote) => vote.screening_record_id === record.id)
    .filter((vote) => ['include', 'exclude'].includes(vote.decision));
  if (matchingRelational.length) return matchingRelational;
  return (Array.isArray(record.metadata?.fullTextDecisions)
    ? record.metadata.fullTextDecisions
    : []
  ).filter((vote) => (
    vote
    && ['include', 'exclude'].includes(vote.decision)
    && vote.reviewerProfileId
    && vote.decidedAt
  ));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const env = loadEnv(ENV_PATH);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables.');
  }
  const mappingPayload = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  if (mappingPayload.completed !== true || mappingPayload.failure) {
    throw new Error('The 2026-07-30 title/abstract promotion mapping is not complete.');
  }
  const mapping = mappingPayload.applied ?? [];
  const recordIds = mapping.map((row) => row.fullTextRecordId);
  const studyIds = mapping.map((row) => row.assignedStudyId);
  if (recordIds.length !== 27 || new Set(recordIds).size !== 27) {
    throw new Error('Expected an exact 27-record full-text cohort.');
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const [
    screeningRecords,
    screeningVotes,
    papers,
    allPaperHashRows,
    allPaperFileHashRows,
  ] = await Promise.all([
    query(supabase, 'screening_records', '*', (request) => request.in('id', recordIds)),
    query(supabase, 'screening_votes', '*', (request) => request.in('screening_record_id', recordIds)),
    query(supabase, 'papers', '*', (request) => request.in('assigned_study_id', studyIds)),
    pagedQuery(
      supabase,
      'papers',
      'id,assigned_study_id,primary_file_sha256,updated_at',
    ),
    pagedQuery(
      supabase,
      'paper_files',
      'id,paper_id,file_sha256,storage_bucket,storage_object_path,uploaded_at',
    ),
  ]);
  if (screeningRecords.length !== 27) {
    throw new Error(`Expected 27 live screening rows, found ${screeningRecords.length}.`);
  }

  const paperIds = papers.map((paper) => paper.id);
  const [
    paperFiles,
    paperNotes,
    extractions,
    populationGroups,
    populationValues,
  ] = paperIds.length
    ? await Promise.all([
        query(supabase, 'paper_files', '*', (request) => request.in('paper_id', paperIds)),
        query(supabase, 'paper_notes', '*', (request) => request.in('paper_id', paperIds)),
        query(supabase, 'extractions', '*', (request) => request.in('paper_id', paperIds)),
        query(supabase, 'population_groups', '*', (request) => request.in('paper_id', paperIds)),
        query(supabase, 'population_values', '*', (request) => request.in('paper_id', paperIds)),
      ])
    : [[], [], [], [], []];
  const extractionIds = extractions.map((row) => row.id);
  const extractionFields = extractionIds.length
    ? await query(
        supabase,
        'extraction_fields',
        '*',
        (request) => request.in('extraction_id', extractionIds),
      )
    : [];

  const papersByStudyId = new Map(papers.map((paper) => [paper.assigned_study_id, paper]));
  const hashOwners = new Map();
  for (const paper of allPaperHashRows) {
    if (paper.primary_file_sha256) {
      hashOwners.set(paper.primary_file_sha256, paper.assigned_study_id);
    }
  }
  const paperIdToStudyId = new Map(
    allPaperHashRows.map((paper) => [paper.id, paper.assigned_study_id]),
  );
  for (const file of allPaperFileHashRows) {
    if (file.file_sha256 && !hashOwners.has(file.file_sha256)) {
      hashOwners.set(
        file.file_sha256,
        paperIdToStudyId.get(file.paper_id) ?? `paper_file:${file.id}`,
      );
    }
  }
  const backlogText = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const paperFileVerifications = [];
  for (const file of paperFiles) {
    const verification = {
      paperFileId: file.id,
      paperId: file.paper_id,
      bucket: file.storage_bucket,
      objectPath: file.storage_object_path,
      expectedSha256: file.file_sha256,
      readable: false,
      hashMatched: false,
      downloadedSha256: null,
      error: null,
    };
    if (file.storage_bucket && file.storage_object_path && file.file_sha256) {
      const { data, error } = await supabase.storage
        .from(file.storage_bucket)
        .download(file.storage_object_path);
      if (error || !data) {
        verification.error = error?.message ?? 'No storage object returned';
      } else {
        verification.downloadedSha256 = sha256(Buffer.from(await data.arrayBuffer()));
        verification.readable = true;
        verification.hashMatched = verification.downloadedSha256 === file.file_sha256;
      }
    } else {
      verification.error = 'Paper file has no complete storage pointer and hash.';
    }
    paperFileVerifications.push(verification);
  }
  const results = [];

  for (const record of screeningRecords) {
    const votes = authoritativeFullTextVotes(record, screeningVotes);
    const includeVotes = votes.filter((vote) => vote.decision === 'include');
    const excludeVotes = votes.filter((vote) => vote.decision === 'exclude');
    const paper = papersByStudyId.get(record.assigned_study_id) ?? null;
    const reasons = [];
    if (record.stage !== 'full_text') reasons.push('not_full_text');
    if (record.ai_status !== 'completed') reasons.push('ai_not_completed');
    if (record.ai_suggested_decision !== 'include') reasons.push('ai_not_include');
    if (record.ai_criteria_version !== EXPECTED_CRITERIA) reasons.push('not_current_criteria');
    if (includeVotes.length !== 1) reasons.push(`human_include_count_${includeVotes.length}`);
    if (excludeVotes.length !== 0) reasons.push(`human_exclude_count_${excludeVotes.length}`);
    if (!record.storage_bucket || !record.storage_object_path || !record.file_sha256) {
      reasons.push('missing_verified_full_text_pointer');
    }
    if (record.metadata?.awaitingFullTextPdf !== false) reasons.push('awaiting_full_text');
    if (record.promoted_paper_id) reasons.push('already_promoted');
    if (paper) reasons.push('paper_study_id_exists');
    const existingHashOwner = hashOwners.get(record.file_sha256);
    if (existingHashOwner && existingHashOwner !== record.assigned_study_id) {
      reasons.push(`paper_file_hash_exists_${existingHashOwner}`);
    }
    if (record.assigned_study_id === EXCLUDED_EXCEPTION_ID) {
      reasons.push('excluded_s845_reference_only_exception');
    }

    let storageVerification = {
      attempted: false,
      readable: false,
      hashMatched: false,
      downloadedSha256: null,
      error: null,
    };
    if (record.storage_bucket && record.storage_object_path && record.file_sha256) {
      storageVerification.attempted = true;
      const { data, error } = await supabase.storage
        .from(record.storage_bucket)
        .download(record.storage_object_path);
      if (error || !data) {
        storageVerification.error = error?.message ?? 'No storage object returned';
        reasons.push('storage_download_failed');
      } else {
        const downloadedSha256 = sha256(Buffer.from(await data.arrayBuffer()));
        storageVerification = {
          attempted: true,
          readable: true,
          hashMatched: downloadedSha256 === record.file_sha256,
          downloadedSha256,
          error: null,
        };
        if (!storageVerification.hashMatched) reasons.push('storage_hash_mismatch');
      }
    }

    const factualPredicateMatched = reasons.length === 0;
    results.push({
      studyId: record.assigned_study_id,
      screeningRecordId: record.id,
      factualPredicateMatched,
      promotionSupportedByCurrentGate: false,
      reasons,
      ai: {
        status: record.ai_status,
        decision: record.ai_suggested_decision,
        criteriaVersion: record.ai_criteria_version,
        model: record.ai_model,
        reviewedAt: record.ai_reviewed_at,
        rawResponse: record.ai_raw_response,
      },
      humanVotes: votes,
      manualFields: {
        decision: record.manual_decision,
        reason: record.manual_reason,
        decidedBy: record.manual_decided_by,
        decidedAt: record.manual_decided_at,
      },
      resolution: record.metadata?.fullTextResolution ?? null,
      promotionFields: {
        paperId: record.promoted_paper_id,
        promotedBy: record.promoted_by,
        promotedAt: record.promoted_at,
      },
      screeningFile: {
        bucket: record.storage_bucket,
        objectPath: record.storage_object_path,
        fileSha256: record.file_sha256,
        mimeType: record.mime_type,
        size: record.size,
        awaitingFullTextPdf: record.metadata?.awaitingFullTextPdf ?? null,
        storageVerification,
      },
      currentPaper: paper,
      currentPaperFiles: paper
        ? paperFiles.filter((file) => file.paper_id === paper.id)
        : [],
      currentPaperNotes: paper
        ? paperNotes.filter((note) => note.paper_id === paper.id)
        : [],
      currentPaperFileVerifications: paper
        ? paperFileVerifications.filter((file) => file.paperId === paper.id)
        : [],
      backlog2Matches: backlogText
        .split(/\r?\n/)
        .filter((line) => line.includes(`| ${record.assigned_study_id} |`)),
      updatedAt: record.updated_at,
    });
  }

  results.sort((left, right) => (
    Number(left.studyId.slice(1)) - Number(right.studyId.slice(1))
  ));
  const exactPredicateIds = results
    .filter((row) => row.factualPredicateMatched)
    .map((row) => row.studyId);
  const snapshot = {
    artifactType: 'Read-only pre-write snapshot and unsupported-gate manifest',
    generatedAt,
    mode: 'read_only',
    cohort: {
      source: MAPPING_PATH,
      count: mapping.length,
      mapping,
    },
    gate: {
      requestedPredicate: [
        'completed full-text AI include under fifa-gbi-full-text-v8-2026-06-23',
        'exactly one authoritative human full-text include',
        'zero human excludes or conflicts',
        'verified full text',
        'not already promoted',
        'member of the exact 2026-07-30 cohort',
      ],
      currentAuthoritativeRule: 'Two distinct human full-text include votes are required.',
      historicalBridgeStatus: 'retired',
      supported: false,
      blocker: 'No current documented gate permits AI plus one human promotion.',
      unblock: [
        'Obtain the second authoritative human include through save_screening_vote.',
        'Or approve a versioned repository amendment that explicitly reopens a cohort-scoped AI-plus-one-human bridge.',
      ],
    },
    exactPredicateIds,
    exactPredicateCount: exactPredicateIds.length,
    workflowStatus: {
      promotions: 'blocked_unsupported_gate',
      extractions: 'not_started',
      backlog2: 'not_started',
      liveWritesPerformedByThisAudit: 0,
    },
    rollback: {
      requiredNow: false,
      reason: 'This audit performs no live writes.',
      futurePromotionRollback:
        'Restore guarded rows from this snapshot. Deleting inserted paper/file/extraction rows would be destructive and requires explicit approval.',
    },
    results,
    exactLiveSnapshot: {
      screeningRecords,
      screeningVotes,
      papers,
      paperFiles,
      paperNotes,
      extractions,
      extractionFields,
      populationGroups,
      populationValues,
    },
    globalDuplicateBaseline: {
      papersCount: allPaperHashRows.length,
      paperFilesCount: allPaperFileHashRows.length,
      papersHash: stableHash(allPaperHashRows),
      paperFilesHash: stableHash(allPaperFileHashRows),
    },
    paperFileVerifications,
    hashes: {
      screeningRecords: stableHash(screeningRecords),
      screeningVotes: stableHash(screeningVotes),
      papers: stableHash(papers),
      paperFiles: stableHash(paperFiles),
      paperNotes: stableHash(paperNotes),
      extractions: stableHash(extractions),
      extractionFields: stableHash(extractionFields),
      populationGroups: stableHash(populationGroups),
      populationValues: stableHash(populationValues),
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outputPath = path.join(OUT_DIR, `blocked-gate-snapshot-${timestampSlug()}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({
    outputPath,
    exactPredicateIds,
    supported: false,
    liveWritesPerformed: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
