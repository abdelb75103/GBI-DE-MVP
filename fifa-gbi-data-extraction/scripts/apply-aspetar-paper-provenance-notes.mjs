import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATE = '2026-07-27';
const APPLY = process.argv.includes('--apply');
const OUT_DIR = path.join(ROOT, 'data', 'aspetar-reconciliation');
const INPUT_PATH = path.join(OUT_DIR, `aspetar-paper-provenance-note-input-${DATE}.json`);
const SNAPSHOT_PATH = path.join(OUT_DIR, `aspetar-pre-note-live-snapshot-${DATE}.json`);
const APPLY_AUDIT_PATH = path.join(OUT_DIR, `aspetar-paper-provenance-note-apply-audit-${DATE}.json`);
const STUDY_IDS = ['S071', 'S195', 'S261', 'S344', 'S544', 'S555', 'S602', 'S712', 'S1431', 'S2824', 'S3577'];

const treatmentByStudyId = {
  S071: {
    classification: 'duplicate alias',
    groupedUnder: 'S261',
    body: 'Aspetar source-family treatment, 2026-07-27: S071 is a manuscript-stage duplicate alias of S261 for the same 551-player Aspire Academy cohort over 2012/13-2015/16. No S071 values were added as an independent extraction or denominator. Use S261 as the academy source of truth; S071 is retained for provenance and audit only.',
  },
  S261: {
    classification: 'anchor',
    groupedUnder: 'S261',
    body: 'Aspetar source-family treatment, 2026-07-27: S261 is the academy anchor and source of truth for the 551-player U9-U19 Aspire Academy cohort over 2012/13-2015/16. Its final published data were extracted into Total and U9-U19 rows. S071 is a duplicate manuscript alias. Direct values from the later, non-overlapping S1431 2016/17-2018/19 U13-U15 cohort were added as the explicitly labelled final S261 row, with S1431 provenance retained.',
  },
  S1431: {
    classification: 'included supplement',
    groupedUnder: 'S261',
    body: 'Aspetar source-family treatment, 2026-07-27: S1431 is a later, non-overlapping Aspire Academy supplement covering U13-U15 players in 2016/17-2018/19. Its directly reported 95-player, 21,712-hour, 161-index-injury core and compatible Table 1 values were added to S261 as the labelled final population row. The S1431 record remains as source provenance; do not count both the source record and the grouped S261 row as separate representations of the same S1431 cohort.',
  },
  S195: {
    classification: 'included supplement',
    groupedUnder: 'S2824',
    body: 'Aspetar source-family treatment, 2026-07-27: S195 is a disjoint historical Qatar Stars League all-injury supplement from August 2008 to April 2009. Its directly reported 10-club, 230-player, 217-injury values were added to S2824 as the explicitly labelled 2008/09 historical row. The S195 record remains as source provenance; do not count both the source record and the grouped S2824 row as separate representations of the same 2008/09 cohort.',
  },
  S2824: {
    classification: 'anchor',
    groupedUnder: 'S2824',
    body: 'Aspetar source-family treatment, 2026-07-27: S2824 is the Qatar Stars League professional anchor. Its existing All seasons and 2014/15-2021/22 rows remain the modern all-injury denominator. Four labelled source rows were added: disjoint S195 2008/09 all-injury, overlapping S344 groin, S555 ACL, and S712 head/neck-concussion. The topic rows preserve direct supplementary detail but must not be summed as independent all-injury denominators. S544 and S3577 are covered by the S344 source row.',
  },
  S344: {
    classification: 'included supplement',
    groupedUnder: 'S2824',
    body: 'Aspetar source-family treatment, 2026-07-27: S344 is the 2013/14-2014/15 Qatar Stars League groin-injury supplement. Its directly supported 606-player, 205,466-hour, 206-groin-injury values were added to S2824 as an explicitly labelled topic row. This period overlaps S2824 in 2014/15, so the S344 row is not an independent all-injury denominator. The S344 source record remains for provenance and must not be counted again alongside the grouped S2824 row.',
  },
  S544: {
    classification: 'covered by another row',
    groupedUnder: 'S344',
    body: 'Aspetar source-family treatment, 2026-07-27: S544 is covered by the S344 groin row. It uses the same 2013/14-2014/15 Qatar Stars League programme and the same 205,466-hour denominator; the 579-player analytic sample reflects selection for risk-factor modelling. No S544 values were added as an independent extraction row or denominator. Retain S544 for provenance and audit only.',
  },
  S3577: {
    classification: 'covered by another row',
    groupedUnder: 'S344',
    body: 'Aspetar source-family treatment, 2026-07-27: S3577 is a retrospective limb-asymmetry secondary analysis of the S344 2013/14-2014/15 Qatar Stars League groin cohort and pre-season screening data. It has no independent surveillance denominator. No S3577 values were added to an anchor; the source is retained for provenance and audit only and is covered by the S344 topic row under S2824.',
  },
  S555: {
    classification: 'included supplement',
    groupedUnder: 'S2824',
    body: 'Aspetar source-family treatment, 2026-07-27: S555 is the ACL-specific Qatar Stars League supplement for 2013/14-2017/18. Its directly reported 486,951-hour and 37-ACL-rupture values were added to S2824 as an explicitly labelled ACL topic row. The period overlaps the S2824 programme, so this row is not an independent all-injury denominator. The S555 source record remains for provenance and must not be counted again alongside the grouped S2824 row.',
  },
  S712: {
    classification: 'included supplement',
    groupedUnder: 'S2824',
    body: 'Aspetar source-family treatment, 2026-07-27: S712 is the head/neck and concussion-specific Qatar Stars League supplement for 2013/14-2020/21. Its directly supported topic values, including 87 head/neck injuries among 4,736 time-loss injuries, were added to S2824 as an explicitly labelled topic row. The period overlaps the S2824 programme, so this row is not an independent all-injury denominator. The S712 source record remains for provenance and must not be counted again alongside the grouped S2824 row.',
  },
  S602: {
    classification: 'separate cohort',
    groupedUnder: 'S602',
    body: 'Aspetar source-family treatment, 2026-07-27: S602 is a separate AFC multicountry professional anchor, not part of the Qatar Stars League or Aspire Academy denominators. Its directly reported 2017-2019 data were extracted into Total, 2017, 2018, and 2019 rows on S602 itself. The source states nine countries but enumerates ten jurisdictions, including China and Hong Kong separately; it also prints pooled exposure of 232,665 hours while season rows sum to 233,371 hours. Both source views are preserved without correction.',
  },
};

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

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
  .in('assigned_study_id', STUDY_IDS)
  .order('assigned_study_id');
if (papersError) throw papersError;
if ((papers ?? []).length !== STUDY_IDS.length) {
  throw new Error(`Expected ${STUDY_IDS.length} papers, received ${(papers ?? []).length}`);
}

const paperIds = papers.map((paper) => paper.id);
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
  const groupRows = [];
  const valueRows = [];
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

const input = {
  artifactType: 'Aspetar source-family paper-note provenance input',
  date: DATE,
  fixedMembership: STUDY_IDS,
  notes: STUDY_IDS.map((studyId) => ({ studyId, ...treatmentByStudyId[studyId] })),
};
fs.writeFileSync(INPUT_PATH, `${JSON.stringify(input, null, 2)}\n`);

if (!fs.existsSync(SNAPSHOT_PATH)) {
  const snapshot = {
    artifactType: 'Aspetar pre-provenance-note live snapshot',
    date: DATE,
    fixedMembership: STUDY_IDS,
    rollback: {
      method: 'Remove only the inserted paper-note IDs recorded in the apply audit. This rollback would delete live note records and therefore requires explicit destructive-action approval.',
      destructiveActionRequired: true,
    },
    papers: papers.map((paper) => ({
      studyId: paper.assigned_study_id,
      paperId: paper.id,
      status: paper.status,
      flagReason: paper.flag_reason,
      assignedTo: paper.assigned_to,
      primaryFileId: paper.primary_file_id,
      protectedMetadata: Object.fromEntries(protectedKeys.map((key) => [key, paper.metadata?.[key] ?? null])),
      extractionPopulationSignatureSha256: stateSignature(paper),
      notes: (notes ?? [])
        .filter((note) => note.paper_id === paper.id)
        .map((note) => ({ id: note.id, body: note.body, createdAt: note.created_at })),
    })),
  };
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
}

const paperByStudyId = new Map(papers.map((paper) => [paper.assigned_study_id, paper]));
const inserted = [];
const skippedExisting = [];
for (const item of input.notes) {
  const paper = paperByStudyId.get(item.studyId);
  const matches = (notes ?? []).filter((note) => note.paper_id === paper.id && note.body === item.body);
  if (matches.length) {
    skippedExisting.push({ studyId: item.studyId, noteIds: matches.map((note) => note.id) });
    continue;
  }
  if (!APPLY) {
    inserted.push({ studyId: item.studyId, mode: 'planned' });
    continue;
  }
  const { data: newNote, error: insertError } = await supabase
    .from('paper_notes')
    .insert({
      id: crypto.randomUUID(),
      paper_id: paper.id,
      body: item.body,
      created_at: new Date().toISOString(),
    })
    .select('id,paper_id,body,created_at')
    .single();
  if (insertError) throw insertError;
  inserted.push({
    studyId: item.studyId,
    noteId: newNote.id,
    createdAt: newNote.created_at,
  });
}

const audit = {
  artifactType: 'Aspetar source-family paper-note provenance apply audit',
  date: DATE,
  mode: APPLY ? 'apply' : 'dry-run',
  fixedMembership: STUDY_IDS,
  inserted,
  skippedExisting,
  inputPath: INPUT_PATH,
  preApplySnapshotPath: SNAPSHOT_PATH,
};
fs.writeFileSync(APPLY_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  result: APPLY ? 'applied' : 'dry-run',
  inputPath: INPUT_PATH,
  snapshotPath: SNAPSHOT_PATH,
  auditPath: APPLY_AUDIT_PATH,
  plannedOrInserted: inserted.length,
  skippedExisting: skippedExisting.length,
  liveExtractionCounts: Object.fromEntries(papers.map((paper) => [
    paper.assigned_study_id,
    {
      extractionFields: (paper.extractions ?? []).reduce((sum, extraction) => sum + (extraction.extraction_fields?.length ?? 0), 0),
      populationGroups: paper.population_groups?.length ?? 0,
      populationValues: (paper.population_groups ?? []).reduce((sum, group) => sum + (group.population_values?.length ?? 0), 0),
      existingNotes: (notes ?? []).filter((note) => note.paper_id === paper.id).length,
    },
  ])),
}, null, 2));
