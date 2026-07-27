import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STUDY_ID = 'S642';
const PAPER_ID = '1398614f-1f37-4f67-ad1d-8484f9261664';
const COV_NUMBER = '#869';
const REVIEWER_ID = '00000000-0000-0000-0000-000000000001';
const REVIEW_DATE = '2026-07-27';
const ORIGINAL_SHA256 = '570810025830c4572860888bf9ff61218fddd5c8e55a4bdbfd172ee93f1af2fc';
const MERGED_SHA256 = '4fe55d8ee95d30d6dceb55e232ae7d18e0ff3456397ed260251ae6d960744257';
const SOURCE_RELATIVE_PATH = '../outputs/extraction-ready-translations/2026-05-25-716-869/merged-translated-original/pdfs/merged-translated-first-original-second-#869.pdf';
const SOURCE_PATH = path.resolve(APP_DIR, SOURCE_RELATIVE_PATH);
const PAPER_AUDIT_RELATIVE_PATH = '../outputs/extraction-ready-translations/2026-05-25-716-869/paper-audits/table-audit-#869.md';
const PAPER_AUDIT_PATH = path.resolve(APP_DIR, PAPER_AUDIT_RELATIVE_PATH);
const ATTACHMENT_NAME = 'Covidence_869_English_translation_first_original_second.pdf';
const STORAGE_OBJECT_PATH = `translated-merged/869/${REVIEW_DATE}-${MERGED_SHA256.slice(0, 12)}-${ATTACHMENT_NAME}`;
const AUDIT_DIR = path.join(APP_DIR, 'data', 'translation-follow-up', `${REVIEW_DATE}-s642-covidence-869`);
const APPLY_EVENT_AUDIT_PATH = path.join(AUDIT_DIR, 's642-covidence-869-apply-events-2026-07-27.jsonl');
const APPLY = process.argv.includes('--apply');
const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');
const POPULATION_LABELS = [
  'All years (2002-2009)',
  'Before active water supply (2002-2004)',
  'After active water supply (2005-2009)',
];
const EXTRACTION_TABS = [
  'studyDetails',
  'participantCharacteristics',
  'definitions',
  'exposure',
  'injuryOutcome',
  'illnessOutcome',
  'injuryTissueType',
  'injuryLocation',
  'illnessRegion',
  'illnessEtiology',
];

const aligned = (total, before = '', after = '') => [total, before, after].join('\n');

const translationNoteBody = () => [
  'Translated from Japanese on 2026-05-25 using the Codex GPT-5 manual translation workflow;',
  'extracted on 2026-07-27 from a merged PDF with English translation first and original source second.',
  `Merged PDF SHA-256: ${MERGED_SHA256}.`,
  `Original source SHA-256: ${ORIGINAL_SHA256}.`,
  `Population layout: ${POPULATION_LABELS.join(' / ')}.`,
].join(' ');

const field = (tab, fieldId, value, pageHint) => ({
  tab,
  fieldId,
  value,
  status: value === null ? 'not_reported' : 'reported',
  pageHint,
});

const STAGED_FIELDS = [
  field('studyDetails', 'studyId', STUDY_ID, 'System-assigned study ID'),
  field('studyDetails', 'leadAuthor', 'Edama M', 'Merged p.1; original p.299'),
  field(
    'studyDetails',
    'title',
    'Medical support for an all-star youth soccer team in Niigata prefecture by physical therapists: Eight-year evaluation of the incidence of acute injury, and change of acute injury incidence by active water supply',
    'Merged p.1; original p.299',
  ),
  field('studyDetails', 'yearOfPublication', '2012', 'Merged p.1; RapidILL cover'),
  field('studyDetails', 'journal', 'Japanese Journal of Clinical Sports Medicine', 'Merged p.1; RapidILL cover'),
  field('studyDetails', 'doi', null, 'DOI checked in full text and cover; not reported'),
  field('studyDetails', 'studyDesign', 'retrospective cohort [prospective data]', 'Merged pp.1-3; original pp.299-301'),

  field('participantCharacteristics', 'fifaDiscipline', aligned('Association football (11-a-side)'), 'Merged p.1; original p.299'),
  field('participantCharacteristics', 'country', aligned('Japan'), 'Merged p.1; original p.299'),
  field('participantCharacteristics', 'levelOfPlay', aligned('all-star youth prefectural selection team'), 'Merged p.1; original p.299'),
  field('participantCharacteristics', 'sex', aligned('male'), 'Merged p.1; original p.299'),
  field('participantCharacteristics', 'ageCategory', aligned('14-18 years'), 'Merged p.1; original pp.299-300, Table 1'),
  field('participantCharacteristics', 'meanAge', aligned('16.5'), 'Merged p.1; original p.300, Table 1'),
  field('participantCharacteristics', 'sampleSizePlayers', aligned('164', '58', '106'), 'Merged p.1; original p.300, Table 1'),
  field('participantCharacteristics', 'numberOfTeams', aligned('1'), 'Merged p.1; original pp.299-300'),
  field(
    'participantCharacteristics',
    'observationDuration',
    aligned('2002-2009; 8 years', '2002-2004', '2005-2009'),
    'Merged pp.1-3; original pp.299-302',
  ),

  field(
    'definitions',
    'injuryDefinition',
    aligned('medical attention [acute match injuries recorded by physical therapists on the medical support check sheet]'),
    'Merged pp.2-3; original pp.300-301',
  ),
  field('definitions', 'illnessDefinition', null, 'Full text checked; illnesses were not an outcome'),
  field('definitions', 'incidenceDefinition', aligned('per 1000 player-hours of match exposure'), 'Merged pp.1-3; original pp.299-302'),
  field('definitions', 'burdenDefinition', null, 'Full text checked; burden was not reported'),
  field(
    'definitions',
    'severityDefinition',
    aligned("injuries requiring treatment through the following day or preventing participation in the following day's match"),
    'Merged p.3; original p.301',
  ),
  field('definitions', 'recurrenceDefinition', null, 'Full text checked; recurrence was not reported'),
  field('definitions', 'mechanismReporting', aligned('Medical Staff'), 'Merged p.2; original pp.300-301'),

  field('exposure', 'seasonLength', null, 'Full text checked; no season length in weeks'),
  field('exposure', 'numberOfSeasons', aligned('8', '3', '5'), 'Merged pp.1-3; original pp.299-302'),
  field('exposure', 'exposureMeasurementUnit', aligned('player-hours'), 'Merged pp.1-3; original pp.299-302'),
  field('exposure', 'totalExposure', null, 'Full text checked; exposure hours were not printed and were not back-calculated'),
  field('exposure', 'matchExposure', null, 'Full text checked; 59 matches were reported, but exposure hours were not printed'),
  field('exposure', 'trainingExposure', null, 'Training injuries and exposure were outside the study outcome'),

  field('injuryOutcome', 'injuryTotalCount', aligned('126', '44', '82'), 'Merged p.3; original pp.301-302'),
  field('injuryOutcome', 'injuryPlayersCompletedStudy', aligned('164', '58', '106'), 'Merged pp.1-3; original pp.300-302'),
  field('injuryOutcome', 'injuryTeamsCompletedStudy', aligned('1'), 'Merged pp.1-3; original pp.299-302'),
  field('injuryOutcome', 'injuryMedicalAttentionCount', aligned('126', '44', '82'), 'Merged pp.2-3; original pp.301-302'),
  field('injuryOutcome', 'injuryTimeLossCount', null, 'The 45 consequential cases mix next-day treatment and inability to play; not forced into time-loss'),
  field('injuryOutcome', 'injuryMatchCount', aligned('126', '44', '82'), 'Merged p.3; original pp.301-302'),
  field('injuryOutcome', 'injuryMatchMedicalAttentionCount', aligned('126', '44', '82'), 'Merged pp.2-3; original pp.301-302'),
  field('injuryOutcome', 'injuryMatchTimeLossCount', null, 'Consequential-case definition is not cleanly time-loss'),
  field('injuryOutcome', 'injuryTrainingCount', null, 'Training injuries were not studied'),
  field('injuryOutcome', 'injuryTrainingMedicalAttentionCount', null, 'Training injuries were not studied'),
  field('injuryOutcome', 'injuryTrainingTimeLossCount', null, 'Training injuries were not studied'),
  field('injuryOutcome', 'injuryIncidenceOverall', aligned('162.9', '205.7', '154.3'), 'Merged p.3; original pp.301-302'),
  field('injuryOutcome', 'injuryIncidenceMatch', aligned('162.9', '205.7', '154.3'), 'Merged p.3; original pp.301-302'),
  field('injuryOutcome', 'injuryIncidenceTraining', null, 'Training incidence was not reported'),
  field('injuryOutcome', 'injuryIncidenceTimeLossOverall', null, 'Consequential-case definition is not cleanly time-loss'),
  field('injuryOutcome', 'injuryIncidenceTimeLossMatch', null, 'Consequential-case definition is not cleanly time-loss'),
  field('injuryOutcome', 'injuryIncidenceTimeLossTraining', null, 'Training incidence was not reported'),
  field('injuryOutcome', 'injuryIncidenceCi95', null, 'No incidence confidence interval was reported'),
  field('injuryOutcome', 'injuryTimeLossTotal', null, 'Time-loss days were not reported'),
  field('injuryOutcome', 'injuryTimeLossMedian', null, 'Median time loss was not reported'),
  field('injuryOutcome', 'injuryTimeLossMean', null, 'Mean time loss was not reported'),
  field('injuryOutcome', 'injuryBurden', null, 'Injury burden was not reported'),
  field('injuryOutcome', 'injuryBurdenCi95', null, 'Injury burden confidence interval was not reported'),
  field('injuryOutcome', 'injuryMostCommonDiagnosis', aligned('contusion'), 'Merged p.3; original p.302, Figure 1'),
  field('injuryOutcome', 'injuryMostCommonType', aligned('contusion (48%)'), 'Merged p.3; original p.302, Figure 1'),
  field('injuryOutcome', 'injuryMostCommonLocation', aligned('ankle/foot (34%)'), 'Merged p.3; original p.302, Figure 2'),
  field('injuryOutcome', 'injuryMostCommonSeverity', null, 'No formal severity class distribution was reported'),
  field('injuryOutcome', 'injuryModeRepetitiveGradual', null, 'Repetitive gradual-onset injuries were outside the acute-injury cohort'),
  field('injuryOutcome', 'injuryModeRepetitiveSudden', null, 'Repetitive sudden-onset injuries were not reported'),
  field('injuryOutcome', 'injuryModeAcuteSudden', aligned('126', '44', '82'), 'Merged p.3; original pp.301-302'),
  field('injuryOutcome', 'injuryContact', aligned('88'), 'Percentage-derived from 70% of 126 acute injuries; original p.302'),
  field('injuryOutcome', 'injuryNonContact', aligned('38'), 'Complement of the reported 70% contact share over 126 acute injuries; original p.302'),
  field('injuryOutcome', 'injuryCumulativeRepetitive', null, 'Cumulative repetitive injuries were not reported'),
  field('injuryOutcome', 'injuryDurationMedian', null, 'Injury duration was not reported'),
  field('injuryOutcome', 'injuryDurationMean', null, 'Injury duration was not reported'),
  field('injuryOutcome', 'injuryRecurrentTotal', null, 'Recurrent injuries were not reported'),
  field('injuryOutcome', 'injuryRecurrenceRate', null, 'Recurrence rate was not reported'),

  ...[
    'illnessTotalCount',
    'illnessPlayersCompletedStudy',
    'illnessTeamsCompletedStudy',
    'illnessMatchCount',
    'illnessTrainingCount',
    'illnessIncidenceOverall',
    'illnessIncidenceMatch',
    'illnessIncidenceTraining',
    'illnessIncidenceCi95',
    'illnessTimeLossTotal',
    'illnessTimeLossMedian',
    'illnessTimeLossMean',
    'illnessBurden',
    'illnessBurdenCi95',
    'illnessMostCommonSystem',
    'illnessMostCommonEtiology',
    'illnessMostCommonSeverity',
    'illnessModeGradual',
    'illnessModeSudden',
    'illnessDurationMedian',
    'illnessDurationMean',
  ].map((fieldId) => field('illnessOutcome', fieldId, null, 'Full text checked; illnesses were not an outcome')),
];

const POPULATION_VALUE_FIELD_IDS = new Set([
  'ageCategory',
  'sex',
  'meanAge',
  'sampleSizePlayers',
  'numberOfTeams',
  'observationDuration',
  'numberOfSeasons',
  'totalExposure',
  'matchExposure',
  'trainingExposure',
  ...STAGED_FIELDS.filter(({ tab }) => tab === 'injuryOutcome').map(({ fieldId }) => fieldId),
]);

const EXPECTED_BEFORE_FIELDS = {
  'participantCharacteristics.ageCategory': '15-18 years',
  'participantCharacteristics.country': 'Japan',
  'exposure.exposureMeasurementUnit': 'match-hours',
  'participantCharacteristics.fifaDiscipline': 'Association football (11-a-side)',
  'definitions.incidenceDefinition': 'acute injuries per 1000 match-hours per player',
  'definitions.injuryDefinition': 'medical attention or time-loss',
  'injuryOutcome.injuryIncidenceOverall': '162.9',
  'injuryOutcome.injuryMostCommonDiagnosis': 'direct contusion of lower extremity and ankle sprain',
  'injuryOutcome.injuryMostCommonLocation': 'lower extremity',
  'injuryOutcome.injuryMostCommonType': 'contusion and sprain',
  'studyDetails.journal': 'Japanese Journal of Clinical Sports Medicine',
  'studyDetails.leadAuthor': 'Edama M',
  'participantCharacteristics.levelOfPlay': 'all-star youth prefectural selection team',
  'exposure.matchExposure': '59 matches',
  'participantCharacteristics.meanAge': '16.5',
  'definitions.mechanismReporting': 'Medical Staff',
  'exposure.numberOfSeasons': '8',
  'participantCharacteristics.numberOfTeams': '1',
  'participantCharacteristics.observationDuration': '2002-2009; 8 years',
  'participantCharacteristics.sampleSizePlayers': '164',
  'participantCharacteristics.sex': 'male',
  'studyDetails.studyDesign': 'prospective cohort',
  'studyDetails.studyId': STUDY_ID,
  'studyDetails.title': 'Medical support for an all-star youth soccer team in Niigata prefecture by physical therapists',
  'studyDetails.yearOfPublication': '2012',
};

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

const env = parseEnv(fs.readFileSync(path.join(APP_DIR, '.env.local'), 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const stableJson = (value) => JSON.stringify(canonicalize(value));

const fetchSnapshot = async () => {
  const papers = requireData(
    await supabase.from('papers').select('*').eq('assigned_study_id', STUDY_ID),
    'paper',
  );
  if (papers.length !== 1) throw new Error(`Expected one ${STUDY_ID} paper, found ${papers.length}`);
  const paper = papers[0];

  const [
    paperFiles,
    paperNotes,
    extractions,
    populationGroups,
    populationValues,
    screeningByStudyId,
    screeningByPaperId,
  ] = await Promise.all([
    supabase.from('paper_files').select('*').eq('paper_id', paper.id).order('uploaded_at'),
    supabase.from('paper_notes').select('*').eq('paper_id', paper.id).order('created_at'),
    supabase.from('extractions').select('*').eq('paper_id', paper.id).order('tab'),
    supabase.from('population_groups').select('*').eq('paper_id', paper.id).order('position'),
    supabase.from('population_values').select('*').eq('paper_id', paper.id).order('field_id'),
    supabase.from('screening_records').select('*').eq('assigned_study_id', STUDY_ID),
    supabase.from('screening_records').select('*').eq('promoted_paper_id', paper.id),
  ]);

  const extractionRows = requireData(extractions, 'extractions');
  const extractionFields = extractionRows.length
    ? requireData(
      await supabase
        .from('extraction_fields')
        .select('*')
        .in('extraction_id', extractionRows.map((row) => row.id))
        .order('field_id'),
      'extraction fields',
    )
    : [];

  const screeningMap = new Map(
    [
      ...requireData(screeningByStudyId, 'screening by study ID'),
      ...requireData(screeningByPaperId, 'screening by paper ID'),
    ].map((row) => [row.id, row]),
  );
  const screeningRecords = [...screeningMap.values()];
  const screeningVotes = screeningRecords.length
    ? requireData(
      await supabase
        .from('screening_votes')
        .select('*')
        .in('screening_record_id', screeningRecords.map((row) => row.id))
        .order('vote_order'),
      'screening votes',
    )
    : [];

  return {
    capturedAt: new Date().toISOString(),
    paper,
    paperFiles: requireData(paperFiles, 'paper files'),
    paperNotes: requireData(paperNotes, 'paper notes'),
    extractions: extractionRows,
    extractionFields,
    populationGroups: requireData(populationGroups, 'population groups'),
    populationValues: requireData(populationValues, 'population values'),
    screeningRecords,
    screeningVotes,
  };
};

const summariseSnapshot = async (snapshot) => {
  const extractionTabById = new Map(snapshot.extractions.map((row) => [row.id, row.tab]));
  const fields = Object.fromEntries(
    snapshot.extractionFields.map((row) => [
      `${extractionTabById.get(row.extraction_id)}.${row.field_id}`,
      {
        id: row.id,
        value: row.value,
        status: row.status,
        confidence: row.confidence,
        metric: row.metric,
        pageHint: row.page_hint,
        sourceQuote: row.source_quote,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      },
    ]),
  );

  const downloadStorageRef = async (storageBucket, storageObjectPath) => {
    if (!storageBucket || !storageObjectPath) {
      return { downloadedSha256: null, downloadError: 'Missing storage bucket or object path.' };
    }
    const result = await supabase.storage.from(storageBucket).download(storageObjectPath);
    if (result.error) return { downloadedSha256: null, downloadError: result.error.message };
    return {
      downloadedSha256: sha256(Buffer.from(await result.data.arrayBuffer())),
      downloadError: null,
    };
  };

  const attachments = [];
  for (const file of snapshot.paperFiles) {
    const downloaded = await downloadStorageRef(file.storage_bucket, file.storage_object_path);
    attachments.push({
      id: file.id,
      name: file.name,
      originalFileName: file.original_file_name,
      size: file.size,
      mimeType: file.mime_type,
      storageBucket: file.storage_bucket,
      storageObjectPath: file.storage_object_path,
      registeredSha256: file.file_sha256,
      downloadedSha256: downloaded.downloadedSha256,
      downloadError: downloaded.downloadError,
      isPrimary: file.id === snapshot.paper.primary_file_id,
      uploadedAt: file.uploaded_at,
    });
  }
  const paperStorageDownload = await downloadStorageRef(
    snapshot.paper.storage_bucket,
    snapshot.paper.storage_object_path,
  );
  const preservedOriginalMetadata = snapshot.paper.metadata?.translationAttachment?.originalAttachment ?? null;
  const preservedOriginalDownload = preservedOriginalMetadata
    ? await downloadStorageRef(
      preservedOriginalMetadata.storageBucket,
      preservedOriginalMetadata.storageObjectPath,
    )
    : { downloadedSha256: null, downloadError: null };

  return {
    capturedAt: snapshot.capturedAt,
    paper: {
      id: snapshot.paper.id,
      assignedStudyId: snapshot.paper.assigned_study_id,
      title: snapshot.paper.title,
      status: snapshot.paper.status,
      flagReason: snapshot.paper.flag_reason,
      assignedTo: snapshot.paper.assigned_to,
      primaryFileId: snapshot.paper.primary_file_id,
      primaryFileSha256: snapshot.paper.primary_file_sha256,
      storageBucket: snapshot.paper.storage_bucket,
      storageObjectPath: snapshot.paper.storage_object_path,
      originalFileName: snapshot.paper.original_file_name,
      metadata: snapshot.paper.metadata,
      updatedAt: snapshot.paper.updated_at,
    },
    attachments,
    paperStorageObject: {
      storageBucket: snapshot.paper.storage_bucket,
      storageObjectPath: snapshot.paper.storage_object_path,
      registeredSha256: snapshot.paper.primary_file_sha256,
      downloadedSha256: paperStorageDownload.downloadedSha256,
      downloadError: paperStorageDownload.downloadError,
    },
    preservedOriginalSource: preservedOriginalMetadata
      ? {
        ...preservedOriginalMetadata,
        downloadedSha256: preservedOriginalDownload.downloadedSha256,
        downloadError: preservedOriginalDownload.downloadError,
      }
      : null,
    notes: snapshot.paperNotes,
    extractionTabs: snapshot.extractions.map((row) => ({
      id: row.id,
      tab: row.tab,
      model: row.model,
      updatedAt: row.updated_at,
    })),
    fields,
    populationGroups: snapshot.populationGroups,
    populationValues: snapshot.populationValues,
    screening: {
      records: snapshot.screeningRecords,
      votes: snapshot.screeningVotes,
      recordsSha256: sha256(Buffer.from(stableJson(snapshot.screeningRecords))),
      votesSha256: sha256(Buffer.from(stableJson(snapshot.screeningVotes))),
    },
  };
};

const localSourceState = () => {
  if (!fs.existsSync(SOURCE_PATH)) throw new Error(`Merged source PDF is missing: ${SOURCE_PATH}`);
  if (!fs.existsSync(PAPER_AUDIT_PATH)) throw new Error(`Paper audit is missing: ${PAPER_AUDIT_PATH}`);
  const buffer = fs.readFileSync(SOURCE_PATH);
  const sourceSha256 = sha256(buffer);
  if (sourceSha256 !== MERGED_SHA256) {
    throw new Error(`Merged PDF hash changed: expected ${MERGED_SHA256}, found ${sourceSha256}`);
  }
  return {
    buffer,
    sha256: sourceSha256,
    size: buffer.length,
    path: SOURCE_PATH,
    paperAuditPath: PAPER_AUDIT_PATH,
  };
};

const assertStagedFieldIds = () => {
  const schema = fs.readFileSync(path.join(APP_DIR, 'src', 'lib', 'extraction', 'schema.ts'), 'utf8');
  const directIds = new Set([...schema.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]));
  const stagedKeys = new Set();
  const unknown = [];
  const duplicates = [];
  for (const staged of STAGED_FIELDS) {
    const key = `${staged.tab}.${staged.fieldId}`;
    if (stagedKeys.has(key)) duplicates.push(key);
    stagedKeys.add(key);
    if (!EXTRACTION_TABS.includes(staged.tab) || !directIds.has(staged.fieldId)) unknown.push(key);
  }
  if (duplicates.length) throw new Error(`Duplicate staged fields: ${duplicates.join(', ')}`);
  if (unknown.length) throw new Error(`Unknown staged fields: ${unknown.join(', ')}`);
};

const assertPreApplyState = (summary) => {
  if (summary.paper.id !== PAPER_ID) throw new Error(`Paper ID changed: ${summary.paper.id}`);
  if (summary.paper.assignedStudyId !== STUDY_ID) throw new Error(`Study ID changed: ${summary.paper.assignedStudyId}`);
  if (summary.paper.flagReason !== null) throw new Error(`Expected null flag reason, found ${summary.paper.flagReason}`);
  if (summary.paper.assignedTo !== REVIEWER_ID) throw new Error(`Assignment changed: ${summary.paper.assignedTo}`);
  if (summary.paper.metadata?.covidenceNumber !== COV_NUMBER || summary.paper.metadata?.covidenceStudy !== 'Edama 2012') {
    throw new Error('Covidence #869 / Edama 2012 metadata mapping changed.');
  }
  if (summary.screening.records.length !== 0 || summary.screening.votes.length !== 0) {
    throw new Error('Unexpected linked screening state; refusing to continue.');
  }

  const originals = summary.attachments.filter((attachment) => attachment.registeredSha256 === ORIGINAL_SHA256);
  const mergedFiles = summary.attachments.filter((attachment) => attachment.registeredSha256 === MERGED_SHA256);
  const original = originals[0];
  const merged = mergedFiles[0];
  const unexpectedAttachments = summary.attachments.filter(
    (attachment) => ![ORIGINAL_SHA256, MERGED_SHA256].includes(attachment.registeredSha256),
  );
  if (
    summary.attachments.length !== 1
    || originals.length + mergedFiles.length !== 1
    || unexpectedAttachments.length
  ) {
    throw new Error('The supported single paper_files attachment state is invalid.');
  }
  if (original && original.downloadedSha256 !== ORIGINAL_SHA256) {
    throw new Error('The existing original paper_files object does not match its registered hash.');
  }
  if (merged && merged.downloadedSha256 !== MERGED_SHA256) {
    throw new Error('The existing merged attachment hash does not match the local translation source.');
  }
  if (summary.paperStorageObject.downloadedSha256 !== summary.paper.primaryFileSha256) {
    throw new Error('The papers storage pointer does not match its registered SHA-256.');
  }
  const finalPaperState =
    summary.paper.status === 'processing'
    && summary.paper.primaryFileSha256 === MERGED_SHA256
    && merged?.isPrimary
    && summary.preservedOriginalSource?.downloadedSha256 === ORIGINAL_SHA256;
  const writablePaperState =
    summary.paper.status === 'flagged'
    && summary.paper.primaryFileSha256 === ORIGINAL_SHA256
    && (original?.isPrimary || merged?.isPrimary);
  if (!finalPaperState && !writablePaperState) {
    throw new Error(`Unexpected paper status or primary attachment: ${summary.paper.status} / ${summary.paper.primaryFileSha256}`);
  }

  const unexpectedNotes = summary.notes.filter((row) => row.body !== translationNoteBody());
  if (unexpectedNotes.length || summary.notes.length > 1) {
    throw new Error('Unexpected paper-note state; refusing to overwrite or duplicate provenance.');
  }

  const liveLabels = summary.populationGroups.map((row) => row.label);
  if (liveLabels.length && stableJson(liveLabels) !== stableJson(POPULATION_LABELS)) {
    throw new Error('Unexpected population labels or order.');
  }
  const expectedPopulation = expectedPopulationValues();
  const groupById = new Map(summary.populationGroups.map((row) => [row.id, row]));
  const populationKeys = new Set();
  for (const row of summary.populationValues) {
    const group = groupById.get(row.population_group_id);
    const live = {
      label: group?.label ?? null,
      position: group?.position ?? null,
      fieldId: row.field_id,
      value: row.value,
    };
    const populationKey = stableJson(live);
    if (populationKeys.has(populationKey)) {
      throw new Error(`Duplicate population value for ${row.field_id} at position ${group?.position ?? 'unknown'}.`);
    }
    populationKeys.add(populationKey);
    if (!expectedPopulation.some((expected) => stableJson(expected) === stableJson(live))) {
      throw new Error(`Unexpected population value for ${row.field_id}.`);
    }
  }

  const stagedByKey = new Map(STAGED_FIELDS.map((staged) => [`${staged.tab}.${staged.fieldId}`, staged]));
  const unexpectedFields = [];
  for (const [key, live] of Object.entries(summary.fields)) {
    const baselineValue = EXPECTED_BEFORE_FIELDS[key];
    const staged = stagedByKey.get(key);
    const baselineConfidence = key === 'studyDetails.studyId' ? null : 0.75;
    const liveState = {
      value: live?.value ?? null,
      status: live?.status ?? null,
      confidence: live?.confidence ?? null,
      metric: live?.metric ?? null,
      pageHint: live?.pageHint ?? null,
      sourceQuote: live?.sourceQuote ?? null,
      updatedBy: live?.updatedBy ?? null,
    };
    const baselineState = baselineValue === undefined ? null : {
      value: baselineValue,
      status: 'reported',
      confidence: baselineConfidence,
      metric: null,
      pageHint: null,
      sourceQuote: null,
      updatedBy: REVIEWER_ID,
    };
    const stagedState = staged ? {
      value: staged.value,
      status: staged.status,
      confidence: baselineValue === undefined ? null : baselineConfidence,
      metric: null,
      pageHint: staged.pageHint,
      sourceQuote: null,
      updatedBy: REVIEWER_ID,
    } : null;
    if (
      !live?.updatedAt
      || (
        (!baselineState || stableJson(liveState) !== stableJson(baselineState))
        && (!stagedState || stableJson(liveState) !== stableJson(stagedState))
      )
    ) {
      unexpectedFields.push(key);
    }
  }
  if (unexpectedFields.length) {
    throw new Error(`Unexpected live extraction field state: ${unexpectedFields.join(', ')}`);
  }
  for (const key of Object.keys(EXPECTED_BEFORE_FIELDS)) {
    if (!summary.fields[key]) throw new Error(`Baseline extraction field is missing: ${key}`);
  }
  return finalPaperState ? 'final' : merged || summary.notes.length || liveLabels.length
    ? 'resumable'
    : 'pristine';
};

const ensureAuditDir = () => fs.mkdirSync(AUDIT_DIR, { recursive: true });

const appendApplyEvent = (event) => {
  ensureAuditDir();
  fs.appendFileSync(
    APPLY_EVENT_AUDIT_PATH,
    `${JSON.stringify({ at: new Date().toISOString(), paperId: PAPER_ID, studyId: STUDY_ID, ...event })}\n`,
  );
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const ensureExtractionRows = async (snapshot, appliedAt) => {
  const byTab = new Map(snapshot.extractions.map((row) => [row.tab, row]));
  const missingTabs = EXTRACTION_TABS.filter((tab) => !byTab.has(tab));
  if (missingTabs.length) {
    const rows = missingTabs.map((tab) => ({
      id: crypto.randomUUID(),
      paper_id: PAPER_ID,
      tab,
      model: 'human-input',
      created_at: appliedAt,
      updated_at: appliedAt,
    }));
    const inserted = requireData(
      await supabase.from('extractions').insert(rows).select('*'),
      'insert missing extraction tabs',
    );
    for (const row of inserted) byTab.set(row.tab, row);
  }
  if (byTab.size !== EXTRACTION_TABS.length) {
    throw new Error(`Expected ${EXTRACTION_TABS.length} extraction tabs, found ${byTab.size}`);
  }
  return byTab;
};

const applyExtractionFields = async (snapshot, extractionByTab, appliedAt) => {
  const currentByKey = new Map();
  const tabByExtractionId = new Map(snapshot.extractions.map((row) => [row.id, row.tab]));
  for (const row of snapshot.extractionFields) {
    currentByKey.set(`${tabByExtractionId.get(row.extraction_id)}.${row.field_id}`, row);
  }

  for (const tab of EXTRACTION_TABS) {
    const extraction = extractionByTab.get(tab);
    const stagedForTab = STAGED_FIELDS.filter((staged) => staged.tab === tab);
    const inserts = [];
    for (const staged of stagedForTab) {
      const existing = currentByKey.get(`${staged.tab}.${staged.fieldId}`);
      if (existing) {
        const rows = requireData(
          await supabase
            .from('extraction_fields')
            .update({
              value: staged.value,
              status: staged.status,
              page_hint: staged.pageHint,
              updated_at: appliedAt,
              updated_by: REVIEWER_ID,
            })
            .eq('id', existing.id)
            .eq('extraction_id', extraction.id)
            .eq('field_id', staged.fieldId)
            .eq('updated_at', existing.updated_at)
            .select('id'),
          `guarded update ${staged.tab}.${staged.fieldId}`,
        );
        if (rows.length !== 1) {
          throw new Error(`Concurrent field edit detected for ${staged.tab}.${staged.fieldId}`);
        }
      } else {
        inserts.push({
          id: crypto.randomUUID(),
          extraction_id: extraction.id,
          field_id: staged.fieldId,
          value: staged.value,
          status: staged.status,
          confidence: null,
          source_quote: null,
          page_hint: staged.pageHint,
          metric: null,
          updated_at: appliedAt,
          updated_by: REVIEWER_ID,
        });
      }
    }
    if (inserts.length) {
      requireData(
        await supabase
          .from('extraction_fields')
          .insert(inserts)
          .select('id,extraction_id,field_id'),
        `insert ${tab} fields`,
      );
    }
  }
};

const applyPopulationLayout = async (appliedAt) => {
  let groups = requireData(
    await supabase.from('population_groups').select('*').eq('paper_id', PAPER_ID).order('position'),
    'load population groups before apply',
  );
  let groupsAdded = 0;
  if (!groups.length) {
    const groupRows = POPULATION_LABELS.map((label, position) => ({
      id: crypto.randomUUID(),
      paper_id: PAPER_ID,
      tab: 'participantCharacteristics',
      label,
      position,
      created_at: appliedAt,
      updated_at: appliedAt,
    }));
    groups = requireData(
      await supabase.from('population_groups').insert(groupRows).select('*'),
      'insert population groups',
    );
    groupsAdded = groups.length;
  }
  groups.sort((left, right) => left.position - right.position);
  if (stableJson(groups.map((row) => row.label)) !== stableJson(POPULATION_LABELS)) {
    throw new Error('Population group layout changed before apply.');
  }

  const currentValues = requireData(
    await supabase.from('population_values').select('*').eq('paper_id', PAPER_ID),
    'load population values before apply',
  );
  const currentByKey = new Map();
  for (const row of currentValues) {
    const group = groups.find((candidate) => candidate.id === row.population_group_id);
    const key = `${group?.position}:${row.field_id}`;
    if (currentByKey.has(key)) throw new Error(`Duplicate live population value: ${key}`);
    currentByKey.set(key, row);
  }

  const valueRows = [];
  for (const expected of expectedPopulationValues()) {
    const group = groups[expected.position];
    const key = `${expected.position}:${expected.fieldId}`;
    const current = currentByKey.get(key);
    if (current) {
      if (current.value !== expected.value || current.population_group_id !== group.id) {
        throw new Error(`Unexpected existing population value for ${key}`);
      }
      continue;
    }
    valueRows.push({
        id: crypto.randomUUID(),
        population_group_id: group.id,
        paper_id: PAPER_ID,
        field_id: expected.fieldId,
        source_field_id: expected.fieldId,
        value: expected.value,
        metric: null,
        unit: null,
        created_at: appliedAt,
        updated_at: appliedAt,
    });
  }
  if (valueRows.length) {
    requireData(
      await supabase.from('population_values').insert(valueRows).select('id'),
      'insert population values',
    );
  }
  return {
    groups: groups.length,
    groupsAdded,
    values: currentValues.length + valueRows.length,
    valuesAdded: valueRows.length,
  };
};

const uploadTranslationAttachment = async (source, appliedAt) => {
  const existingFiles = requireData(
    await supabase.from('paper_files').select('*').eq('paper_id', PAPER_ID),
    'load current paper file',
  );
  if (existingFiles.length !== 1) throw new Error(`Expected one paper_files row, found ${existingFiles.length}.`);
  const existing = existingFiles[0];
  if (existing.file_sha256 === MERGED_SHA256) {
    const download = await supabase.storage.from(existing.storage_bucket).download(existing.storage_object_path);
    if (download.error) throw new Error(`download existing translation attachment: ${download.error.message}`);
    const downloadedSha256 = sha256(Buffer.from(await download.data.arrayBuffer()));
    if (downloadedSha256 !== MERGED_SHA256) throw new Error('Existing translation attachment bytes do not match its registered hash.');
    appendApplyEvent({
      step: 'translation_attachment',
      status: 'reused_verified',
      fileId: existing.id,
      storageObjectPath: existing.storage_object_path,
      fileSha256: downloadedSha256,
    });
    return existing;
  }
  if (existing.file_sha256 !== ORIGINAL_SHA256) {
    throw new Error(`Unexpected current paper_files SHA-256 ${existing.file_sha256}`);
  }

  const upload = await supabase.storage.from('papers').upload(STORAGE_OBJECT_PATH, source.buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  appendApplyEvent({
    step: 'storage_upload_attempt',
    status: upload.error ? 'failed' : 'uploaded',
    storageObjectPath: STORAGE_OBJECT_PATH,
    fileSha256: source.sha256,
    fileSize: source.size,
    message: upload.error?.message ?? 'Storage upload completed.',
  });
  if (upload.error) {
    const download = await supabase.storage.from('papers').download(STORAGE_OBJECT_PATH);
    if (download.error) throw new Error(`translation storage upload: ${upload.error.message}`);
    const existingObjectSha256 = sha256(Buffer.from(await download.data.arrayBuffer()));
    if (existingObjectSha256 !== MERGED_SHA256) {
      throw new Error(`Existing deterministic storage object has unexpected SHA-256 ${existingObjectSha256}`);
    }
    appendApplyEvent({
      step: 'storage_upload_recovery',
      status: 'reused_verified_object',
      storageObjectPath: STORAGE_OBJECT_PATH,
      fileSha256: existingObjectSha256,
    });
  }

  const fileUpdate = {
    name: ATTACHMENT_NAME,
    original_file_name: ATTACHMENT_NAME,
    size: source.size,
    mime_type: 'application/pdf',
    uploaded_at: appliedAt,
    storage_bucket: 'papers',
    storage_object_path: STORAGE_OBJECT_PATH,
    public_url: null,
    data_base64: null,
    file_sha256: source.sha256,
  };
  const rows = requireData(
    await supabase
      .from('paper_files')
      .update(fileUpdate)
      .eq('id', existing.id)
      .eq('paper_id', PAPER_ID)
      .eq('file_sha256', ORIGINAL_SHA256)
      .eq('storage_object_path', existing.storage_object_path)
      .select('*'),
    'guarded update of the single paper_files row',
  );
  if (rows.length !== 1) throw new Error(`Expected one updated paper_files row, found ${rows.length}`);
  appendApplyEvent({
    step: 'paper_files_attachment',
    status: 'updated_supported_single_file_contract',
    fileId: rows[0].id,
    storageObjectPath: rows[0].storage_object_path,
    fileSha256: rows[0].file_sha256,
    preservedOriginalStorageObjectPath: existing.storage_object_path,
    preservedOriginalSha256: existing.file_sha256,
  });
  return rows[0];
};

const addTranslationNote = async (appliedAt) => {
  const body = translationNoteBody();
  const existing = requireData(
    await supabase.from('paper_notes').select('*').eq('paper_id', PAPER_ID).eq('body', body),
    'load existing translation note',
  );
  if (existing.length > 1) throw new Error(`Found ${existing.length} duplicate translation notes.`);
  if (existing.length === 1) {
    appendApplyEvent({ step: 'translation_note', status: 'reused', noteId: existing[0].id });
    return existing[0];
  }
  const rows = requireData(
    await supabase
      .from('paper_notes')
      .insert({
        id: crypto.randomUUID(),
        paper_id: PAPER_ID,
        body,
        created_at: appliedAt,
      })
      .select('*'),
    'insert translation provenance note',
  );
  if (rows.length !== 1) throw new Error(`Expected one inserted translation note, found ${rows.length}`);
  appendApplyEvent({ step: 'translation_note', status: 'inserted', noteId: rows[0].id });
  return rows[0];
};

const updatePaperForTranslation = async (translationFile, appliedAt) => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const papers = requireData(
      await supabase.from('papers').select('*').eq('id', PAPER_ID),
      'paper before guarded update',
    );
    if (papers.length !== 1) throw new Error(`Expected one paper before guarded update, found ${papers.length}`);
    const current = papers[0];
    if (
      current.assigned_study_id !== STUDY_ID
      || current.assigned_to !== REVIEWER_ID
      || current.status !== 'flagged'
      || current.primary_file_sha256 !== ORIGINAL_SHA256
    ) {
      throw new Error('Paper identity, assignment, status, or original primary file changed during apply.');
    }

    const metadata = {
      ...(current.metadata && typeof current.metadata === 'object' ? current.metadata : {}),
      translationAttachment: {
        targetSystem: 'FIFA GBI web app extraction',
        covidenceNumber: COV_NUMBER,
        sourceLanguage: 'Japanese',
        translatedOn: '2026-05-25',
        attachedOn: REVIEW_DATE,
        workflow: 'Codex GPT-5 manual translation with rendered-page checks',
        mergeOrder: 'English translation first; complete original source second',
        fileId: translationFile.id,
        fileName: ATTACHMENT_NAME,
        storageBucket: 'papers',
        storageObjectPath: STORAGE_OBJECT_PATH,
        fileSha256: MERGED_SHA256,
        localSourcePath: SOURCE_RELATIVE_PATH.replace(/^\.\.\//, ''),
        paperAuditPath: PAPER_AUDIT_RELATIVE_PATH.replace(/^\.\.\//, ''),
        originalAttachment: {
          fileId: current.primary_file_id,
          fileName: current.original_file_name,
          storageBucket: current.storage_bucket,
          storageObjectPath: current.storage_object_path,
          fileSha256: current.primary_file_sha256,
        },
      },
      translationExtractionFollowUp: {
        completedAt: appliedAt,
        model: 'GPT-5 Codex',
        reviewedTabs: EXTRACTION_TABS,
        populationLabels: POPULATION_LABELS,
        disposition: 'ready_for_human_extraction_review',
      },
    };

    const updated = requireData(
      await supabase
        .from('papers')
        .update({
          status: 'processing',
          flag_reason: null,
          primary_file_id: translationFile.id,
          primary_file_sha256: MERGED_SHA256,
          storage_bucket: 'papers',
          storage_object_path: STORAGE_OBJECT_PATH,
          original_file_name: ATTACHMENT_NAME,
          metadata,
          updated_at: appliedAt,
        })
        .eq('id', PAPER_ID)
        .eq('assigned_study_id', STUDY_ID)
        .eq('updated_at', current.updated_at)
        .select('*'),
      `guarded paper update attempt ${attempt}`,
    );
    if (updated.length === 1) return updated[0];
  }
  throw new Error('Paper kept changing during guarded update; no paper pointer or status was changed.');
};

const expectedPopulationValues = () => {
  const expected = [];
  for (const staged of STAGED_FIELDS) {
    if (staged.value === null || !POPULATION_VALUE_FIELD_IDS.has(staged.fieldId)) continue;
    const lines = String(staged.value).split(/\r?\n/);
    POPULATION_LABELS.forEach((label, position) => {
      const value = lines[position] ?? '';
      if (value.trim()) expected.push({ label, position, fieldId: staged.fieldId, value: value.trim() });
    });
  }
  return expected;
};

const compareMultisets = (expected, live) => {
  const counts = (rows) => {
    const result = new Map();
    for (const row of rows) {
      const key = stableJson(row);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  };
  const expectedCounts = counts(expected);
  const liveCounts = counts(live);
  const mismatches = [];
  for (const key of new Set([...expectedCounts.keys(), ...liveCounts.keys()])) {
    const expectedCount = expectedCounts.get(key) ?? 0;
    const liveCount = liveCounts.get(key) ?? 0;
    if (expectedCount !== liveCount) {
      mismatches.push({ row: JSON.parse(key), expectedCount, liveCount });
    }
  }
  return mismatches;
};

const runIntegrityGate = (before, after) => {
  const fieldMismatches = [];
  for (const staged of STAGED_FIELDS) {
    const key = `${staged.tab}.${staged.fieldId}`;
    const live = after.fields[key];
    if (
      !live
      || live.value !== staged.value
      || live.status !== staged.status
      || live.pageHint !== staged.pageHint
      || live.updatedBy !== REVIEWER_ID
    ) {
      fieldMismatches.push({
        key,
        expectedValue: staged.value,
        liveValue: live?.value ?? null,
        expectedStatus: staged.status,
        liveStatus: live?.status ?? null,
        expectedPageHint: staged.pageHint,
        livePageHint: live?.pageHint ?? null,
        expectedUpdatedBy: REVIEWER_ID,
        liveUpdatedBy: live?.updatedBy ?? null,
      });
    }
  }
  const stagedFieldKeys = new Set(STAGED_FIELDS.map((staged) => `${staged.tab}.${staged.fieldId}`));
  const unexpectedLiveFields = Object.keys(after.fields).filter((key) => !stagedFieldKeys.has(key));

  const groupsById = new Map(after.populationGroups.map((group) => [group.id, group]));
  const livePopulationValues = after.populationValues.map((row) => ({
    label: groupsById.get(row.population_group_id)?.label ?? null,
    position: groupsById.get(row.population_group_id)?.position ?? null,
    fieldId: row.field_id,
    value: row.value,
  }));
  const expectedValues = expectedPopulationValues();
  const populationMismatches = compareMultisets(expectedValues, livePopulationValues);

  const mergedAttachments = after.attachments.filter((attachment) => attachment.registeredSha256 === MERGED_SHA256);
  const merged = mergedAttachments[0];
  const preservedOriginal = after.preservedOriginalSource;
  const matchingNotes = after.notes.filter((row) => row.body === translationNoteBody());
  const note = matchingNotes[0];
  const backlog = fs.readFileSync(path.join(APP_DIR, 'docs', 'review-backlog.md'), 'utf8');
  const backlogUpdated = backlog.includes('| S642 | processing | ⏲️ pending_review | Translation follow-up completed live |');
  const extractionTabNames = after.extractionTabs.map((row) => row.tab).sort();
  const expectedTabNames = [...EXTRACTION_TABS].sort();
  const findings = [];

  if (after.paper.id !== PAPER_ID || after.paper.assignedStudyId !== STUDY_ID) findings.push('Paper identity mismatch.');
  if (after.paper.assignedTo !== REVIEWER_ID) findings.push('Assignment changed.');
  if (after.paper.status !== 'processing' || after.paper.flagReason !== null) findings.push('Paper is not processing with a cleared translation flag.');
  if (after.paper.primaryFileSha256 !== MERGED_SHA256 || after.paper.primaryFileId !== merged?.id) findings.push('Merged translation is not the verified primary attachment.');
  if (
    !preservedOriginal
    || preservedOriginal.fileSha256 !== ORIGINAL_SHA256
    || preservedOriginal.downloadedSha256 !== ORIGINAL_SHA256
  ) findings.push('Original source storage object was not preserved and verified through provenance metadata.');
  if (after.attachments.length !== 1 || mergedAttachments.length !== 1 || !merged || merged.downloadedSha256 !== MERGED_SHA256 || !merged.isPrimary) findings.push('The single supported paper_files row is not the verified merged primary attachment.');
  if (after.paperStorageObject.downloadedSha256 !== MERGED_SHA256) findings.push('The papers storage pointer does not resolve to the merged translation bytes.');
  if (!note) findings.push('Translation provenance note is missing.');
  if (matchingNotes.length !== 1 || after.notes.length !== 1) findings.push('Translation provenance note is not present exactly once.');
  if (stableJson(extractionTabNames) !== stableJson(expectedTabNames)) findings.push('Tabs 1-10 are not all present.');
  if (fieldMismatches.length) findings.push(`${fieldMismatches.length} staged extraction fields do not match live.`);
  if (unexpectedLiveFields.length) findings.push(`${unexpectedLiveFields.length} unexpected extraction fields are present.`);
  if (stableJson(after.populationGroups.map((row) => row.label)) !== stableJson(POPULATION_LABELS)) findings.push('Population labels or order differ.');
  if (populationMismatches.length) findings.push(`${populationMismatches.length} population dual-write mismatches found.`);
  if (before.screening.recordsSha256 !== after.screening.recordsSha256) findings.push('Protected screening record state changed.');
  if (before.screening.votesSha256 !== after.screening.votesSha256) findings.push('Protected screening vote state changed.');
  if (after.fields['studyDetails.studyId']?.value !== STUDY_ID) findings.push('studyId no longer matches assigned_study_id.');
  if (!backlogUpdated) findings.push('Review backlog row is not updated to the verified S642 processing state.');

  return {
    result: findings.length ? 'failed' : 'passed',
    findings,
    fieldMismatches,
    populationMismatches,
    exactTargetMembership: after.paper.id === PAPER_ID && after.paper.assignedStudyId === STUDY_ID,
    assignmentPreserved: after.paper.assignedTo === REVIEWER_ID,
    statusIsProcessing: after.paper.status === 'processing' && after.paper.flagReason === null,
    studyIdMatchesAssignedStudyId: after.fields['studyDetails.studyId']?.value === STUDY_ID,
    originalAttachmentPreserved: Boolean(preservedOriginal && preservedOriginal.fileSha256 === ORIGINAL_SHA256 && preservedOriginal.downloadedSha256 === ORIGINAL_SHA256),
    translatedAttachmentPrimaryAndVerified: Boolean(after.attachments.length === 1 && mergedAttachments.length === 1 && merged && merged.downloadedSha256 === MERGED_SHA256 && merged.isPrimary),
    translationProvenancePresent: Boolean(note),
    allTenTabsPresent: stableJson(extractionTabNames) === stableJson(expectedTabNames),
    sourceToLiveFieldTransferMismatches: fieldMismatches.length,
    unexpectedLiveFields,
    populationLayoutMismatches:
      stableJson(after.populationGroups.map((row) => row.label)) === stableJson(POPULATION_LABELS) ? 0 : 1,
    structuredDualWriteMismatches: populationMismatches.length,
    protectedScreeningUnchanged:
      before.screening.recordsSha256 === after.screening.recordsSha256
      && before.screening.votesSha256 === after.screening.votesSha256,
    backlogUpdated,
  };
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const writeAuditFiles = ({ startedAt, finishedAt, before, after, gate, populationApply }) => {
  ensureAuditDir();
  const audit = {
    artifactType: 'S642 / Covidence #869 translation attachment and extraction correction audit',
    date: REVIEW_DATE,
    scope: 'S642 / Covidence #869 only',
    model: 'GPT-5 Codex',
    targetSystem: 'FIFA GBI web app extraction',
    source: {
      language: 'Japanese',
      translatedOn: '2026-05-25',
      mergedPdf: SOURCE_RELATIVE_PATH.replace(/^\.\.\//, ''),
      mergedPdfSha256: MERGED_SHA256,
      originalPdfSha256: ORIGINAL_SHA256,
      paperAudit: PAPER_AUDIT_RELATIVE_PATH.replace(/^\.\.\//, ''),
      pages: { translated: 5, original: 8, total: 13 },
      visualChecks: [
        'Merged pages 1-5 rendered cleanly and contained the full English translation.',
        'Original p.300 Table 1 verified player, age, support-day, match, and PT rows.',
        'Original p.302 Figures 1-2 verified injury-type and injury-location percentages.',
      ],
    },
    upload: {
      target_system: 'web app extraction',
      covidence_number: COV_NUMBER,
      assigned_study_id: STUDY_ID,
      screening_record_id: null,
      paper_id: PAPER_ID,
      source_language: 'Japanese',
      review_reference_id: null,
      filename: ATTACHMENT_NAME,
      source_filter: 'exact papers.assigned_study_id plus metadata.covidenceNumber',
      study_id: STUDY_ID,
      storage_bucket: 'papers',
      storage_object_path: STORAGE_OBJECT_PATH,
      file_sha256: MERGED_SHA256,
      status: gate.translatedAttachmentPrimaryAndVerified ? 'uploaded_and_verified' : 'verification_failed',
      document_id: after.attachments.find((attachment) => attachment.registeredSha256 === MERGED_SHA256)?.id ?? null,
      upload_key: STORAGE_OBJECT_PATH,
      file_size: fs.statSync(SOURCE_PATH).size,
      started_at_utc: startedAt,
      finished_at_utc: finishedAt,
      message: 'Updated the supported single extraction-file pointer to the merged English-first/original-second PDF and preserved the verified original storage object and hash in provenance metadata.',
    },
    before,
    after,
    sourceCoverage:
      'English translation, full methods and results, original Table 1, original Figures 1-2, discussion, limitations, and printed English abstract checked.',
    populationLayout: {
      labels: POPULATION_LABELS,
      count: POPULATION_LABELS.length,
      rationale: 'The source directly reports pooled values and the primary pre/post active-water-supply comparison.',
      applied: populationApply,
    },
    extractionScope: {
      reviewedTabs: EXTRACTION_TABS,
      reportedFieldCount: STAGED_FIELDS.filter((row) => row.status === 'reported').length,
      notReportedFieldCount: STAGED_FIELDS.filter((row) => row.status === 'not_reported').length,
      intentionallyBlankFamilies: {
        illnessOutcome: 'Illnesses were not an outcome.',
        injuryTissueType:
          'Figure 1 percentages total 101% after rounding, so count fields were not populated or forced from incompatible percentages.',
        injuryLocation:
          'Figure 2 percentages total 101%, and the largest category combines ankle/foot; count fields were not forced from rounded or combined percentages.',
        illnessRegion: 'Illnesses were not an outcome.',
        illnessEtiology: 'Illnesses were not an outcome.',
      },
      directAndDerivedCaveats: [
        'Pre/post player totals 58 and 106 are transparent sums of direct annual Table 1 counts.',
        'Contact count 88 is percentage-derived from 70% of 126; non-contact count 38 is the binary complement.',
        'No exposure total was back-calculated from counts and rates.',
        'The 45 consequential injuries and their incidence were not forced into time-loss fields because the definition mixes next-day treatment with inability to play.',
      ],
    },
    protectedScreening: {
      preApplyLinkedRecords: before.screening.records.length,
      preApplyLinkedVotes: before.screening.votes.length,
      postApplyUnchanged: gate.protectedScreeningUnchanged,
      screeningWrites: 0,
      resolverWrites: 0,
      promotionWrites: 0,
    },
    integrityGate: gate,
    rollback: {
      paperPointer:
        'Restore the papers primary_file_id, primary_file_sha256, storage fields, original_file_name, status, flag_reason, and metadata from before.paper.',
      extractionFields:
        'Restore each pre-existing extraction field from before.fields. Newly added rows can remain as not_reported until deletion is separately approved.',
      attachments:
        'Restore the single paper_files row and papers storage pointers from before. The original storage object remains intact and verified at its prior path.',
      population:
        'The full pre-apply state had no population rows. Removal of the additive population rows is destructive and would require separate approval.',
    },
    readyFor: gate.result === 'passed' ? 'Human extraction review' : 'Correction before human review',
  };

  writeJson(path.join(AUDIT_DIR, 's642-covidence-869-translation-extraction-audit-2026-07-27.json'), audit);

  const uploadHeaders = Object.keys(audit.upload);
  fs.writeFileSync(
    path.join(AUDIT_DIR, 's642-covidence-869-translation-upload-audit-2026-07-27.csv'),
    `${uploadHeaders.join(',')}\n${uploadHeaders.map((header) => csvEscape(audit.upload[header])).join(',')}\n`,
  );

  const markdown = [
    '# S642 / Covidence #869 translation follow-up audit',
    '',
    `- Date: ${REVIEW_DATE}`,
    '- Target: FIFA GBI web app extraction',
    `- Result: ${gate.result}`,
    `- Ready for: ${audit.readyFor}`,
    '- Screening decisions changed: no',
    '',
    '| Study ID | Covidence | Language | Attachment | SHA-256 | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${STUDY_ID} | ${COV_NUMBER} | Japanese | \`${ATTACHMENT_NAME}\` | \`${MERGED_SHA256}\` | ${audit.upload.status} |`,
    '',
    '## Extraction outcome',
    '',
    `Population layout: ${POPULATION_LABELS.join(' / ')}.`,
    '',
    `Tabs 1-10 were checked. ${audit.extractionScope.reportedFieldCount} reported fields and ${audit.extractionScope.notReportedFieldCount} explicit not-reported fields were written.`,
    '',
    'Tabs 7-8 were checked against original p.302. Their percentages were not converted to count fields because both charts total 101% after rounding, and the location chart also combines ankle/foot.',
    '',
    `Focused live integrity gate: ${gate.result}. Source-to-live mismatches: ${gate.sourceToLiveFieldTransferMismatches}; population dual-write mismatches: ${gate.structuredDualWriteMismatches}.`,
    '',
    'Remaining decision: human extraction review. The translation blocker is cleared, but this workflow does not mark the Batch 064 row reviewed complete.',
    '',
  ].join('\n');
  fs.writeFileSync(
    path.join(AUDIT_DIR, 's642-covidence-869-translation-extraction-audit-2026-07-27.md'),
    markdown,
  );
  return audit;
};

const runApply = async () => {
  assertStagedFieldIds();
  const source = localSourceState();
  const currentSnapshot = await fetchSnapshot();
  const current = await summariseSnapshot(currentSnapshot);
  const state = assertPreApplyState(current);
  ensureAuditDir();
  const preApplyPath = path.join(AUDIT_DIR, 's642-covidence-869-pre-apply-live-snapshot-2026-07-27.json');
  if (state === 'final' && !fs.existsSync(preApplyPath)) {
    throw new Error('Final live state exists without the original pristine pre-apply snapshot.');
  }
  let before;
  if (fs.existsSync(preApplyPath)) {
    before = JSON.parse(fs.readFileSync(preApplyPath, 'utf8'));
  } else {
    before = current;
    writeJson(preApplyPath, before);
  }
  appendApplyEvent({ step: 'preconditions', status: 'passed', state, preApplySnapshot: preApplyPath });
  if (state === 'final') {
    appendApplyEvent({ step: 'apply', status: 'already_final_verifying' });
    const after = await summariseSnapshot(await fetchSnapshot());
    const gate = runIntegrityGate(before, after);
    const audit = writeAuditFiles({
      startedAt: before.capturedAt,
      finishedAt: new Date().toISOString(),
      before,
      after,
      gate,
      populationApply: { groups: after.populationGroups.length, values: after.populationValues.length },
    });
    if (gate.result !== 'passed') throw new Error(`Final-state verification failed: ${gate.findings.join('; ')}`);
    process.stdout.write(`${JSON.stringify({ result: 'already_applied_and_verified', auditDir: AUDIT_DIR, integrityGate: audit.integrityGate }, null, 2)}\n`);
    return;
  }

  const startedAt = before.capturedAt;
  const appliedAt = new Date().toISOString();
  try {
    const translationFile = await uploadTranslationAttachment(source, appliedAt);
    const extractionByTab = await ensureExtractionRows(currentSnapshot, appliedAt);
    appendApplyEvent({ step: 'extraction_tabs', status: 'ensured', count: extractionByTab.size });
    await applyExtractionFields(currentSnapshot, extractionByTab, appliedAt);
    appendApplyEvent({ step: 'extraction_fields', status: 'applied', count: STAGED_FIELDS.length });
    const populationApply = await applyPopulationLayout(appliedAt);
    appendApplyEvent({ step: 'population_layout', status: 'applied', ...populationApply });
    await addTranslationNote(appliedAt);
    const paper = await updatePaperForTranslation(translationFile, appliedAt);
    appendApplyEvent({
      step: 'paper_transition',
      status: 'applied',
      paperStatus: paper.status,
      primaryFileId: paper.primary_file_id,
      primaryFileSha256: paper.primary_file_sha256,
    });

    const after = await summariseSnapshot(await fetchSnapshot());
    const gate = runIntegrityGate(before, after);
    const finishedAt = new Date().toISOString();
    const audit = writeAuditFiles({ startedAt, finishedAt, before, after, gate, populationApply });
    appendApplyEvent({ step: 'focused_live_integrity_gate', status: gate.result, findings: gate.findings });
    if (gate.result !== 'passed') throw new Error(`Focused live integrity gate failed: ${gate.findings.join('; ')}`);
    process.stdout.write(`${JSON.stringify({ result: 'applied', auditDir: AUDIT_DIR, integrityGate: audit.integrityGate }, null, 2)}\n`);
  } catch (error) {
    appendApplyEvent({ step: 'apply_failure', status: 'failed', message: error.message });
    throw error;
  }
};

const runVerify = async () => {
  assertStagedFieldIds();
  localSourceState();
  const preApplyPath = path.join(AUDIT_DIR, 's642-covidence-869-pre-apply-live-snapshot-2026-07-27.json');
  if (!fs.existsSync(preApplyPath)) throw new Error(`Pre-apply snapshot is missing: ${preApplyPath}`);
  const before = JSON.parse(fs.readFileSync(preApplyPath, 'utf8'));
  const after = await summariseSnapshot(await fetchSnapshot());
  const gate = runIntegrityGate(before, after);
  const audit = writeAuditFiles({
    startedAt: before.capturedAt,
    finishedAt: new Date().toISOString(),
    before,
    after,
    gate,
    populationApply: {
      groups: after.populationGroups.length,
      values: after.populationValues.length,
    },
  });
  if (gate.result !== 'passed') throw new Error(`Verification failed: ${gate.findings.join('; ')}`);
  process.stdout.write(`${JSON.stringify({ result: 'verified', auditDir: AUDIT_DIR, integrityGate: audit.integrityGate }, null, 2)}\n`);
};

const runDryRun = async () => {
  assertStagedFieldIds();
  const source = localSourceState();
  const before = await summariseSnapshot(await fetchSnapshot());
  assertPreApplyState(before);
  const changes = STAGED_FIELDS.map((staged) => {
    const key = `${staged.tab}.${staged.fieldId}`;
    const live = before.fields[key];
    return {
      key,
      priorValue: live?.value ?? null,
      nextValue: staged.value,
      priorStatus: live?.status ?? null,
      nextStatus: staged.status,
      action: live ? 'correct_or_verify' : 'add',
    };
  });
  process.stdout.write(`${JSON.stringify({
    result: 'dry_run_passed',
    paperId: PAPER_ID,
    studyId: STUDY_ID,
    sourceSha256: source.sha256,
    sourceSize: source.size,
    attachmentAction: {
      add: ATTACHMENT_NAME,
      storageObjectPath: STORAGE_OBJECT_PATH,
      makePrimary: true,
      preserveOriginalFileId: before.paper.primaryFileId,
      preserveOriginalSha256: before.paper.primaryFileSha256,
    },
    paperTransition: { from: before.paper.status, to: 'processing' },
    populationLabels: POPULATION_LABELS,
    extractionTabs: EXTRACTION_TABS,
    fieldCounts: {
      total: STAGED_FIELDS.length,
      reported: STAGED_FIELDS.filter((row) => row.status === 'reported').length,
      notReported: STAGED_FIELDS.filter((row) => row.status === 'not_reported').length,
      existing: changes.filter((row) => row.action === 'correct_or_verify').length,
      additive: changes.filter((row) => row.action === 'add').length,
    },
    changes,
  }, null, 2)}\n`);
};

if (APPLY) {
  await runApply();
} else if (VERIFY_ONLY) {
  await runVerify();
} else if (DRY_RUN) {
  await runDryRun();
} else {
  const snapshot = await fetchSnapshot();
  const summary = await summariseSnapshot(snapshot);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
