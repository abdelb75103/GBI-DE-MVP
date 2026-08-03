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
const PAPER_ID = 'f6a4ee4e-6aa6-48fe-88f3-5f498373dd61';
const STUDY_ID = 'S683';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const FILE_SHA256 = '924a293491d65ac6ba1672c18887a0e825796a031c0576a661ee194d43cc6b67';
const LABELS = ['Total', '2015', '2016', '2017'];

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
const protectedSignature = (snapshot) => stableHash({
  screening: sorted(snapshot.screening),
  votes: sorted(snapshot.votes),
  extractions: sorted(snapshot.extractions),
  fields: sorted(snapshot.fields),
  values: sorted(snapshot.values),
  files: sorted(snapshot.files),
});

const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
if (audit.applyResult?.result !== 'passed' || !audit.preState) {
  throw new Error('S683 successful apply audit or rollback preState is missing');
}
const after = await fetchSnapshot();
const paper = after.papers[0];
const protectedBefore = protectedSignature(audit.preState);
const protectedAfter = protectedSignature(after);
const findings = [];
if (after.papers.length !== 1 || paper.assigned_study_id !== STUDY_ID) findings.push('paper identity mismatch');
if (paper.status !== 'processing' || paper.assigned_to !== PROFILE_ID) findings.push('status or assignment mismatch');
if (paper.primary_file_sha256 !== FILE_SHA256 || after.files.length !== 1 || after.files[0].file_sha256 !== FILE_SHA256) findings.push('source identity mismatch');
if (JSON.stringify(after.groups.map((row) => row.label)) !== JSON.stringify(LABELS)) findings.push('population labels mismatch');
if (JSON.stringify(paper.metadata?.populationLabels) !== JSON.stringify(LABELS)) findings.push('metadata labels mismatch');
if (paper.metadata?.populationHash !== audit.preStateSummary.populationHashAfter) findings.push('population hash mismatch');
if (after.fields.length !== audit.preState.fields.length) findings.push('extraction field count changed');
if (after.values.length !== audit.preState.values.length) findings.push('population value count changed');
if (protectedAfter !== protectedBefore) findings.push('protected extraction, screening, vote, value, or file state changed');

audit.postState = after;
audit.integrityGate = {
  ...audit.integrityGate,
  result: findings.length ? 'failed' : 'passed',
  findings,
  refreshedAt: new Date().toISOString(),
  rawPostStatePersisted: true,
  populationLabels: after.groups.map((row) => row.label),
  extractionFieldsPreserved: after.fields.length === audit.preState.fields.length,
  populationValuesPreserved: after.values.length === audit.preState.values.length,
  protectedSignatureBeforeSha256: protectedBefore,
  protectedSignatureAfterSha256: protectedAfter,
  protectedStateUnchanged: protectedAfter === protectedBefore,
  sourceHashMatches: paper.primary_file_sha256 === FILE_SHA256 && after.files[0]?.file_sha256 === FILE_SHA256,
  statusIsProcessing: paper.status === 'processing',
  assignmentPreserved: paper.assigned_to === PROFILE_ID,
};
audit.readyFor = findings.length ? 'Blocked pending correction' : 'Human extraction review';
fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  auditPath: AUDIT_PATH,
  rawPostStatePersisted: true,
  integrityGate: audit.integrityGate,
  readyFor: audit.readyFor,
}, null, 2));
if (findings.length) process.exit(1);
