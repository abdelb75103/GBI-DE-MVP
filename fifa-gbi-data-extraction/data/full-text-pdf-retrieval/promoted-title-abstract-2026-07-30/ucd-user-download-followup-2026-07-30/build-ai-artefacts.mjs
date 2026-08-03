import fs from 'node:fs';
import path from 'node:path';

const baseDirectory =
  '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main/fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30';
const followupDirectory = path.join(
  baseDirectory,
  'ucd-user-download-followup-2026-07-30',
);
const previousDirectory = path.join(baseDirectory, 'ucd-second-pass-2026-07-30');
const uploadResultPath = path.join(
  followupDirectory,
  'upload-result-2026-07-30T15-27-46-466Z.json',
);
const newRecommendationsPath = path.join(
  followupDirectory,
  'ai-review-newly-attached-five-2026-07-30/recommendations.json',
);
const priorRecommendationsPath = path.join(
  previousDirectory,
  'combined-recommendations.json',
);
const deltaUploadResultPath = path.join(followupDirectory, 'ai-delta-upload-result.json');
const combinedRecommendationsPath = path.join(
  followupDirectory,
  'combined-recommendations.json',
);
const criteriaVersion = 'fifa-gbi-full-text-v8-2026-06-23';

const uploadResult = JSON.parse(fs.readFileSync(uploadResultPath, 'utf8'));
const priorPayload = JSON.parse(fs.readFileSync(priorRecommendationsPath, 'utf8'));
const newPayload = JSON.parse(fs.readFileSync(newRecommendationsPath, 'utf8'));
const priorRecommendations = priorPayload.recommendations ?? priorPayload;
const newRecommendations = newPayload.recommendations ?? newPayload;
const newUploadResults = uploadResult.results.filter(
  (row) => row.status === 'uploaded_verified',
);
const newByStudyId = new Map(newRecommendations.map((row) => [row.studyId, row]));

if (newUploadResults.length !== 5 || newRecommendations.length !== 5) {
  throw new Error('The AI delta must contain exactly five newly uploaded records.');
}
for (const upload of newUploadResults) {
  const recommendation = newByStudyId.get(upload.studyId);
  if (
    !recommendation
    || recommendation.recordId !== upload.recordId
    || recommendation.pdfSha256 !== upload.sha256
    || recommendation.criteriaVersion !== criteriaVersion
  ) {
    throw new Error(`${upload.studyId}: AI delta identity, hash or criteria mismatch.`);
  }
}

const combined = [...priorRecommendations, ...newRecommendations];
const seen = new Set();
const attachedByStudyId = new Map(
  uploadResult.results
    .filter((row) => ['uploaded_verified', 'already_uploaded_same_hash'].includes(row.status))
    .map((row) => [row.studyId, row]),
);
for (const recommendation of combined) {
  if (seen.has(recommendation.studyId)) {
    throw new Error(`Duplicate recommendation for ${recommendation.studyId}.`);
  }
  seen.add(recommendation.studyId);
  const upload = attachedByStudyId.get(recommendation.studyId);
  if (
    !upload
    || recommendation.recordId !== upload.recordId
    || recommendation.pdfSha256 !== upload.sha256
    || recommendation.criteriaVersion !== criteriaVersion
  ) {
    throw new Error(`${recommendation.studyId}: combined recommendation mismatch.`);
  }
}
if (combined.length !== attachedByStudyId.size) {
  throw new Error('Combined recommendations do not cover every verified attachment.');
}

fs.writeFileSync(
  deltaUploadResultPath,
  `${JSON.stringify({
    scope: 'Five newly uploaded and verified user-download follow-up records only',
    generatedAt: new Date().toISOString(),
    sourcePath: uploadResultPath,
    results: newUploadResults,
  }, null, 2)}\n`,
  { flag: 'wx' },
);
fs.writeFileSync(
  combinedRecommendationsPath,
  `${JSON.stringify({
    criteriaVersion,
    generatedAt: new Date().toISOString(),
    scope: 'Every and only the 24 verified attached records in the exact 27-record workflow',
    sourcePaths: {
      priorRecommendations: priorRecommendationsPath,
      newRecommendations: newRecommendationsPath,
      uploadResult: uploadResultPath,
    },
    recommendations: combined,
  }, null, 2)}\n`,
  { flag: 'wx' },
);
console.log(JSON.stringify({
  deltaUploadResultPath,
  combinedRecommendationsPath,
  newRecommendations: newRecommendations.length,
  combinedRecommendations: combined.length,
}, null, 2));
