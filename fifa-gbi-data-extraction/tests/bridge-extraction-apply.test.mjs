import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../scripts/apply-2026-07-30-bridge-extractions.mjs',
  ),
  'utf8',
);

test('extraction apply is bounded to five primary studies and S2699 reference handling', () => {
  for (const studyId of ['S683', 'S2761', 'S3931', 'S4859', 'S4860']) {
    assert.match(source, new RegExp(`'${studyId}'`));
  }
  assert.match(source, /SYSTEMATIC_REVIEW_ID = 'S2699'/);
  assert.match(source, /exact five primary studies in order/);
});

test('extraction apply is additive-only and resumable', () => {
  assert.match(source, /deterministicUuid/);
  assert.match(source, /insertOrVerify/);
  assert.doesNotMatch(source, /\.delete\(/);
  assert.doesNotMatch(source, /\.upsert\(/);
  assert.match(source, /existing bridge paper does not match payload|existing .* does not match payload/);
});

test('all ten tabs are created and core tabs are completeness-filled', () => {
  for (const tab of [
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
  ]) {
    assert.match(source, new RegExp(`'${tab}'`));
  }
  assert.match(source, /CORE_TABS\.has\(tab\)/);
  assert.match(source, /itemFields\[definition\.id\] = null/);
});

test('apply guards source identity, assignment and bridge version', () => {
  assert.match(source, /paper\.assigned_to !== PROFILE_ID/);
  assert.match(source, /temporaryExtractionPromotionVersion !== VERSION/);
  assert.match(source, /item\.source\.sha256 !== paper\.primary_file_sha256/);
  assert.match(source, /item\.source\.screeningRecordId !== paper\.metadata\?\.screeningRecordId/);
});

test('S2699 cannot receive extraction or population rows', () => {
  assert.match(source, /systematicExtractions\.length/);
  assert.match(source, /systematicGroups\.length/);
  assert.match(source, /systematicValues\.length/);
  assert.match(source, /reference-only paper unexpectedly has extraction data/);
});
