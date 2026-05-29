import crypto from 'node:crypto';
import fs from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const ABDEL_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const envPath = '.env.local';

const tabsByFieldId = new Map([
  ['studyId', 'studyDetails'],
  ['leadAuthor', 'studyDetails'],
  ['title', 'studyDetails'],
  ['yearOfPublication', 'studyDetails'],
  ['journal', 'studyDetails'],
  ['doi', 'studyDetails'],
  ['studyDesign', 'studyDetails'],
  ['fifaDiscipline', 'participantCharacteristics'],
  ['country', 'participantCharacteristics'],
  ['levelOfPlay', 'participantCharacteristics'],
  ['sex', 'participantCharacteristics'],
  ['ageCategory', 'participantCharacteristics'],
  ['meanAge', 'participantCharacteristics'],
  ['sampleSizePlayers', 'participantCharacteristics'],
  ['numberOfTeams', 'participantCharacteristics'],
  ['observationDuration', 'participantCharacteristics'],
  ['injuryDefinition', 'definitions'],
  ['illnessDefinition', 'definitions'],
  ['incidenceDefinition', 'definitions'],
  ['burdenDefinition', 'definitions'],
  ['severityDefinition', 'definitions'],
  ['recurrenceDefinition', 'definitions'],
  ['mechanismReporting', 'definitions'],
  ['seasonLength', 'exposure'],
  ['numberOfSeasons', 'exposure'],
  ['exposureMeasurementUnit', 'exposure'],
  ['totalExposure', 'exposure'],
  ['matchExposure', 'exposure'],
  ['trainingExposure', 'exposure'],
]);

const injuryOutcomeFields = [
  'injuryTotalCount',
  'injuryPlayersCompletedStudy',
  'injuryTeamsCompletedStudy',
  'injuryMedicalAttentionCount',
  'injuryTimeLossCount',
  'injuryMatchCount',
  'injuryMatchMedicalAttentionCount',
  'injuryMatchTimeLossCount',
  'injuryTrainingCount',
  'injuryTrainingMedicalAttentionCount',
  'injuryTrainingTimeLossCount',
  'injuryIncidenceOverall',
  'injuryIncidenceMatch',
  'injuryIncidenceTraining',
  'injuryIncidenceTimeLossOverall',
  'injuryIncidenceTimeLossMatch',
  'injuryIncidenceTimeLossTraining',
  'injuryIncidenceCi95',
  'injuryTimeLossTotal',
  'injuryTimeLossMedian',
  'injuryTimeLossMean',
  'injuryBurden',
  'injuryBurdenCi95',
  'injuryMostCommonDiagnosis',
  'injuryMostCommonType',
  'injuryMostCommonLocation',
  'injuryMostCommonSeverity',
  'injuryModeRepetitiveGradual',
  'injuryModeRepetitiveSudden',
  'injuryModeAcuteSudden',
  'injuryContact',
  'injuryNonContact',
  'injuryCumulativeRepetitive',
  'injuryDurationMedian',
  'injuryDurationMean',
  'injuryRecurrentTotal',
  'injuryRecurrenceRate',
];
injuryOutcomeFields.forEach((fieldId) => tabsByFieldId.set(fieldId, 'injuryOutcome'));

const metricSuffixes = ['prevalence', 'incidence', 'burden', 'severityMeanDays', 'severityTotalDays'];

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function inferTab(fieldId) {
  if (tabsByFieldId.has(fieldId)) return tabsByFieldId.get(fieldId);
  if (fieldId.startsWith('injuryTissueType_')) return 'injuryTissueType';
  if (fieldId.startsWith('injuryLocation_')) return 'injuryLocation';
  if (fieldId.startsWith('illnessRegion_')) return 'illnessRegion';
  if (fieldId.startsWith('illnessEtiology_')) return 'illnessEtiology';
  throw new Error(`No tab mapping for field ${fieldId}`);
}

function inferMetric(fieldId) {
  for (const suffix of metricSuffixes) {
    if (fieldId.endsWith(`_${suffix}`)) return suffix;
  }
  return null;
}

function sourceQuote(sourceIds, note) {
  const sources = Array.isArray(sourceIds) ? sourceIds.join(', ') : sourceIds;
  return `UEFA extraction control map: source ${sources}. ${note}`;
}

function sourceRow(label, sourceId, fields, options = {}) {
  const base = {
    fifaDiscipline: 'Association football (11-a-side)',
    country: options.country ?? 'Europe (multi-country)',
    levelOfPlay: options.levelOfPlay ?? 'Professional elite',
    sex: options.sex ?? 'Male',
    ageCategory: options.ageCategory ?? 'Senior',
    injuryDefinition: options.injuryDefinition ?? 'time-loss',
    incidenceDefinition: options.incidenceDefinition ?? 'injuries per 1000 player-hours',
    burdenDefinition: options.burdenDefinition ?? 'days lost per 1000 player-hours',
    severityDefinition: options.severityDefinition ?? 'days from injury until medically cleared for full participation',
    recurrenceDefinition: options.recurrenceDefinition ?? 'same type and location as a previous injury',
    mechanismReporting: options.mechanismReporting ?? 'Medical staff',
    exposureMeasurementUnit: options.exposureMeasurementUnit ?? 'hours',
  };
  return {
    label,
    sourceId,
    fields: {
      ...base,
      ...fields,
    },
  };
}

function numericEstimate(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^[-+]?\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}

function addStructuredMetricSweep(fields) {
  const incidence = numericEstimate(fields.injuryIncidenceOverall);
  const burden = numericEstimate(fields.injuryBurden);
  const severityMeanDays = numericEstimate(fields.injuryDurationMean);
  const severityTotalDays = numericEstimate(fields.injuryTimeLossTotal);
  const output = { ...fields };

  for (const fieldId of Object.keys(fields)) {
    if (!fieldId.startsWith('injuryTissueType_') && !fieldId.startsWith('injuryLocation_')) continue;
    if (!fieldId.endsWith('_prevalence')) continue;
    const prefix = fieldId.slice(0, -'_prevalence'.length);
    if (incidence && !output[`${prefix}_incidence`]) output[`${prefix}_incidence`] = incidence;
    if (burden && !output[`${prefix}_burden`]) output[`${prefix}_burden`] = burden;
    if (severityMeanDays && !output[`${prefix}_severityMeanDays`]) {
      output[`${prefix}_severityMeanDays`] = severityMeanDays;
    }
    if (severityTotalDays && !output[`${prefix}_severityTotalDays`]) {
      output[`${prefix}_severityTotalDays`] = severityTotalDays;
    }
  }

  return output;
}

const ecisSharedFieldIds = new Set([
  'fifaDiscipline',
  'country',
  'levelOfPlay',
  'ageCategory',
  'injuryDefinition',
  'incidenceDefinition',
  'burdenDefinition',
  'severityDefinition',
  'recurrenceDefinition',
  'mechanismReporting',
  'exposureMeasurementUnit',
]);

function leanEcisRow(legacyRow, sexScope, fieldPatch = {}) {
  const fields = {};
  for (const [fieldId, value] of Object.entries(legacyRow.fields)) {
    if (ecisSharedFieldIds.has(fieldId)) continue;
    fields[fieldId] = value;
  }
  const enrichedFields = addStructuredMetricSweep(fields);
  return {
    label: legacyRow.label,
    sourceId: legacyRow.sourceId,
    fields: {
      ...enrichedFields,
      studyId: 'UEFA-ECIS-MASTER',
      sex: sexScope,
      ...fieldPatch,
    },
  };
}

function buildRefinedEcisRows(s200Fields) {
  const legacyRows = buildEcisSupplementRows();
  const byLabel = new Map(legacyRows.map((row) => [row.label, row]));
  const retained = [
    ['S043 hamstring injuries - 2001/02-2021/22', 'male - hamstring-specific study'],
    ['S046 hip/groin injuries - 2001/02-2015/16', 'male - hip/groin-specific study', {
      injuryLocation_groin_prevalence: '1812',
    }],
    ['S046 adductor-related hip/groin injuries - 2001/02-2015/16', 'male - adductor-specific study', {
      injuryLocation_groin_prevalence: '1139',
      injuryLocation_groin_incidence: '0.63',
      injuryTissueType_muscle_tendon_prevalence: '1139',
      injuryTissueType_muscle_tendon_incidence: '0.63',
    }],
    ['S006 LCL injuries - 2001-2018', 'male - LCL-specific study'],
    ['S006 PCL injuries - 2001-2018', 'male - PCL-specific study'],
    ['S106 MCL injuries - 2001/02-2011/12', 'male - MCL-specific study'],
    ['S401 ACL injuries - 2001-2015', 'male - ACL-specific study'],
    ['S107 ankle injuries - 2001/02-2011/12', 'male - ankle-specific study', {
      injuryLocation_ankle_incidence: '1.022',
      injuryLocation_ankle_burden: '16.3',
      injuryLocation_ankle_severityMeanDays: '15.9',
      injuryTissueType_bone_fracture_prevalence: '18',
      injuryTissueType_bone_fracture_incidence: '0.017',
      injuryTissueType_bone_fracture_burden: '1.5',
      injuryTissueType_bone_fracture_severityMeanDays: '89.6',
      injuryTissueType_bone_stress_prevalence: '4',
      injuryTissueType_bone_stress_incidence: '0.004',
      injuryTissueType_ligament_joint_capsule_prevalence: '744',
      injuryTissueType_ligament_joint_capsule_incidence: '0.704',
      injuryTissueType_joint_sprain_prevalence: '729',
      injuryTissueType_joint_sprain_incidence: '0.690',
      injuryTissueType_joint_sprain_burden: '10.6',
      injuryTissueType_joint_sprain_severityMeanDays: '15.4',
      injuryTissueType_cartilage_injury_prevalence: '12',
      injuryTissueType_cartilage_injury_incidence: '0.011',
      injuryTissueType_superficial_contusion_prevalence: '182',
      injuryTissueType_superficial_contusion_incidence: '0.172',
      injuryTissueType_superficial_contusion_burden: '1.1',
      injuryTissueType_superficial_contusion_severityMeanDays: '6.2',
      injuryTissueType_laceration_prevalence: '10',
      injuryTissueType_laceration_incidence: '0.010',
      injuryTissueType_peripheral_nerve_prevalence: '2',
      injuryTissueType_peripheral_nerve_incidence: '0.002',
      injuryTissueType_synovitis_capsulitis_prevalence: '65',
      injuryTissueType_synovitis_capsulitis_incidence: '0.062',
      injuryTissueType_synovitis_capsulitis_burden: '1.0',
      injuryTissueType_synovitis_capsulitis_severityMeanDays: '16.0',
    }],
    ['S368 isolated syndesmotic ankle injuries - 2001-2016', 'male - syndesmosis-specific study'],
    ['S113 upper extremity injuries - 2001-2011', 'male - upper-extremity-specific study'],
    ['S340 head/neck injuries - 2001/02-2009/10', 'male - head/neck-specific study', {
      injuryLocation_head_neck_overall_incidence: '0.170',
      injuryLocation_head_neck_overall_severityMeanDays: '10.4',
      injuryLocation_head_incidence: '0.135',
      injuryLocation_head_severityMeanDays: '11.6',
      injuryLocation_neck_incidence: '0.035',
      injuryLocation_neck_severityMeanDays: '5.6',
      injuryTissueType_concussion_prevalence: '48',
      injuryTissueType_concussion_incidence: '0.060',
      injuryTissueType_concussion_severityMeanDays: '10.5',
      injuryTissueType_bone_fracture_prevalence: '39',
      injuryTissueType_bone_fracture_incidence: '0.049',
      injuryTissueType_bone_fracture_severityMeanDays: '16.7',
      injuryTissueType_superficial_contusion_prevalence: '12',
      injuryTissueType_laceration_prevalence: '10',
      injuryTissueType_laceration_incidence: '0.012',
      injuryTissueType_laceration_severityMeanDays: '2.6',
      injuryTissueType_muscle_injury_prevalence: '5',
      injuryTissueType_muscle_injury_incidence: '0.006',
      injuryTissueType_muscle_injury_severityMeanDays: '6.4',
      injuryTissueType_joint_sprain_prevalence: '1',
      injuryTissueType_joint_sprain_incidence: '0.001',
      injuryTissueType_joint_sprain_severityMeanDays: '3',
    }],
    ['S340 concussion - 2001/02-2009/10', 'male - concussion-specific study'],
    ['S202 stress fractures - ECIS-related cohorts', 'male - stress-fracture-specific study', { injuryRecurrentTotal: '', injuryRecurrenceRate: '29%' }],
    ['S451 fifth metatarsal fractures - 2001-2012', 'male - fifth-metatarsal-fracture-specific study'],
    ['S091 Achilles tendinopathy - 2001-2011', 'male - Achilles-tendinopathy-specific study'],
    ['S091 Achilles tendon rupture - 2001-2011', 'male - Achilles-rupture-specific study'],
    ['S007 indirect thigh muscle injuries - 2001-2013', 'male - indirect-thigh-specific study'],
    ['S007 direct thigh muscle contusions - 2001-2013', 'male - direct-thigh-contusion-specific study'],
  ];

  return [
    {
      label: 'S200 ECIS men all injuries anchor - 2001/02-2018/19',
      sourceId: 'S200',
      fields: {
        ...s200Fields,
        studyId: 'UEFA-ECIS-MASTER',
        studyDesign: s200Fields.studyDesign || 'prospective cohort',
        fifaDiscipline: 'Association football (11-a-side)',
        country: 'Europe (multi-country)',
        levelOfPlay: 'Professional elite',
        sex: 'Male',
        ageCategory: 'Senior',
        sampleSizePlayers: '3302',
        numberOfTeams: '49',
        observationDuration: '2001/02-2018/19',
        numberOfSeasons: '18',
        injuryDefinition: 'time-loss',
        incidenceDefinition: 'injuries per 1000 player-hours',
        burdenDefinition: 'days lost per 1000 player-hours',
        severityDefinition: 'days from injury until medically cleared for full participation',
        recurrenceDefinition: 'same type and location as a previous injury',
        mechanismReporting: 'Medical staff',
        exposureMeasurementUnit: 'hours',
        totalExposure: '1784281',
        injuryTotalCount: '11820',
        injuryTrainingCount: '5035',
        injuryMatchCount: '6785',
        injuryIncidenceOverall: '6.6',
        injuryIncidenceTraining: '3.4 (95% CI 3.3-3.5)',
        injuryIncidenceMatch: '23.8 (95% CI 23.2-24.4)',
        injuryMostCommonType: 'muscle injury',
        injuryTissueType_muscle_injury_prevalence: '4763',
        injuryTissueType_ligament_joint_capsule_prevalence: '1971',
      },
    },
    ...retained.map(([label, sexScope, fieldPatch]) => {
      const row = byLabel.get(label);
      if (!row) throw new Error(`Missing retained ECIS legacy row: ${label}`);
      return leanEcisRow(row, sexScope, fieldPatch);
    }),
  ];
}

async function loadPaperByStudyId(supabase, studyId) {
  const { data, error } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,status,assigned_to,metadata')
    .eq('assigned_study_id', studyId)
    .maybeSingle();
  if (error || !data) throw new Error(`Missing paper ${studyId}: ${error?.message ?? 'not found'}`);
  return data;
}

async function loadFilledFieldMap(supabase, paperId) {
  const { data, error } = await supabase
    .from('extractions')
    .select('tab,extraction_fields(field_id,value,status,metric,page_hint,source_quote)')
    .eq('paper_id', paperId);
  if (error) throw new Error(`Failed to load extractions for ${paperId}: ${error.message}`);

  const fields = {};
  for (const extraction of data ?? []) {
    for (const field of extraction.extraction_fields ?? []) {
      if (typeof field.value !== 'string' || !field.value.trim()) continue;
      fields[field.field_id] = field.value.trim();
    }
  }
  return fields;
}

function manualWecisTotalFieldMap() {
  return {
    studyDesign: 'prospective cohort',
    sampleSizePlayers: '596',
    numberOfTeams: '15',
    observationDuration: '2018/2019 to 2021/2022',
    numberOfSeasons: '4',
    injuryDefinition: 'time-loss',
    incidenceDefinition: 'injuries per 1000 player-hours',
    burdenDefinition: 'days lost per 1000 player-hours',
    mechanismReporting: 'Medical staff',
    exposureMeasurementUnit: 'hours',
    totalExposure: '227922',
    trainingExposure: '195945',
    matchExposure: '31977',
    injuryTotalCount: '1527',
    injuryPlayersCompletedStudy: '596',
    injuryTeamsCompletedStudy: '15',
    injuryTimeLossCount: '1527',
    injuryTrainingCount: '940',
    injuryMatchCount: '587',
    injuryIncidenceOverall: '6.7',
    injuryIncidenceMatch: '18.4',
    injuryIncidenceTraining: '4.8',
    injuryIncidenceCi95: 'overall 6.4-7.0; match 16.9-19.9; training 4.5-5.1',
    injuryTimeLossTotal: '40632',
    injuryBurden: '175.5',
    injuryMostCommonDiagnosis: 'hamstring muscle injury',
    injuryMostCommonType: 'muscle injury',
    injuryMostCommonLocation: 'thigh',
    injuryTissueType_injury_diagnosis_diagnosis: 'hamstring muscle injury',
    injuryTissueType_injury_diagnosis_prevalence: '188',
    injuryTissueType_injury_diagnosis_incidence: '0.8',
    injuryTissueType_injury_diagnosis_burden: '8.3',
    injuryTissueType_muscle_injury_prevalence: '598',
    injuryTissueType_concussion_prevalence: '47',
    injuryTissueType_concussion_incidence: '0.2',
    injuryTissueType_concussion_burden: '0.8',
    injuryTissueType_cartilage_synovium_bursa_prevalence: '56',
    injuryTissueType_cartilage_synovium_bursa_incidence: '0.2',
    injuryTissueType_cartilage_synovium_bursa_burden: '15.6',
    injuryTissueType_cartilage_injury_prevalence: '56',
    injuryTissueType_cartilage_injury_incidence: '0.2',
    injuryTissueType_cartilage_injury_burden: '15.6',
    injuryTissueType_ligament_joint_capsule_prevalence: '304',
    injuryTissueType_joint_sprain_prevalence: '263',
    injuryLocation_head_neck_overall_prevalence: '71',
    injuryLocation_head_prevalence: '60',
    injuryLocation_head_incidence: '0.3',
    injuryLocation_head_burden: '0.9',
    injuryLocation_neck_prevalence: '11',
    injuryLocation_neck_incidence: '0.0',
    injuryLocation_neck_burden: '0.0',
    injuryLocation_upper_limb_overall_prevalence: '61',
    injuryLocation_shoulder_prevalence: '24',
    injuryLocation_shoulder_incidence: '0.1',
    injuryLocation_shoulder_burden: '1.7',
    injuryLocation_hand_prevalence: '37',
    injuryLocation_hand_incidence: '0.2',
    injuryLocation_hand_burden: '7.5',
    injuryLocation_trunk_overall_prevalence: '91',
    injuryLocation_abdomen_prevalence: '7',
    injuryLocation_abdomen_incidence: '0.0',
    injuryLocation_abdomen_burden: '0.0',
    injuryLocation_lumbosacral_prevalence: '76',
    injuryLocation_lumbosacral_incidence: '0.3',
    injuryLocation_lumbosacral_burden: '2.3',
    injuryLocation_lower_limb_overall_prevalence: '1304',
    injuryLocation_groin_prevalence: '151',
    injuryLocation_groin_incidence: '0.7',
    injuryLocation_groin_burden: '7.3',
    injuryLocation_thigh_prevalence: '408',
    injuryLocation_thigh_incidence: '1.8',
    injuryLocation_thigh_burden: '25.3',
    injuryLocation_knee_prevalence: '270',
    injuryLocation_knee_incidence: '1.2',
    injuryLocation_knee_burden: '84.5',
    injuryLocation_lower_leg_prevalence: '175',
    injuryLocation_lower_leg_incidence: '0.8',
    injuryLocation_lower_leg_burden: '15.2',
    injuryLocation_ankle_prevalence: '209',
    injuryLocation_ankle_incidence: '0.9',
    injuryLocation_ankle_burden: '16.2',
    injuryLocation_foot_prevalence: '91',
    injuryLocation_foot_incidence: '0.4',
    injuryLocation_foot_burden: '9.0',
  };
}

const wecisSeasonRows = [
  {
    label: 'S112 WECIS women season - 2018/2019',
    observationDuration: '2018/2019',
    injuryTotalCount: '323',
    injuryTrainingCount: '174',
    injuryMatchCount: '151',
    injuryIncidenceOverall: '6.1',
    injuryIncidenceMatch: '19.2',
    injuryIncidenceTraining: '3.8',
    injuryIncidenceCi95: 'overall 5.5-6.8; match 16.3-22.5; training 3.3-4.5',
    injuryTimeLossTotal: '7173',
    injuryBurden: '126.3',
  },
  {
    label: 'S112 WECIS women season - 2019/2020',
    observationDuration: '2019/2020',
    injuryTotalCount: '306',
    injuryTrainingCount: '208',
    injuryMatchCount: '96',
    injuryIncidenceOverall: '5.7',
    injuryIncidenceMatch: '14.2',
    injuryIncidenceTraining: '4.5',
    injuryIncidenceCi95: 'overall 5.1-6.4; match 11.6-17.3; training 3.9-5.2',
    injuryTimeLossTotal: '10317',
    injuryBurden: '174.9',
  },
  {
    label: 'S112 WECIS women season - 2020/2021',
    observationDuration: '2020/2021',
    injuryTotalCount: '470',
    injuryTrainingCount: '305',
    injuryMatchCount: '165',
    injuryIncidenceOverall: '7.0',
    injuryIncidenceMatch: '19.9',
    injuryIncidenceTraining: '5.2',
    injuryIncidenceCi95: 'overall 6.4-7.7; match 17.1-23.2; training 4.7-5.8',
    injuryTimeLossTotal: '12434',
    injuryBurden: '189.5',
  },
  {
    label: 'S112 WECIS women season - 2021/2022',
    observationDuration: '2021/2022',
    injuryTotalCount: '428',
    injuryTrainingCount: '253',
    injuryMatchCount: '175',
    injuryIncidenceOverall: '7.8',
    injuryIncidenceMatch: '19.4',
    injuryIncidenceTraining: '5.5',
    injuryIncidenceCi95: 'overall 7.1-8.6; match 16.7-22.5; training 4.9-6.2',
    injuryTimeLossTotal: '10708',
    injuryBurden: '183.4',
  },
];

function buildWecisRows(s112Fields, targetStudyId = 'S112') {
  const common = {
    studyDesign: 'prospective cohort',
    sampleSizePlayers: '596',
    numberOfTeams: '15',
    numberOfSeasons: '1',
    studyId: targetStudyId,
    fifaDiscipline: 'Association football (11-a-side)',
    country: 'Europe (multi-country)',
    levelOfPlay: 'Professional elite',
    sex: 'Female',
    ageCategory: 'Senior',
  };

  return [
    sourceRow('S112 WECIS women total - 2018/2019-2021/2022', 'S112', {
      ...s112Fields,
      ...manualWecisTotalFieldMap(),
      studyId: targetStudyId,
      fifaDiscipline: 'Association football (11-a-side)',
      country: 'Europe (multi-country)',
      levelOfPlay: 'Professional elite',
      sex: 'Female',
      ageCategory: 'Senior',
    }, { sex: 'Female' }),
    ...wecisSeasonRows.map(({ label, ...fields }) => sourceRow(label, 'S112', {
      ...common,
      ...fields,
    }, { sex: 'Female' })),
  ];
}

async function clearMasterExtractions(supabase, paperId) {
  const { data: extractionRows, error } = await supabase.from('extractions').select('id').eq('paper_id', paperId);
  if (error) throw new Error(`Failed to load master extractions: ${error.message}`);

  const extractionIds = (extractionRows ?? []).map((row) => row.id);
  if (extractionIds.length > 0) {
    const { error: fieldError } = await supabase.from('extraction_fields').delete().in('extraction_id', extractionIds);
    if (fieldError) throw new Error(`Failed to clear extraction fields: ${fieldError.message}`);
    const { error: extractionError } = await supabase.from('extractions').delete().in('id', extractionIds);
    if (extractionError) throw new Error(`Failed to clear extractions: ${extractionError.message}`);
  }
  const { error: valueError } = await supabase.from('population_values').delete().eq('paper_id', paperId);
  if (valueError) throw new Error(`Failed to clear population values: ${valueError.message}`);
  const { error: groupError } = await supabase.from('population_groups').delete().eq('paper_id', paperId);
  if (groupError) throw new Error(`Failed to clear population groups: ${groupError.message}`);
}

async function ensureExtraction(supabase, paperId, tab, existingByTab = null) {
  if (existingByTab?.has(tab)) return existingByTab.get(tab);

  const { data: existing, error: existingError } = await supabase
    .from('extractions')
    .select('id,tab')
    .eq('paper_id', paperId)
    .eq('tab', tab)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to check extraction ${tab}: ${existingError.message}`);
  if (existing?.id) {
    existingByTab?.set(tab, existing.id);
    return existing.id;
  }

  const now = new Date().toISOString();
  const payload = {
    id: crypto.randomUUID(),
    paper_id: paperId,
    tab,
    model: 'human-input',
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase.from('extractions').insert(payload).select('id').single();
  if (error || !data) throw new Error(`Failed to create ${tab} extraction: ${error?.message ?? 'Unknown error'}`);
  existingByTab?.set(tab, data.id);
  return data.id;
}

function rowsToFieldRows(rows, masterStudyId) {
  const fieldIds = new Set();
  for (const row of rows) {
    Object.entries(row.fields).forEach(([fieldId, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) fieldIds.add(fieldId);
    });
  }
  const byField = [];
  for (const fieldId of Array.from(fieldIds).sort()) {
    const lines = rows.map((row) => {
      const value = fieldId === 'studyId' ? masterStudyId : row.fields[fieldId];
      return value === undefined || value === null ? '' : String(value).trim();
    });
    if (!lines.some((line) => line)) continue;
    const sourceIds = Array.from(new Set(rows.filter((row, index) => lines[index]).map((row) => row.sourceId)));
    byField.push({
      fieldId,
      tab: inferTab(fieldId),
      metric: inferMetric(fieldId),
      value: lines.join('\n'),
      sourceQuote: sourceQuote(sourceIds, 'Multiline value follows the saved population-row order; blanks preserve row alignment and avoid double counting.'),
      pageHint: `${sourceIds.join(', ')}; UEFA master-control extraction; population row labels contain source and topic scope.`,
    });
  }
  return byField;
}

async function insertFieldRows(supabase, paperId, fieldRows) {
  const byTab = new Map();
  for (const field of fieldRows) {
    const current = byTab.get(field.tab) ?? [];
    current.push(field);
    byTab.set(field.tab, current);
  }
  for (const [tab, tabFields] of byTab.entries()) {
    const extractionId = await ensureExtraction(supabase, paperId, tab);
    const now = new Date().toISOString();
    const rows = tabFields.map((field) => ({
      id: crypto.randomUUID(),
      extraction_id: extractionId,
      field_id: field.fieldId,
      value: field.value,
      confidence: 0.95,
      source_quote: field.sourceQuote,
      page_hint: field.pageHint,
      metric: field.metric,
      status: 'reported',
      updated_at: now,
      updated_by: null,
    }));
    const { error } = await supabase.from('extraction_fields').insert(rows);
    if (error) throw new Error(`Failed to insert ${tab} fields: ${error.message}`);
  }
}

async function insertPopulationGroups(supabase, paperId, rows) {
  const now = new Date().toISOString();
  for (let index = 0; index < rows.length; index += 1) {
    const groupId = crypto.randomUUID();
    const { error: groupError } = await supabase.from('population_groups').insert({
      id: groupId,
      paper_id: paperId,
      tab: 'participantCharacteristics',
      label: rows[index].label,
      position: index,
      created_at: now,
      updated_at: now,
    });
    if (groupError) throw new Error(`Failed to insert population group ${rows[index].label}: ${groupError.message}`);

    const values = Object.entries(rows[index].fields)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
      .map(([fieldId, value]) => ({
        id: crypto.randomUUID(),
        population_group_id: groupId,
        paper_id: paperId,
        field_id: fieldId,
        value: String(value).trim(),
        metric: inferMetric(fieldId),
        unit: null,
        source_field_id: fieldId,
        created_at: now,
        updated_at: now,
      }));
    if (values.length > 0) {
      const { error } = await supabase.from('population_values').insert(values);
      if (error) throw new Error(`Failed to insert population values for ${rows[index].label}: ${error.message}`);
    }
  }
}

async function rebuildMaster(supabase, paper, rows, masterStudyId, metadataPatch, paperPatch = {}) {
  await clearMasterExtractions(supabase, paper.id);
  const fieldRows = rowsToFieldRows(rows, masterStudyId);
  await insertFieldRows(supabase, paper.id, fieldRows);
  await insertPopulationGroups(supabase, paper.id, rows);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('papers')
    .update({
      assigned_to: ABDEL_PROFILE_ID,
      ...paperPatch,
      metadata: {
        ...(paper.metadata ?? {}),
        ...metadataPatch,
        fullMasterExtractionAppliedAt: now,
        fullMasterExtractionMethod: 'Direct Supabase script; UEFA extraction rebuilt from audited source rows with population-row alignment.',
      },
      updated_at: now,
    })
    .eq('id', paper.id);
  if (error) throw new Error(`Failed to update master metadata: ${error.message}`);
  return { fieldCount: fieldRows.length, rowCount: rows.length };
}

async function loadExistingExtractionState(supabase, paperId) {
  const { data, error } = await supabase
    .from('extractions')
    .select('id,tab,extraction_fields(id,field_id,value)')
    .eq('paper_id', paperId);
  if (error) throw new Error(`Failed to load extraction state: ${error.message}`);
  const extractionByTab = new Map();
  const fieldById = new Map();
  for (const extraction of data ?? []) {
    extractionByTab.set(extraction.tab, extraction.id);
    for (const field of extraction.extraction_fields ?? []) {
      fieldById.set(field.field_id, { ...field, extractionId: extraction.id, tab: extraction.tab });
    }
  }
  return { extractionByTab, fieldById };
}

async function applyRowsAdditive(supabase, paper, rows, targetStatus = null) {
  if (paper.assigned_to && paper.assigned_to !== ABDEL_PROFILE_ID) {
    return { skipped: true, reason: `assigned to another profile (${paper.assigned_to})` };
  }

  const now = new Date().toISOString();
  const statusPatch = targetStatus && paper.status === 'uefa' ? { status: targetStatus } : {};
  const { error: paperError } = await supabase
    .from('papers')
    .update({ assigned_to: ABDEL_PROFILE_ID, ...statusPatch, updated_at: now })
    .eq('id', paper.id);
  if (paperError) throw new Error(`Failed to update paper ${paper.assigned_study_id}: ${paperError.message}`);

  const { extractionByTab, fieldById } = await loadExistingExtractionState(supabase, paper.id);
  const fieldRows = rowsToFieldRows(rows, paper.assigned_study_id);
  const inserted = [];
  const updatedBlank = [];
  const skippedNonblank = [];

  for (const field of fieldRows) {
    const existing = fieldById.get(field.fieldId);
    if (existing?.value?.trim()) {
      skippedNonblank.push(field.fieldId);
      continue;
    }
    if (existing?.id) {
      const { error } = await supabase
        .from('extraction_fields')
        .update({
          value: field.value,
          confidence: 0.95,
          source_quote: field.sourceQuote,
          page_hint: field.pageHint,
          metric: field.metric,
          status: 'reported',
          updated_at: now,
          updated_by: null,
        })
        .eq('id', existing.id);
      if (error) throw new Error(`Failed to update blank field ${field.fieldId}: ${error.message}`);
      updatedBlank.push(field.fieldId);
      continue;
    }
    const extractionId = await ensureExtraction(supabase, paper.id, field.tab, extractionByTab);
    const { error } = await supabase.from('extraction_fields').insert({
      id: crypto.randomUUID(),
      extraction_id: extractionId,
      field_id: field.fieldId,
      value: field.value,
      confidence: 0.95,
      source_quote: field.sourceQuote,
      page_hint: field.pageHint,
      metric: field.metric,
      status: 'reported',
      updated_at: now,
      updated_by: null,
    });
    if (error) throw new Error(`Failed to insert field ${field.fieldId}: ${error.message}`);
    inserted.push(field.fieldId);
  }

  await upsertPopulationRowsAdditive(supabase, paper.id, rows);
  return { skipped: false, inserted: inserted.length, updatedBlank: updatedBlank.length, skippedNonblank: skippedNonblank.length };
}

async function upsertPopulationRowsAdditive(supabase, paperId, rows) {
  const { data: existingGroups, error: groupError } = await supabase
    .from('population_groups')
    .select('id,label,position,population_values(id,field_id,value)')
    .eq('paper_id', paperId)
    .order('position', { ascending: true });
  if (groupError) throw new Error(`Failed to load population groups: ${groupError.message}`);

  const now = new Date().toISOString();
  const groups = [...(existingGroups ?? [])];
  for (let index = 0; index < rows.length; index += 1) {
    let group = groups[index];
    if (!group) {
      const { data, error } = await supabase
        .from('population_groups')
        .insert({
          id: crypto.randomUUID(),
          paper_id: paperId,
          tab: 'participantCharacteristics',
          label: rows[index].label,
          position: index,
          created_at: now,
          updated_at: now,
        })
        .select('id,label,position,population_values(id,field_id,value)')
        .single();
      if (error || !data) throw new Error(`Failed to create population group ${rows[index].label}: ${error?.message ?? 'unknown error'}`);
      groups[index] = data;
      group = data;
    } else if (!group.label || /^Row \d+$/.test(group.label) || group.label !== rows[index].label) {
      const { error } = await supabase
        .from('population_groups')
        .update({ label: rows[index].label, updated_at: now })
        .eq('id', group.id);
      if (error) throw new Error(`Failed to update population label ${rows[index].label}: ${error.message}`);
    }

    const existingValues = new Map((group.population_values ?? []).map((value) => [value.field_id, value]));
    const inserts = [];
    for (const [fieldId, value] of Object.entries(rows[index].fields)) {
      if (value === undefined || value === null || !String(value).trim()) continue;
      const existingValue = existingValues.get(fieldId);
      if (existingValue?.value?.trim()) continue;
      if (existingValue?.id) {
        const { error } = await supabase
          .from('population_values')
          .update({ value: String(value).trim(), metric: inferMetric(fieldId), source_field_id: fieldId, updated_at: now })
          .eq('id', existingValue.id);
        if (error) throw new Error(`Failed to update blank population value ${fieldId}: ${error.message}`);
      } else {
        inserts.push({
          id: crypto.randomUUID(),
          population_group_id: group.id,
          paper_id: paperId,
          field_id: fieldId,
          value: String(value).trim(),
          metric: inferMetric(fieldId),
          unit: null,
          source_field_id: fieldId,
          created_at: now,
          updated_at: now,
        });
      }
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from('population_values').insert(inserts);
      if (error) throw new Error(`Failed to insert population values: ${error.message}`);
    }
  }
}

function buildEcisSupplementRows() {
  return [
    sourceRow('S043 hamstring injuries - 2001/02-2021/22', 'S043', {
      observationDuration: '2001/02-2021/22',
      numberOfSeasons: '21',
      sampleSizePlayers: '3909',
      numberOfTeams: '54',
      totalExposure: '2131561',
      trainingExposure: '1787823',
      matchExposure: '343738',
      injuryTotalCount: '2636',
      injuryTimeLossCount: '2636',
      injuryTrainingCount: '922',
      injuryMatchCount: '1714',
      injuryIncidenceMatch: '4.99',
      injuryIncidenceTraining: '0.52',
      injuryTimeLossMedian: '13 (IQR 7-22)',
      injuryRecurrentTotal: '475',
      injuryRecurrenceRate: '18%',
      injuryMostCommonDiagnosis: 'hamstring injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'hamstring injury',
      injuryTissueType_injury_diagnosis_prevalence: '2636',
      injuryTissueType_muscle_injury_prevalence: '2636',
      injuryLocation_thigh_prevalence: '2636',
    }),
    sourceRow('S043 structural hamstring injuries - 2011/12-2021/22', 'S043', {
      observationDuration: '2011/12-2021/22',
      injuryTotalCount: '1312',
      injuryTimeLossMedian: '17 (IQR 11-25)',
      injuryRecurrentTotal: '234',
      injuryMostCommonDiagnosis: 'structural hamstring injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'structural hamstring injury',
      injuryTissueType_injury_diagnosis_prevalence: '1312',
      injuryTissueType_muscle_injury_prevalence: '1312',
      injuryLocation_thigh_prevalence: '1312',
    }),
    sourceRow('S043 functional hamstring injuries - 2011/12-2021/22', 'S043', {
      observationDuration: '2011/12-2021/22',
      injuryTotalCount: '507',
      injuryTimeLossMedian: '6 (IQR 4-10)',
      injuryRecurrentTotal: '83',
      injuryMostCommonDiagnosis: 'functional hamstring injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'functional hamstring injury',
      injuryTissueType_injury_diagnosis_prevalence: '507',
      injuryTissueType_muscle_injury_prevalence: '507',
      injuryLocation_thigh_prevalence: '507',
    }),
    sourceRow('S046 hip/groin injuries - 2001/02-2015/16', 'S046', {
      observationDuration: '2001/02-2015/16',
      numberOfSeasons: '15',
      sampleSizePlayers: '3055',
      numberOfTeams: '47',
      totalExposure: '1816071',
      trainingExposure: '1529387',
      matchExposure: '286684',
      injuryTotalCount: '1812',
      injuryTrainingCount: '912',
      injuryMatchCount: '900',
      injuryIncidenceOverall: '1.0',
      injuryIncidenceMatch: '3.1',
      injuryIncidenceTraining: '0.6',
      injuryBurden: '9.2 (95% CI 9.1-9.3)',
      injuryDurationMean: '15 (SD 20)',
      injuryModeAcuteSudden: '888',
      injuryModeRepetitiveGradual: '910',
      injuryRecurrentTotal: '204',
      injuryRecurrenceRate: '11%',
      injuryMostCommonDiagnosis: 'adductor-related hip/groin injury',
      injuryMostCommonLocation: 'hip/groin',
      injuryTissueType_injury_diagnosis_diagnosis: 'hip/groin injury',
      injuryTissueType_injury_diagnosis_prevalence: '1812',
    }),
    sourceRow('S046 adductor-related hip/groin injuries - 2001/02-2015/16', 'S046', {
      observationDuration: '2001/02-2015/16',
      injuryTotalCount: '1139',
      injuryIncidenceOverall: '0.63 (95% CI 0.59-0.66)',
      injuryIncidenceMatch: '2.16 (95% CI 2.00-2.33)',
      injuryMostCommonDiagnosis: 'adductor-related injury',
      injuryMostCommonType: 'muscle/tendon injury',
      injuryMostCommonLocation: 'groin',
      injuryTissueType_injury_diagnosis_diagnosis: 'adductor-related hip/groin injury',
      injuryTissueType_injury_diagnosis_prevalence: '1139',
    }),
    sourceRow('S006 LCL injuries - 2001-2018', 'S006', {
      observationDuration: '2001-2018',
      numberOfSeasons: '17',
      sampleSizePlayers: '4389',
      numberOfTeams: '68',
      totalExposure: '2554687',
      trainingExposure: '2160908',
      matchExposure: '393778',
      injuryTotalCount: '128',
      injuryIncidenceOverall: '0.05',
      injuryIncidenceMatch: '0.21',
      injuryIncidenceTraining: '0.02',
      injuryBurden: '1.26',
      injuryTimeLossMedian: '15 (Q1 7; Q3 32)',
      injuryDurationMean: '25.4 (SD 27.6)',
      injuryContact: '63/108',
      injuryNonContact: '45/108',
      injuryRecurrenceRate: '8.3%',
      injuryMostCommonDiagnosis: 'lateral collateral ligament injury',
      injuryMostCommonType: 'ligament/joint capsule injury',
      injuryMostCommonLocation: 'knee',
      injuryTissueType_injury_diagnosis_diagnosis: 'lateral collateral ligament injury',
      injuryTissueType_injury_diagnosis_prevalence: '128',
      injuryTissueType_ligament_joint_capsule_prevalence: '128',
      injuryLocation_knee_prevalence: '128',
    }),
    sourceRow('S006 PCL injuries - 2001-2018', 'S006', {
      observationDuration: '2001-2018',
      numberOfSeasons: '17',
      sampleSizePlayers: '4389',
      numberOfTeams: '68',
      totalExposure: '2554687',
      trainingExposure: '2160908',
      matchExposure: '393778',
      injuryTotalCount: '28',
      injuryIncidenceOverall: '0.01',
      injuryIncidenceMatch: '0.056',
      injuryIncidenceTraining: '0.003',
      injuryBurden: '0.61',
      injuryTimeLossMedian: '31 (Q1 15; Q3 74)',
      injuryDurationMean: '55.9 (SD 59.7)',
      injuryContact: '14/26',
      injuryNonContact: '12/26',
      injuryRecurrentTotal: '1',
      injuryMostCommonDiagnosis: 'posterior cruciate ligament injury',
      injuryMostCommonType: 'ligament/joint capsule injury',
      injuryMostCommonLocation: 'knee',
      injuryTissueType_injury_diagnosis_diagnosis: 'posterior cruciate ligament injury',
      injuryTissueType_injury_diagnosis_prevalence: '28',
      injuryTissueType_ligament_joint_capsule_prevalence: '28',
      injuryLocation_knee_prevalence: '28',
    }),
    sourceRow('S106 MCL injuries - 2001/02-2011/12', 'S106', {
      observationDuration: '2001/02-2011/12',
      numberOfSeasons: '11',
      totalExposure: '1057201',
      trainingExposure: '888249',
      matchExposure: '168952',
      injuryTotalCount: '346',
      injuryIncidenceOverall: '0.33 (95% CI 0.29-0.36)',
      injuryIncidenceMatch: '1.31 (95% CI 1.15-1.49)',
      injuryIncidenceTraining: '0.14 (95% CI 0.12-0.17)',
      injuryBurden: '7.6 (95% CI 7.5-7.8)',
      injuryTimeLossMedian: '16 (IQR 8-31)',
      injuryDurationMean: '23 (SD 23)',
      injuryContact: '182/264',
      injuryNonContact: '82/264',
      injuryRecurrentTotal: '37',
      injuryRecurrenceRate: '10.8%',
      injuryMostCommonDiagnosis: 'medial collateral ligament injury',
      injuryMostCommonType: 'ligament/joint capsule injury',
      injuryMostCommonLocation: 'knee',
      injuryTissueType_injury_diagnosis_diagnosis: 'medial collateral ligament injury',
      injuryTissueType_injury_diagnosis_prevalence: '346',
      injuryTissueType_ligament_joint_capsule_prevalence: '346',
      injuryLocation_knee_prevalence: '346',
    }),
    sourceRow('S401 ACL injuries - 2001-2015', 'S401', {
      observationDuration: '2001-2015',
      numberOfTeams: '78',
      totalExposure: '2387913',
      trainingExposure: '2026211',
      matchExposure: '361702',
      injuryTotalCount: '157',
      injuryMatchCount: '123',
      injuryTrainingCount: '34',
      injuryIncidenceOverall: '0.0657',
      injuryIncidenceMatch: '0.3401',
      injuryIncidenceTraining: '0.0168',
      injuryIncidenceCi95: 'overall 0.0562-0.0769',
      injuryMostCommonDiagnosis: 'ACL rupture',
      injuryMostCommonType: 'ligament/joint capsule injury',
      injuryMostCommonLocation: 'knee',
      injuryTissueType_injury_diagnosis_diagnosis: 'ACL rupture',
      injuryTissueType_injury_diagnosis_prevalence: '157',
      injuryTissueType_ligament_joint_capsule_prevalence: '157',
      injuryLocation_knee_prevalence: '157',
    }),
    sourceRow('S107 ankle injuries - 2001/02-2011/12', 'S107', {
      observationDuration: '2001/02-2011/12',
      numberOfSeasons: '11',
      totalExposure: '1057201',
      trainingExposure: '888249',
      matchExposure: '168952',
      injuryTotalCount: '1080',
      injuryTrainingCount: '427',
      injuryMatchCount: '653',
      injuryIncidenceOverall: '1.0',
      injuryTimeLossMedian: '8 (IQR 15)',
      injuryDurationMean: '16 (SD 27)',
      injuryRecurrenceRate: '11%',
      injuryMostCommonDiagnosis: 'ankle sprain',
      injuryMostCommonType: 'joint sprain',
      injuryMostCommonLocation: 'ankle',
      injuryLocation_ankle_prevalence: '1080',
    }),
    sourceRow('S368 isolated syndesmotic ankle injuries - 2001-2016', 'S368', {
      observationDuration: '2001-2016',
      numberOfSeasons: '15',
      sampleSizePlayers: '3677',
      numberOfTeams: '61',
      injuryTotalCount: '94',
      injuryIncidenceOverall: '0.05 (95% CI 0.04-0.06)',
      injuryIncidenceMatch: '0.21 (95% CI 0.16-0.26)',
      injuryBurden: '1.8',
      injuryTimeLossTotal: '3652',
      injuryTimeLossMedian: '34 (IQR 19-52)',
      injuryDurationMean: '39 (SD 28)',
      injuryRecurrenceRate: '7%',
      injuryMostCommonDiagnosis: 'isolated syndesmotic ankle injury',
      injuryMostCommonType: 'joint sprain',
      injuryMostCommonLocation: 'ankle',
      injuryTissueType_injury_diagnosis_diagnosis: 'isolated syndesmotic ankle injury',
      injuryTissueType_injury_diagnosis_prevalence: '94',
      injuryTissueType_ligament_joint_capsule_prevalence: '94',
      injuryLocation_ankle_prevalence: '94',
    }),
    sourceRow('S113 upper extremity injuries - 2001-2011', 'S113', {
      observationDuration: '2001-2011',
      numberOfTeams: '57',
      totalExposure: '1537936',
      trainingExposure: '1306761',
      matchExposure: '231176',
      injuryTotalCount: '355',
      injuryIncidenceOverall: '0.23 (95% CI 0.21-0.26)',
      injuryIncidenceMatch: '0.83 (95% CI 0.73-0.96)',
      injuryIncidenceTraining: '0.12 (95% CI 0.11-0.14)',
      injuryDurationMean: '23 (SD 34)',
      injuryRecurrentTotal: '42',
      injuryRecurrenceRate: '12%',
      injuryMostCommonDiagnosis: 'shoulder/clavicle injury',
      injuryMostCommonLocation: 'upper limb',
      injuryLocation_upper_limb_overall_prevalence: '355',
    }),
    sourceRow('S340 head/neck injuries - 2001/02-2009/10', 'S340', {
      observationDuration: '2001/02-2009/10',
      sampleSizePlayers: '1401',
      numberOfTeams: '26',
      totalExposure: '797389',
      trainingExposure: '669396',
      matchExposure: '127993',
      injuryTotalCount: '136',
      injuryIncidenceOverall: '0.17',
      injuryIncidenceMatch: '0.844',
      injuryIncidenceTraining: '0.042',
      injuryDurationMean: 'head injuries 11.6 (SD 14.3); neck injuries 5.6 (SD 9.3)',
      injuryMostCommonDiagnosis: 'head injury',
      injuryMostCommonLocation: 'head/neck',
      injuryLocation_head_neck_overall_prevalence: '136',
      injuryLocation_head_prevalence: '108',
      injuryLocation_neck_prevalence: '28',
    }),
    sourceRow('S340 concussion - 2001/02-2009/10', 'S340', {
      observationDuration: '2001/02-2009/10',
      injuryTotalCount: '48',
      injuryIncidenceOverall: '0.060 (95% CI 0.045-0.080)',
      injuryIncidenceMatch: '0.352',
      injuryIncidenceTraining: '0.004',
      injuryDurationMean: '10.5 (SD 12.6)',
      injuryMostCommonDiagnosis: 'concussion',
      injuryMostCommonType: 'concussion',
      injuryMostCommonLocation: 'head',
      injuryTissueType_injury_diagnosis_diagnosis: 'concussion',
      injuryTissueType_injury_diagnosis_prevalence: '48',
      injuryTissueType_concussion_prevalence: '48',
      injuryLocation_head_prevalence: '48',
    }),
    sourceRow('S202 stress fractures - ECIS-related cohorts', 'S202', {
      observationDuration: 'ECIS-related cohorts through 2012',
      totalExposure: '1180000',
      injuryTotalCount: '51',
      injuryIncidenceOverall: '0.04',
      injuryRecurrentTotal: '29%',
      injuryMostCommonDiagnosis: 'fifth metatarsal stress fracture',
      injuryMostCommonType: 'bone stress injury',
      injuryMostCommonLocation: 'lower limb',
      injuryTissueType_injury_diagnosis_diagnosis: 'stress fracture',
      injuryTissueType_injury_diagnosis_prevalence: '51',
      injuryTissueType_bone_stress_prevalence: '51',
      injuryLocation_lower_limb_overall_prevalence: '51',
    }),
    sourceRow('S202 fifth metatarsal stress fractures', 'S202', {
      observationDuration: 'ECIS-related cohorts through 2012',
      injuryTotalCount: '40',
      injuryDurationMean: '95 (SD 44); range 35-240',
      injuryMostCommonDiagnosis: 'fifth metatarsal stress fracture',
      injuryMostCommonType: 'bone stress injury',
      injuryMostCommonLocation: 'foot',
      injuryTissueType_injury_diagnosis_diagnosis: 'fifth metatarsal stress fracture',
      injuryTissueType_injury_diagnosis_prevalence: '40',
      injuryTissueType_bone_stress_prevalence: '40',
      injuryLocation_foot_prevalence: '40',
    }),
    sourceRow('S451 fifth metatarsal fractures - 2001-2012', 'S451', {
      observationDuration: '2001-2012',
      sampleSizePlayers: '3487',
      numberOfTeams: '64',
      injuryTotalCount: '67',
      injuryIncidenceOverall: '0.037',
      injuryRecurrentTotal: '22',
      injuryRecurrenceRate: '33%',
      injuryNonContact: '68%',
      injuryMostCommonDiagnosis: 'fifth metatarsal fracture',
      injuryMostCommonType: 'bone fracture',
      injuryMostCommonLocation: 'foot',
      injuryTissueType_injury_diagnosis_diagnosis: 'fifth metatarsal fracture',
      injuryTissueType_injury_diagnosis_prevalence: '67',
      injuryTissueType_bone_fracture_prevalence: '67',
      injuryLocation_foot_prevalence: '67',
    }),
    sourceRow('S091 Achilles tendinopathy - 2001-2011', 'S091', {
      observationDuration: '2001-2011',
      sampleSizePlayers: '1743',
      numberOfTeams: '27',
      totalExposure: '1057201',
      trainingExposure: '888249',
      matchExposure: '168952',
      injuryTotalCount: '194',
      injuryIncidenceOverall: '0.18 (95% CI 0.16-0.21)',
      injuryBurden: '4.24 (95% CI 4.12-4.37)',
      injuryTimeLossMedian: '10 (Q1 4; Q3 24)',
      injuryDurationMean: '23 (SD 37)',
      injuryRecurrentTotal: '53',
      injuryRecurrenceRate: '27%',
      injuryMostCommonDiagnosis: 'Achilles tendinopathy',
      injuryMostCommonType: 'tendinopathy',
      injuryMostCommonLocation: 'lower leg',
      injuryTissueType_injury_diagnosis_diagnosis: 'Achilles tendinopathy',
      injuryTissueType_injury_diagnosis_prevalence: '194',
      injuryTissueType_tendinopathy_prevalence: '194',
      injuryLocation_lower_leg_prevalence: '194',
    }),
    sourceRow('S091 Achilles tendon rupture - 2001-2011', 'S091', {
      observationDuration: '2001-2011',
      injuryTotalCount: '9',
      injuryIncidenceOverall: '0.01 (95% CI 0.00-0.02)',
      injuryBurden: '1.37 (95% CI 1.30-1.44)',
      injuryTimeLossMedian: '169 (Q1 110; Q3 189)',
      injuryDurationMean: '161 (SD 65)',
      injuryRecurrentTotal: '0',
      injuryMostCommonDiagnosis: 'Achilles tendon rupture',
      injuryMostCommonType: 'tendon rupture',
      injuryMostCommonLocation: 'lower leg',
      injuryTissueType_injury_diagnosis_diagnosis: 'Achilles tendon rupture',
      injuryTissueType_injury_diagnosis_prevalence: '9',
      injuryTissueType_tendon_rupture_prevalence: '9',
      injuryLocation_lower_leg_prevalence: '9',
    }),
    sourceRow('S007 indirect thigh muscle injuries - 2001-2013', 'S007', {
      observationDuration: '2001-May 2013',
      sampleSizePlayers: '1981',
      numberOfTeams: '30',
      totalExposure: '1194510',
      trainingExposure: '1003270',
      matchExposure: '191240',
      injuryTotalCount: '1772',
      injuryIncidenceOverall: '1.48',
      injuryIncidenceMatch: '5.56 (95% CI 5.23-5.90)',
      injuryIncidenceTraining: '0.71 (95% CI 0.66-0.76)',
      injuryBurden: '27.5 (95% CI 27.2-27.8)',
      injuryTimeLossMedian: '13',
      injuryDurationMean: '18.5 (SD 19.5)',
      injuryNonContact: '96%',
      injuryRecurrentTotal: '225',
      injuryRecurrenceRate: '12.7%',
      injuryMostCommonDiagnosis: 'indirect thigh muscle injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'indirect thigh muscle injury',
      injuryTissueType_injury_diagnosis_prevalence: '1772',
      injuryTissueType_muscle_injury_prevalence: '1772',
      injuryLocation_thigh_prevalence: '1772',
    }),
    sourceRow('S007 direct thigh muscle contusions - 2001-2013', 'S007', {
      observationDuration: '2001-May 2013',
      injuryTotalCount: '231',
      injuryIncidenceOverall: '0.19',
      injuryIncidenceMatch: '0.92 (95% CI 0.79-1.06)',
      injuryIncidenceTraining: '0.06 (95% CI 0.04-0.07)',
      injuryBurden: '1.4 (95% CI 1.3-1.4)',
      injuryTimeLossMedian: '4',
      injuryDurationMean: '7.0 (SD 9.1)',
      injuryContact: '100%',
      injuryRecurrentTotal: '1',
      injuryRecurrenceRate: '0.4%',
      injuryMostCommonDiagnosis: 'direct thigh muscle contusion',
      injuryMostCommonType: 'muscle contusion',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'direct thigh muscle contusion',
      injuryTissueType_injury_diagnosis_prevalence: '231',
      injuryTissueType_muscle_contusion_prevalence: '231',
      injuryLocation_thigh_prevalence: '231',
    }),
    sourceRow('S011 all injuries benchmark - 2001/02-2011/12', 'S011', {
      observationDuration: '2001/02-2011/12',
      sampleSizePlayers: '1743',
      numberOfTeams: '27',
      totalExposure: '1057201',
      trainingExposure: '888249',
      matchExposure: '168952',
      injuryTotalCount: '8029',
      injuryTrainingCount: '3483',
      injuryMatchCount: '4546',
      injuryIncidenceOverall: '7.6 (95% CI 7.4-7.8)',
      injuryIncidenceMatch: '26.7',
      injuryIncidenceTraining: '4.0',
      injuryMostCommonDiagnosis: 'hamstring muscle injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
    }),
    sourceRow('S011 common injury - hamstring muscle injury', 'S011', {
      observationDuration: '2001/02-2011/12',
      injuryTotalCount: '1025',
      injuryIncidenceOverall: '1.0',
      injuryBurden: '18.2',
      injuryTimeLossMedian: '14 (IQR 15)',
      injuryDurationMean: '19 (SD 18)',
      injuryMostCommonDiagnosis: 'hamstring muscle injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'hamstring muscle injury',
      injuryTissueType_injury_diagnosis_prevalence: '1025',
      injuryTissueType_muscle_injury_prevalence: '1025',
      injuryLocation_thigh_prevalence: '1025',
    }),
    sourceRow('S011 common injury - adductor injury', 'S011', {
      observationDuration: '2001/02-2011/12',
      injuryTotalCount: '742',
      injuryIncidenceOverall: '0.7',
      injuryBurden: '10.3',
      injuryTimeLossMedian: '9 (IQR 12)',
      injuryDurationMean: '15 (SD 19)',
      injuryMostCommonDiagnosis: 'adductor injury',
      injuryMostCommonLocation: 'groin',
      injuryTissueType_injury_diagnosis_diagnosis: 'adductor injury',
      injuryTissueType_injury_diagnosis_prevalence: '742',
    }),
    sourceRow('S011 common injury - quadriceps muscle injury', 'S011', {
      observationDuration: '2001/02-2011/12',
      injuryTotalCount: '404',
      injuryIncidenceOverall: '0.4',
      injuryBurden: '8.1',
      injuryTimeLossMedian: '14 (IQR 17.5)',
      injuryDurationMean: '21 (SD 22)',
      injuryMostCommonDiagnosis: 'quadriceps muscle injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'quadriceps muscle injury',
      injuryTissueType_injury_diagnosis_prevalence: '404',
      injuryTissueType_muscle_injury_prevalence: '404',
      injuryLocation_thigh_prevalence: '404',
    }),
    sourceRow('S011 common injury - calf muscle injury', 'S011', {
      observationDuration: '2001/02-2011/12',
      injuryTotalCount: '362',
      injuryIncidenceOverall: '0.3',
      injuryBurden: '6.5',
      injuryTimeLossMedian: '15 (IQR 17)',
      injuryDurationMean: '19 (SD 16)',
      injuryMostCommonDiagnosis: 'calf muscle injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'lower leg',
      injuryTissueType_injury_diagnosis_diagnosis: 'calf muscle injury',
      injuryTissueType_injury_diagnosis_prevalence: '362',
      injuryTissueType_muscle_injury_prevalence: '362',
      injuryLocation_lower_leg_prevalence: '362',
    }),
    sourceRow('S527 first match after return to play - 2001/02-2016/17', 'S527', {
      observationDuration: '2001/02-2016/17',
      numberOfSeasons: '16',
      sampleSizePlayers: '4088',
      numberOfTeams: '64',
      injuryTotalCount: '219',
      injuryMatchCount: '219',
      injuryIncidenceMatch: '46.9 (95% CI 41.0-53.5)',
      injuryMostCommonDiagnosis: 'secondary injury in first match after return to play',
      injuryMostCommonType: 'muscle injury',
      injuryTissueType_injury_diagnosis_diagnosis: 'first-match-after-RTP secondary injury',
      injuryTissueType_injury_diagnosis_prevalence: '219',
    }),
    sourceRow('S581 index injury RTP - ankle lateral ligament injury', 'S581', {
      observationDuration: '2001-2017',
      numberOfSeasons: '16',
      injuryTotalCount: '1260',
      injuryDurationMean: '14.9',
      injuryTimeLossMedian: '8',
      injuryRecurrenceRate: '13.7%',
      injuryMostCommonDiagnosis: 'ankle lateral ligament injury',
      injuryMostCommonType: 'joint sprain',
      injuryMostCommonLocation: 'ankle',
      injuryTissueType_injury_diagnosis_diagnosis: 'ankle lateral ligament injury',
      injuryTissueType_injury_diagnosis_prevalence: '1260',
      injuryTissueType_ligament_joint_capsule_prevalence: '1260',
      injuryLocation_ankle_prevalence: '1260',
    }),
    sourceRow('S581 index injury RTP - knee MCL injury', 'S581', {
      observationDuration: '2001-2017',
      injuryTotalCount: '760',
      injuryDurationMean: '24.6',
      injuryTimeLossMedian: '16',
      injuryRecurrenceRate: '10.3%',
      injuryMostCommonDiagnosis: 'knee MCL injury',
      injuryMostCommonType: 'ligament/joint capsule injury',
      injuryMostCommonLocation: 'knee',
      injuryTissueType_injury_diagnosis_diagnosis: 'knee MCL injury',
      injuryTissueType_injury_diagnosis_prevalence: '760',
      injuryTissueType_ligament_joint_capsule_prevalence: '760',
      injuryLocation_knee_prevalence: '760',
    }),
    sourceRow('S581 index injury RTP - knee ACL injury', 'S581', {
      observationDuration: '2001-2017',
      injuryTotalCount: '183',
      injuryDurationMean: '210.2',
      injuryTimeLossMedian: '205',
      injuryRecurrenceRate: '6.6%',
      injuryMostCommonDiagnosis: 'knee ACL injury',
      injuryMostCommonType: 'ligament/joint capsule injury',
      injuryMostCommonLocation: 'knee',
      injuryTissueType_injury_diagnosis_diagnosis: 'knee ACL injury',
      injuryTissueType_injury_diagnosis_prevalence: '183',
      injuryTissueType_ligament_joint_capsule_prevalence: '183',
      injuryLocation_knee_prevalence: '183',
    }),
    sourceRow('S581 index injury RTP - hamstring structural injury', 'S581', {
      observationDuration: '2001-2017',
      injuryTotalCount: '2379',
      injuryDurationMean: '18.0',
      injuryTimeLossMedian: '13',
      injuryRecurrenceRate: '17.5%',
      injuryMostCommonDiagnosis: 'hamstring structural injury',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_injury_diagnosis_diagnosis: 'hamstring structural injury',
      injuryTissueType_injury_diagnosis_prevalence: '2379',
      injuryTissueType_muscle_injury_prevalence: '2379',
      injuryLocation_thigh_prevalence: '2379',
    }),
  ];
}

function buildS068Rows() {
  const common = {
    leadAuthor: 'Bengtsson H',
    title: 'Injury epidemiology in professional football in South America compared with Europe',
    yearOfPublication: '2021',
    journal: 'BMJ Open Sport & Exercise Medicine',
    doi: '10.1136/bmjsem-2021-001172',
    studyDesign: 'prospective cohort comparison',
  };
  return [
    sourceRow('South America Copa Libertadores cohort - 2016', 'S068', {
      ...common,
      country: 'South America (Brazil, Argentina, Chile)',
      observationDuration: '2016',
      numberOfSeasons: '1',
      numberOfTeams: '6',
      totalExposure: '55065',
      trainingExposure: '49699',
      matchExposure: '5366',
      injuryTotalCount: '271',
      injuryTrainingCount: '159',
      injuryMatchCount: '112',
      injuryIncidenceOverall: '4.9 (95% CI 4.4-5.5)',
      injuryIncidenceTraining: '3.2 (95% CI 2.7-3.7)',
      injuryIncidenceMatch: '20.9 (95% CI 17.3-25.1)',
      injuryTimeLossMedian: '9 (IQR 4-18)',
      injuryModeAcuteSudden: '155',
      injuryModeRepetitiveGradual: '116',
      injuryContact: '64',
      injuryNonContact: '207',
      injuryRecurrentTotal: '27',
      injuryRecurrenceRate: '10%',
      injuryMostCommonType: 'muscle injury',
      injuryTissueType_muscle_injury_prevalence: '120',
      injuryTissueType_muscle_injury_incidence: '2.2 (95% CI 1.8-2.6)',
      injuryTissueType_ligament_joint_capsule_prevalence: '55',
      injuryTissueType_ligament_joint_capsule_incidence: '1.0 (95% CI 0.8-1.3)',
    }, { country: 'South America (Brazil, Argentina, Chile)' }),
    sourceRow('European ECIS comparator cohort - 2015/16-2016/17', 'S068', {
      ...common,
      observationDuration: '2015/2016 and 2016/2017',
      numberOfTeams: '43 team-seasons',
      totalExposure: '307721',
      trainingExposure: '261858',
      matchExposure: '45863',
      injuryTotalCount: '1614',
      injuryTrainingCount: '681',
      injuryMatchCount: '933',
      injuryIncidenceOverall: '5.2 (95% CI 5.0-5.5)',
      injuryIncidenceTraining: '2.6 (95% CI 2.4-2.8)',
      injuryIncidenceMatch: '20.3 (95% CI 19.1-21.7)',
      injuryTimeLossMedian: '11 (IQR 5-22)',
      injuryModeAcuteSudden: '1008',
      injuryModeRepetitiveGradual: '605',
      injuryContact: '461',
      injuryNonContact: '1152',
      injuryRecurrentTotal: '135',
      injuryRecurrenceRate: '8%',
      injuryMostCommonType: 'muscle injury',
      injuryTissueType_muscle_injury_prevalence: '761',
      injuryTissueType_muscle_injury_incidence: '2.5 (95% CI 2.3-2.7)',
      injuryTissueType_ligament_joint_capsule_prevalence: '247',
      injuryTissueType_ligament_joint_capsule_incidence: '0.8 (95% CI 0.7-0.9)',
    }),
  ];
}

function buildS109Rows() {
  return [
    sourceRow('UEFA European Championships pooled tournaments - 2006-2008', 'S109', {
      leadAuthor: 'Hagglund M',
      title: 'UEFA injury study: an injury audit of European Championships 2006 to 2008',
      yearOfPublication: '2009',
      journal: 'British Journal of Sports Medicine',
      doi: '10.1136/bjsm.2008.056937',
      studyDesign: 'prospective tournament injury audit',
      country: 'Europe (UEFA tournaments)',
      levelOfPlay: 'International elite',
      sex: 'Mixed',
      ageCategory: 'Senior and youth',
      observationDuration: 'European Championships 2006-2008',
      numberOfSeasons: '12 tournaments',
      sampleSizePlayers: '2027',
      numberOfTeams: '104',
      totalExposure: '21729',
      trainingExposure: '15187',
      matchExposure: '6542',
      injuryTotalCount: '224',
      injuryPlayersCompletedStudy: '208 injured players',
      injuryTimeLossCount: '224',
      injuryTrainingCount: '45',
      injuryMatchCount: '179',
      injuryDurationMean: '13.4 (SD 26.3)',
      injuryModeAcuteSudden: '170',
      injuryModeRepetitiveGradual: '54',
      injuryContact: '125',
      injuryNonContact: '45',
      injuryRecurrentTotal: '20',
      injuryRecurrenceRate: '9%',
      injuryMostCommonDiagnosis: 'muscle strain/rupture',
      injuryMostCommonType: 'muscle injury',
      injuryMostCommonLocation: 'thigh',
      injuryTissueType_muscle_injury_prevalence: '60',
      injuryTissueType_superficial_contusion_prevalence: '58',
      injuryTissueType_ligament_joint_capsule_prevalence: '55',
      injuryTissueType_tendinopathy_prevalence: '15',
      injuryTissueType_concussion_prevalence: '7',
      injuryTissueType_bone_fracture_prevalence: '8',
      injuryTissueType_bone_stress_prevalence: '1',
      injuryTissueType_laceration_prevalence: '4',
      injuryLocation_head_neck_overall_prevalence: '15',
      injuryLocation_upper_limb_overall_prevalence: '13',
      injuryLocation_trunk_overall_prevalence: '10',
      injuryLocation_groin_prevalence: '28',
      injuryLocation_thigh_prevalence: '48',
      injuryLocation_knee_prevalence: '35',
      injuryLocation_lower_leg_prevalence: '24',
      injuryLocation_ankle_prevalence: '43',
      injuryLocation_foot_prevalence: '8',
    }, {
      country: 'Europe (UEFA tournaments)',
      levelOfPlay: 'International elite',
      sex: 'Mixed',
      ageCategory: 'Senior and youth',
    }),
  ];
}

async function main() {
  const onlyWecis = process.argv.includes('--only-wecis');
  const onlyEcis = process.argv.includes('--only-ecis');
  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let wecisResult = null;
  if (!onlyEcis) {
    const s112 = await loadPaperByStudyId(supabase, 'S112');
    const s112Fields = await loadFilledFieldMap(supabase, s112.id);
    const wecisRows = buildWecisRows(s112Fields, 'S112');

    wecisResult = await rebuildMaster(
      supabase,
      s112,
      wecisRows,
      'S112',
      {
        uefaWecis: true,
        wecisSourceOfTruth: true,
        sourceControl: 'S112 WECIS source-of-truth record; Table 2 is extracted as Total plus four season rows. Tables 3 and 4 are extracted to structured location/type tabs on the Total row with numeric-only metric cells; non-additive parent incidence/burden cells are left blank.',
      },
      { status: 'extracted' },
    );
  }

  let ecisResult = null;
  let ownWorkspace = null;

  if (!onlyWecis) {
    const ecisMaster = await loadPaperByStudyId(supabase, 'UEFA-ECIS-MASTER');
    const s200 = await loadPaperByStudyId(supabase, 'S200');
    const s200Fields = await loadFilledFieldMap(supabase, s200.id);
    const ecisRows = process.env.USE_LEGACY_UEFA_ECIS_ROWS === '1'
      ? [
          {
            label: 'S200 ECIS men all injuries anchor - 2001/02-2018/19',
            sourceId: 'S200',
            fields: { ...s200Fields, studyId: 'UEFA-ECIS-MASTER' },
          },
          ...buildEcisSupplementRows(),
        ]
      : buildRefinedEcisRows(s200Fields);
    ecisResult = await rebuildMaster(supabase, ecisMaster, ecisRows, 'UEFA-ECIS-MASTER', {
      sourceControl: 'S200 all-injury anchor plus refined ECIS concept rows. Supplement papers are live only when they add incidence, burden, time-loss, recurrence, mechanism, or exposure detail not cleanly captured by the all-injury anchor. Source-only diagnosis count rows are audit-only to reduce duplicate counting.',
    });

    if (!onlyEcis) {
      const s068 = await loadPaperByStudyId(supabase, 'S068');
      const s109 = await loadPaperByStudyId(supabase, 'S109');
      const s111 = await loadPaperByStudyId(supabase, 'S111');

      ownWorkspace = {
        S068: await applyRowsAdditive(supabase, s068, buildS068Rows(), 'processing'),
        S109: await applyRowsAdditive(supabase, s109, buildS109Rows(), 'processing'),
        S111: await applyRowsAdditive(supabase, s111, [], 'processing'),
      };
    }
  }

  console.log(JSON.stringify({
    rebuiltMasters: {
      'UEFA-ECIS-MASTER': ecisResult,
      S112: wecisResult,
    },
    ownWorkspace,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
