import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

/**
 * Purpose
 * -------
 * Generate a reproducible Tab 2 live-update batch from user-approved tag-level shortcut rules.
 *
 * Why this script exists
 * ----------------------
 * For some status groups, the user explicitly approved a status-based assumption to speed up
 * participant-characteristics completion. This script converts those approved rules into a concrete
 * batch JSON file that can be reviewed, applied, and audited like any other intervention.
 *
 * Methodological stance
 * ---------------------
 * This is an operational shortcut approved by the user, not a direct source-text extraction step.
 * The generated batch therefore records the rule source explicitly in its rationale so the resulting
 * values remain auditable and distinguishable from paper-specific manual extraction.
 */

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');

const STATUS_RULES = {
  american_data: {
    fifaDiscipline: 'Association football (11-a-side)',
    country: 'USA',
    levelOfPlay: 'collegiate',
  },
  uefa: {
    fifaDiscipline: 'Association football (11-a-side)',
    country: 'Europe',
    levelOfPlay: 'professional',
  },
  aspetar_asprev: {
    fifaDiscipline: 'Association football (11-a-side)',
    country: 'Qatar',
    levelOfPlay: 'professional',
  },
  fifa_data: {
    fifaDiscipline: 'Association football (11-a-side)',
    levelOfPlay: 'professional',
  },
};

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

async function main() {
  const outPath =
    process.argv[2] ||
    path.join(
      repoRoot,
      'Data Analysis',
      'Data Cleaning',
      'audit',
      'tab2',
      'tab2-shortcut-tag-backfill-2026-04-12.json',
    );

  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const statuses = Object.keys(STATUS_RULES);
  const { data: papers, error } = await supabase
    .from('papers')
    .select('assigned_study_id,status')
    .in('status', statuses)
    .order('assigned_study_id', { ascending: true });

  if (error) throw new Error(`Failed to load papers: ${error.message}`);

  const updates = [];
  for (const paper of papers ?? []) {
    const rules = STATUS_RULES[paper.status];
    if (!rules) continue;

    for (const [fieldId, value] of Object.entries(rules)) {
      updates.push({
        studyId: paper.assigned_study_id,
        fieldId,
        value,
        mode: 'replace_if_different',
        rationale: `User-approved tag-level shortcut for status '${paper.status}' on 2026-04-12.`,
      });
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        notes:
          'User-approved tag-level Tab 2 shortcut backfill for fifaDiscipline, country, and levelOfPlay. This batch intentionally uses replace_if_different to enforce the approved status defaults where live values differ.',
        updates,
      },
      null,
      2,
    ),
  );

  console.log(outPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
