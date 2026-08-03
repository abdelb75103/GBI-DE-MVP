#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const AUDIT_DIR = path.join(
  APP_ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/extraction-gate-audit-2026-07-30',
);
const OUTPUT_PATH = path.join(
  AUDIT_DIR,
  'bridge-extraction-payload-2026-07-30.json',
);
const VERSION = 'full-text-ai-one-human-bridge-2026-07-30-v1';
const GENERATED_AT = '2026-07-30T18:45:00.000Z';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, relativePath), 'utf8'));
}

const s683 = readJson('prep-s683-s2761/s683-stage-a-proposal.json');
const s2761 = readJson('prep-s683-s2761/s2761-stage-a-proposal.json');
const s3931s4859 = readJson('prep-s3931-s4859/stage-a-proposal.json');
const s4860 = readJson('prep-s4860-s2699/s4860-stage-a-tabs-1-10-proposal.json');
const s2699 = readJson('prep-s4860-s2699/s2699-reference-check-only-proposal.json');

const proposalById = new Map(
  s3931s4859.papers.map((paper) => [paper.studyId, paper]),
);
const sourceById = new Map(
  s3931s4859.stageA.sourceFiles.map((source) => [source.studyId, source]),
);

function primary(item, note, source) {
  return {
    studyId: item.studyId,
    populationLabels: item.populationLabels,
    fields: item.fields,
    note,
    source,
  };
}

const payload = {
  version: VERSION,
  generatedAt: GENERATED_AT,
  papers: [
    primary(
      s683,
      'Male youth futsal subgroup extracted across Futsal - all seasons / 2015 / 2016 / 2017. Direct lower-limb-trauma counts are 3, 7 and 1, with the all-seasons count 11 recorded as the transparent sum of disjoint season rows. Published futsal incidence is 1.9, 4.4 and 0.6 per 1,000 total exposure hours. Whole-club exposure totals, age, sex distribution and all-sport locations were not assigned to the futsal subgroup.',
      {
        sha256: s683.source.sha256,
        screeningRecordId: s683.screeningRecordId,
        document: s683.source.document,
      },
    ),
    primary(
      s2761,
      'Prospective five-season Turkish Super League surveillance extracted as Total / Goalkeeper / Defenders / Midfielders / Forwards. Conflicting source injury totals of 224, 229 and 227 were not reconciled, so total injury count remains blank. The repeated abstract/Results incidence of 8.9 per 1,000 combined hours is retained with its reported 8.72-9.0 CI, while the conflicting Discussion value of 8.49 remains a review caveat. Injury time loss 4,457 is a transparent sum of direct components, although the paper alternates between sessions and days.',
      {
        sha256: s2761.source.sha256,
        screeningRecordId: s2761.screeningRecordId,
        document: s2761.source.document,
      },
    ),
    primary(
      proposalById.get('S3931'),
      proposalById.get('S3931').note,
      {
        sha256: sourceById.get('S3931').sha256,
        screeningRecordId: '06602261-8794-42a8-9344-2cf6f443bb59',
        document: sourceById.get('S3931').path,
      },
    ),
    primary(
      proposalById.get('S4859'),
      proposalById.get('S4859').note,
      {
        sha256: sourceById.get('S4859').sha256,
        screeningRecordId: '322717ea-99c3-40c2-868d-6f5ba58592da',
        document: sourceById.get('S4859').path,
      },
    ),
    primary(
      {
        studyId: s4860.studyId,
        populationLabels: s4860.stageA.populationLabels,
        fields: s4860.stageA.fields,
      },
      'Soccer-only girls and boys subgroups extracted from the multi-sport study. Direct Table II concussion counts, athlete-exposures, training/competition/overall rates and confidence intervals are retained. Contact totals of 30 girls and 17 boys are transparent sums of the five explicitly contact-classified Table IV categories; unknown mechanism is excluded. No soccer-specific player, team, season, time-loss, illness, location or tissue values were inferred.',
      {
        sha256: s4860.source.sha256,
        screeningRecordId: s4860.screeningRecordId,
        document: s4860.source.citation,
      },
    ),
  ],
  systematicReview: {
    studyId: s2699.studyId,
    note: s2699.minimalProposedLiveChange.paperNote,
    source: {
      sha256: s2699.source.sha256,
      screeningRecordId: s2699.screeningRecordId,
      document: s2699.source.citation,
    },
  },
};

const expected = ['S683', 'S2761', 'S3931', 'S4859', 'S4860'];
if (JSON.stringify(payload.papers.map((paper) => paper.studyId)) !== JSON.stringify(expected)) {
  throw new Error('Combined payload does not contain the exact five primary studies.');
}
for (const paper of payload.papers) {
  if (!paper.note || !paper.source.sha256 || !paper.source.screeningRecordId) {
    throw new Error(`${paper.studyId}: incomplete combined payload.`);
  }
}

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(OUTPUT_PATH);
