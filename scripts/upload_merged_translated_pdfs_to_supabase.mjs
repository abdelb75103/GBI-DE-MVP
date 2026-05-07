#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, 'fifa-gbi-data-extraction', '.env.local');
const mergedManifestPath = path.join(
  repoRoot,
  'outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/merged-translated-original-manifest.csv',
);
const sourceManifestPath = path.join(repoRoot, 'exports/non-english-translations/manifest.csv');
const outDir = path.join(repoRoot, 'outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18');
const uploadAuditPath = path.join(outDir, 'SUPABASE_UPLOAD_AUDIT.md');
const uploadManifestPath = path.join(outDir, 'supabase-upload-manifest.csv');

const included = ['#50', '#245', '#720', '#53', '#626', '#719', '#733', '#734', '#855', '#113', '#412', '#815', '#835', '#547', '#249', '#252', '#752', '#744'];

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function randomId() {
  return crypto.randomUUID();
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function normalizeDoi(value) {
  return String(value ?? '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '') || null;
}

function titleFingerprint(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || null;
}

function cleanTitle(row) {
  const title = String(row.title ?? '').replace(/\s+Full text.*$/i, '').replace(/\s+Primary Full text.*$/i, '').trim();
  return title || row.covidence_number;
}

function leadAuthor(row) {
  const title = cleanTitle(row);
  const match = title.match(/^([A-Za-zÀ-ÖØ-öø-ÿ'-]+)/);
  return match ? match[1] : null;
}

function year(row) {
  const match = String(row.title ?? '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function duplicateKey(title, lead, yr) {
  return [titleFingerprint(title), String(lead ?? '').toLowerCase(), yr ?? ''].filter(Boolean).join('|') || null;
}

async function nextAssignedStudyId(supabase) {
  const { data, error } = await supabase
    .from('papers')
    .select('assigned_study_id')
    .order('assigned_study_id', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to load study id: ${error.message}`);
  const current = data?.[0]?.assigned_study_id ?? 'S000';
  const number = Number(String(current).replace(/\D/g, '')) + 1;
  return `S${String(number).padStart(3, '0')}`;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sourceRows = new Map(readCsv(sourceManifestPath).map((row) => [row.covidence_number, row]));
  const mergedRows = readCsv(mergedManifestPath).filter((row) => included.includes(row.covidence_number));
  if (mergedRows.length !== 18) throw new Error(`Expected 18 merged rows, found ${mergedRows.length}`);

  const results = [];
  for (const merged of mergedRows) {
    const covId = merged.covidence_number;
    const source = sourceRows.get(covId);
    if (!source) throw new Error(`Missing source manifest row for ${covId}`);

    const pdfPath = merged.merged_pdf;
    const buffer = fs.readFileSync(pdfPath);
    const fileHash = sha256(buffer);
    const fileName = path.basename(pdfPath);
    const title = cleanTitle(source);
    const lead = leadAuthor(source);
    const yr = year(source);
    const normalizedDoi = normalizeDoi(source.title.match(/DOI:\s*([^\s]+)/i)?.[1] ?? null);
    const existing = await supabase
      .from('papers')
      .select('id,assigned_study_id,title,status')
      .eq('metadata->>translatedCovidenceNumber', covId)
      .maybeSingle();
    if (existing.error) throw new Error(`Existing paper lookup failed for ${covId}: ${existing.error.message}`);

    const storageObjectPath = `translated-merged/${covId.replace('#', '')}/${Date.now()}-${sanitizeFileName(fileName)}`;
    const upload = await supabase.storage.from('papers').upload(storageObjectPath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (upload.error) throw new Error(`Storage upload failed for ${covId}: ${upload.error.message}`);

    let paperId;
    let assignedStudyId;
    let action;
    const now = new Date().toISOString();
    const metadata = {
      translatedCovidenceNumber: covId,
      translatedMergedPdfWorkflow: 'translated_first_original_second',
      translatedMergedGeneratedAt: now,
      translatedMergedLocalPath: pdfPath,
      translatedSmartAppendixBase: 'outputs/extraction-ready-translations/2026-05-07/smart-appendix-batch-all18',
      originalPdfPath: merged.original_pdf,
      translatedPages: Number(merged.translated_pages),
      originalPages: Number(merged.original_pages),
      totalPages: Number(merged.total_pages),
      sourceLanguage: source.language ?? null,
      sourceResolution: source.source_resolution ?? null,
    };

    if (existing.data) {
      paperId = existing.data.id;
      assignedStudyId = existing.data.assigned_study_id;
      const paperUpdate = await supabase
        .from('papers')
        .update({
          title,
          extracted_title: title,
          lead_author: lead,
          year: yr,
          doi: normalizedDoi,
          normalized_doi: normalizedDoi,
          duplicate_key_v2: duplicateKey(title, lead, yr),
          title_fingerprint: titleFingerprint(title),
          primary_file_sha256: fileHash,
          original_file_name: fileName,
          status: 'uploaded',
          storage_bucket: 'papers',
          storage_object_path: storageObjectPath,
          updated_at: now,
          metadata,
        })
        .eq('id', paperId);
      if (paperUpdate.error) throw new Error(`Paper update failed for ${covId}: ${paperUpdate.error.message}`);
      action = 'updated_existing_metadata_match';
    } else {
      assignedStudyId = await nextAssignedStudyId(supabase);
      paperId = randomId();
      const insert = await supabase.from('papers').insert({
        id: paperId,
        assigned_study_id: assignedStudyId,
        title,
        extracted_title: title,
        lead_author: lead,
        journal: null,
        year: yr,
        doi: normalizedDoi,
        normalized_doi: normalizedDoi,
        duplicate_key_v2: duplicateKey(title, lead, yr),
        title_fingerprint: titleFingerprint(title),
        dedupe_review_status: 'clean',
        status: 'uploaded',
        storage_bucket: 'papers',
        storage_object_path: storageObjectPath,
        primary_file_sha256: fileHash,
        original_file_name: fileName,
        uploaded_by: null,
        uploaded_at: now,
        updated_at: now,
        metadata,
      });
      if (insert.error) throw new Error(`Paper insert failed for ${covId}: ${insert.error.message}`);
      action = 'created_new_extraction_paper';
    }

    const fileId = randomId();
    const fileInsert = await supabase.from('paper_files').insert({
      id: fileId,
      paper_id: paperId,
      name: fileName,
      original_file_name: fileName,
      size: buffer.length,
      mime_type: 'application/pdf',
      uploaded_at: now,
      storage_bucket: 'papers',
      storage_object_path: storageObjectPath,
      public_url: null,
      data_base64: null,
      file_sha256: fileHash,
    });
    if (fileInsert.error) throw new Error(`paper_files insert failed for ${covId}: ${fileInsert.error.message}`);

    const primaryUpdate = await supabase
      .from('papers')
      .update({ primary_file_id: fileId, storage_bucket: 'papers', storage_object_path: storageObjectPath, updated_at: now })
      .eq('id', paperId);
    if (primaryUpdate.error) throw new Error(`Primary file update failed for ${covId}: ${primaryUpdate.error.message}`);

    results.push({
      covidence_number: covId,
      action,
      paper_id: paperId,
      assigned_study_id: assignedStudyId,
      title,
      file_id: fileId,
      storage_bucket: 'papers',
      storage_object_path: storageObjectPath,
      file_sha256: fileHash,
      size: buffer.length,
      merged_pdf: pdfPath,
    });
    console.log(`${covId} ${action} ${assignedStudyId} ${paperId}`);
  }

  const headers = Object.keys(results[0]);
  fs.writeFileSync(uploadManifestPath, [headers.join(','), ...results.map((row) => headers.map((h) => csvEscape(row[h])).join(','))].join('\n') + '\n');
  fs.writeFileSync(
    uploadAuditPath,
    [
      '# Supabase Upload Audit',
      '',
      `- Uploaded at: ${new Date().toISOString()}`,
      `- Records uploaded: \`${results.length}\``,
      `- Upload manifest: \`${uploadManifestPath}\``,
      '- Storage bucket: `papers`',
      '- Upload action: direct extraction paper upload; no pending upload queue.',
      '',
      '| Covidence | Study ID | Action | Paper ID | Storage object |',
      '| --- | --- | --- | --- | --- |',
      ...results.map((row) => `| ${row.covidence_number} | ${row.assigned_study_id} | ${row.action} | ${row.paper_id} | \`${row.storage_object_path}\` |`),
      '',
    ].join('\n'),
  );
  console.log(uploadAuditPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
