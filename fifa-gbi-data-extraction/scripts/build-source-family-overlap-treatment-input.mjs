import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(
  APP_ROOT,
  'data',
  'source-family-overlap-audit',
  '2026-07-27',
);
const INVENTORY_PATH = path.join(DATA_DIR, 'complete-candidate-inventory-2026-07-27.json');
const UEFA_EVIDENCE_PATH = path.join(
  DATA_DIR,
  'uefa-source-family-evidence-input-2026-07-27.json',
);
const DECISION_PATH = path.join(DATA_DIR, 'source-family-decision-ledger-2026-07-27.json');
const TREATMENT_PATH = path.join(DATA_DIR, 'analysis-source-treatment-input-2026-07-27.json');
const ROW_PATH = path.join(DATA_DIR, 'analysis-row-treatment-input-2026-07-27.json');
const VERSION = '2026-07-27-source-family-v1';

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
const paperByStudyId = new Map(inventory.papers.map((paper) => [paper.studyId, paper]));
const families = [];
const decisions = [];
const candidateDispositions = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function addFamily(family) {
  families.push(family);
  for (const decision of family.papers) {
    assert(paperByStudyId.has(decision.studyId), `Missing live paper ${decision.studyId}`);
    assert(!decisions.some((current) => current.studyId === decision.studyId), `Duplicate decision ${decision.studyId}`);
    decisions.push({
      stage: true,
      rowMode: 'all',
      ...decision,
      familyKey: family.familyKey,
      familyLabel: family.label,
    });
  }
}

function duplicateNote(studyId, canonicalStudyId, label) {
  return `Source-family overlap treatment, 27 July 2026: ${studyId} is a bibliographic or import duplicate of ${canonicalStudyId} in the ${label} family. ${canonicalStudyId} is the canonical analysis record. ${studyId} remains available in source scope but is excluded from the default analysis export. No screening, status, assignment, extraction, population, file or protected value was changed.`;
}

function addDuplicateFamily({
  familyKey,
  label,
  canonicalStudyId,
  duplicateStudyIds,
  analysisUnit = 'Canonical publication record',
  evidence,
  canonicalRowMode = 'all',
  canonicalIncludePositions,
}) {
  addFamily({
    familyKey,
    label,
    analysisUnit,
    anchors: [canonicalStudyId],
    evidence,
    papers: [
      {
        studyId: canonicalStudyId,
        role: 'anchor',
        includeInAnalysisExport: true,
        rowMode: canonicalRowMode,
        includePositions: canonicalIncludePositions,
        note: `Source-family overlap treatment, 27 July 2026: ${canonicalStudyId} is the canonical analysis record for the ${label} family. Duplicate imports are retained only in source scope. No screening, status, assignment, extraction, population, file or protected value was changed.`,
        evidence,
      },
      ...duplicateStudyIds.map((studyId) => ({
        studyId,
        role: 'audit_only',
        includeInAnalysisExport: false,
        anchorStudyId: canonicalStudyId,
        relationship: 'incorporated',
        rowMode: 'all_false',
        note: duplicateNote(studyId, canonicalStudyId, label),
        evidence,
      })),
    ],
  });
}

const uefaAudit = JSON.parse(fs.readFileSync(UEFA_EVIDENCE_PATH, 'utf8'));
const uefaSourceIds = Array.from(new Set([
  ...Object.keys(uefaAudit.ecis_source_ledger ?? {}),
  ...Object.keys(uefaAudit.second_search_source_family_ledger ?? {}),
  'S044',
  'S031',
  'S036',
  'S136',
  'S137',
  'S138',
  'S2391',
  'S389',
  'S390',
])).filter((studyId) => !['S1091', 'S5151', 'S5338'].includes(studyId));
const uefaMasterRowKeys = [
  'ECIS men all injuries 2001/02-2018/19',
  'ECIS men hamstring injuries 2001/02-2021/22',
  'ECIS men hip/groin injuries 2001/02-2015/16',
  'ECIS men adductor injuries 2001/02-2015/16',
  'ECIS men LCL injuries 2001-2018',
  'ECIS men PCL injuries 2001-2018',
  'ECIS men MCL injuries 2001/02-2011/12',
  'ECIS men ACL injuries 2001-2015',
  'ECIS men ankle injuries 2001/02-2011/12',
  'ECIS men syndesmosis injuries 2001-2016',
  'ECIS men upper-extremity injuries 2001-2011',
  'ECIS men head/neck injuries 2001/02-2009/10',
  'ECIS men concussion injuries 2001/02-2009/10',
  'ECIS-related stress fractures through 2012',
  'ECIS men fifth-metatarsal fractures through 2012',
  'ECIS men Achilles tendinopathy 2001-2011',
  'ECIS men Achilles rupture 2001-2011',
  'ECIS men indirect thigh injuries 2001-May 2013',
  'ECIS men direct thigh contusions 2001-May 2013',
  'ECIS men all injuries 2022/23',
];
addFamily({
  familyKey: 'uefa-ecis-men',
  label: 'UEFA Elite Club Injury Study, men',
  analysisUnit: 'Club-season surveillance programme. The default denominator rows are the S200 all-injury programme anchor and the disjoint S5151 2022/23 full-season row held in the existing master.',
  anchors: ['UEFA-ECIS-MASTER'],
  evidence: 'Reconciles the existing UEFA source ledger and grouped master. ECIS topic, prognosis, risk-factor and superseded publications reuse the programme cohort or a nested subset.',
  papers: [
    {
      studyId: 'UEFA-ECIS-MASTER',
      role: 'anchor',
      includeInAnalysisExport: true,
      includePositions: [0, 19],
      rowMode: 'include_positions',
      rowKeys: uefaMasterRowKeys,
      allowRowPolicyUpgrade: true,
      note: 'Source-family overlap treatment, 27 July 2026: UEFA-ECIS-MASTER remains the existing men’s ECIS grouped source of truth. Only the S200 all-injury row and the disjoint 2022/23 S5151 all-injury row own default analysis denominators. Diagnosis, prognosis and subgroup rows remain available in source scope but are source-only for denominator aggregation. No extraction or population value was changed.',
      evidence: 'Existing UEFA master source audit, plus live row-level denominator verification.',
    },
    ...uefaSourceIds.map((studyId) => {
      const ledger = uefaAudit.ecis_source_ledger?.[studyId]
        ?? uefaAudit.second_search_source_family_ledger?.[studyId]
        ?? null;
      return {
        studyId,
        role: ledger?.tag?.includes('audit-only') ? 'audit_only' : 'supplement',
        includeInAnalysisExport: false,
        anchorStudyId: 'UEFA-ECIS-MASTER',
        relationship: ledger?.tag?.includes('audit-only') ? 'overlaps' : 'incorporated',
        rowMode: 'all_false',
        note: `Source-family overlap treatment, 27 July 2026: ${studyId} belongs to the UEFA ECIS men source family and is source-only in the default analysis export. ${ledger?.reason ?? 'Its surveillance population overlaps the ECIS programme or a retained topic row.'} The existing UEFA-ECIS-MASTER remains the grouped source of truth. No extraction or population value was changed.`,
        evidence: ledger ?? 'Primary-file and live-denominator reconciliation.',
      };
    }),
  ],
});

addFamily({
  familyKey: 'uefa-wecis-women',
  label: 'UEFA Women’s Elite Club Injury Study',
  analysisUnit: 'Four-season women’s ECIS programme, 2018/19 to 2021/22',
  anchors: ['S112'],
  evidence: 'S1091 and S112 have the same DOI and publication. S112 contains the complete live extraction.',
  papers: [
    {
      studyId: 'S112',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S112 is the canonical WECIS record. Its pooled four-season row owns the default analysis denominator; season rows remain in source scope to avoid pooling the pooled denominator and its component seasons together. S1091 is a duplicate alias.',
      evidence: 'Exact DOI 10.1136/bjsports-2023-107133 and source-verified live rows.',
    },
    {
      studyId: 'S1091',
      role: 'audit_only',
      includeInAnalysisExport: false,
      anchorStudyId: 'S112',
      relationship: 'incorporated',
      rowMode: 'all_false',
      note: duplicateNote('S1091', 'S112', 'UEFA WECIS'),
      evidence: 'Exact matching DOI and publication identity.',
    },
  ],
});

addFamily({
  familyKey: 'aspetar-aspire-academy',
  label: 'Aspire Academy surveillance',
  analysisUnit: 'Two disjoint all-injury periods: S261 for 2012/13-2015/16 and S076 for 2016/17-2019/20. S1431 is nested within the later period.',
  anchors: ['S261', 'S076'],
  evidence: 'Primary PDFs confirm consecutive Aspire Academy periods. S076 explicitly states that 2016/17-2019/20 follows the S261 period. S1431 covers only U13-U15 in 2016/17-2018/19.',
  papers: [
    {
      studyId: 'S261',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S261 owns the pooled 2012/13-2015/16 Aspire Academy denominator. Age rows and the appended S1431 row remain available in source scope but are excluded from default denominator aggregation. S076 owns the later all-injury period; S1431 is nested within S076.',
      evidence: 'S261 primary PDF and source-verified live rows.',
    },
    {
      studyId: 'S071',
      role: 'audit_only',
      includeInAnalysisExport: false,
      anchorStudyId: 'S261',
      relationship: 'incorporated',
      rowMode: 'all_false',
      note: duplicateNote('S071', 'S261', 'Aspire Academy 2012/13-2015/16'),
      evidence: 'Same title, cohort, seasons and manuscript/final-publication identity.',
    },
    {
      studyId: 'S076',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'all',
      note: 'Source-family overlap treatment, 27 July 2026: S076 owns the later Aspire Academy all-injury period, 2016/17-2019/20. Its U13-U18 rows are disjoint exposure strata. S1431 is a nested U13-U15 risk-factor subset of three of these four seasons and is source-only.',
      evidence: 'S076 primary PDF, Methods and Discussion, directly identify the period and its relationship to the preceding academy study.',
    },
    {
      studyId: 'S1431',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S076',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S1431 is a nested U13-U15 growth and maturity analysis from 2016/17-2018/19 within the later S076 Aspire Academy period. It adds risk-factor detail but no independent all-injury denominator. Its appended representation in S261 is also source-only.',
      evidence: 'Matching academy, nested ages and three seasons within the S076 four-season period.',
    },
  ],
});

addFamily({
  familyKey: 'aspetar-qsl-professional',
  label: 'Aspetar Qatar Stars League surveillance',
  analysisUnit: 'S2824 pooled modern all-injury programme plus the disjoint S195 2008/09 historical cohort',
  anchors: ['S2824'],
  evidence: 'Existing Aspetar ledger and verified primary files. Topic sources overlap the professional programme and are represented only as source-scoped detail.',
  papers: [
    {
      studyId: 'S2824',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0, 9],
      note: 'Source-family overlap treatment, 27 July 2026: S2824 owns the pooled 2014/15-2021/22 QSL denominator and the disjoint S195 2008/09 historical row. Component seasons, groin, ACL, and head/neck-concussion rows remain source-only to prevent pooled-plus-component or topic-denominator duplication.',
      evidence: 'Existing Aspetar source ledger, primary PDFs and exact live row denominators.',
    },
    ...[
      ['S195', 'supplement', 'incorporated', 'Disjoint historical row is already represented in S2824.'],
      ['S344', 'supplement', 'incorporated', 'Groin-specific row is already represented in S2824 and overlaps 2014/15.'],
      ['S544', 'audit_only', 'overlaps', 'Same 205,466-hour groin programme as S344, used for risk-factor modelling.'],
      ['S3577', 'nested_subset', 'nested', 'Retrospective limb-asymmetry analysis of the S344 cohort.'],
      ['S555', 'supplement', 'incorporated', 'ACL-specific row is already represented in S2824.'],
      ['S712', 'supplement', 'incorporated', 'Head/neck-concussion row is already represented in S2824.'],
    ].map(([studyId, role, relationship, reason]) => ({
      studyId,
      role,
      includeInAnalysisExport: false,
      anchorStudyId: 'S2824',
      relationship,
      rowMode: 'all_false',
      note: `Source-family overlap treatment, 27 July 2026: ${studyId} is source-only in the QSL family. ${reason} No extraction or population value was changed.`,
      evidence: reason,
    })),
  ],
});

addFamily({
  familyKey: 'aspetar-afc-multicountry',
  label: 'Aspetar AFC multicountry professional cohort',
  analysisUnit: 'Pooled 2017-2019 AFC cohort',
  anchors: ['S602'],
  evidence: 'Separate 22-team multicountry cohort, not the Qatar Stars League or Aspire Academy.',
  papers: [{
    studyId: 'S602',
    role: 'separate_family',
    includeInAnalysisExport: true,
    rowMode: 'include_positions',
    includePositions: [0],
    note: 'Source-family overlap treatment, 27 July 2026: S602 remains a separate AFC multicountry anchor. The pooled row owns the default denominator; component years remain in source scope to avoid pooled-plus-year duplication.',
    evidence: 'Existing Aspetar ledger and source-verified pooled/year rows.',
  }],
});

addFamily({
  familyKey: 'german-youth-academy-2012-13',
  label: 'German elite youth academy, 2012/13',
  analysisUnit: 'One 138-player, seven-squad, 41,973-hour academy season',
  anchors: ['S075'],
  evidence: 'Primary files repeat the same academy, season, 138 players, 41,973 hours and 109 injuries. S1389 follows 130 eligible players for career progression.',
  papers: [
    {
      studyId: 'S075',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S075 owns the pooled 138-player, 41,973-hour, 109-injury German academy denominator for 2012/13.',
      evidence: 'Direct abstract and Methods denominators.',
    },
    ...[
      ['S047', 'supplement', 'overlaps', 'Age-specific analysis of the same 138-player academy season.'],
      ['S630', 'supplement', 'overlaps', 'Earlier injury-profile publication from the same 138-player and 109-injury cohort.'],
      ['S1389', 'nested_subset', 'nested', 'Ten-year career follow-up of 130 eligible players from the same cohort.'],
    ].map(([studyId, role, relationship, evidence]) => ({
      studyId,
      role,
      includeInAnalysisExport: false,
      anchorStudyId: 'S075',
      relationship,
      rowMode: 'all_false',
      note: `Source-family overlap treatment, 27 July 2026: ${studyId} is source-only under S075. ${evidence}`,
      evidence,
    })),
  ],
});
candidateDispositions.push({
  studyIds: ['S309'],
  disposition: 'separate analysis family',
  reason: 'Professional French/Finnish hamstring-screening cohort, not the German youth academy.',
});

addFamily({
  familyKey: 'funball-cluster-rct',
  label: 'FUNBALL cluster-randomised trial',
  analysisUnit: 'S1014 intervention and control arms',
  anchors: ['S1014'],
  evidence: 'Exact arm-level player, team, exposure and injury denominators plus NCT05137015 linkage.',
  papers: [
    {
      studyId: 'S1014',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S1014 owns the FUNBALL intervention and control denominators.',
      evidence: 'Primary RCT with directly reported arm denominators.',
    },
    ...[
      ['S2259', 'nested_subset', 'nested', 'Secondary severe-injury analysis across the same trial arms.'],
      ['S2474', 'nested_subset', 'nested', 'Age analysis of the exact S1014 control arm.'],
      ['S289', 'audit_only', 'incorporated', 'Exact duplicate import of S1014.'],
    ].map(([studyId, role, relationship, evidence]) => ({
      studyId,
      role,
      includeInAnalysisExport: false,
      anchorStudyId: 'S1014',
      relationship,
      rowMode: 'all_false',
      note: `Source-family overlap treatment, 27 July 2026: ${studyId} is source-only under S1014. ${evidence}`,
      evidence,
    })),
  ],
});

addFamily({
  familyKey: 'dutch-amateur-professional-2009-10',
  label: 'Dutch amateur and professional football, 2009/10',
  analysisUnit: 'S025 amateur and professional cohorts',
  anchors: ['S025'],
  evidence: 'Exact repeated amateur/professional players, exposures and outcome totals.',
  papers: [
    {
      studyId: 'S025',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S025 owns the disjoint Dutch amateur and professional 2009/10 cohort denominators.',
      evidence: 'Direct two-cohort comparison.',
    },
    ...[
      ['S468', 'nested_subset', 'nested', 'Amateur cohort re-analysis.'],
      ['S658', 'cross_tournament_supplement', 'pooled_across', 'Pooled and subgroup representation of the same amateur/professional cohorts.'],
    ].map(([studyId, role, relationship, evidence]) => ({
      studyId,
      role,
      includeInAnalysisExport: false,
      anchorStudyId: 'S025',
      relationship,
      rowMode: 'all_false',
      note: `Source-family overlap treatment, 27 July 2026: ${studyId} is source-only under S025. ${evidence}`,
      evidence,
    })),
  ],
});

addDuplicateFamily({
  familyKey: 'female-menstrual-cycle-cohort',
  label: 'Female football menstrual-cycle cohort',
  canonicalStudyId: 'S991',
  duplicateStudyIds: ['S073', 'S074'],
  evidence: 'Same title, three seasons, 26 players, 7,273 hours and 74 injuries; S074 and S991 have the exact same PDF SHA-256.',
});

addFamily({
  familyKey: 'australian-a-league-2012-18',
  label: 'Australian A-League injury surveillance, 2012/13-2017/18',
  analysisUnit: 'S586 pooled six-season league cohort',
  anchors: ['S586'],
  evidence: 'Same 421-player, 10-team, six-season A-League programme. The source contains a 917 pooled versus 916 season-sum discrepancy, retained without correction.',
  papers: [
    {
      studyId: 'S586',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S586 owns the pooled six-season A-League denominator. Season rows remain in source scope to prevent pooled-plus-season duplication.',
      evidence: 'Complete live all-injury extraction.',
    },
    ...[
      ['S573', 'supplement', 'overlaps', 'Team-versus-league analysis of the same programme.'],
      ['S618', 'audit_only', 'overlaps', 'Financial/performance analysis using the same 421-player cohort without an independent exposure denominator.'],
    ].map(([studyId, role, relationship, evidence]) => ({
      studyId,
      role,
      includeInAnalysisExport: false,
      anchorStudyId: 'S586',
      relationship,
      rowMode: 'all_false',
      note: `Source-family overlap treatment, 27 July 2026: ${studyId} is source-only under S586. ${evidence}`,
      evidence,
    })),
  ],
});

addFamily({
  familyKey: 'ready-to-play-norway-women',
  label: '#ReadyToPlay Norwegian women’s cohort',
  analysisUnit: 'S008 all-health-problem cohort, 2020-2021',
  anchors: ['S008'],
  evidence: 'Exact 294 players, 11 teams, 66,234 hours and the same two seasons.',
  papers: [
    {
      studyId: 'S008',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S008 owns the 2020-2021 Norwegian women’s cohort denominator.',
      evidence: 'Full cohort source.',
    },
    {
      studyId: 'S1041',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S008',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S1041 is the groin-injury subset of the S008 cohort and adds clinical/imaging detail only.',
      evidence: 'Exact shared population, teams, seasons and exposure.',
    },
  ],
});

addFamily({
  familyKey: 'iran-national-futsal-18-month',
  label: 'Iran national futsal teams, 18-month cohort',
  analysisUnit: 'S065 team-level injury surveillance',
  anchors: ['S065'],
  evidence: 'Same national teams, 18 months and exact team injury counts.',
  papers: [
    {
      studyId: 'S065',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S065 owns the three national-team strata for the 18-month Iranian futsal cohort.',
      evidence: 'Direct comparative injury study.',
    },
    {
      studyId: 'S080',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S065',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S080 reuses the S065 cohort for physical-fitness risk analysis and is source-only.',
      evidence: 'Exact team counts and injury outcomes.',
    },
    {
      studyId: 'S120',
      role: 'audit_only',
      includeInAnalysisExport: false,
      anchorStudyId: 'S080',
      relationship: 'incorporated',
      rowMode: 'all_false',
      note: duplicateNote('S120', 'S080', 'Iran national futsal'),
      evidence: 'Bibliographic duplicate file record.',
    },
  ],
});

addFamily({
  familyKey: 'new-zealand-female-team-2022-23',
  label: 'New Zealand amateur female team, 2022-2023',
  analysisUnit: 'S1304 all-match-injury cohort',
  anchors: ['S1304'],
  evidence: 'Same team, 49 players and two seasons. S1009 is concussion-specific.',
  papers: [
    {
      studyId: 'S1304',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S1304 owns the two-season all-match-injury denominator.',
      evidence: 'All-injury source.',
    },
    {
      studyId: 'S1009',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S1304',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S1009 is the concussion-specific analysis of the same New Zealand team and seasons.',
      evidence: 'Exact team, players and observation period.',
    },
  ],
});

addFamily({
  familyKey: 'ghana-academy-2021-22',
  label: 'Ghana academy 2021/22 cohort',
  analysisUnit: 'S1229 pooled academy epidemiology',
  anchors: ['S1229'],
  evidence: 'Same academy, 39 weeks and exact age-group injury counts.',
  papers: [
    {
      studyId: 'S1229',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S1229 owns the pooled Ghana academy denominator. Age rows remain source-only for denominator aggregation.',
      evidence: 'Full epidemiology paper.',
    },
    {
      studyId: 'S324',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S1229',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S324 is the risk-factor analysis of the same Ghana academy age strata.',
      evidence: 'Exact age-group counts and observation period.',
    },
  ],
});

addFamily({
  familyKey: 'spanish-groin-2015-16',
  label: 'Spanish male football groin cohort, 2015/16',
  analysisUnit: 'S428 in-season cohort',
  anchors: ['S428'],
  evidence: 'S211 contains the same 407-player, 17-team, 71,908-hour, 63-groin-problem in-season cohort plus a preseason extension.',
  papers: [
    {
      studyId: 'S428',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S428 owns the 39-week in-season groin-problem denominator.',
      evidence: 'Direct full-season source.',
    },
    {
      studyId: 'S211',
      role: 'supplement',
      includeInAnalysisExport: false,
      anchorStudyId: 'S428',
      relationship: 'overlaps',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S211 adds a preseason extension but repeats the S428 in-season cohort and is source-only.',
      evidence: 'Exact in-season denominator and outcome match.',
    },
  ],
});

addFamily({
  familyKey: 'high-school-1995-97-surveillance',
  label: 'US high-school 1995-1997 surveillance',
  analysisUnit: 'S496 broad surveillance denominator',
  anchors: ['S496'],
  evidence: 'Exact male/female soccer exposure totals and near-identical injury totals from the same 1995-1997 surveillance data.',
  papers: [
    {
      studyId: 'S496',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S496 owns the broad 1995-1997 high-school surveillance denominator.',
      evidence: 'Broad surveillance source.',
    },
    {
      studyId: 'S231',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S496',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S231 reuses the S496 surveillance denominators for a kidney-injury analysis and is source-only.',
      evidence: 'Exact sport/sex exposure denominators.',
    },
  ],
});

addFamily({
  familyKey: 'korean-youth-2021',
  label: 'Korean male youth cohort, 2021',
  analysisUnit: 'S4629 all-injury cohort',
  anchors: ['S4629'],
  evidence: 'Same 100 players, two teams, year and mean exposure. S3075 restricts outcomes to lateral ankle sprains.',
  papers: [
    {
      studyId: 'S4629',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S4629 owns the 2021 Korean youth all-injury denominator.',
      evidence: 'Broad cohort source.',
    },
    {
      studyId: 'S3075',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S4629',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S3075 is the lateral-ankle-sprain subset of S4629.',
      evidence: 'Exact participants, teams and exposure.',
    },
  ],
});

addFamily({
  familyKey: 'english-professional-clubs-1994-97',
  label: 'English professional clubs, 1994-1997',
  analysisUnit: 'S417 prospective four-club cohort',
  anchors: ['S417'],
  evidence: 'Same 138 players, four clubs, observation period and 744 injuries.',
  papers: [
    {
      studyId: 'S417',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S417 owns the pooled four-club epidemiological denominator.',
      evidence: 'Primary prospective cohort.',
    },
    {
      studyId: 'S574',
      role: 'supplement',
      includeInAnalysisExport: false,
      anchorStudyId: 'S417',
      relationship: 'overlaps',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S574 is a risk-assessment analysis of the S417 cohort.',
      evidence: 'Exact cohort and injury total.',
    },
  ],
});

addFamily({
  familyKey: 'australian-academy-2017-20',
  label: 'Australian male academy 2017-2020 cohort',
  analysisUnit: 'S421 full/partial time-loss cohort',
  anchors: ['S421'],
  evidence: 'Primary files confirm the same 118 U13-U18 players and three seasons. S600 re-analyses season phases with a restricted analysable exposure frame.',
  papers: [
    {
      studyId: 'S421',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S421 owns the pooled three-season academy denominator. Season rows remain in source scope.',
      evidence: 'Full/partial time-loss source with complete cohort denominator.',
    },
    {
      studyId: 'S600',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S421',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S600 reuses the same academy and seasons for phase-specific analyses and is source-only.',
      evidence: 'Same players and seasons; differing analysis-specific exposure frame.',
    },
  ],
});

addFamily({
  familyKey: 'english-fa-academy-audit-2000-05',
  label: 'English FA academy audit, 2000-2005',
  analysisUnit: 'No general all-injury anchor located in the live corpus',
  anchors: [],
  evidence: 'S452 and S454 both use the same 41-academy, 12,306 player-registration database over five seasons, but report different diagnosis-specific outcomes without a general denominator-owning source.',
  papers: [
    ['S452', 'Thigh-muscle prognosis analysis.'],
    ['S454', 'Knee-injury analysis.'],
  ].map(([studyId, evidence]) => ({
    studyId,
    role: 'audit_only',
    includeInAnalysisExport: false,
    rowMode: 'all_false',
    note: `Source-family overlap treatment, 27 July 2026: ${studyId} is source-only in the English FA academy audit family. ${evidence} No eligible general all-injury anchor is present in the live corpus.`,
    evidence,
  })),
});

addFamily({
  familyKey: 'mls-public-diagnosis-2010-21',
  label: 'MLS public diagnosis analyses, 2010-2021',
  analysisUnit: 'No eligible at-risk surveillance denominator',
  anchors: [],
  evidence: 'ACL and hamstring publications share the public MLS period and analytic approach but contain diagnosis-case cohorts, not a reusable at-risk exposure denominator.',
  papers: ['S4778', 'S4793'].map((studyId) => ({
    studyId,
    role: 'audit_only',
    includeInAnalysisExport: false,
    rowMode: 'all_false',
    note: `Source-family overlap treatment, 27 July 2026: ${studyId} is audit-only. The source reports a diagnosis-specific public-data cohort without an eligible at-risk exposure denominator.`,
    evidence: 'Primary-file denominator check.',
  })),
});

addFamily({
  familyKey: 'norway-cup-2005-08',
  label: 'Norway Cup youth tournament, 2005-2008',
  analysisUnit: 'S605 four-tournament surface comparison',
  anchors: ['S605'],
  evidence: 'Exact repeated 60,000+ players, 4,000+ teams, 62,597 match-hours and 2,454 injuries.',
  papers: [
    {
      studyId: 'S605',
      role: 'anchor',
      includeInAnalysisExport: true,
      rowMode: 'include_positions',
      includePositions: [0],
      note: 'Source-family overlap treatment, 27 July 2026: S605 owns the pooled Norway Cup denominator. Surface rows remain in source scope.',
      evidence: 'Later complete publication.',
    },
    {
      studyId: 'S627',
      role: 'audit_only',
      includeInAnalysisExport: false,
      anchorStudyId: 'S605',
      relationship: 'incorporated',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S627 is an earlier bibliographic representation of the same Norway Cup totals and is source-only.',
      evidence: 'Exact repeated denominator and outcome totals.',
    },
  ],
});

addFamily({
  familyKey: 'fifa11-collegiate-men',
  label: 'FIFA 11+ collegiate male trial',
  analysisUnit: 'S628 control and intervention arms',
  anchors: ['S628'],
  evidence: 'S026 explicitly states that it reuses the S628 trial dataset for ACL analysis; S116 duplicates S026.',
  papers: [
    {
      studyId: 'S628',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S628 owns the collegiate male FIFA 11+ trial denominators.',
      evidence: 'Primary trial.',
    },
    {
      studyId: 'S026',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S628',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S026 is the ACL-specific retrospective analysis of S628 and is source-only.',
      evidence: 'Existing live note and paper Methods identify the parent trial.',
    },
    {
      studyId: 'S116',
      role: 'audit_only',
      includeInAnalysisExport: false,
      anchorStudyId: 'S026',
      relationship: 'incorporated',
      rowMode: 'all_false',
      note: duplicateNote('S116', 'S026', 'FIFA 11+ ACL analysis'),
      evidence: 'Bibliographic duplicate.',
    },
  ],
});

addFamily({
  familyKey: 'fifa11-kids-multicountry',
  label: '11+ Kids multicountry cluster trial',
  analysisUnit: 'S481 control and intervention arms',
  anchors: ['S481'],
  evidence: 'S430 is explicitly a severe-injury secondary analysis of the same multicountry trial arms.',
  papers: [
    {
      studyId: 'S481',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S481 owns the multicountry 11+ Kids trial arm denominators.',
      evidence: 'Primary multicountry cluster trial.',
    },
    {
      studyId: 'S430',
      role: 'nested_subset',
      includeInAnalysisExport: false,
      anchorStudyId: 'S481',
      relationship: 'nested',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S430 is the severe-injury secondary analysis of S481 and is source-only.',
      evidence: 'Exact arm populations and near-identical exposure totals.',
    },
  ],
});

addFamily({
  familyKey: 'norwegian-ankle-risk-substudy',
  label: 'Norwegian male amateur ankle-risk substudy',
  analysisUnit: 'Audit-only because the parent randomised trial is not a live paper',
  anchors: [],
  evidence: 'S209 Methods state that it reuses a randomised injury-prevention trial cohort. The parent Engebretsen et al. 2008 paper is not present in the live papers table.',
  papers: [{
    studyId: 'S209',
    role: 'audit_only',
    includeInAnalysisExport: false,
    rowMode: 'all_false',
    note: 'Source-family overlap treatment, 27 July 2026: S209 is a risk-factor re-analysis of a parent randomised trial that is not present as a live paper. It is source-only and remains unresolved to an in-corpus anchor.',
    evidence: 'Primary PDF Methods and reference list.',
  }],
});

const canonicalDuplicateFamilies = [
  ['swedish-elite-sex-2005', 'Swedish elite male/female 2005', 'S058', ['S118']],
  ['nordic-hamstring-high-school', 'Nordic hamstring high-school trial', 'S028', ['S117']],
  ['female-hypermobility-2014-15', 'Female elite joint-hypermobility cohort', 'S086', ['S121']],
  ['hamstring-prevention-elite', 'Elite hamstring-prevention intervention', 'S087', ['S122']],
  ['german-knee-prevention', 'German severe-knee-injury prevention cohort', 'S088', ['S123']],
  ['sao-paulo-2016', 'São Paulo professional championship 2016', 'S089', ['S124']],
  ['brazil-2019', 'Brazilian championship 2019', 'S090', ['S125']],
  ['australian-ankle-risk', 'Australian amateur ankle-risk cohort', 'S092', ['S126']],
  ['high-school-concussion-trends', 'US high-school concussion trends', 'S094', ['S127']],
  ['norway-text-message-method', 'Norwegian women’s text-message method study', 'S095', ['S128']],
  ['fifa11-shoulder-goalkeepers', 'FIFA 11+ shoulder goalkeeper trial', 'S099', ['S131']],
  ['match-congestion-single-club', 'Single-club match-congestion study', 'S100', ['S132']],
  ['english-youth-female-2019-20', 'English elite youth female 2019/20', 'S102', ['S133']],
  ['saudi-surface-pilot', 'Saudi national-team surface pilot', 'S103', ['S134']],
  ['caribbean-women-league', 'Caribbean amateur women’s league', 'S104', ['S135']],
  ['french-academy-workload', 'French academy workload study', 'S115', ['S114']],
  ['epl-workload-model', 'English Premier League workload model', 'S139', ['S082']],
  ['futsal-preseason-levels', 'Futsal preseason competitive-level study', 'S1402', ['S303']],
  ['brazil-shoulder-2016-19', 'Brazilian professional shoulder cohort', 'S989', ['S273']],
  ['dutch-growth-injuries-2021-22', 'Dutch youth growth-related injury cohort', 'S2813', ['S338']],
  ['swiss-youth-muscle-2016-17', 'Swiss youth muscle-injury cohort', 'S644', ['S645']],
];
for (const [familyKey, label, canonicalStudyId, duplicateStudyIds] of canonicalDuplicateFamilies) {
  addDuplicateFamily({
    familyKey,
    label,
    canonicalStudyId,
    duplicateStudyIds,
    evidence: 'Bibliographic identity confirmed by normalised title, archived duplicate record, matching source data, or exact registered file identity.',
  });
}

addFamily({
  familyKey: 'dutch-amateur-rct-2009-10',
  label: 'Dutch amateur injury-prevention RCT, 2009/10',
  analysisUnit: 'S532 intervention and control arms',
  anchors: ['S532'],
  evidence: 'Exact arm sizes, teams and injury totals. S534 is the conference abstract.',
  papers: [
    {
      studyId: 'S532',
      role: 'anchor',
      includeInAnalysisExport: true,
      note: 'Source-family overlap treatment, 27 July 2026: S532 is the full-paper anchor for the Dutch amateur RCT.',
      evidence: 'Full publication.',
    },
    {
      studyId: 'S534',
      role: 'audit_only',
      includeInAnalysisExport: false,
      anchorStudyId: 'S532',
      relationship: 'incorporated',
      rowMode: 'all_false',
      note: 'Source-family overlap treatment, 27 July 2026: S534 is the conference-abstract representation of S532 and is source-only.',
      evidence: 'Exact arm denominators and outcomes.',
    },
  ],
});

const tournamentDuplicateAliases = [
  ['S038', 'S010', '2014 FIFA World Cup paper duplicate'],
  ['S119', 'S064', 'women’s FIFA tournament paper duplicate'],
  ['S129', 'S096', 'three-World-Cup score-state paper duplicate'],
];
addFamily({
  familyKey: 'tournament-import-aliases',
  label: 'Tournament import aliases',
  analysisUnit: 'Existing validated tournament anchors and supplements',
  anchors: ['S010', 'S064', 'S096'],
  evidence: 'Archived bibliographic aliases of records already governed by the committed tournament source ledger.',
  papers: tournamentDuplicateAliases.map(([studyId, anchorStudyId, evidence]) => ({
    studyId,
    role: 'audit_only',
    includeInAnalysisExport: false,
    anchorStudyId,
    relationship: 'incorporated',
    rowMode: 'all_false',
    note: duplicateNote(studyId, anchorStudyId, 'validated tournament source ledger'),
    evidence,
  })),
});

candidateDispositions.push(
  {
    studyIds: ['S010', 'S037', 'S039', 'S048', 'S059', 'S064', 'S078', 'S081', 'S096', 'S256', 'S259', 'S277', 'S640', 'S5151', 'S2615'],
    disposition: 'existing validated treatment preserved',
    reason: 'The committed tournament source ledger and real export verification already govern these records. S5151 remains in the UEFA ECIS workflow; S2615 remains validated as requested.',
  },
  {
    studyIds: ['S3946'],
    disposition: 'separate analysis family',
    reason: 'Cameroon professional playoff surveillance, not an Aspire Academy cohort despite coincidental extracted values.',
  },
  {
    studyIds: ['S050', 'S594'],
    disposition: 'comparable populations, no demonstrated overlap',
    reason: 'Different total cohorts and regions: S050 observes 264 players across age/skill groups; S594 follows a distinct 444-player Czech/Alsace youth cohort.',
  },
  {
    studyIds: ['S176', 'S212'],
    disposition: 'separate analysis families',
    reason: 'Norwegian pandemic-season comparison versus German shortened-winter-break comparison.',
  },
  {
    studyIds: ['S188', 'S396'],
    disposition: 'separate tournament families',
    reason: 'Rio 2016 versus London 2012 Paralympic Games.',
  },
  {
    studyIds: ['S620', 'S707'],
    disposition: 'comparable but separate cohorts',
    reason: 'Male versus female Spanish professional cohorts with different publications and no primary-source evidence of shared participants.',
  },
  {
    studyIds: ['S4652', 'S5338'],
    disposition: 'existing separate analysis families preserved',
    reason: 'CONMEBOL club competitions versus Copa América national-team tournament. Existing validated metadata already records the separation.',
  },
  {
    studyIds: ['S392', 'S457'],
    disposition: 'shared surveillance system, separate sex-specific cohorts',
    reason: 'NCAA men’s and women’s soccer records are comparable system-level sources but not duplicate populations.',
  },
  {
    studyIds: ['S4562', 'S4619'],
    disposition: 'shared national-team programme, separate disciplines',
    reason: 'Futsal versus beach soccer cohorts; no shared denominator.',
  },
  {
    studyIds: ['S316', 'S363'],
    disposition: 'paired systematic-review parts, not primary surveillance denominators',
    reason: 'Part I and Part II are review publications and remain outside primary cohort aggregation.',
  },
);

const preferredStableFields = [
  'observationDuration',
  'totalExposure',
  'matchExposure',
  'trainingExposure',
  'sampleSizePlayers',
  'numberOfTeams',
  'injuryTotalCount',
  'injuryTimeLossTotal',
  'ageCategory',
  'sex',
  'studyId',
];

function buildExpectedValues(group) {
  const available = {
    ...(group.stableValues ?? {}),
    ...(group.values ?? {}),
  };
  const selected = [];
  for (const fieldId of preferredStableFields) {
    const value = available[fieldId];
    if (value == null || !String(value).trim()) continue;
    selected.push([fieldId, String(value)]);
    if (selected.length === 2) break;
  }
  if (selected.length === 0) {
    for (const [fieldId, value] of Object.entries(available)) {
      if (value == null || !String(value).trim()) continue;
      selected.push([fieldId, String(value)]);
      if (selected.length === 2) break;
    }
  }
  return Object.fromEntries(selected);
}

function treatmentFor(decision) {
  const sourceLinks = decision.anchorStudyId
    ? [{
        anchorStudyId: decision.anchorStudyId,
        relationship: decision.relationship ?? 'overlaps',
        tournamentKey: decision.familyKey,
        notes: decision.evidence ?? null,
      }]
    : [];
  const record = paperByStudyId.get(decision.studyId);
  const groups = record.populationGroups ?? [];
  const includePositions = new Set(
    decision.rowMode === 'all_false'
      ? []
      : decision.rowMode === 'include_positions'
        ? decision.includePositions ?? []
        : groups.map((group) => group.position),
  );
  const populationTreatments = groups.map((group) => ({
    populationPosition: group.position,
    expectedLabel: group.label,
    tournamentKey: decision.rowKeys?.[group.position]
      ?? `${decision.familyKey}: ${group.label}`,
    includeInAnalysisExport: decision.includeInAnalysisExport && includePositions.has(group.position),
    expectedValues: buildExpectedValues(group),
  }));
  const populationExclusions = populationTreatments
    .filter((row) => !row.includeInAnalysisExport)
    .map((row) => ({
      populationPosition: row.populationPosition,
      expectedLabel: row.expectedLabel,
      anchorStudyId: decision.anchorStudyId
        ?? (decision.includeInAnalysisExport ? decision.studyId : null),
      tournamentKey: row.tournamentKey,
      notes: decision.evidence ?? `Source-only row in ${decision.familyLabel}`,
    }));
  return {
    version: VERSION,
    role: decision.role,
    includeInAnalysisExport: decision.includeInAnalysisExport,
    sourceLinks,
    populationExclusions,
    requireCompletePopulationMap: groups.length > 0,
    populationTreatments,
  };
}

const rowIdentityGaps = [];
const stagedPapers = decisions
  .filter((decision) => decision.stage !== false)
  .map((decision) => {
    const intendedTreatment = treatmentFor(decision);
    for (const row of intendedTreatment.populationTreatments) {
      if (Object.keys(row.expectedValues).length === 0) {
        rowIdentityGaps.push({
          studyId: decision.studyId,
          populationPosition: row.populationPosition,
          expectedLabel: row.expectedLabel,
        });
      }
    }
    return {
      studyId: decision.studyId,
      familyKey: decision.familyKey,
      note: decision.note,
      evidence: decision.evidence,
      allowRowPolicyUpgrade: decision.allowRowPolicyUpgrade === true,
      intendedTreatment,
    };
  });

const coveredStudyIds = new Set([
  ...decisions.map((decision) => decision.studyId),
  ...candidateDispositions.flatMap((disposition) => disposition.studyIds),
]);
const unreviewedComponents = inventory.familyComponents
  .map((component) => component.filter((studyId) => !coveredStudyIds.has(studyId)))
  .filter((component) => component.length > 0);

const decisionArtifact = {
  artifactType: 'Source-family overlap evidence and decision ledger',
  generatedAt: new Date().toISOString(),
  version: VERSION,
  sourceInventory: path.relative(APP_ROOT, INVENTORY_PATH),
  summary: {
    familyCount: families.length,
    stagedPaperCount: stagedPapers.length,
    candidateDispositionCount: candidateDispositions.length,
    rowIdentityGapCount: rowIdentityGaps.length,
    unreviewedComponentCount: unreviewedComponents.length,
  },
  families,
  candidateDispositions,
  rowIdentityGaps,
  unreviewedComponents,
};
const treatmentArtifact = {
  artifactType: 'Staged live analysis source-treatment input',
  generatedAt: new Date().toISOString(),
  version: VERSION,
  writeBoundary: 'papers.metadata.analysisSourceTreatment and additive paper_notes only',
  papers: stagedPapers,
};
const rowArtifact = {
  artifactType: 'Complete source-verified row-treatment input',
  generatedAt: new Date().toISOString(),
  version: VERSION,
  papers: stagedPapers
    .filter((paper) => paper.intendedTreatment.requireCompletePopulationMap)
    .map((paper) => ({
      studyId: paper.studyId,
      familyKey: paper.familyKey,
      requireCompletePopulationMap: true,
      rows: paper.intendedTreatment.populationTreatments,
    })),
  rowIdentityGaps,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(DECISION_PATH, `${JSON.stringify(decisionArtifact, null, 2)}\n`);
fs.writeFileSync(TREATMENT_PATH, `${JSON.stringify(treatmentArtifact, null, 2)}\n`);
fs.writeFileSync(ROW_PATH, `${JSON.stringify(rowArtifact, null, 2)}\n`);

console.log(JSON.stringify({
  decisionPath: DECISION_PATH,
  treatmentPath: TREATMENT_PATH,
  rowPath: ROW_PATH,
  summary: decisionArtifact.summary,
  rowIdentityGaps,
  unreviewedComponents,
}, null, 2));
