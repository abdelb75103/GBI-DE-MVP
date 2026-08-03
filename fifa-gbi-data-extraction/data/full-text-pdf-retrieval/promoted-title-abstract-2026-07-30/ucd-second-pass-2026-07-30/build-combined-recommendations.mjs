import fs from 'node:fs';
import path from 'node:path';

const criteriaVersion = 'fifa-gbi-full-text-v8-2026-06-23';
const repositoryRoot = '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main';
const baseDirectory = path.join(
  repositoryRoot,
  'fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30',
);
const secondPassDirectory = path.join(baseDirectory, 'ucd-second-pass-2026-07-30');
const priorPath = path.join(baseDirectory, 'ai-review/recommendations.json');
const newPath = path.join(secondPassDirectory, 'ai-review/recommendations.json');
const uploadResultPath = path.join(
  secondPassDirectory,
  'upload-result-2026-07-30T14-39-19-454Z.json',
);
const outputPath = path.join(secondPassDirectory, 'combined-recommendations.json');

const readRecommendations = (filePath) => {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return payload.recommendations ?? payload;
};

const prior = readRecommendations(priorPath);
const newlyPrepared = readRecommendations(newPath);
const uploadResult = JSON.parse(fs.readFileSync(uploadResultPath, 'utf8'));
const attached = new Map(
  uploadResult.results
    .filter((row) => ['uploaded_verified', 'already_uploaded_same_hash'].includes(row.status))
    .map((row) => [row.studyId, row]),
);

const recommendations = [...prior, ...newlyPrepared];
const seen = new Set();
for (const recommendation of recommendations) {
  if (seen.has(recommendation.studyId)) {
    throw new Error(`Duplicate recommendation for ${recommendation.studyId}.`);
  }
  seen.add(recommendation.studyId);
  const upload = attached.get(recommendation.studyId);
  if (!upload) {
    throw new Error(`${recommendation.studyId} is not in the verified attached set.`);
  }
  if (
    recommendation.recordId !== upload.recordId
    || recommendation.pdfSha256 !== upload.sha256
  ) {
    throw new Error(`${recommendation.studyId} recommendation identity or hash mismatch.`);
  }
  if (recommendation.criteriaVersion !== criteriaVersion) {
    throw new Error(`${recommendation.studyId} uses the wrong criteria version.`);
  }
}

const missing = [...attached.keys()].filter((studyId) => !seen.has(studyId));
if (recommendations.length !== attached.size || missing.length) {
  throw new Error(`Recommendation scope mismatch; missing: ${missing.join(', ') || 'none'}.`);
}

const payload = {
  criteriaVersion,
  generatedAt: new Date().toISOString(),
  scope: 'Every and only the 19 verified attached records in the exact 27-record workflow',
  sourcePaths: {
    priorRecommendations: priorPath,
    secondPassRecommendations: newPath,
    uploadResult: uploadResultPath,
  },
  recommendations,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({
  outputPath,
  recommendations: recommendations.length,
  decisions: recommendations.reduce((counts, row) => {
    counts[row.decision] = (counts[row.decision] ?? 0) + 1;
    return counts;
  }, {}),
}, null, 2));
