import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Download the local source PDFs for a selected Tab 2 sex-backlog batch and
 * extract the first two pages of machine-readable text into the audit workspace.
 *
 * Why this script exists
 * ----------------------
 * The Tab 2 recovery workflow now mixes:
 * - approved status/title shortcuts for low-risk fields, and
 * - direct paper review for the remaining ambiguous papers.
 *
 * For the remaining sex backlog we need a saved, reproducible source trail
 * showing exactly what PDF text was reviewed before any live update is applied.
 * This script stages that trail without mutating the database.
 */

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');
const workRoot = path.join(
  repoRoot,
  'Data Analysis',
  'Data Cleaning',
  'audit',
  'tab2',
  'work',
  'sex-source-review',
);

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

async function fetchAllRows(supabase, table, select, builder) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (builder) query = builder(query);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function sanitizeFileComponent(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractFirstPages(pdfPath) {
  try {
    return execFileSync('pdftotext', ['-f', '1', '-l', '2', pdfPath, '-'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

async function main() {
  const ids = (process.env.GBI_TAB2_SEX_STUDY_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error('Set GBI_TAB2_SEX_STUDY_IDS to a comma-separated list of study IDs.');
  }

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const papers = (
    await fetchAllRows(
      supabase,
      'papers',
      'id,assigned_study_id,title,status,year,storage_object_path,storage_bucket,original_file_name',
      (query) => query.order('assigned_study_id', { ascending: true }),
    )
  ).filter((paper) => ids.includes(paper.assigned_study_id));

  fs.mkdirSync(workRoot, { recursive: true });
  const manifest = [];

  for (const paper of papers) {
    if (!paper.storage_object_path) {
      manifest.push({
        studyId: paper.assigned_study_id,
        status: paper.status,
        year: paper.year,
        title: paper.title,
        pdfPath: null,
        textPath: null,
        note: 'Missing storage_object_path',
      });
      continue;
    }

    const bucket = paper.storage_bucket || 'papers';
    const { data, error } = await supabase.storage.from(bucket).download(paper.storage_object_path);
    if (error || !data) {
      manifest.push({
        studyId: paper.assigned_study_id,
        status: paper.status,
        year: paper.year,
        title: paper.title,
        pdfPath: null,
        textPath: null,
        note: `Download failed: ${error?.message ?? 'unknown error'}`,
      });
      continue;
    }

    const dir = path.join(workRoot, paper.assigned_study_id);
    fs.mkdirSync(dir, { recursive: true });

    const baseName = sanitizeFileComponent(
      paper.original_file_name || path.basename(paper.storage_object_path) || `${paper.assigned_study_id}.pdf`,
    ) || `${paper.assigned_study_id}.pdf`;
    const pdfPath = path.join(dir, baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`);
    const textPath = path.join(dir, 'first-pages.txt');

    fs.writeFileSync(pdfPath, Buffer.from(await data.arrayBuffer()));
    fs.writeFileSync(textPath, extractFirstPages(pdfPath), 'utf8');

    manifest.push({
      studyId: paper.assigned_study_id,
      status: paper.status,
      year: paper.year,
      title: paper.title,
      pdfPath,
      textPath,
      note: 'ok',
    });
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const manifestPath = path.join(workRoot, `manifest-${stamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`manifest=${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
