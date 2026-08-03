import fs from 'node:fs';
import path from 'node:path';

const baseDirectory =
  '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main/fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30';
const secondPassDirectory = path.join(baseDirectory, 'ucd-second-pass-2026-07-30');
const priorPath = path.join(
  baseDirectory,
  'ai-apply-result-2026-07-30T13-21-36-645Z.json',
);
const secondPassPath = path.join(
  secondPassDirectory,
  'ai-apply-result-2026-07-30T14-51-45-703Z.json',
);
const recommendationsPath = path.join(
  secondPassDirectory,
  'combined-recommendations.json',
);
const outputPath = path.join(secondPassDirectory, 'combined-ai-result.json');

const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
const secondPass = JSON.parse(fs.readFileSync(secondPassPath, 'utf8'));
const recommendationsPayload = JSON.parse(fs.readFileSync(recommendationsPath, 'utf8'));
const recommendationByRecordId = new Map(
  recommendationsPayload.recommendations.map((row) => [row.recordId, row]),
);
const results = [...prior.results, ...secondPass.results];
const seen = new Set();

for (const result of results) {
  if (seen.has(result.recordId)) {
    throw new Error(`Duplicate AI result for ${result.recordId}.`);
  }
  seen.add(result.recordId);
  const recommendation = recommendationByRecordId.get(result.recordId);
  if (
    !recommendation
    || recommendation.studyId !== result.studyId
    || recommendation.pdfSha256 !== result.pdfSha256
    || recommendation.decision !== result.decision
    || recommendation.criteriaVersion !== result.criteriaVersion
  ) {
    throw new Error(`${result.studyId}: combined AI result mismatch.`);
  }
}
if (results.length !== recommendationByRecordId.size) {
  throw new Error('Combined AI result does not cover every attached recommendation.');
}

const payload = {
  scope: 'All 19 AI-applied and verified attached records in the exact 27-record workflow',
  generatedAt: new Date().toISOString(),
  sourcePaths: {
    prior: priorPath,
    secondPass: secondPassPath,
    recommendations: recommendationsPath,
  },
  results,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({
  outputPath,
  results: results.length,
  statuses: results.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {}),
}, null, 2));
