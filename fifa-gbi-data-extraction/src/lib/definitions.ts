export type DefinitionCategory = {
  id: string;
  title: string;
  description: string;
  entries: Array<{
    id: string;
    label: string;
    summary: string;
    source?: string;
  }>;
};

export const definitionCategories: DefinitionCategory[] = [
  {
    id: 'injury-terminology',
    title: 'Core Injury Terminology (IOC Consensus 2020)',
    description:
      'Standard definitions used across GBI extractions to ensure comparability. These align with the IOC consensus statement on injury surveillance in professional football.',
    entries: [
      {
        id: 'time-loss-injury',
        label: 'Time-Loss Injury',
        summary:
          'Any physical complaint sustained by a player that results in absence from training or match play for at least one day after the event.',
        source: 'IOC Consensus Statement on Injury Surveillance, 2020',
      },
      {
        id: 'medical-attention-injury',
        label: 'Medical-Attention Injury',
        summary:
          'A physical complaint that requires assessment or treatment by medical staff regardless of time-loss. Where reported separately, record in notes.',
      },
      {
        id: 'recurrent-injury',
        label: 'Recurrent Injury',
        summary:
          'An injury of the same type and at the same site as a previous index injury that occurs after a player has returned to full participation.',
      },
      {
        id: 'acute-vs-gradual',
        label: 'Mode of Onset',
        summary:
          'Acute/sudden injuries result from a single identifiable event. Gradual/repetitive injuries develop over time from cumulative microtrauma.',
      },
    ],
  },
  {
    id: 'severity-classes',
    title: 'Severity Classes (IOC)',
    description:
      'Severity is based on the total number of days from injury onset until the player is fully available. If authors deviate, capture their definition in notes.',
    entries: [
      { id: 'minimal', label: 'Minimal', summary: '1–3 days time-loss.' },
      { id: 'mild', label: 'Mild', summary: '4–7 days time-loss.' },
      { id: 'moderate', label: 'Moderate', summary: '8–28 days time-loss.' },
      { id: 'severe', label: 'Severe', summary: '≥29 days time-loss.' },
    ],
  },
  {
    id: 'osiics',
    title: 'OSIICS/SMDSC Injury Locations',
    description:
      'Use OSIICS 2020 anatomical groupings where studies provide compatible descriptions. Map free text to the closest category and note uncertainties.',
    entries: [
      { id: 'head-neck', label: 'Head & Neck', summary: 'Includes concussion, facial fractures, cervical strains.' },
      {
        id: 'upper-extremity',
        label: 'Upper Extremity',
        summary: 'Shoulder, arm, elbow, forearm, wrist, hand, and finger injuries.',
      },
      {
        id: 'trunk',
        label: 'Trunk',
        summary: 'Thorax, abdomen, pelvis, lumbar spine. Use when authors reference core or torso injuries.',
      },
      {
        id: 'hip-groin',
        label: 'Hip/Groin',
        summary: 'Adductor strains, hip flexor injuries, labral tears. See OSIICS code G70–G79.',
      },
      {
        id: 'thigh',
        label: 'Thigh',
        summary: 'Hamstring, quadriceps, and adductor injuries located between hip and knee.',
      },
      {
        id: 'knee',
        label: 'Knee',
        summary: 'Ligament sprains (ACL, MCL), meniscal injuries, patellofemoral disorders.',
      },
      {
        id: 'lower-leg',
        label: 'Lower Leg',
        summary: 'Calf strains, tibial stress injuries, Achilles tendinopathy.',
      },
      {
        id: 'ankle-foot',
        label: 'Ankle & Foot',
        summary: 'Ankle sprains, midfoot injuries, metatarsal fractures, toe injuries.',
      },
    ],
  },
  {
    id: 'illness',
    title: 'Illness Definitions',
    description:
      'Illnesses are separated from injuries and follow the IOC/UEFA illness surveillance guidance. Capture primary system and time-loss where possible.',
    entries: [
      {
        id: 'systemic-illness',
        label: 'Systemic Illness',
        summary: 'A non-injury health complaint affecting systemic function (e.g., respiratory infection, GI illness).',
      },
      {
        id: 'organ-system',
        label: 'Organ System Classification',
        summary:
          'Use the organ system reported by authors; otherwise map to respiratory, gastrointestinal, neurological, dermatological, or “other”.',
      },
      {
        id: 'illness-severity',
        label: 'Illness Severity',
        summary: 'Use the same time-loss thresholds as injury severity when days unavailable are reported.',
      },
    ],
  },
];

export const definitionIndex = new Map<string, DefinitionCategory>(
  definitionCategories.map((category) => [category.id, category]),
);

