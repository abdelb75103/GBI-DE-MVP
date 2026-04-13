export const injuryDefinitionAnalysis = {
  generatedAtUtc: '2026-04-12T22:56:23.608279+00:00',
  paperCount: 499,
  classifiedPaperCount: 484,
  mainFamilyPaperCount: 474,
  mainMessage: {
    headline: 'Time-loss definitions dominate the literature.',
    subhead: '340 of 499 studies (68.1%) use a time-loss definition.',
  },
  primaryRows: [
    {
      category: 'time-loss',
      count: 340,
      pctAllPapers: 68.1,
      pctClassifiedPapers: 70.2,
    },
    {
      category: 'medical attention',
      count: 87,
      pctAllPapers: 17.4,
      pctClassifiedPapers: 18.0,
    },
    {
      category: 'physical complaint',
      count: 47,
      pctAllPapers: 9.4,
      pctClassifiedPapers: 9.7,
    },
    {
      category: 'other/specific',
      count: 6,
      pctAllPapers: 1.2,
      pctClassifiedPapers: 1.2,
    },
    {
      category: 'not_reported',
      count: 4,
      pctAllPapers: 0.8,
      pctClassifiedPapers: 0.8,
    },
    {
      category: 'mixed standardized values',
      count: 0,
      pctAllPapers: 0.0,
      pctClassifiedPapers: 0.0,
    },
    {
      category: 'missing',
      count: 15,
      pctAllPapers: 3.0,
      pctClassifiedPapers: 3.1,
    },
  ],
  keyFigures: {
    timeLoss: {
      count: 340,
      pctAllPapers: 68.1,
      pctMainFamilies: 71.7,
    },
    medicalAttention: {
      count: 87,
      pctAllPapers: 17.4,
      pctMainFamilies: 18.4,
    },
    physicalComplaint: {
      count: 47,
      pctAllPapers: 9.4,
      pctMainFamilies: 9.9,
    },
    residual: {
      count: 25,
      pctAllPapers: 5.0,
    },
  },
  sensitivityAudit: {
    hybridRawDefinitions: 20,
    medicalAttentionPlusTimeLoss: 15,
    physicalComplaintPlusTimeLoss: 3,
    physicalComplaintPlusMedicalAttention: 2,
    mixedRawFamilyPapers: 2,
  },
  overridesApplied: [
    {
      paperId: 'S231',
      finalCategory: 'time-loss',
      rationale:
        'Kidney-specific catastrophic and surgical wording is an outcome-specific severity concept, not a separate general injury-definition family.',
    },
    {
      paperId: 'S349',
      finalCategory: 'medical attention',
      rationale:
        'The paper defines medical-attention injuries as the broader capture frame and reports time-loss injuries as a subset within that frame.',
    },
  ],
} as const;
