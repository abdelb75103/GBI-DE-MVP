import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const envPath = path.join(appRoot, '.env.local');
const apply = process.argv.includes('--apply');

const masters = [
  {
    assignedStudyId: 'UEFA-ECIS-MASTER',
    title: 'UEFA ECIS Men Master Extraction',
    extractedTitle: 'UEFA ECIS Men Master Extraction',
    leadAuthor: 'UEFA ECIS master',
    year: '2026',
    filePath: path.join(repoRoot, 'output', 'pdf', 'UEFA_ECIS_Men_Master_Extraction.pdf'),
    fileName: 'UEFA_ECIS_Men_Master_Extraction.pdf',
    metadata: {
      syntheticRecord: true,
      masterExtraction: true,
      masterFamily: 'UEFA ECIS men',
      countingUnit: 'programme-period',
      sourceAuditPath: 'Data Analysis/Data Cleaning/audit/uefa-master/uefa-master-source-audit.json',
      ordinaryUefaSourcesAreSourceOnly: true,
    },
  },
];

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function fingerprint(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 12)
    .join('-');
}

function duplicateKey(title, leadAuthor, year) {
  return [fingerprint(title), fingerprint(leadAuthor), year].filter(Boolean).join('::');
}

async function ensureStatusExists(supabase) {
  const { error } = await supabase
    .from('papers')
    .select('id')
    .eq('status', 'uefa_master_extraction')
    .limit(1);

  if (error) {
    throw new Error(
      `The live database does not appear to accept status "uefa_master_extraction" yet: ${error.message}. Apply the migration first.`,
    );
  }
}

async function createMaster(supabase, master) {
  const buffer = fs.readFileSync(master.filePath);
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const { data: existingByStudyId, error: existingError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,status,primary_file_id')
    .eq('assigned_study_id', master.assignedStudyId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check ${master.assignedStudyId}: ${existingError.message}`);
  }

  if (existingByStudyId) {
    return {
      action: 'skip_existing',
      assignedStudyId: master.assignedStudyId,
      paperId: existingByStudyId.id,
      title: existingByStudyId.title,
      status: existingByStudyId.status,
    };
  }

  const paperId = crypto.randomUUID();
  const now = new Date().toISOString();
  const storageObjectPath = `${paperId}/${Date.now()}-${master.fileName}`;

  const { error: uploadError } = await supabase.storage.from('papers').upload(storageObjectPath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Failed to upload ${master.fileName}: ${uploadError.message}`);
  }

  const paperPayload = {
    id: paperId,
    assigned_study_id: master.assignedStudyId,
    title: master.title,
    extracted_title: master.extractedTitle,
    lead_author: master.leadAuthor,
    year: master.year,
    doi: null,
    normalized_doi: null,
    journal: 'GBI UEFA master extraction',
    duplicate_key_v2: duplicateKey(master.extractedTitle, master.leadAuthor, master.year),
    title_fingerprint: fingerprint(master.extractedTitle),
    dedupe_review_status: 'clean',
    status: 'uefa_master_extraction',
    storage_bucket: 'papers',
    storage_object_path: storageObjectPath,
    primary_file_sha256: fileHash,
    original_file_name: master.fileName,
    uploaded_at: now,
    updated_at: now,
    metadata: master.metadata,
  };

  const { error: paperError } = await supabase.from('papers').insert(paperPayload);
  if (paperError) {
    throw new Error(`Failed to create paper ${master.assignedStudyId}: ${paperError.message}`);
  }

  const filePayload = {
    id: crypto.randomUUID(),
    paper_id: paperId,
    name: master.fileName,
    original_file_name: master.fileName,
    size: buffer.length,
    mime_type: 'application/pdf',
    uploaded_at: now,
    storage_bucket: 'papers',
    storage_object_path: storageObjectPath,
    file_sha256: fileHash,
  };

  const { data: fileRow, error: fileError } = await supabase
    .from('paper_files')
    .insert(filePayload)
    .select('id')
    .single();

  if (fileError || !fileRow) {
    throw new Error(`Failed to attach ${master.fileName}: ${fileError?.message ?? 'Unknown error'}`);
  }

  const { error: updateError } = await supabase
    .from('papers')
    .update({ primary_file_id: fileRow.id, updated_at: new Date().toISOString() })
    .eq('id', paperId);

  if (updateError) {
    throw new Error(`Failed to set primary file for ${master.assignedStudyId}: ${updateError.message}`);
  }

  return {
    action: 'created',
    assignedStudyId: master.assignedStudyId,
    paperId,
    title: master.title,
    status: 'uefa_master_extraction',
    fileName: master.fileName,
    storageObjectPath,
  };
}

async function main() {
  const missingFiles = masters.filter((master) => !fs.existsSync(master.filePath));
  if (missingFiles.length > 0) {
    throw new Error(`Missing PDF(s): ${missingFiles.map((master) => master.filePath).join(', ')}`);
  }

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const plannedActions = masters.map((master) => ({
    assignedStudyId: master.assignedStudyId,
    title: master.title,
    status: 'uefa_master_extraction',
    filePath: master.filePath,
    metadata: master.metadata,
  }));

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          message: 'No live changes made. Re-run with --apply only after Abdel approves these exact actions.',
          plannedActions,
        },
        null,
        2,
      ),
    );
    return;
  }

  await ensureStatusExists(supabase);
  const results = [];
  for (const master of masters) {
    results.push(await createMaster(supabase, master));
  }

  console.log(JSON.stringify({ mode: 'apply', results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
