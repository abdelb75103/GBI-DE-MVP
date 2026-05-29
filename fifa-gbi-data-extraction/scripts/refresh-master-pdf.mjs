import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const envPath = '.env.local';

function loadEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function main() {
  const studyId = argValue('--study-id');
  const filePath = argValue('--file');
  if (!studyId || !filePath) {
    throw new Error('Usage: node scripts/refresh-master-pdf.mjs --study-id <ID> --file <pdf-path>');
  }

  const absoluteFilePath = path.resolve(filePath);
  const buffer = fs.readFileSync(absoluteFilePath);
  const fileName = path.basename(absoluteFilePath);
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,metadata')
    .eq('assigned_study_id', studyId)
    .maybeSingle();
  if (paperError || !paper) {
    throw new Error(`Missing paper ${studyId}: ${paperError?.message ?? 'not found'}`);
  }

  const now = new Date().toISOString();
  const storageObjectPath = `${paper.id}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await supabase.storage.from('papers').upload(storageObjectPath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw new Error(`Failed to upload ${fileName}: ${uploadError.message}`);

  const filePayload = {
    name: fileName,
    original_file_name: fileName,
    size: buffer.length,
    mime_type: 'application/pdf',
    uploaded_at: now,
    storage_bucket: 'papers',
    storage_object_path: storageObjectPath,
    file_sha256: fileHash,
  };
  const { data: existingFile, error: existingFileError } = await supabase
    .from('paper_files')
    .select('id')
    .eq('paper_id', paper.id)
    .maybeSingle();
  if (existingFileError) {
    throw new Error(`Failed to check existing paper_files row for ${studyId}: ${existingFileError.message}`);
  }

  let fileRow = existingFile;
  if (existingFile) {
    const { data: updatedFile, error: fileError } = await supabase
      .from('paper_files')
      .update(filePayload)
      .eq('id', existingFile.id)
      .select('id')
      .single();
    if (fileError || !updatedFile) {
      throw new Error(`Failed to update paper_files row for ${fileName}: ${fileError?.message ?? 'Unknown error'}`);
    }
    fileRow = updatedFile;
  } else {
    const { data: insertedFile, error: fileError } = await supabase
      .from('paper_files')
      .insert({
        id: crypto.randomUUID(),
        paper_id: paper.id,
        ...filePayload,
      })
      .select('id')
      .single();
    if (fileError || !insertedFile) {
      throw new Error(`Failed to create paper_files row for ${fileName}: ${fileError?.message ?? 'Unknown error'}`);
    }
    fileRow = insertedFile;
  }

  const { error: updateError } = await supabase
    .from('papers')
    .update({
      primary_file_id: fileRow.id,
      storage_bucket: 'papers',
      storage_object_path: storageObjectPath,
      primary_file_sha256: fileHash,
      original_file_name: fileName,
      metadata: {
        ...(paper.metadata ?? {}),
        refreshedMasterPdfAt: now,
        refreshedMasterPdfName: fileName,
      },
      updated_at: now,
    })
    .eq('id', paper.id);
  if (updateError) throw new Error(`Failed to update ${studyId}: ${updateError.message}`);

  console.log(JSON.stringify({ studyId, fileName, fileId: fileRow.id, storageObjectPath, sha256: fileHash }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
