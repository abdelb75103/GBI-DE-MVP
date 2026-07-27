import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATE = '2026-07-27';
const APPLY = process.argv.includes('--apply');
const OUT_DIR = path.join(ROOT, 'data', 'aspetar-reconciliation');
const INPUT_PATH = path.join(OUT_DIR, `aspetar-anchor-reconciliation-input-${DATE}.json`);
const OUTPUT_PATH = path.join(OUT_DIR, `aspetar-duplicate-field-alias-repair-${DATE}.json`);
const STUDY_IDS = ['S261', 'S602'];
const FIELD_IDS = ['injuryDefinition', 'mechanismReporting'];

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const inputByStudyId = new Map(input.papers.map((paper) => [paper.studyId, paper]));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: papers, error } = await supabase
  .from('papers')
  .select('id,assigned_study_id,extractions(id,tab,extraction_fields(id,field_id,value,updated_at))')
  .in('assigned_study_id', STUDY_IDS)
  .order('assigned_study_id');
if (error) throw error;

const repairs = [];
for (const paper of papers ?? []) {
  const staged = inputByStudyId.get(paper.assigned_study_id);
  const definitions = staged?.fields?.definitions ?? {};
  for (const extraction of paper.extractions ?? []) {
    for (const field of extraction.extraction_fields ?? []) {
      if (!FIELD_IDS.includes(field.field_id)) continue;
      const expectedValue = definitions[field.field_id];
      if (expectedValue == null || field.value === expectedValue) continue;
      repairs.push({
        studyId: paper.assigned_study_id,
        extractionId: extraction.id,
        tab: extraction.tab,
        fieldId: field.field_id,
        fieldRowId: field.id,
        beforeValue: field.value,
        afterValue: expectedValue,
        beforeUpdatedAt: field.updated_at,
      });
    }
  }
}

if (APPLY) {
  for (const repair of repairs) {
    const { error: updateError } = await supabase
      .from('extraction_fields')
      .update({
        value: repair.afterValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', repair.fieldRowId);
    if (updateError) throw updateError;
  }
}

const audit = {
  artifactType: 'Aspetar duplicate extraction-field alias repair',
  date: DATE,
  mode: APPLY ? 'apply' : 'dry-run',
  reason: 'Legacy extraction rows in non-canonical tabs reused two schema field IDs. Aligning the aliases prevents population rebuild order from selecting stale values.',
  fixedMembership: STUDY_IDS,
  fixedFieldIds: FIELD_IDS,
  repairs,
};
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  result: APPLY ? 'applied' : 'dry-run',
  output: OUTPUT_PATH,
  repairCount: repairs.length,
  repairs: repairs.map(({ studyId, tab, fieldId, beforeValue, afterValue }) => ({
    studyId,
    tab,
    fieldId,
    beforeValue,
    afterValue,
  })),
}, null, 2));
