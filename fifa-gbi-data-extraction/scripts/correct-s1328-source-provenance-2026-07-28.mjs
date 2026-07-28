import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(
  '/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/package.json',
);
const { createClient } = require('@supabase/supabase-js');

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = fs.existsSync(path.join(APP_ROOT, '.env.local'))
  ? path.join(APP_ROOT, '.env.local')
  : '/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction/.env.local';
const OUT_DIR = path.join(
  APP_ROOT,
  'data',
  'second-search-extraction',
  'adjudication-2026-07-28',
);
const PRE_PATH = path.join(OUT_DIR, 's1328-source-provenance-pre-apply-2026-07-28.json');
const FINAL_PATH = path.join(OUT_DIR, 's1328-source-provenance-final-live-audit-2026-07-28.json');
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');
const PAPER_ID = 'a94238e3-5271-46ea-b745-625cd1bdfe2a';
const STUDY_ID = 'S1328';
const EXPECTED_STATUS = 'retrospective_substudy_analysis';
const REPORT_TITLE = 'Análisis del Protocolo de Reconocimiento Rápido de Concusión, Copa América Brasil 2019';
const REPORT_URL = 'https://cdn.conmebol.com/wp-content/uploads/2019/09/analisis-reconocimiento-rapido-de-concusion-copa-america-brasil-2019_0.pdf';
const NOTE = [
  'Source provenance correction, 28 July 2026:',
  `S1328 is a retrospective secondary analysis of the original CONMEBOL report "${REPORT_TITLE}" (${REPORT_URL}).`,
  'The report contains the underlying Copa América Brasil 2019 descriptive data, but it carries the same unreliable 567-player or athlete-exposure denominator.',
  'S1328 and its retained extraction values are source-only audit evidence and must not be treated as independent analysis data.',
].join(' ');
const TREATMENT = {
  version: '2026-07-28',
  role: 'audit_only',
  includeInAnalysisExport: false,
  sourceLinks: [],
  populationExclusions: [],
  requireCompletePopulationMap: false,
  populationTreatments: [],
};

for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

async function loadState() {
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,status,assigned_to,flag_reason,metadata,primary_file_id,updated_at')
    .eq('id', PAPER_ID)
    .single();
  if (paperError) throw paperError;
  assert(paper.assigned_study_id === STUDY_ID, 'Paper ID no longer resolves to S1328');

  const queries = await Promise.all([
    supabase.from('paper_notes').select('*').eq('paper_id', PAPER_ID).order('created_at'),
    supabase.from('paper_files').select('*').eq('paper_id', PAPER_ID).order('uploaded_at'),
    supabase.from('extractions').select('*,extraction_fields(*)').eq('paper_id', PAPER_ID).order('tab'),
    supabase.from('population_groups').select('*,population_values(*)').eq('paper_id', PAPER_ID).order('position'),
    supabase.from('screening_records').select('*').eq('promoted_paper_id', PAPER_ID).order('stage'),
  ]);
  for (const result of queries) if (result.error) throw result.error;
  const [notes, files, extractions, groups, screeningRecords] = queries.map((result) => result.data ?? []);
  const screeningIds = screeningRecords.map((row) => row.id);
  const { data: votes = [], error: votesError } = screeningIds.length
    ? await supabase.from('screening_votes').select('*').in('screening_record_id', screeningIds).order('screening_record_id').order('vote_order')
    : { data: [], error: null };
  if (votesError) throw votesError;
  return { paper, notes, files, extractions, groups, screeningRecords, votes };
}

function protectedState(state) {
  const { metadata, ...paperWithoutMetadata } = state.paper;
  const { analysisSourceTreatment, ...metadataWithoutTreatment } = metadata ?? {};
  return {
    paper: {
      ...paperWithoutMetadata,
      updated_at: undefined,
      flag_reason: undefined,
      metadata: metadataWithoutTreatment,
    },
    notes: state.notes.filter((note) => note.body !== NOTE),
    files: state.files,
    extractions: state.extractions,
    groups: state.groups,
    screeningRecords: state.screeningRecords,
    votes: state.votes,
  };
}

function checks(state, protectedHash) {
  const treatment = state.paper.metadata?.analysisSourceTreatment;
  const exactNotes = state.notes.filter((note) => note.body === NOTE);
  return {
    paperIdentity: state.paper.id === PAPER_ID && state.paper.assigned_study_id === STUDY_ID,
    statusPreserved: state.paper.status === EXPECTED_STATUS,
    assignmentPreserved: state.paper.assigned_to === '00000000-0000-0000-0000-000000000001',
    flagReasonCleared: state.paper.flag_reason === null,
    treatmentExact: hash(treatment) === hash(TREATMENT),
    auditOnlyRole: treatment?.role === 'audit_only',
    analysisExportExcluded: treatment?.includeInAnalysisExport === false,
    noLivePaperSourceLinkInvented: Array.isArray(treatment?.sourceLinks) && treatment.sourceLinks.length === 0,
    provenanceNoteExactlyOnce: exactNotes.length === 1,
    provenanceTitlePresent: exactNotes[0]?.body.includes(REPORT_TITLE) === true,
    provenanceUrlPresent: exactNotes[0]?.body.includes(REPORT_URL) === true,
    independentAnalysisUseDisclaimed: exactNotes[0]?.body.includes('must not be treated as independent analysis data') === true,
    protectedStatePreserved: hash(protectedState(state)) === protectedHash,
  };
}

assert(!(APPLY && VERIFY), 'Choose either --apply or --verify');
const before = await loadState();
assert(before.paper.status === EXPECTED_STATUS, `Expected status ${EXPECTED_STATUS}, found ${before.paper.status}`);
assert(before.paper.assigned_to === '00000000-0000-0000-0000-000000000001', 'Assignment differs from the authorised preserved value');
const beforeProtectedHash = hash(protectedState(before));
const preApply = {
  artifactType: 'S1328 source provenance correction pre-apply snapshot and rollback reference',
  generatedAt: new Date().toISOString(),
  mode: APPLY ? 'pre-apply' : VERIFY ? 'verify-baseline' : 'dry-run',
  paper: before.paper,
  exactProvenanceNoteCount: before.notes.filter((note) => note.body === NOTE).length,
  protectedHash: beforeProtectedHash,
  protectedState: protectedState(before),
  intendedTreatment: TREATMENT,
  intendedProvenanceNote: NOTE,
  rollback: {
    warning: 'Rollback is destructive and is not authorised by this workflow.',
    priorMetadata: before.paper.metadata,
    priorFlagReason: before.paper.flag_reason,
    removeOnlyExactInsertedNote: NOTE,
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
if (!VERIFY) fs.writeFileSync(PRE_PATH, `${JSON.stringify(preApply, null, 2)}\n`);

if (!APPLY) {
  const currentChecks = checks(before, beforeProtectedHash);
  console.log(JSON.stringify({
    mode: VERIFY ? 'verify' : 'dry-run',
    ready: before.paper.status === EXPECTED_STATUS,
    currentChecks,
    treatmentWriteNeeded: !currentChecks.treatmentExact,
    noteInsertNeeded: !currentChecks.provenanceNoteExactlyOnce,
    flagClearNeeded: before.paper.flag_reason !== null,
    preApplyPath: PRE_PATH,
  }, null, 2));
  process.exit(0);
}

let working = before;
const operations = [];
if (hash(working.paper.metadata?.analysisSourceTreatment) !== hash(TREATMENT)) {
  const metadata = { ...(working.paper.metadata ?? {}), analysisSourceTreatment: TREATMENT };
  const { data, error } = await supabase
    .from('papers')
    .update({ metadata })
    .eq('id', PAPER_ID)
    .eq('updated_at', working.paper.updated_at)
    .eq('status', EXPECTED_STATUS)
    .select('id,updated_at');
  if (error) throw error;
  assert(data?.length === 1, 'Concurrent update blocked analysisSourceTreatment write');
  operations.push('updated analysisSourceTreatment only');
  working = await loadState();
}

assert(hash(working.paper.metadata?.analysisSourceTreatment) === hash(TREATMENT), 'Treatment did not persist exactly');
const matchingNotes = working.notes.filter((note) => note.body === NOTE);
assert(matchingNotes.length <= 1, 'Duplicate exact provenance notes already exist');
if (matchingNotes.length === 0) {
  const { error } = await supabase.from('paper_notes').insert({ paper_id: PAPER_ID, body: NOTE });
  if (error) throw error;
  operations.push('inserted exact external-report provenance note');
  working = await loadState();
}

assert(working.notes.filter((note) => note.body === NOTE).length === 1, 'Provenance note did not persist exactly once');
if (working.paper.flag_reason !== null) {
  const { data, error } = await supabase
    .from('papers')
    .update({ flag_reason: null })
    .eq('id', PAPER_ID)
    .eq('updated_at', working.paper.updated_at)
    .eq('status', EXPECTED_STATUS)
    .eq('flag_reason', working.paper.flag_reason)
    .select('id,updated_at,flag_reason');
  if (error) throw error;
  assert(data?.length === 1, 'Concurrent update blocked flag_reason clear');
  operations.push('cleared S1328 flag_reason only after treatment and provenance verification');
}

const after = await loadState();
const finalChecks = checks(after, beforeProtectedHash);
const failures = Object.entries(finalChecks).filter(([, passed]) => !passed).map(([name]) => name);
const audit = {
  artifactType: 'S1328 source provenance correction final live audit',
  generatedAt: new Date().toISOString(),
  result: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  operations,
  before: {
    status: before.paper.status,
    assignment: before.paper.assigned_to,
    flagReason: before.paper.flag_reason,
    analysisSourceTreatment: before.paper.metadata?.analysisSourceTreatment ?? null,
  },
  after: {
    status: after.paper.status,
    assignment: after.paper.assigned_to,
    flagReason: after.paper.flag_reason,
    analysisSourceTreatment: after.paper.metadata?.analysisSourceTreatment ?? null,
    exactProvenanceNoteCount: after.notes.filter((note) => note.body === NOTE).length,
  },
  counts: {
    files: after.files.length,
    notesBefore: before.notes.length,
    notesAfter: after.notes.length,
    extractions: after.extractions.length,
    extractionFields: after.extractions.reduce((sum, row) => sum + (row.extraction_fields?.length ?? 0), 0),
    populationGroups: after.groups.length,
    populationValues: after.groups.reduce((sum, row) => sum + (row.population_values?.length ?? 0), 0),
    screeningRecords: after.screeningRecords.length,
    screeningVotes: after.votes.length,
  },
  protectedHashBefore: beforeProtectedHash,
  protectedHashAfter: hash(protectedState(after)),
  checks: finalChecks,
};
fs.writeFileSync(FINAL_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit, null, 2));
assert(failures.length === 0, `Final integrity failures: ${failures.join(', ')}`);
