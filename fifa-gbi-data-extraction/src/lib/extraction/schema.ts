import { z } from 'zod';

import type {
  ExtractionFieldMetric,
  ExtractionFieldResult,
  ExtractionTab,
} from '@/lib/types';

export type ExtractionFieldDefinition = {
  id: string;
  label: string;
  description: string;
  tab: ExtractionTab;
  metric?: ExtractionFieldMetric;
  groupId?: string;
  groupLabel?: string;
};

// ---------------------------------------------------------------------------
// AI-assisted tabs (Tabs 1–4)
// ---------------------------------------------------------------------------
const aiFieldDefinitions: ExtractionFieldDefinition[] = [
  // Tab 1 – Study Details
  {
    id: 'studyId',
    label: 'Study ID',
    description: 'Study IDs are assigned automatically by the system; leave blank unless manually overriding.',
    tab: 'studyDetails',
  },
  {
    id: 'leadAuthor',
    label: 'Lead Author',
    description: 'Primary author surname and initials as reported.',
    tab: 'studyDetails',
  },
  {
    id: 'title',
    label: 'Title',
    description: 'Full study title exactly as published.',
    tab: 'studyDetails',
  },
  {
    id: 'yearOfPublication',
    label: 'Year of Publication',
    description: 'Publication year (numeric, four digits).',
    tab: 'studyDetails',
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'Journal name as printed in the source.',
    tab: 'studyDetails',
  },
  {
    id: 'doi',
    label: 'DOI',
    description: 'Digital Object Identifier if available.',
    tab: 'studyDetails',
  },
  {
    id: 'studyDesign',
    label: 'Study Design',
    description: 'Study design classification. Return standardized value: "prospective cohort" | "retrospective cohort" | "cross-sectional" | "case series" | "case-control" | "other".',
    tab: 'studyDetails',
  },
  // Tab 2 – Participant Characteristics
  {
    id: 'fifaDiscipline',
    label: 'FIFA Discipline',
    description: 'Football discipline. Return standardized value: "Association football (11-a-side)" | "Futsal" | "Beach soccer" | "Para football".',
    tab: 'participantCharacteristics',
  },
  {
    id: 'country',
    label: 'Country',
    description: 'Country or region represented in the study.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'levelOfPlay',
    label: 'Level of Play',
    description: 'Competitive level. Examples: "amateur" | "semi-professional" | "professional". Extract as reported in the paper.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'sex',
    label: 'Sex',
    description:
      'Sex of participants. DEFINES POPULATIONS. Enter identifiers only: "male\\nfemale". Other fields use same line order for their values.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'ageCategory',
    label: 'Age Category',
    description:
      'Age group. DEFINES POPULATIONS. Enter identifiers only: "U19\\nU21". Examples: U19, U21, U16, Youth, Senior, etc. Other fields use same line order for their values.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'meanAge',
    label: 'Mean age (±SD) or range',
    description:
      'Mean age ± SD. Extract VALUE ONLY (no "years" unit). For multiple populations: "16.8 ± 0.9\\n20.1 ± 0.3". Line 1 = Pop 1, Line 2 = Pop 2.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'sampleSizePlayers',
    label: 'Sample Size (players)',
    description:
      'Number of players. Extract NUMERIC VALUE ONLY (no labels). For multiple populations: "62\\n60" (NOT "male: 62\\nfemale: 60"). Match line order from Sex or Age Category.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'numberOfTeams',
    label: 'Number of teams/clubs',
    description:
      'Teams or clubs participating. Use one line per population; commas stay within the line for additional detail.',
    tab: 'participantCharacteristics',
  },
  {
    id: 'observationDuration',
    label: 'Observation duration',
    description:
      'Observation window as reported. Extract VALUE ONLY (no population labels). For multiple populations: "4 seasons\\n3 seasons" (NOT "U19: 4 seasons").',
    tab: 'participantCharacteristics',
  },
  // Tab 3 – Definition & Data Collection
  {
    id: 'injuryDefinition',
    label: 'Injury Definition',
    description: 'Definition used for injury. Return standardized value: "medical attention" | "time-loss" | "medical attention or time-loss" only.',
    tab: 'definitions',
  },
  {
    id: 'illnessDefinition',
    label: 'Illness Definition',
    description: 'Definition used for illness. Return standardized value: "medical attention" | "time-loss" | "medical attention or time-loss" only.',
    tab: 'definitions',
  },
  {
    id: 'incidenceDefinition',
    label: 'Incidence Definition',
    description: 'How incidence was defined.',
    tab: 'definitions',
  },
  {
    id: 'burdenDefinition',
    label: 'Burden Definition',
    description: 'Definition for burden metrics.',
    tab: 'definitions',
  },
  {
    id: 'severityDefinition',
    label: 'Severity Definition',
    description: 'Definition for injury severity categories.',
    tab: 'definitions',
  },
  {
    id: 'recurrenceDefinition',
    label: 'Recurrence Definition',
    description: 'Definition for recurrent injuries.',
    tab: 'definitions',
  },
  {
    id: 'mechanismReporting',
    label: 'Who reported the data',
    description: 'Who reported the injury data. Examples: Medical Staff, Coach, Player-selfreported. Return standardized value if applicable: "Medical Staff" | "Coach" | "Player-selfreported" | "other" | free text if not matching.',
    tab: 'definitions',
  },
  // Tab 4 – Exposure Data
  {
    id: 'seasonLength',
    label: 'Length of season/tournament (weeks)',
    description:
      'Duration in weeks. Extract NUMERIC VALUE ONLY (no "weeks" unit). Use one line per population/tournament when multiple groups are reported.',
    tab: 'exposure',
  },
  {
    id: 'numberOfSeasons',
    label: 'Number of seasons',
    description:
      'Total number of seasons. Extract NUMERIC VALUE ONLY (no population labels). For multiple populations: "4\\n3" (NOT "U19: 4\\nU21: 3").',
    tab: 'exposure',
  },
  {
    id: 'exposureMeasurementUnit',
    label: 'Exposure Measurement (unit)',
    description: 'Unit used for exposure. Return standardized value: "hours" | "player-hours" | "athlete-exposures" | "match-exposures" | "sessions" | "other".',
    tab: 'exposure',
  },
  {
    id: 'totalExposure',
    label: 'Total Exposure',
    description: 'Total exposure value. Extract NUMERIC VALUE ONLY (no units). Units captured in exposureMeasurementUnit field.',
    tab: 'exposure',
  },
  {
    id: 'matchExposure',
    label: 'Match Exposure',
    description: 'Match exposure value. Extract NUMERIC VALUE ONLY (no units). Units captured in exposureMeasurementUnit. One line per population if splits exist.',
    tab: 'exposure',
  },
  {
    id: 'trainingExposure',
    label: 'Training Exposure',
    description: 'Training exposure value. Extract NUMERIC VALUE ONLY (no units). Units captured in exposureMeasurementUnit. Match line order from other population fields.',
    tab: 'exposure',
  },
];

// ---------------------------------------------------------------------------
// Manual tabs (Tabs 5–7)
// ---------------------------------------------------------------------------
const injuryOutcomeDefinitions: ExtractionFieldDefinition[] = [
  {
    id: 'injuryTotalCount',
    label: 'Total number of injuries',
    description: 'Total count of injuries. Extract NUMERIC VALUE ONLY (no labels or units). For multiple populations: "150\\n120" (NOT "male: 150").',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryPlayersCompletedStudy',
    label: 'Number of players that completed the study',
    description: 'Enter the number of players who completed the study (equals sample size unless withdrawals occurred).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTeamsCompletedStudy',
    label: 'Number of teams that completed the study',
    description: 'Enter the number of teams who completed the study (equals number of teams sampled unless withdrawals occurred).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMedicalAttentionCount',
    label: 'Total medical attention injuries',
    description: 'If the study separates medical-attention-only injuries, enter that count (otherwise repeat total injuries).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTimeLossCount',
    label: 'Total time-loss injuries',
    description: 'If the study separates time-loss injuries, enter that count (otherwise repeat total injuries).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMatchCount',
    label: 'Total match injuries',
    description: 'Injuries that occurred during matches. For multiple populations, enter each on a new line.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMatchMedicalAttentionCount',
    label: 'Medical attention match injuries',
    description: 'If the study separates medical-attention-only match injuries, enter that count (otherwise repeat total match injuries).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMatchTimeLossCount',
    label: 'Time-loss match injuries',
    description: 'If the study separates time-loss match injuries, enter that count (otherwise repeat total match injuries).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTrainingCount',
    label: 'Total training injuries',
    description: 'Injuries that occurred during training. For multiple populations, enter each on a new line.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTrainingMedicalAttentionCount',
    label: 'Medical attention training injuries',
    description: 'If the study separates medical-attention-only training injuries, enter that count (otherwise repeat total training injuries).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTrainingTimeLossCount',
    label: 'Time-loss training injuries',
    description: 'If the study separates time-loss training injuries, enter that count (otherwise repeat total training injuries).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceOverall',
    label: 'Injury incidence (overall)',
    description:
      'Overall injury incidence rate for the primary definition used in the paper. Extract NUMERIC VALUE ONLY (no population labels or units). For multiple populations: "3.2\\n2.8" (NOT "U19: 3.2"). If the study uses a medical-attention definition AND separately reports time-loss incidence, enter the medical-attention rate here and put the time-loss rate in "injuryIncidenceTimeLossOverall".',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceMatch',
    label: 'Match injury incidence',
    description:
      'Match injury incidence rate using the study’s primary definition. For multiple populations, enter each on a new line. If the paper uses a medical-attention definition and provides a second (time-loss) match incidence, record the medical-attention rate here and the time-loss rate in "injuryIncidenceTimeLossMatch".',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceTraining',
    label: 'Training injury incidence',
    description:
      'Training injury incidence rate using the study’s primary definition. For multiple populations, enter each on a new line. If the paper uses a medical-attention definition and provides a second (time-loss) training incidence, record the medical-attention rate here and the time-loss rate in "injuryIncidenceTimeLossTraining".',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceTimeLossOverall',
    label: 'Injury incidence (time-loss only, overall)',
    description:
      'Overall time-loss injury incidence rate. ONLY fill this in when the study states it used a medical-attention definition but still reports a separate time-loss incidence. Otherwise leave blank.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceTimeLossMatch',
    label: 'Match injury incidence (time-loss only)',
    description:
      'Match injury incidence rate for time-loss-only cases. Only fill in when the paper uses a medical-attention definition and separately reports time-loss match incidence. Otherwise leave blank.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceTimeLossTraining',
    label: 'Training injury incidence (time-loss only)',
    description:
      'Training injury incidence rate for time-loss-only cases. Only fill in when the paper uses a medical-attention definition and separately reports time-loss training incidence. Otherwise leave blank.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryIncidenceCi95',
    label: 'Injury incidence 95% CI',
    description: 'Reported 95% confidence interval for injury incidence.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTimeLossTotal',
    label: 'Total time-loss due to injury',
    description: 'Total time-loss due to injuries.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTimeLossMedian',
    label: 'Median time-loss',
    description: 'Median time-loss reported for injuries.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryTimeLossMean',
    label: 'Mean time-loss',
    description: 'Mean time-loss reported for injuries.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryBurden',
    label: 'Injury burden',
    description: 'Reported injury burden metric.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryBurdenCi95',
    label: 'Injury burden 95% CI',
    description: '95% confidence interval for injury burden.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMostCommonDiagnosis',
    label: 'Most common injury diagnosis',
    description: 'Specific injury diagnosis reported as most common (e.g., hamstring strain).',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMostCommonType',
    label: 'Most common injury type',
    description: 'Most common type of injury reported.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMostCommonLocation',
    label: 'Most common injury location',
    description: 'Most common anatomical location for injuries.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryMostCommonSeverity',
    label: 'Most common injury severity class',
    description: 'Most common injury severity classification.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryModeRepetitiveGradual',
    label: 'Mode of onset – Repetitive gradual',
    description: 'Number of repetitive gradual onset injuries reported. Extract NUMERIC COUNT ONLY.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryModeRepetitiveSudden',
    label: 'Mode of onset – Repetitive sudden',
    description: 'Number of repetitive sudden onset injuries reported. Extract NUMERIC COUNT ONLY.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryModeAcuteSudden',
    label: 'Mode of onset – Acute sudden',
    description: 'Number of acute sudden onset injuries reported. Extract NUMERIC COUNT ONLY.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryContact',
    label: 'Contact',
    description: 'Number of contact-related injuries reported. Extract NUMERIC COUNT ONLY.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryNonContact',
    label: 'Non-contact',
    description: 'Number of non-contact injuries reported. Extract NUMERIC COUNT ONLY.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryCumulativeRepetitive',
    label: 'Cumulative (repetitive)',
    description: 'Number of cumulative repetitive injuries reported. Extract NUMERIC COUNT ONLY.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryDurationMedian',
    label: 'Median injury duration',
    description: 'Median duration of injuries.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryDurationMean',
    label: 'Mean injury duration (±SD)',
    description: 'Mean duration of injuries with SD.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryRecurrentTotal',
    label: 'Total recurrent injuries',
    description: 'Count of recurrent injuries.',
    tab: 'injuryOutcome',
  },
  {
    id: 'injuryRecurrenceRate',
    label: 'Recurrence rate (%)',
    description: 'Injury recurrence rate. Extract with % symbol: "15.2%" (NOT "15.2").',
    tab: 'injuryOutcome',
  },
];

const illnessOutcomeDefinitions: ExtractionFieldDefinition[] = [
  {
    id: 'illnessTotalCount',
    label: 'Total number of illnesses',
    description: 'Total count of illnesses. Extract NUMERIC VALUE ONLY (no population labels). For multiple populations: "45\\n38" (NOT "U19: 45").',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessPlayersCompletedStudy',
    label: 'Number of players that completed the study',
    description: 'Enter the number of players who completed the study (equals sample size unless withdrawals occurred).',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessTeamsCompletedStudy',
    label: 'Number of teams that completed the study',
    description: 'Enter the number of teams who completed the study (equals number of teams sampled unless withdrawals occurred).',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessMatchCount',
    label: 'Number of match illnesses',
    description: 'Illnesses that occurred around matches. For multiple populations, enter each on a new line.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessTrainingCount',
    label: 'Number of training illnesses',
    description: 'Illnesses that occurred during training. For multiple populations, enter each on a new line.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessIncidenceOverall',
    label: 'Illness incidence (overall)',
    description: 'Overall illness incidence rate. Extract NUMERIC VALUE ONLY (no population labels or units). For multiple populations: "2.1\\n1.8".',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessIncidenceMatch',
    label: 'Match illnesses incidence',
    description: 'Illness incidence during matches. For multiple populations, enter each on a new line.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessIncidenceTraining',
    label: 'Training illnesses incidence',
    description: 'Illness incidence during training. For multiple populations, enter each on a new line.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessIncidenceCi95',
    label: 'Illness incidence 95% CI',
    description: 'Reported 95% confidence interval for illness incidence.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessTimeLossTotal',
    label: 'Total time-loss due to illnesses',
    description: 'Total time-loss due to illnesses.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessTimeLossMedian',
    label: 'Median time-loss',
    description: 'Median illness time-loss.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessTimeLossMean',
    label: 'Mean time-loss',
    description: 'Mean illness time-loss.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessBurden',
    label: 'Illness burden',
    description: 'Reported illness burden metric.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessBurdenCi95',
    label: 'Illness burden 95% CI',
    description: '95% confidence interval for illness burden.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessMostCommonSystem',
    label: 'Most common organ system/region',
    description: 'Most affected organ system or region.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessMostCommonEtiology',
    label: 'Most common etiology',
    description: 'Most common illness etiology.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessMostCommonSeverity',
    label: 'Most common illness severity class',
    description: 'Most common illness severity classification.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessModeGradual',
    label: 'Mode of onset – Gradual',
    description: 'Gradual onset illnesses.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessModeSudden',
    label: 'Mode of onset – Sudden',
    description: 'Sudden onset illnesses.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessDurationMedian',
    label: 'Median illness duration',
    description: 'Median illness duration.',
    tab: 'illnessOutcome',
  },
  {
    id: 'illnessDurationMean',
    label: 'Mean illness duration (±SD)',
    description: 'Mean illness duration with SD.',
    tab: 'illnessOutcome',
  },
];


// ---------------------------------------------------------------------------
// Metric-based manual tabs (Tabs 8–11)
// ---------------------------------------------------------------------------
export const extractionMetrics: Array<{ metric: ExtractionFieldMetric; label: string }> = [
  { metric: 'prevalence', label: 'Count' },
  { metric: 'incidence', label: 'Incidence' },
  { metric: 'burden', label: 'Burden' },
  { metric: 'severityMeanDays', label: 'Severity (mean days out)' },
  { metric: 'severityTotalDays', label: 'Severity (total days out)' },
];

type MetricGroup = {
  id: string;
  label: string;
  displayLabel?: string;
};

type MetricDescription = {
  metric: ExtractionFieldMetric;
  labelSuffix: string;
};

const metricDescriptions: MetricDescription[] = [
  { metric: 'prevalence', labelSuffix: 'Count' },
  { metric: 'incidence', labelSuffix: 'Incidence' },
  { metric: 'burden', labelSuffix: 'Burden' },
  { metric: 'severityMeanDays', labelSuffix: 'Severity (mean days out)' },
  { metric: 'severityTotalDays', labelSuffix: 'Severity (total days out)' },
];

function generateDiagnosisFields(tab: ExtractionTab, groups: MetricGroup[]): ExtractionFieldDefinition[] {
  return groups.map((group) => ({
    id: `${tab}_${group.id}_diagnosis`,
    label: 'Injury diagnosis',
    description: 'Free-text injury diagnosis for this row (e.g., hamstring strain, ACL rupture).',
    tab,
    groupId: `${tab}:${group.id}`,
    groupLabel: group.displayLabel ?? group.label,
  }));
}

const injuryTissueTypeGroups: MetricGroup[] = [
  {
    id: 'injury_diagnosis',
    label: 'Injury diagnosis',
    displayLabel: 'Injury diagnosis (e.g., hamstring strain, ACL rupture, ankle ligament injury)',
  },
  { id: 'muscle_tendon', label: 'Muscle/tendon' },
  { id: 'muscle_injury', label: 'Muscle injury' },
  { id: 'muscle_contusion', label: 'Muscle contusion' },
  { id: 'muscle_compartment', label: 'Muscle compartment syndrome' },
  { id: 'tendinopathy', label: 'Tendinopathy' },
  { id: 'tendon_rupture', label: 'Tendon rupture' },
  { id: 'nervous', label: 'Nervous' },
  { id: 'brain_spinal', label: 'Brain/spinal cord injury' },
  { id: 'concussion', label: 'Concussion' },
  { id: 'peripheral_nerve', label: 'Peripheral nerve injury' },
  { id: 'bone', label: 'Bone' },
  { id: 'bone_fracture', label: 'Bone fracture' },
  { id: 'bone_stress', label: 'Bone stress injury' },
  { id: 'bone_contusion', label: 'Bone contusion' },
  { id: 'avascular_necrosis', label: 'Avascular necrosis' },
  { id: 'physis', label: 'Physis injury' },
  { id: 'cartilage_synovium_bursa', label: 'Cartilage/synovium/bursa' },
  { id: 'cartilage_injury', label: 'Cartilage injury' },
  { id: 'arthritis', label: 'Arthritis' },
  { id: 'synovitis_capsulitis', label: 'Synovitis/capsulitis' },
  { id: 'bursitis', label: 'Bursitis' },
  { id: 'ligament_joint_capsule', label: 'Ligament/joint capsule' },
  { id: 'joint_sprain', label: 'Joint sprain' },
  { id: 'chronic_instability', label: 'Chronic instability' },
  { id: 'superficial_contusion', label: 'Contusion (superficial)' },
  { id: 'laceration', label: 'Laceration' },
  { id: 'abrasion', label: 'Abrasion' },
  { id: 'vessels', label: 'Vessels' },
  { id: 'stump', label: 'Stump' },
  { id: 'internal_organs', label: 'Internal organs' },
];

const injuryLocationGroups: MetricGroup[] = [
  { id: 'head', label: 'Head' },
  { id: 'neck', label: 'Neck' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'upper_arm', label: 'Upper arm' },
  { id: 'elbow', label: 'Elbow' },
  { id: 'forearm', label: 'Forearm' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'hand', label: 'Hand' },
  { id: 'chest', label: 'Chest' },
  { id: 'thoracic_spine', label: 'Thoracic spine' },
  { id: 'lumbosacral', label: 'Lumbosacral' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'hip', label: 'Hip' },
  { id: 'groin', label: 'Groin' },
  { id: 'thigh', label: 'Thigh' },
  { id: 'knee', label: 'Knee' },
  { id: 'lower_leg', label: 'Lower leg' },
  { id: 'ankle', label: 'Ankle' },
  { id: 'foot', label: 'Foot' },
  { id: 'unspecified', label: 'Unspecified' },
  { id: 'multiple', label: 'Multiple' },
  { id: 'side_left', label: 'Side – Left' },
  { id: 'side_right', label: 'Side – Right' },
  { id: 'side_centre', label: 'Side – Centre' },
  { id: 'side_bilateral', label: 'Side – Bilateral' },
  { id: 'position_goalkeeper', label: 'Position – Goalkeeper' },
  { id: 'position_defender', label: 'Position – Defender' },
  { id: 'position_midfielder', label: 'Position – Midfielder' },
  { id: 'position_attacker', label: 'Position – Attacker' },
];

const illnessRegionGroups: MetricGroup[] = [
  { id: 'cardiovascular', label: 'Cardiovascular' },
  { id: 'dermatological', label: 'Dermatological' },
  { id: 'dental', label: 'Dental' },
  { id: 'endocrinological', label: 'Endocrinological' },
  { id: 'gastrointestinal', label: 'Gastrointestinal' },
  { id: 'genitourinary', label: 'Genitourinary' },
  { id: 'hematological', label: 'Hematological' },
  { id: 'musculoskeletal', label: 'Musculoskeletal' },
  { id: 'neurological', label: 'Neurological' },
  { id: 'ophthalmological', label: 'Ophthalmological' },
  { id: 'otological', label: 'Otological' },
  { id: 'psychiatric', label: 'Psychiatric/psychological' },
  { id: 'respiratory', label: 'Respiratory' },
  { id: 'thermoregulatory', label: 'Thermoregulatory' },
  { id: 'multiple', label: 'Multiple systems' },
  { id: 'unknown', label: 'Unknown or not specified' },
];

const illnessEtiologyGroups: MetricGroup[] = [
  { id: 'allergic', label: 'Allergic' },
  { id: 'environmental_exercise', label: 'Environmental (exercise related)' },
  { id: 'environmental_nonexercise', label: 'Environmental (nonexercise)' },
  { id: 'immunological', label: 'Immunological/inflammatory' },
  { id: 'infection', label: 'Infection' },
  { id: 'neoplasm', label: 'Neoplasm' },
  { id: 'metabolic', label: 'Metabolic/nutritional' },
  { id: 'thrombotic', label: 'Thrombotic/hemorrhagic' },
  { id: 'degenerative', label: 'Degenerative or chronic condition' },
  { id: 'developmental', label: 'Developmental anomaly' },
  { id: 'drug_related', label: 'Drug-related/poisoning' },
  { id: 'multiple', label: 'Multiple' },
  { id: 'unknown', label: 'Unknown or not specified' },
];

function generateMetricFields(tab: ExtractionTab, groups: MetricGroup[]): ExtractionFieldDefinition[] {
  return groups.flatMap((group) =>
    metricDescriptions.map((metric) => {
      const id = `${tab}_${group.id}_${metric.metric}`;
      const label = `${group.label} – ${metric.labelSuffix}`;
      const description = `${metric.labelSuffix} for ${group.label.toLowerCase()}.`;
      return {
        id,
        label,
        description,
        tab,
        metric: metric.metric,
        groupId: `${tab}:${group.id}`,
        groupLabel: group.displayLabel ?? group.label,
      } satisfies ExtractionFieldDefinition;
    }),
  );
}


const metricFieldDefinitions: ExtractionFieldDefinition[] = [
  ...generateDiagnosisFields(
    'injuryTissueType',
    injuryTissueTypeGroups.filter((group) => group.id === 'injury_diagnosis'),
  ),
  ...generateMetricFields('injuryTissueType', injuryTissueTypeGroups),
  ...generateMetricFields('injuryLocation', injuryLocationGroups),
  ...generateMetricFields('illnessRegion', illnessRegionGroups),
  ...generateMetricFields('illnessEtiology', illnessEtiologyGroups),
];

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------
export const extractionFieldDefinitions: ExtractionFieldDefinition[] = [
  ...aiFieldDefinitions,
  ...injuryOutcomeDefinitions,
  ...illnessOutcomeDefinitions,
  ...metricFieldDefinitions,
];

export const extractionTabs: ExtractionTab[] = [
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

export const aiExtractionTabs = new Set<ExtractionTab>([
  'studyDetails',
  'participantCharacteristics',
  'definitions',
  'exposure',
]);

export const humanExtractionTabs = extractionTabs.filter((tab) => !aiExtractionTabs.has(tab));

export const extractionTabMeta: Record<ExtractionTab, { title: string; description: string }> = {
  studyDetails: {
    title: 'Study details',
    description: 'Bibliographic information, identifiers, and design details captured from the study header or abstract.',
  },
  participantCharacteristics: {
    title: 'Participant characteristics',
    description: 'Demographics and cohort composition describing who took part in the study.',
  },
  definitions: {
    title: 'Definitions & data collection',
    description: 'Operational definitions and data collection conventions used by the authors.',
  },
  exposure: {
    title: 'Exposure data',
    description: 'Season length and exposure measurements for match and training activities.',
  },
  injuryOutcome: {
    title: 'Injury outcome',
    description: 'Manual entry for injury counts, incidences, burdens, and recurrence metrics.',
  },
  illnessOutcome: {
    title: 'Illness outcome',
    description: 'Manual entry for illness incidence, burden, and duration metrics.',
  },
  injuryTissueType: {
    title: 'Injury tissue & type',
    description: 'Manual entry capturing count, incidence, burden, and severity by tissue/tissue type.',
  },
  injuryLocation: {
    title: 'Injury location',
    description: 'Manual entry capturing count, incidence, burden, and severity by anatomical location.',
  },
  illnessRegion: {
    title: 'Illness region',
    description: 'Manual entry capturing count, incidence, burden, and severity by organ system.',
  },
  illnessEtiology: {
    title: 'Illness etiology',
    description: 'Manual entry capturing count, incidence, burden, and severity by illness cause.',
  },
};

// ---------------------------------------------------------------------------
// Helpers used by the extraction service/UI
// ---------------------------------------------------------------------------

export function createEmptyFieldResult(fieldId: string): ExtractionFieldResult {
  return {
    fieldId,
    value: null,
    confidence: null,
    status: 'not_reported',
    updatedAt: new Date().toISOString(),
    updatedBy: 'human',
  };
}

export function createEmptyTabResult(tab: ExtractionTab): ExtractionFieldResult[] {
  return extractionFieldDefinitions
    .filter((definition) => definition.tab === tab)
    .map((definition) => ({
      ...createEmptyFieldResult(definition.id),
      metric: definition.metric,
    }));
}

const schemaCache: Partial<Record<ExtractionTab, z.ZodObject<Record<string, z.ZodTypeAny>>>> = {};

function buildTabSchema(tab: ExtractionTab) {
  if (schemaCache[tab]) {
    return schemaCache[tab]!;
  }

  const definitions = extractionFieldDefinitions.filter((definition) => definition.tab === tab);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const definition of definitions) {
    shape[definition.id] = z.object({
      value: z.union([z.string(), z.null()]).optional(),
      confidence: z.union([z.number(), z.null()]).optional(),
      status: z.enum(['reported', 'not_reported', 'uncertain']).optional(),
      sourceQuote: z.string().optional(),
      pageHint: z.string().optional(),
    });
  }

  const schema = z.object(shape);
  schemaCache[tab] = schema;
  return schema;
}

export function buildTabValidationSchema(tab: ExtractionTab) {
  return buildTabSchema(tab);
}
