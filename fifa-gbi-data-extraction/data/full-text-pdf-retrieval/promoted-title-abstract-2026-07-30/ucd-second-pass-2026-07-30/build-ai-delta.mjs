import fs from 'node:fs';
import path from 'node:path';

const directory =
  '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main/fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/ucd-second-pass-2026-07-30';
const sourcePath = path.join(directory, 'upload-result-2026-07-30T14-39-19-454Z.json');
const recommendationsPath = path.join(directory, 'ai-review/recommendations.json');
const outputPath = path.join(directory, 'ai-delta-upload-result.json');

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const recommendationsPayload = JSON.parse(fs.readFileSync(recommendationsPath, 'utf8'));
const recommendations = recommendationsPayload.recommendations ?? recommendationsPayload;
const recommendationByStudyId = new Map(
  recommendations.map((row) => [row.studyId, row]),
);
const results = source.results.filter((row) => row.status === 'uploaded_verified');

if (results.length !== recommendations.length) {
  throw new Error('New upload and recommendation counts differ.');
}
for (const result of results) {
  const recommendation = recommendationByStudyId.get(result.studyId);
  if (
    !recommendation
    || recommendation.recordId !== result.recordId
    || recommendation.pdfSha256 !== result.sha256
  ) {
    throw new Error(`${result.studyId}: AI delta identity or hash mismatch.`);
  }
}

const payload = {
  scope: 'Five newly uploaded and verified UCD second-pass records only',
  generatedAt: new Date().toISOString(),
  sourcePath,
  results,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({
  outputPath,
  results: results.map((row) => row.studyId),
}, null, 2));
