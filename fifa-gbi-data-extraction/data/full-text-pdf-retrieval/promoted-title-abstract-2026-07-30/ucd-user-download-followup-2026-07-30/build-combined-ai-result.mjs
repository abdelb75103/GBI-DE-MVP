import fs from 'node:fs';
import path from 'node:path';

const directory = path.dirname(new URL(import.meta.url).pathname);
const priorPath = path.join(directory, '..', 'ucd-second-pass-2026-07-30', 'combined-ai-result.json');
const deltaPath = path.join(directory, 'ai-apply-result-2026-07-30T15-36-10-861Z.json');
const recommendationsPath = path.join(directory, 'combined-recommendations.json');
const outputPath = path.join(directory, 'combined-ai-result.json');

const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
const delta = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
const payload = JSON.parse(fs.readFileSync(recommendationsPath, 'utf8'));
const recommendations = payload.recommendations ?? payload;
const results = [...prior.results, ...delta.results];
const recommendationByStudyId = new Map(recommendations.map((row) => [row.studyId, row]));

if (results.length !== 24 || new Set(results.map((row) => row.studyId)).size !== 24) {
  throw new Error('Combined AI result must contain exactly 24 unique studies.');
}
for (const result of results) {
  const recommendation = recommendationByStudyId.get(result.studyId);
  if (
    !recommendation
    || !['ai_applied_verified', 'already_ai_applied_verified'].includes(result.status)
    || result.recordId !== recommendation.recordId
    || result.decision !== recommendation.decision
    || result.pdfSha256 !== recommendation.pdfSha256
    || result.criteriaVersion !== recommendation.criteriaVersion
  ) {
    throw new Error(`${result.studyId}: applied AI result does not match recommendation.`);
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify({
  scope: 'Every and only the 24 verified attached records in the exact 27-record workflow',
  generatedAt: new Date().toISOString(),
  sourcePaths: { prior: priorPath, delta: deltaPath, recommendations: recommendationsPath },
  results,
}, null, 2)}\n`, { flag: 'wx' });

console.log(JSON.stringify({ outputPath, results: results.length }, null, 2));
