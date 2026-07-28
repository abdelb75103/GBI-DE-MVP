import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const parseEnv = (contents) => Object.fromEntries(
  contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      return [key, value];
    }),
);

const localEnv = parseEnv(await fs.readFile(path.resolve('.env.local'), 'utf8'));

const apply = process.argv.includes('--apply');
const rollback = process.argv.includes('--rollback');

if (apply && rollback) {
  throw new Error('Choose either --apply or --rollback, not both.');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const targets = [
  {
    studyId: 'S1368',
    expectedStatus: 'uploaded',
    targetStatus: 'archived',
    basis: 'Retracted publication already adjudicated and documented in live notes.',
  },
  {
    studyId: 'S2259',
    expectedStatus: 'uploaded',
    targetStatus: 'retrospective_substudy_analysis',
    basis: 'Source-only severe-injury analysis nested under S1014.',
  },
  {
    studyId: 'S2474',
    expectedStatus: 'uploaded',
    targetStatus: 'retrospective_substudy_analysis',
    basis: 'Source-only age analysis of the S1014 control arm.',
  },
  {
    studyId: 'S3218',
    expectedStatus: 'uploaded',
    targetStatus: 'retrospective_substudy_analysis',
    basis: 'Surface-specific secondary analysis nested under S319.',
  },
  {
    studyId: 'S3577',
    expectedStatus: 'uploaded',
    targetStatus: 'retrospective_substudy_analysis',
    basis: 'Source-only limb-asymmetry analysis in the S344/S2824 QSL family.',
  },
  {
    studyId: 'S4715',
    expectedStatus: 'uploaded',
    targetStatus: 'no_exposure',
    basis: 'Adjudicated no-exposure exclusion already marked reviewed complete in Backlog 2.',
  },
  {
    studyId: 'S642',
    expectedStatus: 'processing',
    targetStatus: 'extracted',
    basis: 'Translation follow-up, Tabs 1-10 QA, provenance verification, and live integrity checks completed.',
  },
];

const select = [
  'id',
  'assigned_study_id',
  'title',
  'status',
  'flag_reason',
  'assigned_to',
  'metadata',
  'updated_at',
].join(',');

const loadRows = async () => {
  const { data, error } = await supabase
    .from('papers')
    .select(select)
    .in('assigned_study_id', targets.map((target) => target.studyId));

  if (error) throw error;
  return data ?? [];
};

const before = await loadRows();
const byStudyId = new Map(before.map((row) => [row.assigned_study_id, row]));

for (const target of targets) {
  const row = byStudyId.get(target.studyId);
  if (!row) throw new Error(`${target.studyId}: paper not found.`);

  const expected = rollback ? target.targetStatus : target.expectedStatus;
  if (row.status !== expected) {
    throw new Error(`${target.studyId}: expected status ${expected}, found ${row.status}.`);
  }
  if (row.flag_reason !== null) {
    throw new Error(`${target.studyId}: expected a cleared flag, found ${JSON.stringify(row.flag_reason)}.`);
  }
}

const intended = targets.map((target) => ({
  studyId: target.studyId,
  from: rollback ? target.targetStatus : target.expectedStatus,
  to: rollback ? target.expectedStatus : target.targetStatus,
  basis: target.basis,
}));

if (!apply && !rollback) {
  console.log(JSON.stringify({ mode: 'dry-run', intended, before }, null, 2));
  process.exit(0);
}

const changed = [];
for (const target of targets) {
  const row = byStudyId.get(target.studyId);
  const from = rollback ? target.targetStatus : target.expectedStatus;
  const to = rollback ? target.expectedStatus : target.targetStatus;

  const { data, error } = await supabase
    .from('papers')
    .update({ status: to })
    .eq('id', row.id)
    .eq('status', from)
    .is('flag_reason', null)
    .select(select);

  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new Error(`${target.studyId}: guarded update changed ${data?.length ?? 0} rows.`);
  }
  changed.push(data[0]);
}

const after = await loadRows();
const afterByStudyId = new Map(after.map((row) => [row.assigned_study_id, row]));

for (const target of targets) {
  const prior = byStudyId.get(target.studyId);
  const current = afterByStudyId.get(target.studyId);
  const expectedStatus = rollback ? target.expectedStatus : target.targetStatus;

  if (!current || current.status !== expectedStatus || current.flag_reason !== null) {
    throw new Error(`${target.studyId}: post-write status verification failed.`);
  }

  for (const key of ['id', 'assigned_study_id', 'title', 'assigned_to']) {
    if (JSON.stringify(current[key]) !== JSON.stringify(prior[key])) {
      throw new Error(`${target.studyId}: protected field ${key} changed.`);
    }
  }

  if (JSON.stringify(current.metadata) !== JSON.stringify(prior.metadata)) {
    throw new Error(`${target.studyId}: metadata changed during status-only reconciliation.`);
  }
}

const audit = {
  artifactType: rollback
    ? 'Completion-status rollback audit'
    : 'Completion-status reconciliation final live audit',
  generatedAt: new Date().toISOString(),
  mode: rollback ? 'rollback' : 'apply',
  intended,
  before,
  changed,
  after,
  verification: {
    result: 'passed',
    checked: [
      'exact target membership',
      'guarded prior status',
      'null flag reason',
      'final status',
      'unchanged id, study ID, title, assignment, and metadata',
    ],
  },
  rollback: rollback
    ? null
    : {
        command: 'node scripts/reconcile-completion-statuses-2026-07-28.mjs --rollback',
        guard: 'Rollback succeeds only while every paper remains in the exact reconciled status with a null flag.',
      },
};

const auditDirectory = path.resolve('data/status-reconciliation/2026-07-28');
await fs.mkdir(auditDirectory, { recursive: true });
const auditName = rollback
  ? 'completion-status-rollback-audit-2026-07-28.json'
  : 'completion-status-final-live-audit-2026-07-28.json';
await fs.writeFile(path.join(auditDirectory, auditName), `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify({
  mode: audit.mode,
  verification: audit.verification,
  statuses: after.map((row) => ({
    studyId: row.assigned_study_id,
    status: row.status,
    flagReason: row.flag_reason,
  })),
  audit: path.join(auditDirectory, auditName),
}, null, 2));
