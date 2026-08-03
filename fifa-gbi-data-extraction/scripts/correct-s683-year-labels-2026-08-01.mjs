import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const AUDIT_PATH = path.join(
  APP_DIR,
  'data',
  'full-text-pdf-retrieval',
  'promoted-title-abstract-2026-07-30',
  'extraction-gate-audit-2026-07-30',
  's683-year-label-correction-final-live-audit-2026-08-01.json',
);
const STUDY_ID = 'S683';
const PAPER_ID = 'f6a4ee4e-6aa6-48fe-88f3-5f498373dd61';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const FILE_SHA256 = '924a293491d65ac6ba1672c18887a0e825796a031c0576a661ee194d43cc6b67';
const BEFORE_LABELS = ['Futsal - all seasons', 'Futsal - 2015', 'Futsal - 2016', 'Futsal - 2017'];
const AFTER_LABELS = ['Total', '2015', '2016', '2017'];
const APPLY = process.argv.includes('--apply');

const parseEnv = (contents) => Object.fromEntries(
  contents.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2'),
      ];
    }),
);
const env = parseEnv(fs.readFileSync(path.join(APP_DIR, '.env.local'), 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { createPopulationSignature } = await import('../src/lib/extraction/populations.ts');

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};
const stableHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sorted = (rows) => [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));

const fetchSnapshot = async () => {
  const papers = requireData(await supabase.from('papers').select('*').eq('id', PAPER_ID), 'paper');
  const files = requireData(await supabase.from('paper_files').select('*').eq('paper_id', PAPER_ID), 'files');
  const extractions = requireData(await supabase.from('extractions').select('*').eq('paper_id', PAPER_ID), 'extractions');
  const fields = extractions.length
    ? requireData(
      await supabase.from('extraction_fields').select('*').in('extraction_id', extractions.map((row) => row.id)),
      'fields',
    )
    : [];
  const groups = requireData(
    await supabase.from('population_groups').select('*').eq('paper_id', PAPER_ID).order('position'),
    'groups',
  );
  const values = requireData(await supabase.from('population_values').select('*').eq('paper_id', PAPER_ID), 'values');
  const screening = requireData(
    await supabase.from('screening_records').select('*').eq('assigned_study_id', STUDY_ID),
    'screening',
  );
  const votes = screening.length
    ? requireData(
      await supabase.from('screening_votes').select('*').in('screening_record_id', screening.map((row) => row.id)),
      'votes',
    )
    : [];
  return { papers, files, extractions, fields, groups, values, screening, votes };
};

const groupsWithValues = (snapshot, labels) => snapshot.groups.map((group, position) => ({
  position,
  label: labels[position],
  values: snapshot.values
    .filter((row) => row.population_group_id === group.id && row.value !== null && String(row.value).trim())
    .reduce((result, row) => ({ ...result, [row.field_id]: String(row.value).trim() }), {}),
}));
const protectedSignature = (snapshot) => stableHash({
  screening: sorted(snapshot.screening),
  votes: sorted(snapshot.votes),
  extractions: sorted(snapshot.extractions),
  fields: sorted(snapshot.fields),
  values: sorted(snapshot.values),
  files: sorted(snapshot.files),
});

const before = await fetchSnapshot();
const paperBefore = before.papers[0];
if (
  before.papers.length !== 1
  || paperBefore.assigned_study_id !== STUDY_ID
  || paperBefore.status !== 'processing'
  || paperBefore.assigned_to !== PROFILE_ID
  || paperBefore.primary_file_sha256 !== FILE_SHA256
) throw new Error('S683 guarded paper state changed');
if (before.files.length !== 1 || before.files[0].file_sha256 !== FILE_SHA256) {
  throw new Error('S683 source attachment changed');
}
if (JSON.stringify(before.groups.map((row) => row.label)) !== JSON.stringify(BEFORE_LABELS)) {
  throw new Error('S683 current population labels are not the verified futsal/year layout');
}
if (before.extractions.length !== 10 || before.fields.length !== 68 || before.groups.length !== 4) {
  throw new Error('S683 extraction shape changed');
}
const stagedGroups = groupsWithValues(before, AFTER_LABELS);
const expectedPopulationHash = createPopulationSignature(stagedGroups);
const protectedBefore = protectedSignature(before);

const audit = {
  artifactType: 'S683 Total-plus-year label correction final live audit',
  date: '2026-08-01',
  mode: APPLY ? 'apply' : 'dry_run',
  scope: 'S683 only; preserve the existing futsal year split and relabel its rows as Total / 2015 / 2016 / 2017',
  preState: before,
  preStateSummary: {
    priorLabels: BEFORE_LABELS,
    correctedLabels: AFTER_LABELS,
    protectedSignatureSha256: protectedBefore,
    populationHashBefore: paperBefore.metadata?.populationHash ?? null,
    populationHashAfter: expectedPopulationHash,
  },
  applyResult: null,
  integrityGate: null,
  rollback: 'Restore preState.groups labels and preState.papers[0].metadata. No rows are inserted, deleted, or cleared.',
};
if (APPLY) fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
if (!APPLY) {
  console.log(JSON.stringify({
    mode: 'dry_run',
    preconditions: 'passed',
    priorLabels: BEFORE_LABELS,
    correctedLabels: AFTER_LABELS,
    extractionFieldsPreserved: before.fields.length,
    populationValuesPreserved: before.values.length,
    sourceSha256: FILE_SHA256,
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const correctedGroups = before.groups.map((row, position) => ({ ...row, label: AFTER_LABELS[position], updated_at: now }));
const updatedGroups = requireData(
  await supabase.from('population_groups').upsert(correctedGroups).select('*'),
  'population label update',
);
if (updatedGroups.length !== 4) throw new Error('S683 population label update count mismatch');

const latestPaper = requireData(await supabase.from('papers').select('*').eq('id', PAPER_ID), 'latest paper')[0];
if (
  latestPaper.assigned_study_id !== STUDY_ID
  || latestPaper.status !== 'processing'
  || latestPaper.assigned_to !== PROFILE_ID
  || latestPaper.primary_file_sha256 !== FILE_SHA256
) throw new Error('S683 paper changed before metadata update');
const metadata = {
  ...(latestPaper.metadata ?? {}),
  populationLabels: AFTER_LABELS,
  populationHash: expectedPopulationHash,
  extractionYearLabelCorrection20260801: {
    correctedAt: now,
    priorLabels: BEFORE_LABELS,
    correctedLabels: AFTER_LABELS,
    auditPath: AUDIT_PATH,
  },
};
const paperRows = requireData(
  await supabase.from('papers')
    .update({ metadata, updated_at: now })
    .eq('id', PAPER_ID)
    .eq('assigned_study_id', STUDY_ID)
    .eq('status', 'processing')
    .eq('assigned_to', PROFILE_ID)
    .eq('primary_file_sha256', FILE_SHA256)
    .select('*'),
  'paper metadata update',
);
if (paperRows.length !== 1) throw new Error('S683 paper metadata update count mismatch');
audit.applyResult = {
  result: 'passed',
  updatedPopulationGroupIds: updatedGroups.map((row) => row.id),
  updatedPaperId: paperRows[0].id,
  extractionFieldWrites: 0,
  populationValueWrites: 0,
  screeningWrites: 0,
  voteWrites: 0,
  fileWrites: 0,
};

const after = await fetchSnapshot();
const protectedAfter = protectedSignature(after);
audit.postState = after;
const findings = [];
if (JSON.stringify(after.groups.map((row) => row.label)) !== JSON.stringify(AFTER_LABELS)) findings.push('labels mismatch');
if (after.papers[0].metadata?.populationHash !== expectedPopulationHash) findings.push('population hash mismatch');
if (JSON.stringify(after.papers[0].metadata?.populationLabels) !== JSON.stringify(AFTER_LABELS)) findings.push('metadata labels mismatch');
if (protectedAfter !== protectedBefore) findings.push('protected extraction, screening, vote, value, or file state changed');
if (after.papers[0].status !== 'processing' || after.papers[0].assigned_to !== PROFILE_ID) findings.push('status or assignment changed');
audit.integrityGate = {
  result: findings.length ? 'failed' : 'passed',
  findings,
  populationLabels: after.groups.map((row) => row.label),
  extractionFieldsPreserved: after.fields.length === before.fields.length,
  populationValuesPreserved: after.values.length === before.values.length,
  protectedSignatureBeforeSha256: protectedBefore,
  protectedSignatureAfterSha256: protectedAfter,
  protectedStateUnchanged: protectedAfter === protectedBefore,
  sourceHashMatches: after.papers[0].primary_file_sha256 === FILE_SHA256 && after.files[0]?.file_sha256 === FILE_SHA256,
  statusIsProcessing: after.papers[0].status === 'processing',
  assignmentPreserved: after.papers[0].assigned_to === PROFILE_ID,
};
audit.readyFor = findings.length ? 'Blocked pending correction' : 'Human extraction review';
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ auditPath: AUDIT_PATH, applyResult: audit.applyResult, integrityGate: audit.integrityGate, readyFor: audit.readyFor }, null, 2));
if (findings.length) process.exit(1);
