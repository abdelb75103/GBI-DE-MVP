import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'aspetar-reconciliation');
const DATE = '2026-07-27';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const STUDY_IDS = ['S071', 'S195', 'S261', 'S344', 'S544', 'S555', 'S602', 'S712', 'S1431', 'S2824', 'S3577'];

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const { extractionFieldDefinitions } = await import('../src/lib/extraction/schema.ts');
const definitionById = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: papers, error } = await supabase
  .from('papers')
  .select(`
    id,assigned_study_id,title,doi,status,flag_reason,assigned_to,primary_file_id,metadata,updated_at,
    paper_files!paper_files_paper_id_fkey(*),
    extractions(*,extraction_fields(*)),
    population_groups(*,population_values(*))
  `)
  .in('assigned_study_id', STUDY_IDS)
  .order('assigned_study_id');
if (error) throw error;
if ((papers ?? []).length !== STUDY_IDS.length) {
  throw new Error(`Expected ${STUDY_IDS.length} Aspetar-family papers, received ${(papers ?? []).length}`);
}

const paperByStudyId = new Map(papers.map((paper) => [paper.assigned_study_id, paper]));

function filledFields(studyId) {
  const fields = new Map();
  for (const extraction of paperByStudyId.get(studyId)?.extractions ?? []) {
    for (const field of extraction.extraction_fields ?? []) {
      if (field.value == null || !String(field.value).trim()) continue;
      fields.set(field.field_id, String(field.value));
    }
  }
  return fields;
}

function rows(values) {
  return values.map((value) => (value == null ? '' : String(value))).join('\n');
}

function aligned(total, ageValues = [], supplement = '') {
  if (ageValues.length !== 11) throw new Error(`Expected 11 academy age values, received ${ageValues.length}`);
  return rows([total, ...ageValues, supplement]);
}

function sumColumns(...columns) {
  return columns[0].map((_, index) => columns.reduce((sum, column) => sum + Number(column[index] ?? 0), 0));
}

function groupByTab(flatFields) {
  const grouped = {};
  for (const [fieldId, value] of Object.entries(flatFields)) {
    const definition = definitionById.get(fieldId);
    if (!definition) throw new Error(`Unknown extraction field ${fieldId}`);
    grouped[definition.tab] ??= {};
    grouped[definition.tab][fieldId] = value;
  }
  return grouped;
}

const academyAges = ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19'];
const academyLabels = ['Total 2012/13-2015/16', ...academyAges, '2016/17-2018/19 U13-U15 growth cohort (S1431)'];
const ageCounts = {
  concussion: [0, 0, 0, 0, 1, 0, 2, 3, 4, 0, 0],
  cartilage: [0, 0, 0, 0, 0, 2, 1, 5, 5, 5, 1],
  contusion: [7, 20, 22, 23, 32, 38, 50, 77, 41, 26, 1],
  fracture: [2, 0, 1, 2, 1, 10, 9, 1, 2, 9, 0],
  muscle: [0, 0, 0, 1, 7, 12, 22, 22, 25, 31, 6],
  laceration: [0, 0, 0, 0, 0, 2, 1, 1, 0, 0, 0],
  boneStress: [1, 0, 0, 0, 1, 1, 2, 7, 2, 8, 7],
  tendinopathy: [0, 1, 0, 0, 1, 1, 1, 1, 2, 3, 0],
  synovitis: [1, 0, 0, 0, 0, 1, 1, 4, 1, 1, 0],
  growth: [1, 4, 12, 12, 25, 44, 32, 35, 28, 13, 2],
  physealFracture: [0, 1, 1, 2, 8, 4, 7, 10, 3, 1, 0],
  ligament: [6, 2, 4, 0, 17, 14, 33, 42, 44, 50, 3],
  head: [0, 0, 0, 0, 1, 2, 4, 4, 4, 0, 0],
  neck: [0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0],
  shoulder: [2, 0, 1, 0, 0, 2, 4, 0, 1, 3, 0],
  elbow: [0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0],
  hand: [1, 2, 0, 1, 10, 5, 5, 3, 2, 6, 0],
  ribsThoracic: [0, 0, 1, 1, 0, 1, 2, 1, 1, 2, 1],
  abdomenLumbar: [0, 0, 0, 2, 6, 8, 16, 16, 5, 5, 0],
  thighUnspecified: [0, 0, 0, 0, 1, 0, 0, 3, 3, 2, 1],
  quadriceps: [0, 2, 3, 4, 11, 13, 19, 24, 22, 22, 1],
  hamstring: [0, 1, 2, 4, 5, 20, 20, 25, 22, 22, 5],
  adductor: [0, 1, 0, 1, 6, 13, 12, 12, 12, 13, 2],
  knee: [4, 9, 9, 6, 16, 15, 16, 34, 26, 31, 2],
  lowerLeg: [1, 3, 3, 9, 15, 26, 20, 21, 4, 8, 3],
  calfAchilles: [2, 1, 2, 1, 5, 4, 5, 10, 7, 4, 1],
  ankle: [7, 3, 6, 0, 15, 15, 37, 41, 42, 35, 4],
  foot: [3, 6, 16, 10, 10, 20, 15, 29, 11, 8, 1],
};
const ageIncidence = {
  concussion: [0, 0, 0, 0, 0.3, 0, 0.4, 0.7, 0.9, 0, 0],
  cartilage: [0, 0, 0, 0, 0, 0.4, 0.2, 1.1, 1.2, 1.2, 1.5],
  contusion: [1.8, 4.9, 4.8, 5.2, 8.2, 8.5, 10.9, 17.2, 9.7, 6, 1.5],
  fracture: [0.5, 0, 0.2, 0.5, 0.3, 2.2, 2, 0.2, 0.5, 2.1, 0],
  muscle: [0, 0, 0, 0.2, 1.8, 2.7, 4.8, 4.9, 5.9, 7.2, 8.8],
  laceration: [0, 0, 0, 0, 0, 0.4, 0.2, 0.2, 0, 0, 0],
  boneStress: [0.3, 0, 0, 0, 0.3, 0.2, 0.4, 1.6, 0.5, 1.9, 10.3],
  tendinopathy: [0, 0.2, 0, 0, 0.3, 0.2, 0.2, 0.2, 0.5, 0.7, 0],
  synovitis: [0.3, 0, 0, 0, 0, 0.2, 0.2, 0.9, 0.2, 0.2, 0],
  growth: [0.3, 1, 2.6, 2.7, 6.4, 9.8, 7, 7.8, 6.6, 3, 2.9],
  physealFracture: [0, 0.2, 0.2, 0.5, 2, 0.9, 1.5, 2.2, 0.7, 0.2, 0],
  ligament: [1.6, 0.5, 0.9, 0, 4.3, 3.1, 7.2, 9.4, 10.4, 11.6, 4.4],
  head: [0, 0, 0, 0, 0.3, 0.4, 0.9, 0.9, 0.9, 0, 0],
  neck: [0, 0, 0, 0, 0, 0.2, 0.7, 0.2, 0, 0, 0],
  shoulder: [0.5, 0, 0.2, 0, 0, 0.4, 0.9, 0, 0.2, 0.7, 0],
  elbow: [0, 0.2, 0, 0, 0, 0.2, 0, 0.2, 0.2, 0.2, 0],
  hand: [0.3, 0.5, 0, 0.2, 2.6, 1.1, 1.1, 0.7, 0.5, 1.4, 0],
  ribsThoracic: [0, 0, 0.2, 0.2, 0, 0.2, 0.4, 0.2, 0.2, 0.5, 1.5],
  abdomenLumbar: [0, 0, 0, 0.5, 1.5, 1.8, 3.5, 3.6, 1.2, 1.2, 0],
  thighUnspecified: [0, 0, 0, 0, 0.3, 0, 0, 0.7, 0.7, 0.5, 1.5],
  quadriceps: [0, 0.5, 0.7, 0.9, 2.8, 2.9, 4.1, 5.4, 5.2, 5.1, 1.5],
  hamstring: [0, 0.2, 0.4, 0.9, 1.3, 4.5, 4.3, 5.6, 5.2, 5.1, 7.4],
  adductor: [0, 0.2, 0, 0.2, 1.5, 2.9, 2.6, 2.7, 2.8, 3, 2.9],
  knee: [1, 2.2, 2, 1.4, 4.1, 3.3, 3.5, 7.6, 6.1, 7.2, 2.9],
  lowerLeg: [0.3, 0.7, 0.7, 2, 3.8, 5.8, 4.3, 4.7, 0.9, 1.9, 4.4],
  calfAchilles: [0.5, 0.2, 0.4, 0.2, 1.3, 0.9, 1.1, 2.2, 1.7, 0.9, 1.5],
  ankle: [1.8, 0.7, 1.3, 0, 3.8, 3.3, 8, 9.2, 9.9, 8.1, 5.9],
  foot: [0.8, 1.5, 3.5, 2.3, 2.6, 4.5, 3.3, 6.5, 2.6, 1.9, 1.5],
};

const s1431 = filledFields('S1431');
const s1431Value = (fieldId) => s1431.get(fieldId) ?? '';
const academyFlat = {
  studyId: 'S261',
  leadAuthor: 'Materne O',
  title: 'Injury incidence and burden in a youth elite football academy: a four-season prospective study of 551 players aged from under 9 to under 19 years',
  yearOfPublication: '2021',
  journal: 'British Journal of Sports Medicine',
  doi: '10.1136/bjsports-2020-102859',
  studyDesign: 'prospective cohort study',
  fifaDiscipline: 'Association football (11-a-side)',
  country: 'Qatar',
  levelOfPlay: 'elite national youth academy',
  sex: 'male',
  ageCategory: aligned('U9-U19', academyAges, s1431Value('ageCategory')),
  meanAge: aligned('', ['8.7 ± 0.2', '9.7 ± 0.3', '10.7 ± 0.2', '11.6 ± 0.3', '12.7 ± 0.3', '13.7 ± 0.3', '14.6 ± 0.3', '15.6 ± 0.3', '16.6 ± 0.3', '17.6 ± 0.3', '18.4 ± 0.3'], s1431Value('meanAge')),
  sampleSizePlayers: aligned('551', Array(11).fill(''), s1431Value('sampleSizePlayers')),
  numberOfTeams: aligned('1 academy', Array(11).fill(''), ''),
  observationDuration: aligned('2012/13-2015/16 (4 seasons)', Array(11).fill(''), s1431Value('observationDuration')),
  injuryDefinition: aligned('medical attention [with separate time-loss injuries]', Array(11).fill(''), 'time loss [recurrent injuries excluded]'),
  incidenceDefinition: aligned('injuries per squad-season, standardised to 25 players', Array(11).fill(''), s1431Value('incidenceDefinition')),
  burdenDefinition: aligned('injury days lost per squad-season, standardised to 25 players', Array(11).fill(''), ''),
  severityDefinition: aligned('days lost; source reports mean and median by table', Array(11).fill(''), ''),
  recurrenceDefinition: aligned('same diagnosis and site after return to full participation', Array(11).fill(''), s1431Value('recurrenceDefinition')),
  mechanismReporting: aligned('academy medical staff', Array(11).fill(''), s1431Value('mechanismReporting')),
  numberOfSeasons: aligned('4', Array(11).fill(''), s1431Value('numberOfSeasons')),
  exposureMeasurementUnit: aligned('squad-season (25 players)', Array(11).fill(''), s1431Value('exposureMeasurementUnit')),
  totalExposure: aligned('', Array(11).fill(''), s1431Value('totalExposure')),
  matchExposure: aligned('', Array(11).fill(''), s1431Value('matchExposure')),
  trainingExposure: aligned('', Array(11).fill(''), s1431Value('trainingExposure')),
  injuryTotalCount: aligned('2204', Array(11).fill(''), s1431Value('injuryTotalCount')),
  injuryMedicalAttentionCount: aligned('882', Array(11).fill(''), ''),
  injuryTimeLossCount: aligned('1322', [20, 29, 48, 47, 111, 178, 214, 264, 204, 182, 25], s1431Value('injuryTimeLossCount')),
  injuryMatchCount: aligned('', Array(11).fill(''), s1431Value('injuryMatchCount')),
  injuryTrainingCount: aligned('', Array(11).fill(''), s1431Value('injuryTrainingCount')),
  injuryIncidenceOverall: aligned('50.5', Array(11).fill(''), s1431Value('injuryIncidenceOverall')),
  injuryIncidenceTimeLossOverall: aligned('30.3', [5.2, 7, 10.5, 10.6, 28.3, 39.7, 46.5, 58.9, 48.1, 42.1, 36.8], ''),
  injuryIncidenceMatch: aligned('', Array(11).fill(''), s1431Value('injuryIncidenceMatch')),
  injuryIncidenceTraining: aligned('', Array(11).fill(''), s1431Value('injuryIncidenceTraining')),
  injuryTimeLossTotal: aligned('25034', Array(11).fill(''), ''),
  injuryBurden: aligned('573.6', [67.7, 58.7, 104.8, 99.5, 485.5, 667, 727.6, 992.2, 967.5, 1408.3, 1092.6], ''),
  injuryMostCommonType: aligned('contusion/bruise/haematoma', Array(11).fill(''), s1431Value('injuryMostCommonType')),
  injuryMostCommonLocation: aligned('foot/ankle overall', Array(11).fill(''), s1431Value('injuryMostCommonLocation')),
  injuryContact: aligned('920', Array(11).fill(''), ''),
  injuryNonContact: aligned('1284', Array(11).fill(''), ''),
  injuryRecurrentTotal: aligned('55', Array(11).fill(''), ''),
  injuryRecurrenceRate: aligned('4.1%', Array(11).fill(''), ''),
  injuryModeAcuteSudden: aligned('', Array(11).fill(''), s1431Value('injuryModeAcuteSudden')),
  injuryModeRepetitiveGradual: aligned('', Array(11).fill(''), s1431Value('injuryModeRepetitiveGradual')),
};

const structuredTypeMappings = {
  concussion: ['concussion', 10, 0.2, 3.1, 31],
  cartilage_injury: ['cartilage', 19, 0.4, 128.8, 2448],
  superficial_contusion: ['contusion', 337, 7.7, 4.6, 1567],
  bone_fracture: ['fracture', 37, 0.8, 43.8, 1621],
  muscle_injury: ['muscle', 126, 2.9, 22.5, 2836],
  laceration: ['laceration', 4, 0.1, 7.5, 30],
  bone_stress: ['boneStress', 29, 0.7, 37.4, 1084],
  tendinopathy: ['tendinopathy', 10, 0.2, 17.6, 176],
  synovitis_capsulitis: ['synovitis', 9, 0.2, 5.7, 51],
  physis: ['physisCombined', 245, 5.6, '', 6862],
  ligament_joint_capsule: ['ligament', 215, 4.9, 31.3, 6732],
};
ageCounts.physisCombined = sumColumns(ageCounts.growth, ageCounts.physealFracture);
ageIncidence.physisCombined = sumColumns(ageIncidence.growth, ageIncidence.physealFracture);
for (const [schemaId, [sourceKey, totalCount, totalIncidence, meanDays, totalDays]] of Object.entries(structuredTypeMappings)) {
  academyFlat[`injuryTissueType_${schemaId}_prevalence`] = aligned(totalCount, ageCounts[sourceKey], s1431Value(`injuryTissueType_${schemaId}_prevalence`));
  academyFlat[`injuryTissueType_${schemaId}_incidence`] = aligned(totalIncidence, ageIncidence[sourceKey], s1431Value(`injuryTissueType_${schemaId}_incidence`));
  if (meanDays !== '') academyFlat[`injuryTissueType_${schemaId}_severityMeanDays`] = aligned(meanDays, Array(11).fill(''), s1431Value(`injuryTissueType_${schemaId}_severityMeanDays`));
  academyFlat[`injuryTissueType_${schemaId}_severityTotalDays`] = aligned(totalDays, Array(11).fill(''), s1431Value(`injuryTissueType_${schemaId}_severityTotalDays`));
}

const locationMappings = {
  head_neck_overall: [sumColumns(ageCounts.head, ageCounts.neck), sumColumns(ageIncidence.head, ageIncidence.neck), 20, '0.46 (0.28-0.71)', 'median 3 (IQR 1-6)', 86, '21.5 (17.2-26.6)'],
  shoulder: [ageCounts.shoulder, ageIncidence.shoulder, '', '', '', '', ''],
  elbow: [ageCounts.elbow, ageIncidence.elbow, '', '', '', '', ''],
  hand: [ageCounts.hand, ageIncidence.hand, '', '', '', '', ''],
  trunk_overall: [sumColumns(ageCounts.ribsThoracic, ageCounts.abdomenLumbar), sumColumns(ageIncidence.ribsThoracic, ageIncidence.abdomenLumbar), 68, '1.56 (1.21-1.98)', 'median 7 (IQR 2-25)', 1866, '466.5 (445.6-488.2)'],
  thigh: [sumColumns(ageCounts.thighUnspecified, ageCounts.quadriceps, ageCounts.hamstring, ageCounts.adductor), sumColumns(ageIncidence.thighUnspecified, ageIncidence.quadriceps, ageIncidence.hamstring, ageIncidence.adductor), 329, '7.54 (6.75-8.40)', 'median 4 (IQR 2-14)', 3356, '839.0 (810.9-867.9)'],
  knee: [ageCounts.knee, ageIncidence.knee, 218, '5.00 (4.35-5.70)', 'median 11 (IQR 3-29)', 7705, '1926.3 (1883.5-1969.7)'],
  lower_leg: [sumColumns(ageCounts.lowerLeg, ageCounts.calfAchilles), sumColumns(ageIncidence.lowerLeg, ageIncidence.calfAchilles), 105, '2.41 (1.97-2.91)', 'median 4 (IQR 1-9)', 1360, '340.0 (322.2-358.6)'],
  ankle: [ageCounts.ankle, ageIncidence.ankle, '', '', '', '', ''],
  foot: [ageCounts.foot, ageIncidence.foot, '', '', '', '', ''],
};
for (const [schemaId, [counts, incidence, totalCount, totalIncidence, medianDays, totalDays, burden]] of Object.entries(locationMappings)) {
  academyFlat[`injuryLocation_${schemaId}_prevalence`] = aligned(totalCount, counts, s1431Value(`injuryLocation_${schemaId}_prevalence`));
  academyFlat[`injuryLocation_${schemaId}_incidence`] = aligned(totalIncidence, incidence, s1431Value(`injuryLocation_${schemaId}_incidence`));
  if (medianDays) academyFlat[`injuryLocation_${schemaId}_severityMeanDays`] = aligned(medianDays, Array(11).fill(''), s1431Value(`injuryLocation_${schemaId}_severityMeanDays`));
  if (totalDays) academyFlat[`injuryLocation_${schemaId}_severityTotalDays`] = aligned(totalDays, Array(11).fill(''), s1431Value(`injuryLocation_${schemaId}_severityTotalDays`));
  if (burden) academyFlat[`injuryLocation_${schemaId}_burden`] = aligned(burden, Array(11).fill(''), s1431Value(`injuryLocation_${schemaId}_burden`));
}

for (const fieldId of [
  'injuryTissueType_bone_stress_prevalence',
  'injuryTissueType_brain_spinal_prevalence',
  'injuryTissueType_bursitis_prevalence',
  'injuryTissueType_joint_sprain_prevalence',
  'injuryLocation_ankle_prevalence',
  'injuryLocation_ankle_incidence',
  'injuryLocation_foot_prevalence',
  'injuryLocation_foot_incidence',
  'injuryLocation_groin_prevalence',
  'injuryLocation_groin_incidence',
] ) {
  if (!academyFlat[fieldId] && s1431Value(fieldId)) {
    academyFlat[fieldId] = aligned('', Array(11).fill(''), s1431Value(fieldId));
  }
}

const professionalBase = filledFields('S2824');
const professionalBaseLabels = paperByStudyId.get('S2824').population_groups
  .slice()
  .sort((a, b) => a.position - b.position)
  .map((group) => group.label);
if (professionalBaseLabels.length !== 9) {
  throw new Error(`Expected 9 current S2824 rows, received ${professionalBaseLabels.length}`);
}
const professionalSupplementRows = [
  {
    label: '2008/09 historical all-injury cohort (S195)',
    fields: {
      ageCategory: 'senior',
      meanAge: '28.4 ± 4.4',
      sampleSizePlayers: '230',
      numberOfTeams: '10',
      observationDuration: 'August 2008-April 2009',
      injuryDefinition: 'time loss [unable to participate fully in the next training session or match]',
      incidenceDefinition: 'injuries per 1000 player-hours',
      recurrenceDefinition: 'same diagnosis and site within two months after full return',
      mechanismReporting: 'club medical staff',
      numberOfSeasons: '1',
      exposureMeasurementUnit: 'mean player-hours per player',
      totalExposure: '170.0 ± 56.0',
      matchExposure: '27.2 ± 14.9',
      trainingExposure: '142.8 ± 51.6',
      injuryTotalCount: '217',
      injuryMatchCount: '84',
      injuryTrainingCount: '133',
      injuryIncidenceOverall: '6.0',
      injuryIncidenceMatch: '14.5',
      injuryIncidenceTraining: '4.4',
      injuryMostCommonDiagnosis: 'hamstring strain',
      injuryMostCommonType: 'muscle strain',
      injuryMostCommonLocation: 'thigh',
      injuryContact: '62',
      injuryRecurrentTotal: '32',
      injuryRecurrenceRate: '15%',
    },
  },
  {
    label: '2013/14-2014/15 groin supplement (S344)',
    fields: {
      ageCategory: 'senior',
      meanAge: '26 ± 4.9',
      sampleSizePlayers: '606',
      numberOfTeams: '17',
      observationDuration: 'July 2013-June 2015',
      injuryDefinition: 'time loss [groin injury only]',
      incidenceDefinition: 'groin injuries per 1000 player-hours',
      burdenDefinition: 'groin injury days lost per 1000 player-hours',
      recurrenceDefinition: 'same classification and side after full return',
      mechanismReporting: 'club doctors',
      numberOfSeasons: '2',
      exposureMeasurementUnit: 'player-hours',
      totalExposure: '205466',
      matchExposure: '21909',
      trainingExposure: '183557',
      injuryTotalCount: '206',
      injuryTimeLossCount: '206',
      injuryMatchCount: '77',
      injuryTrainingCount: '129',
      injuryIncidenceOverall: '1.0',
      injuryIncidenceCi95: '0.9-1.1',
      injuryIncidenceMatch: '3.5',
      injuryIncidenceTraining: '0.7',
      injuryBurden: '24.3',
      injuryTimeLossMedian: '10 (IQR 5-22)',
      injuryMostCommonDiagnosis: 'adductor-related groin pain',
      injuryMostCommonLocation: 'groin',
      injuryRecurrentTotal: '35',
      injuryRecurrenceRate: '20%',
      injuryTissueType_injury_diagnosis_diagnosis: 'time-loss groin injury',
      injuryTissueType_injury_diagnosis_prevalence: '206',
      injuryTissueType_injury_diagnosis_incidence: '1.0 (0.9-1.1)',
      injuryTissueType_injury_diagnosis_burden: '24.3',
      injuryTissueType_injury_diagnosis_severityMeanDays: 'median 10 (IQR 5-22)',
      injuryLocation_groin_prevalence: '206',
      injuryLocation_groin_incidence: '1.0 (0.9-1.1)',
      injuryLocation_groin_burden: '24.3',
      injuryLocation_groin_severityMeanDays: 'median 10 (IQR 5-22)',
    },
  },
  {
    label: '2013/14-2017/18 ACL supplement (S555)',
    fields: {
      ageCategory: 'senior',
      numberOfTeams: '14-17 per season',
      observationDuration: '2013/14-2017/18',
      injuryDefinition: 'time loss [complete ACL rupture confirmed by MRI]',
      incidenceDefinition: 'ACL injuries per 1000 player-hours',
      burdenDefinition: 'ACL injury days lost per 1000 player-hours',
      recurrenceDefinition: 'complete graft rupture in a reconstructed knee',
      mechanismReporting: 'club medical staff',
      numberOfSeasons: '5',
      exposureMeasurementUnit: 'player-hours',
      totalExposure: '486951',
      injuryTotalCount: '37',
      injuryMatchCount: '22',
      injuryTrainingCount: '15',
      injuryIncidenceOverall: '0.076',
      injuryIncidenceCi95: '0.053-0.104',
      injuryIncidenceMatch: '0.41 (0.26-0.63)',
      injuryIncidenceTraining: '0.04 (0.02-0.06)',
      injuryBurden: '16.3',
      injuryBurdenCi95: '16.0-16.7',
      injuryTimeLossMean: '225.4 ± 65.0',
      injuryTimeLossMedian: '204.5',
      injuryContact: '18',
      injuryNonContact: '19',
      injuryRecurrentTotal: '3',
      injuryRecurrenceRate: '8.1%',
      injuryTissueType_injury_diagnosis_diagnosis: 'complete ACL rupture',
      injuryTissueType_injury_diagnosis_prevalence: '37',
      injuryTissueType_injury_diagnosis_incidence: '0.076 (0.053-0.104)',
      injuryTissueType_injury_diagnosis_burden: '16.3 (16.0-16.7)',
      injuryTissueType_injury_diagnosis_severityMeanDays: 'mean 225.4 ± 65.0',
      injuryLocation_knee_prevalence: '37',
      injuryLocation_knee_incidence: '0.076 (0.053-0.104)',
      injuryLocation_knee_burden: '16.3 (16.0-16.7)',
      injuryLocation_knee_severityMeanDays: 'mean 225.4 ± 65.0',
    },
  },
  {
    label: '2013/14-2020/21 head-neck-concussion supplement (S712)',
    fields: {
      ageCategory: 'senior',
      meanAge: '26.7 ± 4.9',
      sampleSizePlayers: '3762 player records',
      numberOfTeams: '17',
      observationDuration: '2013/14-2020/21',
      injuryDefinition: 'time loss [head and neck injuries only]',
      incidenceDefinition: 'head/neck injuries per 1000 player-hours and squad-season',
      burdenDefinition: 'days missed per 1000 player-hours',
      recurrenceDefinition: 'same structure within the same season',
      mechanismReporting: 'club medical staff',
      numberOfSeasons: '8',
      exposureMeasurementUnit: 'player-hours',
      injuryTotalCount: '87',
      injuryTimeLossCount: '87',
      injuryIncidenceOverall: '0.12',
      injuryIncidenceCi95: '0.09-0.14',
      injuryMostCommonDiagnosis: 'concussion',
      injuryMostCommonLocation: 'head and neck',
      injuryTissueType_concussion_prevalence: '33',
      injuryTissueType_concussion_incidence: '0.04 (0.03-0.06)',
      injuryTissueType_concussion_severityMeanDays: 'median 8 (IQR 1-19)',
      injuryTissueType_bone_fracture_prevalence: '20',
      injuryTissueType_superficial_tissues_skin_prevalence: '23',
      injuryTissueType_superficial_tissues_skin_severityMeanDays: 'median 5 (IQR 1-18)',
      injuryLocation_head_neck_overall_prevalence: '87',
      injuryLocation_head_neck_overall_incidence: '0.12 (0.09-0.14)',
      injuryLocation_neck_prevalence: '11',
      injuryLocation_neck_severityMeanDays: 'median 4 (IQR 2-16)',
    },
  },
];
const professionalFieldsToWrite = new Set(professionalSupplementRows.flatMap((row) => Object.keys(row.fields)));
const professionalFlat = {};
for (const fieldId of professionalFieldsToWrite) {
  const current = professionalBase.get(fieldId)?.split('\n') ?? [];
  const baseValues = Array.from({ length: 9 }, (_, index) => current[index] ?? '');
  professionalFlat[fieldId] = rows([
    ...baseValues,
    ...professionalSupplementRows.map((supplement) => supplement.fields[fieldId] ?? ''),
  ]);
}

const afcFlat = {
  studyId: 'S602',
  leadAuthor: 'Tabben M',
  title: 'Injury and illness epidemiology in professional Asian football: lower general incidence and burden but higher ACL and hamstring injury burden compared with Europe',
  yearOfPublication: '2022',
  journal: 'British Journal of Sports Medicine',
  doi: '10.1136/bjsports-2020-102945',
  studyDesign: 'descriptive prospective cohort study',
  fifaDiscipline: 'Association football (11-a-side)',
  country: rows(['Australia; China; Hong Kong; Japan; Qatar; Thailand; United Arab Emirates; Saudi Arabia; India; Iran', '', '', '']),
  levelOfPlay: 'professional AFC Champions League or AFC Cup clubs',
  sex: 'male',
  ageCategory: 'adult (>=18 years)',
  meanAge: rows(['26 ± 5', '26 ± 5', '26 ± 5', '25 ± 5']),
  sampleSizePlayers: rows(['900 unique players', '408', '396', '429']),
  numberOfTeams: rows(['22 teams across 9 countries', '13', '13', '13']),
  observationDuration: 'January 2017-December 2019',
  injuryDefinition: 'time loss [unable to participate fully in training or match play]',
  illnessDefinition: 'time loss [unable to participate fully in training or match play]',
  incidenceDefinition: 'injuries and illnesses per 1000 player-hours',
  burdenDefinition: 'days lost per 1000 player-hours',
  severityDefinition: 'mild 0-3 days; minor 4-7; moderate 7-28; severe >28 days',
  recurrenceDefinition: 'same body part and structure type within one year of the index injury',
  mechanismReporting: 'club doctor or physiotherapist',
  numberOfSeasons: '3',
  exposureMeasurementUnit: 'player-hours',
  totalExposure: rows(['232665', '72431', '80470', '80470']),
  injuryTotalCount: '1159',
  injuryMatchCount: '496',
  injuryTrainingCount: '610',
  injuryIncidenceOverall: '5.1 ± 2.2',
  injuryIncidenceMatch: '19.2 ± 8.6',
  injuryIncidenceTraining: '2.8 ± 1.4',
  injuryTimeLossMean: '23 ± 41',
  injuryBurden: '112 ± 56',
  injuryMostCommonDiagnosis: 'hamstring strain',
  injuryMostCommonLocation: 'thigh',
  injuryMostCommonSeverity: 'moderate (515; 44.4%)',
  injuryModeAcuteSudden: '846',
  injuryModeRepetitiveGradual: '195',
  injuryRecurrentTotal: '115',
  injuryRecurrenceRate: '9.9%',
  illnessTotalCount: '175',
  illnessIncidenceOverall: '0.9 ± 0.9',
  illnessBurden: '2.5 ± 2.4',
  illnessMostCommonSystem: 'upper respiratory tract (23; 42.6%)',
  injuryTissueType_injury_diagnosis_diagnosis: 'complete ACL rupture',
  injuryTissueType_injury_diagnosis_prevalence: '32',
  injuryTissueType_injury_diagnosis_incidence: '0.14 (0.09-0.19)',
  injuryTissueType_injury_diagnosis_burden: '29.8 (29.1-30.5)',
  injuryTissueType_injury_diagnosis_severityMeanDays: 'median 197 (IQR 182-243)',
  injuryTissueType_concussion_prevalence: '11',
  injuryTissueType_concussion_incidence: '0.05 (0.02-0.08)',
  injuryTissueType_concussion_burden: '0.4 (0.4-0.5)',
  injuryTissueType_concussion_severityMeanDays: 'median 7 (IQR 5-15)',
  injuryTissueType_cartilage_injury_prevalence: '46',
  injuryTissueType_cartilage_injury_incidence: '0.20 (0.15-0.26)',
  injuryTissueType_cartilage_injury_burden: '8.4 (8.0-8.8)',
  injuryTissueType_cartilage_injury_severityMeanDays: 'median 15 (IQR 11-30)',
};
const afcLocations = {
  head: ['23', '0.10 (0.06-0.15)', '1.2 (1.1-1.4)', 'median 7 (IQR 5-15)'],
  shoulder: ['18', '0.08 (0.05-0.12)', '3.6 (3.4-3.9)', 'median 23 (IQR 5-59)'],
  upper_limb_overall: ['22', '0.10 (0.06-0.14)', '1.7 (1.6-1.9)', 'median 10 (IQR 4-23)'],
  trunk_overall: ['29', '0.13 (0.08-0.18)', '1.4 (1.3-1.6)', 'median 7 (IQR 4-14)'],
  lumbosacral: ['60', '0.26 (0.20-0.33)', '4.0 (3.8-4.3)', 'median 6 (IQR 4-10)'],
  groin: ['119', '0.51 (0.42-0.61)', '7.3 (7.0-7.6)', 'median 9 (IQR 6-11)'],
  thigh: ['355', '1.53 (1.37-1.69)', '28.0 (27.3-28.7)', 'median 12 (IQR 10-13)'],
  knee: ['220', '0.95 (0.82-1.08)', '51.9 (51.0-52.8)', 'median 17 (IQR 13-26)'],
  lower_leg: ['100', '0.42 (0.34-0.51)', '6.9 (6.5-7.2)', 'median 9 (IQR 7-14)'],
  ankle: ['162', '0.70 (0.59-0.81)', '9.6 (9.3-10.1)', 'median 7 (IQR 6-10)'],
  foot: ['50', '0.21 (0.16-0.28)', '3.9 (3.6-4.1)', 'median 7 (IQR 5-14)'],
};
for (const [location, [count, incidence, burden, severity]] of Object.entries(afcLocations)) {
  afcFlat[`injuryLocation_${location}_prevalence`] = count;
  afcFlat[`injuryLocation_${location}_incidence`] = incidence;
  afcFlat[`injuryLocation_${location}_burden`] = burden;
  afcFlat[`injuryLocation_${location}_severityMeanDays`] = severity;
}

const sourceLedger = {
  artifactType: 'Aspetar ASPREV source-family ledger and architecture decision',
  date: DATE,
  scope: STUDY_IDS,
  pdfVerification: {
    method: 'Downloaded each matching live PDF, calculated SHA-256, and compared it with the registered live hash where present. S071 had no registered live hash, so its calculated hash is recorded as the baseline.',
    sha256ByStudyId: {
      S071: '55041f92ee95c797151658cb3819006f505fb00322bd15d2c1c10855259eae32',
      S195: '370f17045216f219e630491234b8d30879b9835478058b06d7b0bb89df09b9b8',
      S261: '27046aaa103ad550f9f96a03eefb0745e73dfe89bd0ec383af8a908697f9fc31',
      S344: '5a0998f5c7b6566dcdf96ba5fd67f5aab4b7fe9528bb0802dc329c7167b99e00',
      S544: 'f7708fb9d783a04272867e321620615937423b2448fb81358ed7abccbb041686',
      S555: 'a3930d6b19a2dc9fd317cc82e8d53f5479b7a801d7404b215a3db5d550a8b219',
      S602: '84aed171b29840e49a34b3b2d464a39d32bad6123cea6d5cf5b80af4f0cb1777',
      S712: '453dfd0b5356aff3fb5d730cbfa162e7c0c5272745efc132e810f2036bc222d5',
      S1431: '7419695bf291f19d07c1f819e4824900896eb1aa8eb24651f02ed0ad88611361',
      S2824: 'b3098677903093ec48b4b9f85a86a04b97571b7a691f996315848fd857858426',
      S3577: '26edb492879ac967504daf55cbcbe5650df6e11b83c0a38836604d6762c34301',
    },
  },
  architecture: {
    selected: 'Existing-paper anchors with cohort-specific grouping',
    anchors: {
      professionalQsl: 'S2824',
      academy: 'S261',
      afcMulticountry: 'S602',
    },
    rationale: [
      'A single synthetic Aspetar master was rejected because the QSL professional cohort, Aspire Academy cohort, and AFC multicountry cohort are different populations.',
      'A two-master professional-versus-academy design was rejected as incomplete because S602 is a separate 22-team, nine-country AFC surveillance cohort.',
      'S2824 is the strongest modern QSL all-injury anchor. S195 is a disjoint 2008/09 historical QSL row. S344, S555, and S712 contribute topic-specific rows and are not independent all-injury denominators.',
      'S261 is the final published four-season academy anchor. S071 is its manuscript-stage duplicate alias. S1431 covers the same academy at U13-U15 in later, non-overlapping seasons and is retained as a later-period supplement.',
    ],
  },
  papers: [
    { studyId: 'S071', classification: 'duplicate alias', groupedUnder: 'S261', evidence: 'Same title, authors, 551-player U9-U19 academy cohort, four 2012/13-2015/16 seasons, and DOI manuscript; S071 is a 71-page manuscript/review file while S261 is the final 20-page publication.' },
    { studyId: 'S261', classification: 'anchor', groupedUnder: 'S261', evidence: 'Final published academy source, DOI 10.1136/bjsports-2020-102859; 551 unique players, 1,322 time-loss injuries, 25,034 days lost, 2012/13-2015/16.' },
    { studyId: 'S1431', classification: 'included supplement', groupedUnder: 'S261', evidence: 'Same Aspire Academy affiliation but later, non-overlapping 2016/17-2018/19 U13-U15 period; 95 players, 21,712 player-hours, 161 index injuries.' },
    { studyId: 'S195', classification: 'included supplement', groupedUnder: 'S2824', evidence: 'QSL historical all-injury cohort from August 2008-April 2009; 10 clubs, 230 players, 217 injuries. Period is disjoint from the modern QSL rows.' },
    { studyId: 'S2824', classification: 'anchor', groupedUnder: 'S2824', evidence: 'Strongest QSL all-injury source; 17 first/second-division clubs, 1,466 unique players, 746,384 player-hours, 4,789 injuries, 2014/15-2021/22.' },
    { studyId: 'S344', classification: 'included supplement', groupedUnder: 'S2824', evidence: 'Groin-specific QSL surveillance in 2013/14-2014/15; 606 players, 205,466 hours, 206 groin injuries. It overlaps the anchor in 2014/15 and is retained only as a topic row.' },
    { studyId: 'S544', classification: 'covered by another row', groupedUnder: 'S344', evidence: 'Same 2013/14-2014/15 QSL programme and 205,466-hour denominator as S344; 579 versus 606 players reflects analytic selection. It adds risk-factor modelling, not an independent epidemiological denominator.' },
    { studyId: 'S3577', classification: 'covered by another row', groupedUnder: 'S344', evidence: 'Retrospective limb-asymmetry secondary analysis of the same 2013/14-2014/15 QSL groin cohort and pre-season screening data; no independent denominator.' },
    { studyId: 'S555', classification: 'included supplement', groupedUnder: 'S2824', evidence: 'ACL-specific QSL surveillance over 2013/14-2017/18; 486,951 hours and 37 ACL ruptures. Overlaps the anchor and is retained only for ACL-specific detail.' },
    { studyId: 'S712', classification: 'included supplement', groupedUnder: 'S2824', evidence: 'Head/neck and concussion-specific QSL surveillance over 2013/14-2020/21; 87 head/neck injuries among 4,736 time-loss injuries. Overlaps the anchor and is retained only for topic-specific detail.' },
    { studyId: 'S602', classification: 'separate cohort', groupedUnder: 'S602', evidence: 'AFC surveillance, not a QSL denominator: 22 professional teams from nine countries, 2017-2019, 900 unique players, 232,665 hours, 1,159 injuries.' },
  ],
};

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
const protectedSnapshot = papers.map((paper) => ({
  studyId: paper.assigned_study_id,
  values: Object.fromEntries(protectedKeys.map((key) => [key, paper.metadata?.[key] ?? null])),
}));
const protectedSignature = crypto
  .createHash('sha256')
  .update(JSON.stringify(protectedSnapshot))
  .digest('hex');

const preApplySnapshot = {
  artifactType: 'Aspetar ASPREV pre-apply live rollback snapshot',
  date: DATE,
  fixedMembership: STUDY_IDS,
  rollback: {
    method: 'Restore the exact paper metadata, extractions, extraction_fields, population_groups, and population_values from this snapshot using primary keys, then remove only the three dated reconciliation note IDs recorded by the final integrity audit.',
    destructiveActionRequired: true,
    note: 'The planned apply changes only extraction fields, population rows, and one dated paper note on each of S261, S2824, and S602.',
  },
  protectedScreeningSignatureSha256: protectedSignature,
  papers,
};

const input = {
  scope: 'Aspetar ASPREV first- and second-search source-family reconciliation; existing-paper anchors; 2026-07-27',
  model: 'GPT-5.6 Codex with xhigh reasoning (project-requested GPT-5.5 medium was not selectable in this workspace)',
  fixedBatchMembership: ['S261', 'S2824', 'S602'],
  stageA: {
    result: 'passed',
    checks: [
      'Exact live PDF attachments were downloaded and SHA-256 checked before source review.',
      'S071/S261 duplicate identity and S344/S544/S3577 cohort identity were checked against titles, DOI, seasons, clubs, players, exposure, definitions, and source methods.',
      'Youth and professional denominators remain separate. S602 remains separate from QSL because it is a multicountry AFC cohort.',
      'Only direct source values or transparent sums of compatible age/type/location rows are staged.',
      'The S261 printed pooled-versus-age Knee and Lower leg/calf discrepancy is preserved and flagged rather than inferred away.',
    ],
  },
  papers: [
    {
      studyId: 'S261',
      populationLabels: academyLabels,
      note: 'Aspetar academy anchor reconciliation, 2026-07-27. S261 is the final published source for the 2012/13-2015/16 Aspire Academy cohort; S071 is a duplicate manuscript alias. Rows Total/U9-U19 retain the directly printed final-paper values. The final row is the later, non-overlapping 2016/17-2018/19 U13-U15 S1431 cohort. Table 2, Table 3, Supplementary Tables 1-3, and Supplementary Figure 1 were checked. Source discrepancy retained: pooled Supplementary Table 3 reports Knee 218 and Lower leg/calf 105, while the age rows sum to Knee 168 and Lower leg/calf 155; both views total 323 and no values were reassigned by inference.',
      fields: groupByTab(academyFlat),
    },
    {
      studyId: 'S2824',
      populationLabels: [
        ...professionalBaseLabels,
        ...professionalSupplementRows.map((row) => row.label),
      ],
      note: 'Aspetar professional QSL anchor reconciliation, 2026-07-27. Existing S2824 All seasons and 2014/15-2021/22 rows remain the modern all-injury denominator. Added source-scoped rows: disjoint 2008/09 S195 all-injury cohort; overlapping S344 groin, S555 ACL, and S712 head/neck-concussion topic supplements. Topic rows must not be summed as independent all-injury denominators. S544 and S3577 are covered by the S344 row and remain audit-only secondary analyses.',
      fields: groupByTab(professionalFlat),
    },
    {
      studyId: 'S602',
      populationLabels: ['Total 2017-2019', '2017', '2018', '2019'],
      note: 'Aspetar ASPREV reconciliation, 2026-07-27. S602 remains a separate AFC multicountry anchor, not part of the Qatar Stars League master: 22 teams from nine countries over 2017-2019. Abstract, methods, Tables 1-2, Figure 1, results, discussion, and limitations were checked. The source prints total exposure 232,665 h and season values 72,431 / 80,470 / 80,470 h, whose sum is 233,371 h; all printed values are retained without correction or back-calculation.',
      fields: groupByTab(afcFlat),
    },
  ],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, `aspetar-source-family-ledger-${DATE}.json`),
  `${JSON.stringify(sourceLedger, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(OUT_DIR, `aspetar-pre-apply-live-rollback-snapshot-${DATE}.json`),
  `${JSON.stringify(preApplySnapshot, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(OUT_DIR, `aspetar-anchor-reconciliation-input-${DATE}.json`),
  `${JSON.stringify(input, null, 2)}\n`,
);

console.log(JSON.stringify({
  result: 'prepared',
  outputDirectory: OUT_DIR,
  fixedMembership: input.fixedBatchMembership,
  professionalRows: input.papers[1].populationLabels.length,
  academyRows: input.papers[0].populationLabels.length,
  afcRows: input.papers[2].populationLabels.length,
  protectedScreeningSignatureSha256: protectedSignature,
}, null, 2));
