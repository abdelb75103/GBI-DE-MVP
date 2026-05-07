import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '../fifa-gbi-data-extraction/node_modules/@supabase/supabase-js/dist/main/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENV_PATH = path.join(ROOT, 'fifa-gbi-data-extraction/.env.local');
const MANIFEST_PATH = path.join(ROOT, 'outputs/extraction-ready-translations/2026-05-07/merged-translated-original-all18/supabase-upload-manifest.csv');
const BACKLOG_PATH = path.join(ROOT, 'fifa-gbi-data-extraction/docs/review-backlog.md');

const now = () => new Date().toISOString();

function loadEnv() {
  const env = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadManifest() {
  const lines = fs.readFileSync(MANIFEST_PATH, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());
  return Object.fromEntries(lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    return [row.assigned_study_id, row];
  }));
}

const translationLanguages = {
  S643: 'German',
  S644: 'German',
  S645: 'German',
  S646: 'Turkish',
  S647: 'Portuguese',
  S648: 'Portuguese',
  S649: 'Portuguese',
  S650: 'Portuguese',
  S651: 'Portuguese',
  S652: 'Spanish',
  S653: 'Spanish',
  S654: 'Spanish',
  S655: 'Spanish',
  S656: 'French',
  S657: 'Dutch',
  S658: 'Dutch',
  S659: 'Danish',
  S660: 'Norwegian',
};

const tabs = {
  studyDetails: ['studyId', 'leadAuthor', 'title', 'yearOfPublication', 'journal', 'doi', 'studyDesign'],
  participantCharacteristics: ['fifaDiscipline', 'country', 'levelOfPlay', 'sex', 'ageCategory', 'meanAge', 'sampleSizePlayers', 'numberOfTeams', 'observationDuration'],
  definitions: ['injuryDefinition', 'illnessDefinition', 'incidenceDefinition', 'burdenDefinition', 'severityDefinition', 'recurrenceDefinition', 'mechanismReporting'],
  exposure: ['seasonLength', 'numberOfSeasons', 'exposureMeasurementUnit', 'totalExposure', 'matchExposure', 'trainingExposure'],
  injuryOutcome: [
    'injuryTotalCount', 'injuryPlayersCompletedStudy', 'injuryTeamsCompletedStudy', 'injuryMedicalAttentionCount', 'injuryTimeLossCount',
    'injuryMatchCount', 'injuryMatchMedicalAttentionCount', 'injuryMatchTimeLossCount', 'injuryTrainingCount', 'injuryTrainingMedicalAttentionCount',
    'injuryTrainingTimeLossCount', 'injuryIncidenceOverall', 'injuryIncidenceMatch', 'injuryIncidenceTraining', 'injuryIncidenceTimeLossOverall',
    'injuryIncidenceTimeLossMatch', 'injuryIncidenceTimeLossTraining', 'injuryIncidenceCi95', 'injuryTimeLossTotal', 'injuryTimeLossMedian',
    'injuryTimeLossMean', 'injuryBurden', 'injuryBurdenCi95', 'injuryMostCommonDiagnosis', 'injuryMostCommonType', 'injuryMostCommonLocation',
    'injuryMostCommonSeverity', 'injuryModeRepetitiveGradual', 'injuryModeRepetitiveSudden', 'injuryModeAcuteSudden', 'injuryContact',
    'injuryNonContact', 'injuryCumulativeRepetitive', 'injuryDurationMedian', 'injuryDurationMean', 'injuryRecurrentTotal', 'injuryRecurrenceRate',
  ],
};

function join(values) {
  return Array.isArray(values) ? values.map((v) => v ?? '').join('\n') : values;
}

function top(value, rows) {
  return [value, ...Array(Math.max(rows - 1, 0)).fill('')];
}

function f(tab, fieldId) {
  return `${tab}.${fieldId}`;
}

function loc(id, metric = 'prevalence') {
  return `injuryLocation.injuryLocation_${id}_${metric}`;
}

function tissue(id, metric = 'prevalence') {
  return `injuryTissueType.injuryTissueType_${id}_${metric}`;
}

const papers = [
  {
    sid: 'S643', cov: '#50', batch: '065', labels: ['Total'],
    summary: 'Becker/Gaulrapp/Hess 2006 German women first Bundesliga one-season prospective cohort extracted as pooled female senior row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Becker A',
      [f('studyDetails', 'title')]: "Injuries in Women's Football: Results of a Prospective One-Year Study",
      [f('studyDetails', 'yearOfPublication')]: '2006',
      [f('studyDetails', 'doi')]: '10.1055/s-2006-927193',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Germany',
      [f('participantCharacteristics', 'levelOfPlay')]: 'professional / first division',
      [f('participantCharacteristics', 'sex')]: 'female',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'meanAge')]: '22.8 (16-35)',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '254',
      [f('participantCharacteristics', 'numberOfTeams')]: '12',
      [f('participantCharacteristics', 'observationDuration')]: '2000/01 season (October 2000-June 2001)',
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 match/training exposure hours',
      [f('definitions', 'severityDefinition')]: 'minor <1 week; moderate up to 6 weeks; severe >6 weeks',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'seasonLength')]: '37',
      [f('exposure', 'numberOfSeasons')]: '1',
      [f('exposure', 'exposureMeasurementUnit')]: 'player-hours',
      [f('exposure', 'totalExposure')]: '87353.4',
      [f('injuryOutcome', 'injuryTotalCount')]: '216',
      [f('injuryOutcome', 'injuryPlayersCompletedStudy')]: '254',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '2.5',
      [f('injuryOutcome', 'injuryDurationMean')]: '26.5',
      [f('injuryOutcome', 'injuryMostCommonDiagnosis')]: 'upper ankle ligament rupture',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'ligament injury',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'knee',
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: 'moderate',
      [loc('lower_limb_overall')]: '177',
      [loc('head_neck_overall')]: '15',
      [loc('trunk_overall')]: '17',
      [loc('knee')]: '59',
      [loc('ankle')]: '49',
      [loc('thigh')]: '31',
      [loc('lower_leg')]: '20',
      [loc('foot')]: '11',
      [loc('groin')]: '4',
      [tissue('ligament_joint_capsule')]: '67',
      [tissue('muscle_tendon')]: '32',
      [tissue('superficial_contusion')]: '35',
      [tissue('cartilage_injury')]: '17',
      [tissue('joint_sprain')]: '16',
      [tissue('injury_diagnosis_diagnosis')]: 'ACL rupture; meniscal lesion; upper ankle ligament rupture',
    },
  },
  {
    sid: 'S644', cov: '#245', batch: '065', labels: ['Total', 'U21', 'U18', 'U17', 'U16', 'U15'],
    summary: 'Fromm/Meyer/Tscholl/Leumann 2018 German elite male youth muscle-injury cohort extracted as Total plus U21/U18/U17/U16/U15 population rows.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Fromm L',
      [f('studyDetails', 'title')]: 'The Importance of Muscle Injuries in Youth Soccer',
      [f('studyDetails', 'yearOfPublication')]: '2018',
      [f('studyDetails', 'journal')]: 'Swiss Sports & Exercise Medicine',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 6)),
      [f('participantCharacteristics', 'country')]: join(top('Switzerland', 6)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('elite youth academy', 6)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 6)),
      [f('participantCharacteristics', 'ageCategory')]: join(['Total', 'U21', 'U18', 'U17', 'U16', 'U15']),
      [f('participantCharacteristics', 'meanAge')]: join(['16.8 (14.3-21.0)', '19.4 (17.7-21.0)', '17.7 (16.5-18.0)', '16.5 (16.3-17.0)', '15.7 (15.2-16.0)', '14.4 (14.3-15.0)']),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['110', '26', '26', '20', '20', '18']),
      [f('participantCharacteristics', 'numberOfTeams')]: join(['5', '1', '1', '1', '1', '1']),
      [f('participantCharacteristics', 'observationDuration')]: join(top('August 2016-July 2017 (12 months)', 6)),
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 soccer exposure hours',
      [f('definitions', 'recurrenceDefinition')]: 'same muscle group within 2 months after return to full playing ability',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: join(top('1', 6)),
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 6)),
      [f('exposure', 'totalExposure')]: join(['43062', '10764', '10101', '7740', '7680', '6777']),
      [f('injuryOutcome', 'injuryTotalCount')]: join(top('53', 6)),
      [f('injuryOutcome', 'injuryPlayersCompletedStudy')]: join(['110', '26', '26', '20', '20', '18']),
      [f('injuryOutcome', 'injuryMatchCount')]: join(top('24', 6)),
      [f('injuryOutcome', 'injuryTrainingCount')]: join(top('29', 6)),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(top('1.5', 6)),
      [f('injuryOutcome', 'injuryIncidenceMatch')]: join(top('6.9', 6)),
      [f('injuryOutcome', 'injuryIncidenceTraining')]: join(top('0.9', 6)),
      [f('injuryOutcome', 'injuryRecurrentTotal')]: join(top('1', 6)),
      [f('injuryOutcome', 'injuryRecurrenceRate')]: join(top('1.9%', 6)),
      [f('injuryOutcome', 'injuryMostCommonDiagnosis')]: join(top('hamstring muscle injury', 6)),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(top('functional muscle injury', 6)),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(top('hamstrings', 6)),
      [f('injuryOutcome', 'injuryModeRepetitiveGradual')]: join(top('15', 6)),
      [tissue('muscle_injury')]: join(top('53', 6)),
      [loc('thigh')]: join(top('35', 6)),
      [loc('groin')]: join(top('15', 6)),
    },
  },
  {
    sid: 'S645', cov: '#720', batch: '065', labels: ['Total', 'U21', 'U18', 'U17', 'U16', 'U15'],
    summary: 'Fromm/Meyer/Vavken/Leumann 2018 German companion outcome paper extracted as same elite-youth population split, with pooled muscle-injury time-loss outcomes only.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Fromm L',
      [f('studyDetails', 'title')]: 'Outcome of Muscle Injuries in Youth Football',
      [f('studyDetails', 'yearOfPublication')]: '2018',
      [f('studyDetails', 'journal')]: 'Swiss Sports & Exercise Medicine',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 6)),
      [f('participantCharacteristics', 'country')]: join(top('Switzerland', 6)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('elite youth academy', 6)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 6)),
      [f('participantCharacteristics', 'ageCategory')]: join(['Total', 'U21', 'U18', 'U17', 'U16', 'U15']),
      [f('participantCharacteristics', 'meanAge')]: join(['16.8 (14.3-21.0)', '', '', '', '', '']),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['110', '', '', '', '', '']),
      [f('participantCharacteristics', 'numberOfTeams')]: join(['5', '1', '1', '1', '1', '1']),
      [f('participantCharacteristics', 'observationDuration')]: join(top('August 2016-July 2017 (12 months)', 6)),
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'same cohort as Fromm et al. muscle-injury incidence paper; per 1000 soccer exposure hours',
      [f('definitions', 'severityDefinition')]: 'mild 1-3 days; moderate 4-7 days; moderately severe 8-28 days; severe >28 days',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: join(top('1', 6)),
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 6)),
      [f('injuryOutcome', 'injuryTotalCount')]: join(top('53', 6)),
      [f('injuryOutcome', 'injuryTimeLossTotal')]: join(top('1218', 6)),
      [f('injuryOutcome', 'injuryTimeLossMean')]: join(top('23', 6)),
      [f('injuryOutcome', 'injuryMostCommonDiagnosis')]: join(top('rectus femoris injury caused longest absence', 6)),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(top('muscle injury', 6)),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(top('rectus femoris for longest mean absence', 6)),
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: join(top('moderately severe', 6)),
      [tissue('muscle_injury')]: join(top('53', 6)),
      [tissue('muscle_injury', 'severityMeanDays')]: join(top('23', 6)),
    },
  },
  {
    sid: 'S646', cov: '#53', batch: '065', labels: ['Total'],
    summary: 'Can 2006 Turkish professional female one-team pilot study extracted as pooled row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Can F',
      [f('studyDetails', 'title')]: 'Incidence of Injury in Female Soccer Players: A Pilot Study',
      [f('studyDetails', 'yearOfPublication')]: '2006',
      [f('studyDetails', 'studyDesign')]: 'retrospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Turkey',
      [f('participantCharacteristics', 'levelOfPlay')]: 'professional / first division',
      [f('participantCharacteristics', 'sex')]: 'female',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'meanAge')]: '22 ± 5.1 (17-32)',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '18',
      [f('participantCharacteristics', 'numberOfTeams')]: '1',
      [f('participantCharacteristics', 'observationDuration')]: 'one year',
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 training or match hours',
      [f('definitions', 'severityDefinition')]: 'minor <1 week; moderate 1 week-1 month; major >1 month',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: '1',
      [f('exposure', 'exposureMeasurementUnit')]: 'player-hours',
      [f('exposure', 'totalExposure')]: '3600',
      [f('injuryOutcome', 'injuryTotalCount')]: '32',
      [f('injuryOutcome', 'injuryPlayersCompletedStudy')]: '18',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '2.5',
      [f('injuryOutcome', 'injuryMatchCount')]: '26',
      [f('injuryOutcome', 'injuryTimeLossMean')]: '39 ± 4',
      [f('injuryOutcome', 'injuryMostCommonDiagnosis')]: 'ankle sprain',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'sprain',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'ankle',
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: 'minor',
      [f('injuryOutcome', 'injuryModeRepetitiveGradual')]: '6',
      [f('injuryOutcome', 'injuryModeAcuteSudden')]: '26',
      [loc('lower_limb_overall')]: '27',
      [loc('upper_limb_overall')]: '2',
      [loc('ankle')]: '11',
      [loc('knee')]: '10',
      [loc('thigh')]: '4',
      [loc('lumbosacral')]: '3',
      [loc('foot')]: '2',
      [tissue('joint_sprain')]: '12',
      [tissue('muscle_injury')]: '8',
      [tissue('ligament_joint_capsule')]: '4',
    },
  },
  {
    sid: 'S647', cov: '#626', batch: '065', labels: ['Total'],
    summary: 'Cohen/Abdalla/Ejnisman/Amaro 1997 Portuguese Brazilian professional-club match-injury study extracted as pooled match-only row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Cohen M',
      [f('studyDetails', 'title')]: 'Orthopedic Injuries in Soccer',
      [f('studyDetails', 'yearOfPublication')]: '1997',
      [f('studyDetails', 'studyDesign')]: 'retrospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Brazil',
      [f('participantCharacteristics', 'levelOfPlay')]: 'professional',
      [f('participantCharacteristics', 'sex')]: 'male',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'meanAge')]: '22.4 (16-40)',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '124',
      [f('participantCharacteristics', 'numberOfTeams')]: '8',
      [f('participantCharacteristics', 'observationDuration')]: '1992-1995; minimum 2 years per team',
      [f('definitions', 'injuryDefinition')]: 'medical attention',
      [f('definitions', 'incidenceDefinition')]: 'match-only; risk exposures and annual injury frequency',
      [f('definitions', 'severityDefinition')]: 'mild 0-7 days; moderate 8-30 days; severe >31 days',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: '2+',
      [f('exposure', 'exposureMeasurementUnit')]: 'match-exposures',
      [f('exposure', 'matchExposure')]: '6336',
      [f('injuryOutcome', 'injuryTotalCount')]: '964',
      [f('injuryOutcome', 'injuryMatchCount')]: '964',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'muscle injury',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'thigh',
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: 'mild',
      [f('injuryOutcome', 'injuryContact')]: '392',
      [f('injuryOutcome', 'injuryNonContact')]: '572',
      [loc('lower_limb_overall')]: '696',
      [loc('upper_limb_overall')]: '58',
      [loc('trunk_overall')]: '162',
      [loc('thigh')]: '333',
      [loc('ankle')]: '170',
      [loc('knee')]: '114',
      [tissue('muscle_injury')]: '378',
      [tissue('superficial_contusion')]: '232',
      [tissue('joint_sprain')]: '173',
      [tissue('tendinopathy')]: '129',
      [tissue('bone_fracture')]: '52',
    },
  },
  {
    sid: 'S648', cov: '#719', batch: '066', labels: ['Total'],
    summary: 'Martins de Souza Filho 2018 Portuguese Brazilian university women futsal tournament medical-care record study extracted as pooled row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Martins de Souza Filho LF',
      [f('studyDetails', 'title')]: 'Prevalence and Profile of Athletic Injuries in Female Futsal Athletes During the Brazilian University Sports Competitions',
      [f('studyDetails', 'yearOfPublication')]: '2018',
      [f('studyDetails', 'studyDesign')]: 'cross-sectional',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Futsal',
      [f('participantCharacteristics', 'country')]: 'Brazil',
      [f('participantCharacteristics', 'levelOfPlay')]: 'university first division',
      [f('participantCharacteristics', 'sex')]: 'female',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'meanAge')]: '22.02 ± 2.62',
      [f('participantCharacteristics', 'observationDuration')]: '2014 Brazilian University Games futsal tournament',
      [f('definitions', 'injuryDefinition')]: 'medical attention',
      [f('definitions', 'incidenceDefinition')]: 'injuries per match',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: 'match-exposures',
      [f('exposure', 'matchExposure')]: '18',
      [f('injuryOutcome', 'injuryTotalCount')]: '39',
      [f('injuryOutcome', 'injuryMatchCount')]: '39',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '2.16 injuries per match',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'musculotendinous injury',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'ankle and thigh',
      [f('injuryOutcome', 'injuryContact')]: '17',
      [f('injuryOutcome', 'injuryNonContact')]: '22',
      [loc('ankle')]: '8',
      [loc('lower_leg')]: '4',
      [loc('knee')]: '7',
      [loc('thigh')]: '8',
      [loc('chest')]: '6',
      [loc('shoulder')]: '1',
      [loc('neck')]: '1',
      [loc('head')]: '3',
      [loc('wrist')]: '1',
    },
  },
  {
    sid: 'S649', cov: '#733', batch: '066', labels: ['Total'],
    summary: 'Zanuto/Harada/Filho 2010 Portuguese amateur men cup study extracted as pooled match-only row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Zanuto EAC',
      [f('studyDetails', 'title')]: 'Epidemiological Analysis of Injuries and Physical Profile of Amateur Football Athletes in Western Sao Paulo',
      [f('studyDetails', 'yearOfPublication')]: '2010',
      [f('studyDetails', 'doi')]: '10.1590/s1517-86922010000200008',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Brazil',
      [f('participantCharacteristics', 'levelOfPlay')]: 'amateur',
      [f('participantCharacteristics', 'sex')]: 'male',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'meanAge')]: '25.32 ± 4.41',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '50',
      [f('participantCharacteristics', 'numberOfTeams')]: '12',
      [f('participantCharacteristics', 'observationDuration')]: 'September-December 2008 municipal amateur cup',
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 athlete-hours during matches',
      [f('definitions', 'severityDefinition')]: 'mild <7 days; moderate 7-21 days; severe >21 days',
      [f('definitions', 'mechanismReporting')]: 'Player-selfreported',
      [f('exposure', 'exposureMeasurementUnit')]: 'player-hours',
      [f('exposure', 'matchExposure')]: '1749',
      [f('injuryOutcome', 'injuryTotalCount')]: '21',
      [f('injuryOutcome', 'injuryMatchCount')]: '21',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '12.0',
      [f('injuryOutcome', 'injuryContact')]: '12',
      [f('injuryOutcome', 'injuryNonContact')]: '9',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'trauma and sprain',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'thigh',
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: 'mild',
      [loc('thigh')]: '8',
      [loc('ankle')]: '5',
      [loc('knee')]: '2',
      [loc('lower_leg')]: '2',
      [loc('upper_limb_overall')]: '2',
      [loc('foot')]: '1',
      [loc('trunk_overall')]: '1',
      [tissue('superficial_contusion')]: '8',
      [tissue('joint_sprain')]: '8',
      [tissue('muscle_injury')]: '5',
    },
  },
  {
    sid: 'S650', cov: '#734', batch: '066', labels: ['Total', 'Goalkeepers', 'Defenders', 'Fullbacks', 'Midfielders', 'Forwards'],
    summary: 'Approbato Selistre 2009 Portuguese U21 Regional Games tournament extracted as Total plus field-position rows where direct injury counts are reported.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Approbato Selistre LF',
      [f('studyDetails', 'title')]: 'Injury Incidence in Under-21 Male Soccer Players During the 2006 Regional Games of Sertaozinho, Sao Paulo',
      [f('studyDetails', 'yearOfPublication')]: '2009',
      [f('studyDetails', 'doi')]: '10.1590/s1517-86922009000600006',
      [f('studyDetails', 'studyDesign')]: 'cross-sectional',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 6)),
      [f('participantCharacteristics', 'country')]: join(top('Brazil', 6)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('regional tournament', 6)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 6)),
      [f('participantCharacteristics', 'ageCategory')]: join(['U21', 'Goalkeepers', 'Defenders', 'Fullbacks', 'Midfielders', 'Forwards']),
      [f('participantCharacteristics', 'meanAge')]: join(top('18 ± 2 (16-20)', 6)),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(top('1122', 6)),
      [f('participantCharacteristics', 'numberOfTeams')]: join(top('51', 6)),
      [f('participantCharacteristics', 'observationDuration')]: join(top('5-11 July 2006 tournament', 6)),
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 hours of match play',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 6)),
      [f('exposure', 'matchExposure')]: join(top('1334.7', 6)),
      [f('injuryOutcome', 'injuryTotalCount')]: join(['170', '11', '22', '35', '72', '30']),
      [f('injuryOutcome', 'injuryMatchCount')]: join(['170', '11', '22', '35', '72', '30']),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(top('128.1', 6)),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(top('muscle injury', 6)),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(top('lower limb', 6)),
      [loc('lower_limb_overall')]: join(['127', '5', '13', '22', '60', '27']),
      [loc('upper_limb_overall')]: join(['14', '3', '1', '5', '3', '2']),
      [loc('trunk_overall')]: join(['19', '1', '4', '7', '6', '1']),
      [loc('head_neck_overall')]: join(['10', '2', '4', '1', '3', '']),
      [tissue('muscle_injury')]: join(['64', '1', '7', '12', '33', '11']),
      [tissue('superficial_contusion')]: join(['52', '7', '11', '10', '15', '9']),
      [tissue('joint_sprain')]: join(['40', '2', '4', '10', '18', '6']),
      [tissue('tendinopathy')]: join(['7', '', '', '2', '4', '1']),
      [tissue('bone_fracture')]: join(['2', '', '', '', '', '2']),
    },
  },
  {
    sid: 'S651', cov: '#855', batch: '066', labels: ['Total', 'Flamengo', 'Vasco da Gama', 'Botafogo', 'Fluminense'],
    summary: 'Osorio/Meziat-Filho/Souto Maior 2022 Portuguese Brazilian Serie A Rio de Janeiro team study extracted as Total plus team participant rows.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Osorio AT',
      [f('studyDetails', 'title')]: 'Incidence of Injuries and/or Musculoskeletal Pain and Associated Factors in Professional Soccer Teams from Rio de Janeiro During the 2018 Brazilian Serie A Championship',
      [f('studyDetails', 'yearOfPublication')]: '2022',
      [f('studyDetails', 'journal')]: 'Brazilian Journal of Science and Movement',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 5)),
      [f('participantCharacteristics', 'country')]: join(top('Brazil', 5)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('professional Serie A', 5)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 5)),
      [f('participantCharacteristics', 'ageCategory')]: join(top('Senior', 5)),
      [f('participantCharacteristics', 'meanAge')]: join(['25.2 ± 4.8', '26.1 ± 5.8', '25.7 ± 5.1', '25.4 ± 4.8', '24.1 ± 3.6']),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['148', '32', '43', '33', '40']),
      [f('participantCharacteristics', 'numberOfTeams')]: join(['4', '1', '1', '1', '1']),
      [f('participantCharacteristics', 'observationDuration')]: join(top('2018 Brazilian Serie A Championship', 5)),
      [f('definitions', 'injuryDefinition')]: 'physical complaint',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 match exposure hours',
      [f('definitions', 'severityDefinition')]: 'minimal 1-3 days; mild 4-7; moderate 8-28; severe 29-48; very severe >48 days',
      [f('definitions', 'mechanismReporting')]: 'Player-selfreported / Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 5)),
      [f('exposure', 'matchExposure')]: join(top('5016', 5)),
      [f('injuryOutcome', 'injuryTotalCount')]: join(top('591', 5)),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(top('58.9', 5)),
      [f('injuryOutcome', 'injuryContact')]: join(top('406', 5)),
      [f('injuryOutcome', 'injuryNonContact')]: join(top('185', 5)),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(top('muscle injury', 5)),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(top('ankle', 5)),
      [loc('ankle')]: join(top('147', 5)),
      [loc('head')]: join(top('103', 5)),
      [loc('lower_leg')]: join(top('89', 5)),
      [loc('thigh')]: join(top('66', 5)),
      [loc('knee')]: join(top('48', 5)),
      [tissue('muscle_injury')]: join(top('112', 5)),
      [tissue('ligament_joint_capsule')]: join(top('44', 5)),
      [tissue('concussion')]: join(top('12', 5)),
    },
  },
  {
    sid: 'S652', cov: '#113', batch: '066', labels: ['Total'],
    summary: 'Noya/Sillero 2012 Spanish professional football season study extracted as pooled Spanish first/second division row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Noya J',
      [f('studyDetails', 'title')]: 'Incidence of Injuries in Spanish Professional Football Over a Season: Days Off Due to Injury',
      [f('studyDetails', 'yearOfPublication')]: '2012',
      [f('studyDetails', 'doi')]: '10.1016/j.apunts.2011.10.001',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Spain',
      [f('participantCharacteristics', 'levelOfPlay')]: 'professional first and second division',
      [f('participantCharacteristics', 'sex')]: 'male',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '728',
      [f('participantCharacteristics', 'numberOfTeams')]: '27',
      [f('participantCharacteristics', 'observationDuration')]: '2008-2009 season',
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 training/competition exposure hours',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: '1',
      [f('exposure', 'exposureMeasurementUnit')]: 'player-hours',
      [f('exposure', 'totalExposure')]: '244835',
      [f('injuryOutcome', 'injuryTotalCount')]: '2184',
      [f('injuryOutcome', 'injuryTimeLossTotal')]: '24532',
      [f('injuryOutcome', 'injuryTimeLossMean')]: '11.3',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '8.94',
      [f('injuryOutcome', 'injuryMostCommonDiagnosis')]: 'muscle overload',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'muscle injury',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'biceps femoris for muscle tears; ankle lateral ligament complex for ligament injuries',
      [tissue('muscle_injury')]: '1073',
      [tissue('muscle_injury', 'severityTotalDays')]: '11339',
      [tissue('ligament_joint_capsule')]: '328',
      [tissue('ligament_joint_capsule', 'severityTotalDays')]: '4917',
      [tissue('tendinopathy')]: '104',
      [tissue('bone_fracture')]: '55',
      [tissue('cartilage_injury')]: '29',
      [tissue('concussion')]: '8',
    },
  },
  {
    sid: 'S653', cov: '#412', batch: '067', labels: ['Total', 'Professional', 'Elite/U19'],
    summary: 'Rafael Correa 2013 Spanish Colombian Millonarios cohort extracted as Total plus directly reported professional vs elite/U19 injury rows.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Rafael Correa J',
      [f('studyDetails', 'title')]: 'Musculoskeletal Injuries Incidence in Professional Soccer Players',
      [f('studyDetails', 'yearOfPublication')]: '2013',
      [f('studyDetails', 'doi')]: '10.1016/S0120-8845',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 3)),
      [f('participantCharacteristics', 'country')]: join(top('Colombia', 3)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(['professional / elite / U19', 'professional', 'elite / U19']),
      [f('participantCharacteristics', 'sex')]: join(top('male', 3)),
      [f('participantCharacteristics', 'ageCategory')]: join(['mixed', 'Senior', 'U19/elite']),
      [f('participantCharacteristics', 'meanAge')]: join(['20.4 (15-33)', '', '']),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['84', '', '']),
      [f('participantCharacteristics', 'numberOfTeams')]: join(['3 categories at one club', '', '']),
      [f('participantCharacteristics', 'observationDuration')]: join(top('2010 season (12 months)', 3)),
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 exposure hours',
      [f('definitions', 'severityDefinition')]: 'mild 1-7 days; moderate 8-21 days; severe >21 days',
      [f('definitions', 'recurrenceDefinition')]: 'same side and location within 2 months after rehabilitation ended',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 3)),
      [f('exposure', 'totalExposure')]: join(['50650', '', '']),
      [f('exposure', 'matchExposure')]: join(['2079', '', '']),
      [f('exposure', 'trainingExposure')]: join(['48571', '', '']),
      [f('injuryOutcome', 'injuryTotalCount')]: join(['65', '28', '37']),
      [f('injuryOutcome', 'injuryMatchCount')]: join(['25', '', '']),
      [f('injuryOutcome', 'injuryTrainingCount')]: join(['38', '', '']),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(['1.3', '', '']),
      [f('injuryOutcome', 'injuryIncidenceMatch')]: join(['12', '', '']),
      [f('injuryOutcome', 'injuryIncidenceTraining')]: join(['0.7', '', '']),
      [f('injuryOutcome', 'injuryDurationMean')]: join(['17.8', '', '']),
      [f('injuryOutcome', 'injuryContact')]: join(['28', '', '']),
      [f('injuryOutcome', 'injuryModeRepetitiveGradual')]: join(['16', '', '']),
      [f('injuryOutcome', 'injuryRecurrentTotal')]: join(['2', '', '']),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(['sprain', '', '']),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(['knee', '', '']),
      [loc('knee')]: join(['20', '', '']),
      [loc('ankle')]: join(['18', '', '']),
      [loc('foot')]: join(['18', '', '']),
      [loc('thigh')]: join(['17', '', '']),
      [tissue('joint_sprain')]: join(['21', '', '']),
      [tissue('superficial_contusion')]: join(['16', '', '']),
      [tissue('muscle_injury')]: join(['8', '', '']),
    },
  },
  {
    sid: 'S654', cov: '#815', batch: '067', labels: ['Total', 'Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'],
    summary: 'Garcia-Tamez 2012 Spanish Mexican university indoor-soccer team extracted as Total plus field-position rows.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Garcia-Tamez SE',
      [f('studyDetails', 'title')]: "Epidemiology of Injuries in a Men's University Indoor Soccer Team",
      [f('studyDetails', 'yearOfPublication')]: '2012',
      [f('studyDetails', 'journal')]: 'Acta Ortopedica Mexicana',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Futsal', 5)),
      [f('participantCharacteristics', 'country')]: join(top('Mexico', 5)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('university', 5)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 5)),
      [f('participantCharacteristics', 'ageCategory')]: join(top('Senior', 5)),
      [f('participantCharacteristics', 'meanAge')]: join(top('21.60 ± 2.80 (18-28)', 5)),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['36', '5', '14', '9', '8']),
      [f('participantCharacteristics', 'numberOfTeams')]: join(top('1', 5)),
      [f('participantCharacteristics', 'observationDuration')]: join(top('April-December 2009', 5)),
      [f('definitions', 'injuryDefinition')]: 'medical attention or time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 100 exposure hours',
      [f('definitions', 'severityDefinition')]: 'mild <1 week; moderate >1 week and <1 month; severe >1 month',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 5)),
      [f('exposure', 'totalExposure')]: join(['5351.0', '567.0', '1786.2', '1532.6', '1465.2']),
      [f('exposure', 'matchExposure')]: join(['189.5', '31.59', '63.16', '63.16', '31.59']),
      [f('exposure', 'trainingExposure')]: join(['5161.5', '535.4', '1723.3', '1469.2', '1433.6']),
      [f('injuryOutcome', 'injuryTotalCount')]: join(['62', '7', '24', '22', '9']),
      [f('injuryOutcome', 'injuryMatchCount')]: join(['17', '', '', '', '']),
      [f('injuryOutcome', 'injuryTrainingCount')]: join(['45', '', '', '', '']),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(['1.16', '', '', '', '']),
      [f('injuryOutcome', 'injuryIncidenceMatch')]: join(['8.99', '12.66', '4.75', '6.33', '10.99']),
      [f('injuryOutcome', 'injuryIncidenceTraining')]: join(['0.91', '0.21', '1.22', '1.23', '0.56']),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(top('sprain', 5)),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(top('lower limb', 5)),
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: join(top('mild', 5)),
      [loc('lower_limb_overall')]: join(top('47', 5)),
      [loc('upper_limb_overall')]: join(['9', '6', '', '', '']),
      [tissue('joint_sprain')]: join(top('15', 5)),
      [tissue('superficial_contusion')]: join(top('17', 5)),
      [tissue('muscle_injury')]: join(top('11', 5)),
    },
  },
  {
    sid: 'S655', cov: '#835', batch: '067', labels: ['Total', 'Forwards', 'Midfielders', 'Defenders', 'Goalkeepers'],
    summary: 'Pangrazio/Forriol 2016 Spanish South American U17 championship match-injury study extracted as Total plus positional anthropometry rows.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Pangrazio O',
      [f('studyDetails', 'title')]: 'Epidemiology of Injuries Sustained by Players During the 16th Under-17 South American Soccer Championship',
      [f('studyDetails', 'yearOfPublication')]: '2016',
      [f('studyDetails', 'doi')]: '10.1016/j.recot.2015.12.002',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 5)),
      [f('participantCharacteristics', 'country')]: join(top('Paraguay / South American international tournament', 5)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('international youth elite', 5)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 5)),
      [f('participantCharacteristics', 'ageCategory')]: join(top('U17', 5)),
      [f('participantCharacteristics', 'meanAge')]: join(top('16-17 years', 5)),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(top('220', 5)),
      [f('participantCharacteristics', 'numberOfTeams')]: join(top('10', 5)),
      [f('participantCharacteristics', 'observationDuration')]: join(top('4-29 March 2015 tournament', 5)),
      [f('definitions', 'injuryDefinition')]: 'medical attention',
      [f('definitions', 'incidenceDefinition')]: 'injuries per match and per 1000 minutes of play',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('match-exposures', 5)),
      [f('exposure', 'matchExposure')]: join(top('35', 5)),
      [f('injuryOutcome', 'injuryTotalCount')]: join(top('103', 5)),
      [f('injuryOutcome', 'injuryMatchCount')]: join(top('103', 5)),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(top('2.94 injuries per match; 32.7 per 1000 minutes', 5)),
      [f('injuryOutcome', 'injuryMedicalAttentionCount')]: join(top('66', 5)),
      [f('injuryOutcome', 'injuryContact')]: join(top('56', 5)),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(top('contusion', 5)),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(top('ankle', 5)),
      [loc('head')]: join(top('6', 5)),
      [loc('chest')]: join(top('2', 5)),
      [loc('lumbosacral')]: join(top('6', 5)),
      [loc('abdomen')]: join(top('1', 5)),
      [loc('shoulder')]: join(top('2', 5)),
      [loc('wrist')]: join(top('1', 5)),
      [loc('groin')]: join(top('2', 5)),
      [loc('thigh')]: join(top('14', 5)),
      [loc('knee')]: join(top('7', 5)),
      [loc('ankle')]: join(top('15', 5)),
      [loc('foot')]: join(top('7', 5)),
      [loc('lower_leg')]: join(top('14', 5)),
      [tissue('superficial_contusion')]: join(top('48', 5)),
      [tissue('joint_sprain')]: join(top('8', 5)),
      [tissue('muscle_injury')]: join(top('8', 5)),
      [tissue('bone_fracture')]: join(top('2', 5)),
      [tissue('concussion')]: join(top('1', 5)),
    },
  },
  {
    sid: 'S656', cov: '#547', batch: '067', labels: ['Total'],
    summary: 'Paus/Del Compare/Torrengo 2004 French Argentine professional-club seven-year traumatic injury cohort extracted as pooled row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Paus V',
      [f('studyDetails', 'title')]: 'Incidence of Traumatic Injuries in Professional Soccer Players',
      [f('studyDetails', 'yearOfPublication')]: '2004',
      [f('studyDetails', 'journal')]: 'Journal de Traumatologie du Sport',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Argentina',
      [f('participantCharacteristics', 'levelOfPlay')]: 'professional first division',
      [f('participantCharacteristics', 'sex')]: 'male',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'meanAge')]: '27 (17-37)',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '86',
      [f('participantCharacteristics', 'numberOfTeams')]: '1',
      [f('participantCharacteristics', 'observationDuration')]: '1995-2001 (7 years)',
      [f('definitions', 'injuryDefinition')]: 'medical attention or time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 hours exposure at risk',
      [f('definitions', 'severityDefinition')]: 'grade I 1-7 days; grade II 1-3 weeks; grade III 3-8 weeks; grade IV >8 weeks',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: '7',
      [f('exposure', 'exposureMeasurementUnit')]: 'player-hours',
      [f('exposure', 'totalExposure')]: '3237',
      [f('exposure', 'matchExposure')]: '819',
      [f('exposure', 'trainingExposure')]: '2424',
      [f('injuryOutcome', 'injuryTotalCount')]: '2536',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '9.1',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'myalgia/contracture',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'thigh',
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: 'grade I benign',
      [loc('head_neck_overall')]: '24',
      [loc('trunk_overall')]: '215',
      [loc('upper_limb_overall')]: '145',
      [loc('lower_limb_overall')]: '2153',
      [loc('thigh')]: '1114',
      [loc('knee')]: '245',
      [loc('lower_leg')]: '352',
      [loc('ankle')]: '206',
      [loc('foot')]: '137',
      [loc('groin')]: '69',
      [tissue('muscle_tendon')]: '1689',
      [tissue('muscle_injury')]: '119',
      [tissue('tendinopathy')]: '297',
      [tissue('joint_sprain')]: '184',
      [tissue('bone_fracture')]: '16',
    },
  },
  {
    sid: 'S657', cov: '#249', batch: '067', labels: ['Total'],
    summary: 'van Beijsterveldt/Tak/Langhout/Engelbert/Stubbe 2018 Dutch professional groin-complaint cohort extracted as pooled male professional row.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'van Beijsterveldt AMC',
      [f('studyDetails', 'title')]: 'Groin Complaints in Professional Footballers in the Netherlands',
      [f('studyDetails', 'yearOfPublication')]: '2018',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: 'Association football (11-a-side)',
      [f('participantCharacteristics', 'country')]: 'Netherlands',
      [f('participantCharacteristics', 'levelOfPlay')]: 'professional',
      [f('participantCharacteristics', 'sex')]: 'male',
      [f('participantCharacteristics', 'ageCategory')]: 'Senior',
      [f('participantCharacteristics', 'sampleSizePlayers')]: '230',
      [f('participantCharacteristics', 'numberOfTeams')]: '10',
      [f('participantCharacteristics', 'observationDuration')]: '2015-2016 season',
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 football/player hours',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: '1',
      [f('exposure', 'exposureMeasurementUnit')]: 'player-hours',
      [f('exposure', 'totalExposure')]: '45669',
      [f('exposure', 'matchExposure')]: '4155',
      [f('exposure', 'trainingExposure')]: '41514',
      [f('injuryOutcome', 'injuryTotalCount')]: '24',
      [f('injuryOutcome', 'injuryIncidenceOverall')]: '0.53',
      [f('injuryOutcome', 'injuryIncidenceCi95')]: '0.35 - 0.78',
      [f('injuryOutcome', 'injuryMatchCount')]: '8',
      [f('injuryOutcome', 'injuryTrainingCount')]: '6',
      [f('injuryOutcome', 'injuryIncidenceMatch')]: '1.93',
      [f('injuryOutcome', 'injuryIncidenceTraining')]: '0.14',
      [f('injuryOutcome', 'injuryTimeLossMedian')]: '15',
      [f('injuryOutcome', 'injuryDurationMedian')]: '15',
      [f('injuryOutcome', 'injuryRecurrentTotal')]: '3 players',
      [f('injuryOutcome', 'injuryMostCommonDiagnosis')]: 'adductor-related groin injury',
      [f('injuryOutcome', 'injuryMostCommonType')]: 'groin injury',
      [f('injuryOutcome', 'injuryMostCommonLocation')]: 'groin',
      [f('injuryOutcome', 'injuryModeRepetitiveGradual')]: '9',
      [f('injuryOutcome', 'injuryModeAcuteSudden')]: '14',
      [loc('groin')]: '24',
      [tissue('muscle_tendon')]: '14',
      [tissue('tendinopathy')]: '6',
    },
  },
  {
    sid: 'S658', cov: '#252', batch: '068', labels: ['Total', 'Professional', 'Amateur'],
    summary: 'van Beijsterveldt/van der Knaap/Jongert/Backx/Stubbe 2014 Dutch professional and amateur cohort extracted as Total plus professional/amateur participant/exposure rows.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'van Beijsterveldt AMC',
      [f('studyDetails', 'title')]: 'Epidemiology of Injuries in Dutch Professional and Amateur Football: Knee Injuries Examined in Depth',
      [f('studyDetails', 'yearOfPublication')]: '2014',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 3)),
      [f('participantCharacteristics', 'country')]: join(top('Netherlands', 3)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(['professional and amateur', 'professional premier division', 'first class amateur']),
      [f('participantCharacteristics', 'sex')]: join(top('male', 3)),
      [f('participantCharacteristics', 'ageCategory')]: join(top('Senior', 3)),
      [f('participantCharacteristics', 'meanAge')]: join(['24.7 ± 4.2', '', '']),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['673', '217', '456']),
      [f('participantCharacteristics', 'observationDuration')]: join(top('2009-2010 season', 3)),
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 football hours',
      [f('definitions', 'severityDefinition')]: 'very slight 1-3 days; slight 4-7; moderately severe 8-28; severe >28; career-ending',
      [f('definitions', 'recurrenceDefinition')]: 'same type and same side as earlier recovered injury',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'numberOfSeasons')]: join(top('1', 3)),
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 3)),
      [f('exposure', 'totalExposure')]: join(['90446', '44252', '46194']),
      [f('exposure', 'matchExposure')]: join(['17916', '12734', '5182']),
      [f('exposure', 'trainingExposure')]: join(['72530', '31518', '41012']),
      [f('injuryOutcome', 'injuryTotalCount')]: join(['710', '', '']),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(['7.8', '', '']),
      [f('injuryOutcome', 'injuryIncidenceMatch')]: join(['24.0', '', '']),
      [f('injuryOutcome', 'injuryIncidenceTraining')]: join(['3.3', '', '']),
      [f('injuryOutcome', 'injuryIncidenceCi95')]: join(['overall 7.3-8.4; training 2.9-3.7; match 21.8-26.4', '', '']),
      [f('injuryOutcome', 'injuryDurationMean')]: join(['29', '', '']),
      [f('injuryOutcome', 'injuryDurationMedian')]: join(['12', '', '']),
      [f('injuryOutcome', 'injuryRecurrentTotal')]: join(['13 knee injuries', '', '']),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(['joint/ligament injury', '', '']),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(['knee', '', '']),
      [loc('knee')]: join(['125', '61', '64']),
      [loc('knee', 'incidence')]: join(['1.4', '', '']),
      [loc('knee', 'severityMeanDays')]: join(['49', '', '']),
    },
  },
  {
    sid: 'S659', cov: '#752', batch: '068', labels: ['Study 1 all severities', 'Study 2 moderate/severe'],
    summary: 'Hinge/Brassoe 1984 Danish old-boys football paper extracted as two study-population rows because Study 1 and Study 2 are separate cohorts and severity scopes.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Hinge HHF',
      [f('studyDetails', 'title')]: "Football Injuries in Old Boys' Football Players",
      [f('studyDetails', 'yearOfPublication')]: '1984',
      [f('studyDetails', 'journal')]: 'Ugeskrift for Laeger',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 2)),
      [f('participantCharacteristics', 'country')]: join(top('Denmark', 2)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('recreational old boys', 2)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 2)),
      [f('participantCharacteristics', 'ageCategory')]: join(top('Senior / old boys', 2)),
      [f('participantCharacteristics', 'meanAge')]: join(['37.8 (29-54)', '37.4 (29-61)']),
      [f('participantCharacteristics', 'sampleSizePlayers')]: join(['54', '359']),
      [f('participantCharacteristics', 'numberOfTeams')]: join(['3', '23']),
      [f('participantCharacteristics', 'observationDuration')]: join(top('11 April-8 October 1983 outdoor season', 2)),
      [f('definitions', 'injuryDefinition')]: 'physical complaint',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 match hours',
      [f('definitions', 'severityDefinition')]: 'mild no doctor/treatment absence; moderate doctor or cancelled football/work absence; severe hospital treatment/admission plus absence',
      [f('definitions', 'mechanismReporting')]: 'Player-selfreported',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('player-hours', 2)),
      [f('exposure', 'matchExposure')]: join(['705.5', '5681.8']),
      [f('injuryOutcome', 'injuryTotalCount')]: join(['69', '75']),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(['97.8', '13.2']),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(['contusion/excoriation/wound', 'muscle fiber strain']),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(['shin and ankle/Achilles', 'ankle/Achilles']),
      [f('injuryOutcome', 'injuryMostCommonSeverity')]: join(['mild', 'moderate']),
      [f('injuryOutcome', 'injuryDurationMean')]: join(['', '28.4']),
      [loc('lower_limb_overall')]: join(['53', '63']),
      [loc('head')]: join(['3', '1']),
      [loc('chest')]: join(['6', '7']),
      [loc('groin')]: join(['8', '2']),
      [loc('thigh')]: join(['12', '17']),
      [loc('knee')]: join(['5', '12']),
      [loc('lower_leg')]: join(['13', '10']),
      [loc('ankle')]: join(['13', '20']),
      [loc('foot')]: join(['2', '2']),
      [tissue('superficial_contusion')]: join(['37', '9']),
      [tissue('muscle_injury')]: join(['10', '22']),
      [tissue('joint_sprain')]: join(['5', '23']),
      [tissue('cartilage_injury')]: join(['1', '3']),
    },
  },
  {
    sid: 'S660', cov: '#744', batch: '068', labels: ['1985 artificial turf', '1986 artificial turf', '1986 gravel'],
    summary: 'Engebretsen/Kase 1987 Norwegian winter-series surface study extracted as artificial-turf/gravel rows where direct surface injury counts are reported.',
    fields: {
      [f('studyDetails', 'leadAuthor')]: 'Engebretsen L',
      [f('studyDetails', 'title')]: 'Football Injuries and Artificial Turf',
      [f('studyDetails', 'yearOfPublication')]: '1987',
      [f('studyDetails', 'studyDesign')]: 'prospective cohort',
      [f('participantCharacteristics', 'fifaDiscipline')]: join(top('Association football (11-a-side)', 3)),
      [f('participantCharacteristics', 'country')]: join(top('Norway', 3)),
      [f('participantCharacteristics', 'levelOfPlay')]: join(top('elite / first and second division winter series', 3)),
      [f('participantCharacteristics', 'sex')]: join(top('male', 3)),
      [f('participantCharacteristics', 'ageCategory')]: join(top('Senior', 3)),
      [f('participantCharacteristics', 'numberOfTeams')]: join(top('16', 3)),
      [f('participantCharacteristics', 'observationDuration')]: join(['1985 winter series', '1986 winter series', '1986 winter series']),
      [f('definitions', 'injuryDefinition')]: 'time-loss',
      [f('definitions', 'incidenceDefinition')]: 'per 1000 match hours',
      [f('definitions', 'mechanismReporting')]: 'Medical Staff',
      [f('exposure', 'exposureMeasurementUnit')]: join(top('match-exposures', 3)),
      [f('exposure', 'matchExposure')]: join(['56', '16', '40']),
      [f('injuryOutcome', 'injuryTotalCount')]: join(['58', '16', '22']),
      [f('injuryOutcome', 'injuryMatchCount')]: join(['58', '16', '22']),
      [f('injuryOutcome', 'injuryIncidenceOverall')]: join(['30.1', '30.3', '16.7']),
      [f('injuryOutcome', 'injuryMostCommonType')]: join(['overuse injury', '', '']),
      [f('injuryOutcome', 'injuryMostCommonLocation')]: join(['groin/thigh', '', '']),
      [tissue('joint_sprain')]: join(['22', '16', '']),
      [tissue('superficial_contusion')]: join(['13', '11', '']),
      [tissue('bone_fracture')]: join(['4', '0', '']),
      [tissue('concussion')]: join(['0', '1', '']),
      [loc('head')]: join(['2', '2', '']),
      [loc('trunk_overall')]: join(['6', '7', '']),
      [loc('groin')]: join(['14', '7', '']),
      [loc('thigh')]: join(['14', '7', '']),
      [loc('knee')]: join(['10', '3', '']),
      [loc('lower_leg')]: join(['4', '5', '']),
      [loc('ankle')]: join(['21', '21', '']),
    },
  },
];

function tabForField(fieldId) {
  if (fieldId.includes('.')) return fieldId.split('.')[0];
  for (const [tab, fields] of Object.entries(tabs)) {
    if (fields.includes(fieldId)) return tab;
  }
  if (fieldId.startsWith('injuryLocation_')) return 'injuryLocation';
  if (fieldId.startsWith('injuryTissueType_')) return 'injuryTissueType';
  if (fieldId.startsWith('illness')) return 'illnessOutcome';
  throw new Error(`Unknown field ${fieldId}`);
}

function rawFieldId(key) {
  return key.includes('.') ? key.split('.').slice(1).join('.') : key;
}

function metricFor(fieldId) {
  for (const metric of ['prevalence', 'incidence', 'burden', 'severityMeanDays', 'severityTotalDays']) {
    if (fieldId.endsWith(`_${metric}`)) return metric;
  }
  return null;
}

function valuesByLine(value) {
  return String(value ?? '').split(/\r?\n/);
}

async function ensureExtraction(supabase, paperId, tab) {
  const { data: existing, error: lookupError } = await supabase
    .from('extractions')
    .select('id')
    .eq('paper_id', paperId)
    .eq('tab', tab)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from('extractions')
    .insert({ id: crypto.randomUUID(), paper_id: paperId, tab, model: 'human-input', created_at: now(), updated_at: now() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function applyPaper(supabase, manifest, paper) {
  const manifestRow = manifest[paper.sid];
  if (!manifestRow) throw new Error(`Missing manifest row for ${paper.sid}`);
  const paperId = manifestRow.paper_id;
  const { data: currentPaper, error: currentPaperError } = await supabase
    .from('papers')
    .select('metadata')
    .eq('id', paperId)
    .single();
  if (currentPaperError) throw currentPaperError;
  const fields = { ...paper.fields, [f('studyDetails', 'studyId')]: paper.sid };
  const byTab = new Map();
  for (const [key, value] of Object.entries(fields)) {
    const tab = tabForField(key);
    if (!byTab.has(tab)) byTab.set(tab, []);
    byTab.get(tab).push([rawFieldId(key), join(value)]);
  }

  for (const [tab, entries] of byTab.entries()) {
    const extractionId = await ensureExtraction(supabase, paperId, tab);
    const payload = entries.map(([fieldId, value]) => ({
      id: crypto.randomUUID(),
      extraction_id: extractionId,
      field_id: fieldId,
      value: value || null,
      status: value ? 'reported' : 'not_reported',
      confidence: null,
      source_quote: null,
      page_hint: `Merged translated/original PDF ${paper.cov}`,
      metric: metricFor(fieldId),
      updated_at: now(),
      updated_by: null,
    }));
    const { error } = await supabase
      .from('extraction_fields')
      .upsert(payload, { onConflict: 'extraction_id,field_id' });
    if (error) throw error;
    await supabase.from('extractions').update({ model: 'human-input', updated_at: now() }).eq('id', extractionId);
  }

  await supabase.from('population_values').delete().eq('paper_id', paperId);
  await supabase.from('population_groups').delete().eq('paper_id', paperId);
  const groupRows = paper.labels.map((label, index) => ({
    id: crypto.randomUUID(),
    paper_id: paperId,
    tab: 'participantCharacteristics',
    label,
    position: index,
    created_at: now(),
    updated_at: now(),
  }));
  const { data: insertedGroups, error: groupError } = await supabase.from('population_groups').insert(groupRows).select('*');
  if (groupError) throw groupError;

  const populationFieldEntries = Object.entries(fields)
    .map(([key, value]) => [rawFieldId(key), join(value)])
    .filter(([fieldId]) => (
      ['ageCategory', 'sex', 'meanAge', 'sampleSizePlayers', 'numberOfTeams', 'observationDuration', 'seasonLength', 'numberOfSeasons', 'totalExposure', 'matchExposure', 'trainingExposure'].includes(fieldId) ||
      fieldId.startsWith('injury') ||
      fieldId.includes('_prevalence') ||
      fieldId.includes('_incidence') ||
      fieldId.includes('_burden') ||
      fieldId.includes('_severityMeanDays') ||
      fieldId.includes('_severityTotalDays')
    ));
  const valueRows = [];
  for (const group of insertedGroups ?? []) {
    for (const [fieldId, value] of populationFieldEntries) {
      const line = valuesByLine(value)[group.position] ?? '';
      if (!line.trim()) continue;
      valueRows.push({
        id: crypto.randomUUID(),
        population_group_id: group.id,
        paper_id: paperId,
        field_id: fieldId,
        source_field_id: fieldId,
        value: line.trim(),
        metric: metricFor(fieldId),
        unit: null,
        created_at: now(),
        updated_at: now(),
      });
    }
  }
  if (valueRows.length) {
    const { error } = await supabase.from('population_values').insert(valueRows);
    if (error) throw error;
  }

  const language = translationLanguages[paper.sid] ?? 'non-English source';
  const note = `Translated from ${language} on 2026-05-07 using Codex GPT-5 workflow; extracted from merged PDF with English translation first and original source second. Population layout used for extraction: ${paper.labels.join(' / ')}.`;
  const { data: existingNotes, error: noteLookupError } = await supabase.from('paper_notes').select('id,body').eq('paper_id', paperId);
  if (noteLookupError) throw noteLookupError;
  if (!(existingNotes ?? []).some((n) => n.body?.includes('Translated from') && n.body?.includes('2026-05-07'))) {
    const { error } = await supabase.from('paper_notes').insert({ id: crypto.randomUUID(), paper_id: paperId, body: note, created_at: now() });
    if (error) throw error;
  }

  const { error: paperError } = await supabase
    .from('papers')
    .update({
      status: 'processing',
      updated_at: now(),
      metadata: {
        ...((currentPaper?.metadata && typeof currentPaper.metadata === 'object') ? currentPaper.metadata : {}),
        translatedExtractionBatch: paper.batch,
        translatedExtractionAppliedAt: now(),
        translatedExtractionPopulationLabels: paper.labels,
      },
    })
    .eq('id', paperId);
  if (paperError) throw paperError;

  return { paperId, studyId: paper.sid, covidence: paper.cov, labels: paper.labels, summary: paper.summary };
}

function appendBacklog(results) {
  let backlog = fs.readFileSync(BACKLOG_PATH, 'utf8');
  for (const batch of ['065', '066', '067', '068']) {
    if (backlog.includes(`## Batch ${batch}`)) continue;
    const batchRows = results.filter((r) => papers.find((p) => p.sid === r.studyId)?.batch === batch);
    if (!batchRows.length) continue;
    const lines = [
      '',
      `## Batch ${batch}`,
      '',
      'Created: 2026-05-07',
      '',
      '| Study ID | Paper status live | Review state | Action taken | Notes |',
      '| --- | --- | --- | --- | --- |',
      ...batchRows.map((r) => `| ${r.studyId} | processing | ⏲️ pending_review | Extracted live from translated merged PDF | ${r.summary} Population layout: ${r.labels.join(' / ')}. Translation provenance note added live. Source priority: English translated pages used for comprehension, original-language pages used to verify table/figure values. |`),
      '',
    ];
    backlog += `\n${lines.join('\n')}`;
  }
  fs.writeFileSync(BACKLOG_PATH, backlog);
}

loadEnv();
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars');
}
const manifest = loadManifest();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
for (const paper of papers) {
  results.push(await applyPaper(supabase, manifest, paper));
  console.log(`Applied ${paper.sid} ${paper.cov}`);
}
appendBacklog(results);
console.log(`Applied translated batch extraction to ${results.length} papers.`);
