import crypto from 'node:crypto';
import fs from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const envPath = '.env.local';

const tabByFieldId = new Map([
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
injuryOutcomeFields.forEach((fieldId) => tabByFieldId.set(fieldId, 'injuryOutcome'));

const metricSuffixes = ['diagnosis', 'prevalence', 'incidence', 'burden', 'severityMeanDays', 'severityTotalDays'];
for (const suffix of metricSuffixes) {
  tabByFieldId.set(`injuryTissueType_injury_diagnosis_${suffix}`, 'injuryTissueType');
  tabByFieldId.set(`injuryLocation_thigh_${suffix}`, 'injuryLocation');
}

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function sourceQuote(sourceId, role, note = '') {
  return [`UEFA master extraction provenance: ${role}; source ${sourceId}; value entered directly from source/live source extraction.`, note]
    .filter(Boolean)
    .join(' ');
}

async function loadPaperByStudyId(supabase, studyId) {
  const { data, error } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,status,metadata')
    .eq('assigned_study_id', studyId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Missing paper ${studyId}: ${error?.message ?? 'not found'}`);
  }
  return data;
}

async function loadFilledFields(supabase, paperId) {
  const { data, error } = await supabase
    .from('extractions')
    .select('tab,extraction_fields(field_id,value,status,metric,page_hint,source_quote)')
    .eq('paper_id', paperId);
  if (error) {
    throw new Error(`Failed to load extractions for ${paperId}: ${error.message}`);
  }

  const rows = [];
  for (const extraction of data ?? []) {
    for (const field of extraction.extraction_fields ?? []) {
      if (typeof field.value !== 'string' || !field.value.trim()) continue;
      rows.push({
        tab: extraction.tab,
        fieldId: field.field_id,
        value: field.value.trim(),
        metric: field.metric ?? null,
      });
    }
  }
  return rows;
}

async function clearMasterExtractions(supabase, paperId) {
  const { data: extractionRows, error } = await supabase
    .from('extractions')
    .select('id')
    .eq('paper_id', paperId);
  if (error) throw new Error(`Failed to load master extractions: ${error.message}`);

  const extractionIds = (extractionRows ?? []).map((row) => row.id);
  if (extractionIds.length > 0) {
    const { error: fieldError } = await supabase.from('extraction_fields').delete().in('extraction_id', extractionIds);
    if (fieldError) throw new Error(`Failed to clear extraction fields: ${fieldError.message}`);
    const { error: extractionError } = await supabase.from('extractions').delete().in('id', extractionIds);
    if (extractionError) throw new Error(`Failed to clear extractions: ${extractionError.message}`);
  }

  await supabase.from('population_values').delete().eq('paper_id', paperId);
  await supabase.from('population_groups').delete().eq('paper_id', paperId);
}

async function ensureExtraction(supabase, paperId, tab) {
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
  return data.id;
}

async function insertFields(supabase, paperId, fields) {
  const byTab = new Map();
  for (const field of fields) {
    const tab = field.tab ?? tabByFieldId.get(field.fieldId);
    if (!tab) throw new Error(`No tab mapping for field ${field.fieldId}`);
    const current = byTab.get(tab) ?? [];
    current.push(field);
    byTab.set(tab, current);
  }

  for (const [tab, tabFields] of byTab.entries()) {
    const extractionId = await ensureExtraction(supabase, paperId, tab);
    const now = new Date().toISOString();
    const rows = tabFields.map((field) => ({
      id: crypto.randomUUID(),
      extraction_id: extractionId,
      field_id: field.fieldId,
      value: field.value,
      confidence: field.confidence ?? 0.95,
      source_quote: field.sourceQuote ?? null,
      page_hint: field.pageHint ?? null,
      metric: field.metric ?? null,
      status: 'reported',
      updated_at: now,
      updated_by: null,
    }));
    const { error } = await supabase.from('extraction_fields').insert(rows);
    if (error) throw new Error(`Failed to insert ${tab} fields: ${error.message}`);
  }
}

async function insertSinglePopulationGroup(supabase, paperId, label, sourceFields) {
  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: groupError } = await supabase.from('population_groups').insert({
    id: groupId,
    paper_id: paperId,
    tab: 'participantCharacteristics',
    label,
    position: 0,
    created_at: now,
    updated_at: now,
  });
  if (groupError) throw new Error(`Failed to insert population group: ${groupError.message}`);

  const rows = sourceFields
    .filter((field) => typeof field.value === 'string' && field.value.trim())
    .map((field) => ({
      id: crypto.randomUUID(),
      population_group_id: groupId,
      paper_id: paperId,
      field_id: field.fieldId,
      value: field.value,
      metric: field.metric ?? null,
      unit: null,
      source_field_id: field.fieldId,
      created_at: now,
      updated_at: now,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from('population_values').insert(rows);
    if (error) throw new Error(`Failed to insert population values: ${error.message}`);
  }
}

function overrideStudyDetails(fields, masterStudyId) {
  return fields.map((field) => field.fieldId === 'studyId' ? { ...field, value: masterStudyId } : field);
}

function withProvenance(fields, sourceId, role) {
  return fields.map((field) => ({
    ...field,
    sourceQuote: sourceQuote(sourceId, role),
    pageHint: `${sourceId}; ${role}; copied from existing live source extraction`,
  }));
}

function manualWecisFields() {
  const role = 'WECIS women all-injury anchor';
  const pageHint = 'S112 abstract/page 1; source text reviewed from local extracted PDF text';
  const q = (note) => sourceQuote('S112', role, note);
  return [
    { fieldId: 'studyDesign', value: 'prospective cohort', sourceQuote: q('Study procedure describes prospective surveillance.'), pageHint },
    { fieldId: 'sampleSizePlayers', value: '596', sourceQuote: q('Abstract reports 596 players.'), pageHint },
    { fieldId: 'numberOfTeams', value: '15', sourceQuote: q('Abstract reports 15 elite women teams.'), pageHint },
    { fieldId: 'numberOfSeasons', value: '4', sourceQuote: q('Four seasons, 2018/2019 to 2021/2022.'), pageHint },
    { fieldId: 'injuryDefinition', value: 'time-loss', sourceQuote: q('Abstract and methods report time-loss injuries.'), pageHint },
    { fieldId: 'incidenceDefinition', value: 'injuries per 1000 player-hours', sourceQuote: q('Incidence calculated per 1000 playing hours.'), pageHint },
    { fieldId: 'burdenDefinition', value: 'days lost per 1000 player-hours', sourceQuote: q('Burden calculated as days lost per 1000 hours.'), pageHint },
    { fieldId: 'mechanismReporting', value: 'Medical Staff', sourceQuote: q('Medical staff recorded exposure and injuries.'), pageHint },
    { fieldId: 'exposureMeasurementUnit', value: 'hours', sourceQuote: q('Incidence denominator is playing hours.'), pageHint },
    { fieldId: 'injuryTotalCount', value: '1527', sourceQuote: q('Abstract reports 1527 injuries.'), pageHint },
    { fieldId: 'injuryPlayersCompletedStudy', value: '596', sourceQuote: q('Same directly reported cohort denominator as players studied.'), pageHint },
    { fieldId: 'injuryTeamsCompletedStudy', value: '15', sourceQuote: q('Same directly reported cohort denominator as teams studied.'), pageHint },
    { fieldId: 'injuryTimeLossCount', value: '1527', sourceQuote: q('The reported injuries are time-loss injuries by definition.'), pageHint },
    { fieldId: 'injuryIncidenceOverall', value: '6.7', sourceQuote: q('Abstract reports 6.7 injuries per 1000 hours.'), pageHint },
    { fieldId: 'injuryIncidenceMatch', value: '18.4', sourceQuote: q('Abstract reports 18.4 match injuries per 1000 hours.'), pageHint },
    { fieldId: 'injuryIncidenceTraining', value: '4.8', sourceQuote: q('Abstract reports 4.8 training injuries per 1000 hours.'), pageHint },
    { fieldId: 'injuryIncidenceCi95', value: 'overall 6.4-7.0; match 16.9-19.9; training 4.5-5.1', sourceQuote: q('95% CIs reported with overall, match, and training incidence.'), pageHint },
    { fieldId: 'injuryMostCommonDiagnosis', value: 'hamstring muscle injury', sourceQuote: q('Abstract reports hamstring muscle injuries were most frequent.'), pageHint },
    { fieldId: 'injuryMostCommonType', value: 'muscle injury', sourceQuote: q('Hamstring and quadriceps muscle injuries were the most frequent injury diagnoses.'), pageHint },
    { fieldId: 'injuryMostCommonLocation', value: 'thigh', sourceQuote: q('Abstract reports hamstring and quadriceps thigh muscle injuries as most frequent.'), pageHint },
    { fieldId: 'injuryTissueType_injury_diagnosis_diagnosis', value: 'hamstring muscle injury\nquadriceps muscle injury\nACL injury\nconcussion', sourceQuote: q('Diagnosis rows are direct headline diagnosis details from abstract.'), pageHint, tab: 'injuryTissueType' },
    { fieldId: 'injuryTissueType_injury_diagnosis_prevalence', value: '188\n171\n\n47', sourceQuote: q('Counts reported directly for hamstring, quadriceps, and concussion; ACL only reported as 2%, so count left blank.'), pageHint, metric: 'prevalence', tab: 'injuryTissueType' },
    { fieldId: 'injuryTissueType_injury_diagnosis_burden', value: '\n\n38.0 (IQR 29.2-52.1)\n', sourceQuote: q('ACL burden directly reported; other diagnosis burdens not in abstract.'), pageHint, metric: 'burden', tab: 'injuryTissueType' },
  ];
}

async function main() {
  const env = loadEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const ecisMaster = await loadPaperByStudyId(supabase, 'UEFA-ECIS-MASTER');
  const s200 = await loadPaperByStudyId(supabase, 'S200');

  await clearMasterExtractions(supabase, ecisMaster.id);

  const s200Fields = overrideStudyDetails(
    withProvenance(await loadFilledFields(supabase, s200.id), 'S200', 'ECIS men all-injury anchor'),
    'UEFA-ECIS-MASTER',
  );
  await insertFields(supabase, ecisMaster.id, s200Fields);
  await insertSinglePopulationGroup(
    supabase,
    ecisMaster.id,
    'ECIS men all injuries - 2001/02-2018/19',
    s200Fields.filter((field) => ['sex', 'ageCategory', 'sampleSizePlayers', 'numberOfTeams', 'observationDuration', 'numberOfSeasons', 'totalExposure'].includes(field.fieldId)),
  );

  const now = new Date().toISOString();
  const metadata = {
    ...(ecisMaster.metadata ?? {}),
    anchorExtractionAppliedAt: now,
    anchorExtractionMethod: 'Direct Supabase script; S200 anchor values only; supplements require separate review.',
  };
  await supabase.from('papers').update({ metadata, updated_at: now }).eq('id', ecisMaster.id);

  console.log(JSON.stringify({
    updated: [
      { assignedStudyId: 'UEFA-ECIS-MASTER', paperId: ecisMaster.id, source: 'S200', fields: s200Fields.length },
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
