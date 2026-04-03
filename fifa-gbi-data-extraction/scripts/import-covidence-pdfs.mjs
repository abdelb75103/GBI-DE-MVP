#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function usage() {
  console.log(`Usage:
  node scripts/import-covidence-pdfs.mjs \
    --manifest <csv> \
    --references <csv> \
    --files-dir <dir> \
    [--apply]
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current);
      current = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0];
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  );
}

function normalizeText(text = '') {
  return String(text)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(doi = '') {
  return String(doi)
    .replace(/PT\s*-\s*Article/gi, ' ')
    .replace(/https?:\/\/(dx\.)?doi\.org\//gi, '')
    .trim()
    .toLowerCase()
    .replace(/^doi:\s*/i, '');
}

function generateDuplicateKeyV2(title, author, year) {
  const combined = `${normalizeText(title)}|${normalizeText(author)}|${String(year || '').trim()}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

function generateTitleFingerprint(title) {
  return normalizeText(title);
}

function computeFileSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function inferLeadAuthor(ref) {
  const study = String(ref['Study'] || '').trim();
  if (study) {
    return study.split(' ')[0];
  }
  const authors = String(ref['Authors'] || '').trim();
  if (!authors) {
    return '';
  }
  return authors.split(' and ')[0].split(',')[0].trim();
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function writeCsv(filePath, rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest || !args.references || !args['files-dir']) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env vars');
  }

  const apply = Boolean(args.apply);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const manifestRows = parseCsv(fs.readFileSync(path.resolve(args.manifest), 'utf8')).filter((row) => row.status === 'downloaded');
  const referenceRows = parseCsv(fs.readFileSync(path.resolve(args.references), 'utf8'));
  const filesDir = path.resolve(args['files-dir']);
  const referenceByCovidence = new Map(referenceRows.map((row) => [row['Covidence #'], row]));

  const [{ data: papers, error: papersError }, { data: fileRows, error: filesError }] = await Promise.all([
    supabase.from('papers').select('id,assigned_study_id,title,extracted_title,lead_author,year,doi,normalized_doi,duplicate_key_v2,title_fingerprint,primary_file_id,primary_file_sha256,original_file_name,status'),
    supabase.from('paper_files').select('id,paper_id,file_sha256,name,original_file_name'),
  ]);
  if (papersError) throw papersError;
  if (filesError) throw filesError;

  const doiMap = new Map();
  const dupKeyMap = new Map();
  const fingerprintMap = new Map();
  for (const paper of papers ?? []) {
    const doi = normalizeDoi(paper.normalized_doi || paper.doi || '');
    if (doi) doiMap.set(doi, paper);
    if (paper.duplicate_key_v2) dupKeyMap.set(paper.duplicate_key_v2, paper);
    const fp = normalizeText(paper.title_fingerprint || paper.extracted_title || paper.title || '');
    if (fp) fingerprintMap.set(fp, paper);
  }
  const fileHashSet = new Set((fileRows ?? []).map((row) => row.file_sha256).filter(Boolean));

  const results = [];
  let nextAssignedStudySequence = Math.max(
    0,
    ...(papers ?? []).map((paper) => {
      const match = /^S(\d+)$/i.exec(paper.assigned_study_id || '');
      return match ? Number(match[1]) : 0;
    }),
  );

  for (const manifestRow of manifestRows) {
    const reference = referenceByCovidence.get(manifestRow.covidence_number);
    if (!reference) {
      results.push({
        covidence_number: manifestRow.covidence_number,
        title: manifestRow.title,
        action: 'skip_missing_reference',
        paper_id: '',
        assigned_study_id: '',
        file_name: manifestRow.file_name,
        note: 'Reference row not found in source CSV',
      });
      continue;
    }

    const title = reference.Title;
    const leadAuthor = inferLeadAuthor(reference);
    const year = String(reference['Published Year'] || '').trim() || null;
    const doi = normalizeDoi(reference.DOI || '');
    const duplicateKeyV2 = generateDuplicateKeyV2(title, leadAuthor, year);
    const titleFingerprint = generateTitleFingerprint(title);
    const filePath = path.join(filesDir, manifestRow.file_name);

    if (!fs.existsSync(filePath)) {
      results.push({
        covidence_number: manifestRow.covidence_number,
        title,
        action: 'skip_missing_file',
        paper_id: '',
        assigned_study_id: '',
        file_name: manifestRow.file_name,
        note: 'Downloaded file not found on disk',
      });
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    const fileSha256 = computeFileSha256(buffer);
    if (fileHashSet.has(fileSha256)) {
      results.push({
        covidence_number: manifestRow.covidence_number,
        title,
        action: 'skip_existing_file_hash',
        paper_id: '',
        assigned_study_id: '',
        file_name: manifestRow.file_name,
        note: 'A paper_file with this SHA-256 already exists',
      });
      continue;
    }

    let targetPaper =
      (doi && doiMap.get(doi)) ||
      dupKeyMap.get(duplicateKeyV2) ||
      fingerprintMap.get(titleFingerprint) ||
      null;

    let created = false;
    if (!targetPaper) {
      nextAssignedStudySequence += 1;
      const assignedStudyId = `S${String(nextAssignedStudySequence).padStart(3, '0')}`;
      const payload = {
        id: crypto.randomUUID(),
        assigned_study_id: assignedStudyId,
        title,
        extracted_title: title,
        lead_author: leadAuthor || null,
        journal: reference.Journal || null,
        year,
        doi: doi || null,
        normalized_doi: doi || null,
        duplicate_key_v2: duplicateKeyV2,
        title_fingerprint: titleFingerprint,
        dedupe_review_status: 'clean',
        primary_file_sha256: null,
        original_file_name: manifestRow.file_name,
        status: 'uploaded',
        storage_bucket: 'papers',
        uploaded_by: null,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          source: 'covidence_import_2026-03-11',
          covidenceNumber: manifestRow.covidence_number,
          covidenceStudy: reference.Study || null,
        },
      };

      if (apply) {
        const { data, error } = await supabase.from('papers').insert(payload).select('*').single();
        if (error) {
          results.push({
            covidence_number: manifestRow.covidence_number,
            title,
            action: 'error_create_paper',
            paper_id: '',
            assigned_study_id: '',
            file_name: manifestRow.file_name,
            note: error.message,
          });
          continue;
        }
        targetPaper = data;
      } else {
        targetPaper = payload;
      }

      doiMap.set(doi, targetPaper);
      dupKeyMap.set(duplicateKeyV2, targetPaper);
      fingerprintMap.set(titleFingerprint, targetPaper);
      created = true;
    }

    if (targetPaper.primary_file_id) {
      results.push({
        covidence_number: manifestRow.covidence_number,
        title,
        action: 'skip_paper_already_has_primary_file',
        paper_id: targetPaper.id,
        assigned_study_id: targetPaper.assigned_study_id,
        file_name: manifestRow.file_name,
        note: 'Matched paper already has primary_file_id',
      });
      continue;
    }

    const fileId = crypto.randomUUID();
    const sanitizedFileName = manifestRow.file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageObjectPath = `${fileId}/${Date.now()}-${sanitizedFileName}`;

    if (apply) {
      const { error: uploadError } = await supabase.storage
        .from('papers')
        .upload(storageObjectPath, buffer, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (uploadError) {
        results.push({
          covidence_number: manifestRow.covidence_number,
          title,
          action: 'error_upload_storage',
          paper_id: targetPaper.id,
          assigned_study_id: targetPaper.assigned_study_id,
          file_name: manifestRow.file_name,
          note: uploadError.message,
        });
        continue;
      }

      const filePayload = {
        id: fileId,
        paper_id: targetPaper.id,
        name: manifestRow.file_name,
        original_file_name: manifestRow.file_name,
        size: buffer.length,
        mime_type: 'application/pdf',
        uploaded_at: new Date().toISOString(),
        data_base64: null,
        storage_bucket: 'papers',
        storage_object_path: storageObjectPath,
        public_url: null,
        file_sha256: fileSha256,
      };

      const { data: fileData, error: fileError } = await supabase.from('paper_files').insert(filePayload).select('id').single();
      if (fileError) {
        results.push({
          covidence_number: manifestRow.covidence_number,
          title,
          action: 'error_attach_file',
          paper_id: targetPaper.id,
          assigned_study_id: targetPaper.assigned_study_id,
          file_name: manifestRow.file_name,
          note: fileError.message,
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from('papers')
        .update({
          primary_file_id: fileData.id,
          primary_file_sha256: fileSha256,
          original_file_name: manifestRow.file_name,
          storage_bucket: 'papers',
          storage_object_path: storageObjectPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPaper.id);
      if (updateError) {
        results.push({
          covidence_number: manifestRow.covidence_number,
          title,
          action: 'error_update_paper',
          paper_id: targetPaper.id,
          assigned_study_id: targetPaper.assigned_study_id,
          file_name: manifestRow.file_name,
          note: updateError.message,
        });
        continue;
      }
    }

    fileHashSet.add(fileSha256);
    results.push({
      covidence_number: manifestRow.covidence_number,
      title,
      action: created ? (apply ? 'created_paper_and_attached_file' : 'would_create_paper_and_attach_file') : (apply ? 'attached_file_to_existing_paper' : 'would_attach_file_to_existing_paper'),
      paper_id: targetPaper.id,
      assigned_study_id: targetPaper.assigned_study_id,
      file_name: manifestRow.file_name,
      note: '',
    });
  }

  const outputPath = path.resolve('covidence-import-results.csv');
  writeCsv(outputPath, results, [
    'covidence_number',
    'title',
    'action',
    'paper_id',
    'assigned_study_id',
    'file_name',
    'note',
  ]);

  const summary = results.reduce((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify(summary, null, 2));
  console.log(`results_csv=${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
