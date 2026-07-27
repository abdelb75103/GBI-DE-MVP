import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATE = '2026-07-27';
const OUT_DIR = path.join(ROOT, 'data', 'aspetar-reconciliation');
const INPUT_PATH = path.join(OUT_DIR, `aspetar-paper-provenance-note-input-${DATE}.json`);
const SNAPSHOT_PATH = path.join(OUT_DIR, `aspetar-pre-note-live-snapshot-${DATE}.json`);
const APPLY_AUDIT_PATH = path.join(OUT_DIR, `aspetar-paper-provenance-note-apply-audit-${DATE}.json`);
const OUTPUT_PATH = path.join(OUT_DIR, `aspetar-paper-provenance-note-final-live-audit-${DATE}.json`);

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const before = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const applyAudit = JSON.parse(fs.readFileSync(APPLY_AUDIT_PATH, 'utf8'));
const studyIds = input.fixedMembership;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: papers, error: papersError } = await supabase
  .from('papers')
  .select(`
    id,assigned_study_id,status,flag_reason,assigned_to,primary_file_id,metadata,
    extractions(id,tab,model,extraction_fields(id,field_id,value,metric,status)),
    population_groups(id,label,position,population_values(id,field_id,value,metric,source_field_id))
  `)
  .in('assigned_study_id', studyIds)
  .order('assigned_study_id');
if (papersError) throw papersError;
const paperIds = (papers ?? []).map((paper) => paper.id);
const { data: notes, error: notesError } = await supabase
  .from('paper_notes')
  .select('id,paper_id,body,created_at')
  .in('paper_id', paperIds)
  .order('created_at');
if (notesError) throw notesError;

function stableRows(rows, keys) {
  return [...rows]
    .map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null])))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function stateSignature(paper) {
  const extractionRows = [];
  const groupRows = [];
  const valueRows = [];
  for (const extraction of paper.extractions ?? []) {
    for (const field of extraction.extraction_fields ?? []) {
      extractionRows.push({
        extractionId: extraction.id,
        tab: extraction.tab,
        fieldRowId: field.id,
        fieldId: field.field_id,
        value: field.value,
        metric: field.metric,
        status: field.status,
      });
    }
  }
  for (const group of paper.population_groups ?? []) {
    groupRows.push({ id: group.id, label: group.label, position: group.position });
    for (const value of group.population_values ?? []) {
      valueRows.push({
        id: value.id,
        populationGroupId: group.id,
        fieldId: value.field_id,
        value: value.value,
        metric: value.metric,
        sourceFieldId: value.source_field_id,
      });
    }
  }
  return crypto.createHash('sha256').update(JSON.stringify({
    extractionRows: stableRows(extractionRows, ['extractionId', 'tab', 'fieldRowId', 'fieldId', 'value', 'metric', 'status']),
    groupRows: stableRows(groupRows, ['id', 'label', 'position']),
    valueRows: stableRows(valueRows, ['id', 'populationGroupId', 'fieldId', 'value', 'metric', 'sourceFieldId']),
  })).digest('hex');
}

const protectedKeys = [
  'fullTextDecisions',
  'fullTextDecisionAudit',
  'fullTextResolution',
  'screeningDecision',
  'screeningResolution',
  'titleAbstractDecisions',
  'titleAbstractResolution',
  'screeningPromotedAt',
  'temporaryExtractionPromotion',
  'temporaryExtractionPromotedAt',
];
const beforeByStudyId = new Map(before.papers.map((paper) => [paper.studyId, paper]));
const paperByStudyId = new Map((papers ?? []).map((paper) => [paper.assigned_study_id, paper]));
const failures = [];
const paperAudits = [];

if ((papers ?? []).length !== studyIds.length) {
  failures.push(`Expected ${studyIds.length} papers, received ${(papers ?? []).length}.`);
}
if (applyAudit.mode !== 'apply' || applyAudit.inserted.length !== studyIds.length || applyAudit.skippedExisting.length !== 0) {
  failures.push('Apply audit does not record exactly 11 newly inserted notes.');
}

for (const item of input.notes) {
  const live = paperByStudyId.get(item.studyId);
  const prior = beforeByStudyId.get(item.studyId);
  if (!live || !prior) {
    failures.push(`${item.studyId}: missing live or snapshot record.`);
    continue;
  }
  const liveNotes = (notes ?? []).filter((note) => note.paper_id === live.id);
  const matchingNotes = liveNotes.filter((note) => note.body === item.body);
  const appliedNote = applyAudit.inserted.find((note) => note.studyId === item.studyId);
  const noteCountBefore = prior.notes.length;
  const noteCountAfter = liveNotes.length;
  const protectedMetadata = Object.fromEntries(protectedKeys.map((key) => [key, live.metadata?.[key] ?? null]));
  const checks = {
    exactNotePresentOnce: matchingNotes.length === 1,
    appliedNoteIdMatches: matchingNotes[0]?.id === appliedNote?.noteId,
    snapshotNotesPreserved: prior.notes.every((snapshotNote) =>
      liveNotes.some((liveNote) =>
        liveNote.id === snapshotNote.id && liveNote.body === snapshotNote.body
      )
    ),
    noteCountAtLeastOneHigher: noteCountAfter >= noteCountBefore + 1,
    extractionPopulationUnchanged: stateSignature(live) === prior.extractionPopulationSignatureSha256,
    statusUnchanged: live.status === prior.status,
    flagReasonUnchanged: live.flag_reason === prior.flagReason,
    assignmentUnchanged: live.assigned_to === prior.assignedTo,
    primaryFileUnchanged: live.primary_file_id === prior.primaryFileId,
    protectedMetadataUnchanged: JSON.stringify(protectedMetadata) === JSON.stringify(prior.protectedMetadata),
  };
  for (const [check, passed] of Object.entries(checks)) {
    if (!passed) failures.push(`${item.studyId}: ${check} failed.`);
  }
  paperAudits.push({
    studyId: item.studyId,
    classification: item.classification,
    groupedUnder: item.groupedUnder,
    matchingNoteIds: matchingNotes.map((note) => note.id),
    noteCountBefore,
    noteCountAfter,
    checks,
  });
}

const audit = {
  artifactType: 'Aspetar source-family paper-note provenance final live audit',
  date: DATE,
  result: failures.length ? 'failed' : 'passed',
  fixedMembership: studyIds,
  paperAudits,
  failures,
  rollback: {
    destructiveActionRequired: true,
    method: 'Remove only the 11 matching note IDs listed in paperAudits after explicit destructive-action approval.',
  },
};
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  result: audit.result,
  output: OUTPUT_PATH,
  paperAudits,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
