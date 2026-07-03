#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const PDF_DIR = path.join(ROOT, 'data/full-text-pdf-retrieval/ishanka-inbox-2026-06-28/downloads');
const OUT_DIR = path.join(ROOT, 'data/full-text-pdf-retrieval/ishanka-inbox-2026-06-28');
const TEXT_DIR = path.join(OUT_DIR, 'review-text');
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const CRITERIA_VERSION = 'fifa-gbi-full-text-v8-2026-06-23';
const AWAITING_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');
const ACCEPT_MATCH_SCORE = 0.7;
const FILENAME_RECORD_OVERRIDES = new Map([
  ['32_135.pdf', 'S2991'],
  ['EBSCO-FullText-06_28_2026.pdf', 'S3620'],
]);

const args = new Set(process.argv.slice(2));
const SHOULD_UPLOAD = args.has('--upload');
const SHOULD_APPLY_AI = args.has('--apply-ai');
const SHOULD_VERIFY = args.has('--verify');
const valueArg = (name, fallback = null) => {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`${name}=`));
  return arg ? path.resolve(arg.slice(name.length + 1)) : fallback;
};
const REVIEW_FILE = valueArg('--review-file');

const loadEnv = (filePath) => {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
  return env;
};

const env = loadEnv(ENV_PATH);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compact = (value) => normalize(value).replace(/\s+/g, '');
const safeName = (value) => normalize(value).replace(/\s+/g, '-').slice(0, 120) || 'full-text';
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const words = (value) => new Set(normalize(value).split(' ').filter((word) => word.length > 2));
const tokenScore = (a, b) => {
  const aw = words(a);
  const bw = words(b);
  if (!aw.size || !bw.size) return 0;
  let overlap = 0;
  for (const word of aw) if (bw.has(word)) overlap += 1;
  return overlap / Math.max(aw.size, bw.size);
};

const extractDoi = (text) => {
  const match = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (!match) return null;
  return match[0].replace(/[).,;:\]\s]+$/g, '').toLowerCase();
};

const extractTitle = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^<|^page \d|^downloaded by:|^copyrighted material/i.test(line));
  const candidates = [];
  for (let index = 0; index < Math.min(lines.length, 35); index += 1) {
    const line = lines[index];
    if (line.length >= 25 && line.length <= 220) candidates.push(line);
    if (index + 1 < lines.length) {
      const joined = `${line} ${lines[index + 1]}`.trim();
      if (joined.length >= 40 && joined.length <= 240) candidates.push(joined);
    }
    if (index + 2 < lines.length) {
      const joined = `${line} ${lines[index + 1]} ${lines[index + 2]}`.trim();
      if (joined.length >= 40 && joined.length <= 260) candidates.push(joined);
    }
  }
  const rejected = /^(abstract|keywords|article|authors|affiliations|introduction|objective|purpose|background|bibliography|citation|journal|downloaded)/i;
  return candidates.find((line) => !rejected.test(line)) ?? lines[0] ?? '';
};

const extractText = (pdfPath) => {
  const result = spawnSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`pdftotext failed for ${path.basename(pdfPath)}: ${result.stderr}`);
  }
  return result.stdout;
};

const pdfInfo = (pdfPath) => {
  const result = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  if (result.status !== 0) return { pages: null, raw: result.stderr.trim() };
  const pages = result.stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? null;
  return { pages: pages ? Number(pages) : null, raw: result.stdout.trim() };
};

const listFullTextRecords = async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id,assigned_study_id,title,lead_author,year,journal,doi,normalized_doi,stage,storage_bucket,storage_object_path,data_base64,file_name,original_file_name,mime_type,size,file_sha256,metadata,ai_status,ai_suggested_decision,ai_reason,ai_model,ai_criteria_version,ai_reviewed_at')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const listExistingHashes = async () => {
  const hashes = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id,assigned_study_id,file_sha256')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) if (row.file_sha256) hashes.set(row.file_sha256, `screening:${row.assigned_study_id}`);
    if (!data || data.length < 1000) break;
  }
  const { data, error } = await supabase.from('papers').select('assigned_study_id,primary_file_sha256');
  if (error) throw error;
  for (const row of data ?? []) if (row.primary_file_sha256) hashes.set(row.primary_file_sha256, `paper:${row.assigned_study_id}`);
  return hashes;
};

const isAwaiting = (record) =>
  record.metadata?.awaitingFullTextPdf === true
  || (!record.storage_object_path && record.data_base64 === AWAITING_SENTINEL)
  || (!record.storage_object_path && !record.file_sha256);

const loadPdfs = () => {
  fs.mkdirSync(TEXT_DIR, { recursive: true });
  return fs.readdirSync(PDF_DIR)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort()
    .map((fileName) => {
      const pdfPath = path.join(PDF_DIR, fileName);
      const buffer = fs.readFileSync(pdfPath);
      const text = extractText(pdfPath);
      const textPath = path.join(TEXT_DIR, `${fileName.replace(/\.pdf$/i, '')}.txt`);
      fs.writeFileSync(textPath, text);
      return {
        fileName,
        pdfPath,
        textPath,
        size: buffer.length,
        sha256: sha256(buffer),
        pages: pdfInfo(pdfPath).pages,
        doi: extractDoi(text),
        title: extractTitle(text),
        aiRestricted: /artificial intelligence tools or machine learning technologies/i.test(text),
        textPreview: text.slice(0, 5000),
      };
    });
};

const bestMatch = (pdf, records) => {
  const overrideStudyId = FILENAME_RECORD_OVERRIDES.get(pdf.fileName);
  if (overrideStudyId) {
    const record = records.find((candidate) => candidate.assigned_study_id === overrideStudyId);
    if (!record) throw new Error(`Override target ${overrideStudyId} not found for ${pdf.fileName}`);
    return {
      record,
      score: 3,
      doiScore: 0,
      titleScore: 1,
      fileTitleScore: 0,
      awaiting: isAwaiting(record),
      runnerUp: null,
    };
  }
  const pdfDoi = pdf.doi ? compact(pdf.doi) : null;
  const candidates = records.map((record) => {
    const recordDoi = compact(record.normalized_doi || record.doi);
    const doiScore = pdfDoi && recordDoi && (pdfDoi === recordDoi || pdfDoi.includes(recordDoi) || recordDoi.includes(pdfDoi)) ? 1 : 0;
    const titleScore = Math.max(tokenScore(pdf.title, record.title), tokenScore(pdf.textPreview, record.title));
    const fileTitleScore = tokenScore(pdf.fileName.replace(/\.pdf$/i, ''), record.title);
    const score = (doiScore * 2) + titleScore + (fileTitleScore * 0.3) + (isAwaiting(record) ? 0.2 : 0);
    return { record, score, doiScore, titleScore, fileTitleScore, awaiting: isAwaiting(record) };
  }).sort((a, b) => b.score - a.score);
  const [first, second] = candidates;
  return {
    record: first?.record ?? null,
    score: first?.score ?? 0,
    doiScore: first?.doiScore ?? 0,
    titleScore: first?.titleScore ?? 0,
    fileTitleScore: first?.fileTitleScore ?? 0,
    awaiting: first?.awaiting ?? false,
    runnerUp: second ? {
      id: second.record.id,
      assignedStudyId: second.record.assigned_study_id,
      title: second.record.title,
      score: second.score,
    } : null,
  };
};

const uploadBuffer = async (buffer, fileName) => {
  const fileId = crypto.randomUUID();
  const objectName = `${fileId}/${Date.now()}-${safeName(fileName)}.pdf`;
  const { error } = await supabase.storage.from('papers').upload(objectName, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed for ${fileName}: ${error.message}`);
  return { storageBucket: 'papers', storageObjectPath: objectName };
};

const attachPdf = async (pdf, record, existingHashes) => {
  const duplicate = existingHashes.get(pdf.sha256);
  if (duplicate && duplicate !== `screening:${record.assigned_study_id}`) {
    throw new Error(`Duplicate PDF hash already exists in ${duplicate}`);
  }
  if (!isAwaiting(record) && record.file_sha256 && record.file_sha256 !== pdf.sha256) {
    throw new Error(`${record.assigned_study_id} already has a different PDF`);
  }
  if (record.file_sha256 === pdf.sha256 && record.storage_object_path) {
    return { skipped: true, reason: 'already_attached_same_hash' };
  }

  const buffer = fs.readFileSync(pdf.pdfPath);
  const storage = await uploadBuffer(buffer, pdf.fileName);
  const now = new Date().toISOString();
  const metadata = record.metadata ?? {};
  const { data, error } = await supabase
    .from('screening_records')
    .update({
      storage_bucket: storage.storageBucket,
      storage_object_path: storage.storageObjectPath,
      data_base64: null,
      file_name: pdf.fileName,
      original_file_name: pdf.fileName,
      mime_type: 'application/pdf',
      size: pdf.size,
      file_sha256: pdf.sha256,
      metadata: {
        ...metadata,
        awaitingFullTextPdf: false,
        fullTextPdfAttachedAt: now,
        fullTextPdfAttachedBy: PROFILE_ID,
        fullTextPdfSource: 'gmail-ishanka-inbox-2026-06-28',
      },
      updated_at: now,
    })
    .eq('id', record.id)
    .select('id,assigned_study_id,storage_bucket,storage_object_path,file_sha256')
    .single();
  if (error || !data) throw new Error(`Failed to attach ${pdf.fileName} to ${record.assigned_study_id}: ${error?.message ?? 'unknown error'}`);
  existingHashes.set(pdf.sha256, `screening:${record.assigned_study_id}`);
  return { skipped: false, storageBucket: data.storage_bucket, storageObjectPath: data.storage_object_path };
};

const readReviewItems = () => {
  if (!REVIEW_FILE) return [];
  const raw = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
  return Array.isArray(raw) ? raw : raw.recommendations ?? raw.reviews ?? [];
};

const applyAi = async (itemByRecordId, matched) => {
  const applied = [];
  for (const match of matched) {
    const recordId = match.record?.id;
    if (!recordId) continue;
    const item = itemByRecordId.get(recordId);
    if (!item) continue;
    const now = new Date().toISOString();
    const raw = { ...item, source: 'ishanka-inbox-2026-06-28' };
    const update = item.skipped
      ? {
          ai_status: 'failed',
          ai_error: item.reason,
          ai_suggested_decision: null,
          ai_reason: null,
          ai_confidence: null,
          ai_model: item.model,
          ai_criteria_version: CRITERIA_VERSION,
          ai_raw_response: raw,
          ai_reviewed_at: now,
          updated_at: now,
        }
      : {
          ai_status: 'completed',
          ai_error: null,
          ai_suggested_decision: item.decision,
          ai_reason: item.reason,
          ai_confidence: item.confidence ?? null,
          ai_model: item.model,
          ai_criteria_version: CRITERIA_VERSION,
          ai_raw_response: raw,
          ai_reviewed_at: now,
          updated_at: now,
        };
    const { data, error } = await supabase
      .from('screening_records')
      .update(update)
      .eq('id', recordId)
      .select('id,assigned_study_id,ai_status,ai_suggested_decision,ai_reason,ai_model,ai_criteria_version,ai_reviewed_at,ai_error')
      .single();
    if (error || !data) throw new Error(`Failed AI update for ${match.assignedStudyId}: ${error?.message ?? 'unknown error'}`);
    applied.push(data);
  }
  return applied;
};

const verifyRows = async (ids) => {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('screening_records')
    .select('id,assigned_study_id,title,file_name,file_sha256,storage_bucket,storage_object_path,ai_status,ai_suggested_decision,ai_model,ai_criteria_version,ai_error')
    .in('id', ids);
  if (error) throw error;
  const rows = data ?? [];
  const verified = [];
  for (const row of rows) {
    let storageExists = false;
    if (row.storage_bucket && row.storage_object_path) {
      const { data: downloaded, error: downloadError } = await supabase.storage
        .from(row.storage_bucket)
        .download(row.storage_object_path);
      if (!downloadError && downloaded) storageExists = true;
    }
    verified.push({ ...row, storageExists });
  }
  return verified;
};

const main = async () => {
  const records = await listFullTextRecords();
  const pdfs = loadPdfs();
  const matched = pdfs.map((pdf) => {
    const match = bestMatch(pdf, records);
    return {
      ...pdf,
      record: match.record,
      assignedStudyId: match.record?.assigned_study_id ?? null,
      recordTitle: match.record?.title ?? null,
      recordDoi: match.record?.doi ?? null,
      matchScore: Number(match.score.toFixed(3)),
      matchDetails: {
        doiScore: match.doiScore,
        titleScore: Number(match.titleScore.toFixed(3)),
        fileTitleScore: Number(match.fileTitleScore.toFixed(3)),
        awaiting: match.awaiting,
        runnerUp: match.runnerUp,
      },
    };
  });

  const accepted = matched.filter((match) => match.record && match.matchScore >= ACCEPT_MATCH_SCORE);
  const lowConfidence = matched.filter((match) => !match.record || match.matchScore < ACCEPT_MATCH_SCORE);
  const uploadResults = [];
  if (SHOULD_UPLOAD) {
    if (lowConfidence.length) {
      throw new Error(`Refusing upload; ${lowConfidence.length} low-confidence matches. Review match report first.`);
    }
    const existingHashes = await listExistingHashes();
    for (const match of accepted) {
      uploadResults.push({
        fileName: match.fileName,
        assignedStudyId: match.assignedStudyId,
        recordId: match.record.id,
        result: await attachPdf(match, match.record, existingHashes),
      });
    }
  }

  const reviewItems = readReviewItems();
  const itemByRecordId = new Map(reviewItems.map((item) => [item.recordId, item]));
  const aiResults = SHOULD_APPLY_AI ? await applyAi(itemByRecordId, accepted) : [];
  const verify = SHOULD_VERIFY ? await verifyRows(accepted.map((match) => match.record.id)) : [];

  const report = {
    scope: 'Ishanka Gmail Inbox PDF full-text upload and AI review',
    gmailMessageId: '19f0fb1724d98530',
    sourceEmailTimestamp: '2026-06-28T19:22:15+00:00',
    generatedAt: new Date().toISOString(),
    criteriaVersion: CRITERIA_VERSION,
    shouldUpload: SHOULD_UPLOAD,
    shouldApplyAi: SHOULD_APPLY_AI,
    pdfCount: pdfs.length,
    acceptedCount: accepted.length,
    lowConfidenceCount: lowConfidence.length,
    matched,
    uploadResults,
    aiResults,
    verify,
  };
  const reportPath = path.join(
    OUT_DIR,
    `${SHOULD_UPLOAD || SHOULD_APPLY_AI || SHOULD_VERIFY ? 'ishanka-inbox-live-apply-audit' : 'ishanka-inbox-match-dry-run'}-2026-06-29.json`,
  );
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}${os.EOL}`);
  console.log(JSON.stringify({
    reportPath,
    pdfCount: report.pdfCount,
    acceptedCount: report.acceptedCount,
    lowConfidenceCount: report.lowConfidenceCount,
    uploaded: uploadResults.length,
    aiApplied: aiResults.length,
    verified: verify.length,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
