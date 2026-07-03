import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const ROOT = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const inputPath = process.argv.find((arg) => arg.startsWith('--input='))?.split('=')[1];
const APPLY = args.has('--apply');
const OVERWRITE = args.has('--overwrite');
const COMPLETE_CORE_TABS = args.has('--complete-core-tabs');
const CORE_TABS = new Set(['studyDetails', 'participantCharacteristics', 'definitions', 'exposure']);

if (!inputPath) {
  throw new Error('Usage: node --experimental-strip-types scripts/apply-second-search-extraction-json.mjs --input=/path/file.json [--apply] [--overwrite] [--complete-core-tabs]');
}

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const { extractionFieldDefinitions } = await import('../src/lib/extraction/schema.ts');
const { createPopulationSignature, derivePopulationGroups } = await import('../src/lib/extraction/populations.ts');
const { normalizeGlobalFieldValue } = await import('../src/lib/extraction/normalize.ts');

const definitionById = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
const papers = Array.isArray(payload.papers) ? payload.papers : [payload];
const report = { mode: APPLY ? 'apply' : 'dry-run', input: path.resolve(inputPath), papers: [] };

const ensureExtraction = async (paperId, tab) => {
  const { data: existing, error: lookupError } = await supabase
    .from('extractions')
    .select('*')
    .eq('paper_id', paperId)
    .eq('tab', tab)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const row = {
    id: crypto.randomUUID(),
    paper_id: paperId,
    tab,
    model: 'human-input',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (APPLY) {
    const { error } = await supabase.from('extractions').insert(row);
    if (error) throw error;
  }
  return row;
};

const syncPopulations = async (paperId, populationLabels = []) => {
  const { data: extractionRows, error } = await supabase
    .from('extractions')
    .select('id, extraction_fields(*)')
    .eq('paper_id', paperId);
  if (error) throw error;

  const fields = (extractionRows ?? []).flatMap((row) =>
    (row.extraction_fields ?? []).map((field) => ({
      fieldId: field.field_id,
      value: field.value,
      metric: field.metric,
    })),
  );
  const groups = derivePopulationGroups(fields);
  if (populationLabels.length && populationLabels.length !== groups.length) {
    throw new Error(`Expected ${groups.length} population labels, received ${populationLabels.length}`);
  }
  groups.forEach((group, index) => {
    group.label = populationLabels[index] ?? group.label;
  });

  const groupRows = groups.map((group, index) => ({
    id: crypto.randomUUID(),
    paper_id: paperId,
    tab: 'participantCharacteristics',
    label: group.label,
    position: index,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const valueRows = [];
  for (const groupRow of groupRows) {
    const parsed = groups[groupRow.position];
    for (const [fieldId, value] of Object.entries(parsed.values)) {
      valueRows.push({
        id: crypto.randomUUID(),
        population_group_id: groupRow.id,
        paper_id: paperId,
        field_id: fieldId,
        source_field_id: fieldId,
        value,
        metric: definitionById.get(fieldId)?.metric ?? null,
        unit: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (!APPLY) return { groups: groups.length, values: valueRows.length };

  const { data: priorGroups, error: priorGroupError } = await supabase
    .from('population_groups')
    .select('*')
    .eq('paper_id', paperId);
  if (priorGroupError) throw priorGroupError;
  const { data: priorValues, error: priorValueError } = await supabase
    .from('population_values')
    .select('*')
    .eq('paper_id', paperId);
  if (priorValueError) throw priorValueError;

  const clearPopulations = async () => {
    const { error: valueDeleteError } = await supabase.from('population_values').delete().eq('paper_id', paperId);
    if (valueDeleteError) throw valueDeleteError;
    const { error: groupDeleteError } = await supabase.from('population_groups').delete().eq('paper_id', paperId);
    if (groupDeleteError) throw groupDeleteError;
  };

  await clearPopulations();
  try {
    if (groupRows.length) {
      const { error: groupError } = await supabase.from('population_groups').insert(groupRows);
      if (groupError) throw groupError;
    }
    if (valueRows.length) {
      const { error: valueError } = await supabase.from('population_values').insert(valueRows);
      if (valueError) throw valueError;
    }
    const { data: paperRow, error: paperLookupError } = await supabase
      .from('papers')
      .select('metadata')
      .eq('id', paperId)
      .single();
    if (paperLookupError) throw paperLookupError;
    const { error: metadataError } = await supabase
      .from('papers')
      .update({
        metadata: {
          ...(paperRow.metadata ?? {}),
          populationLabels: groups.map((group) => group.label),
          populationHash: createPopulationSignature(groups),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', paperId);
    if (metadataError) throw metadataError;
  } catch (replacementError) {
    await clearPopulations();
    if (priorGroups?.length) {
      const { error: restoreGroupError } = await supabase.from('population_groups').insert(priorGroups);
      if (restoreGroupError) throw new AggregateError([replacementError, restoreGroupError], 'Population rebuild and rollback failed');
    }
    if (priorValues?.length) {
      const { error: restoreValueError } = await supabase.from('population_values').insert(priorValues);
      if (restoreValueError) throw new AggregateError([replacementError, restoreValueError], 'Population rebuild and rollback failed');
    }
    throw replacementError;
  }
  return { groups: groups.length, values: valueRows.length };
};

for (const item of papers) {
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('id, assigned_study_id')
    .eq('assigned_study_id', item.studyId)
    .maybeSingle();
  if (paperError) throw paperError;
  if (!paper) throw new Error(`${item.studyId}: paper not found`);

  const paperReport = { studyId: item.studyId, written: [], skipped: [], unknownFields: [] };

  const writeField = async (extraction, fieldId, rawValue, existing) => {
    const definition = definitionById.get(fieldId);
    if (!definition) {
      paperReport.unknownFields.push(fieldId);
      return;
    }
    const existingValue = existing.get(fieldId);
    if (!OVERWRITE && existingValue && String(existingValue).trim()) {
      paperReport.skipped.push({ fieldId, reason: 'nonblank_exists' });
      return;
    }
    const value = fieldId === 'studyId'
      ? paper.assigned_study_id
      : normalizeGlobalFieldValue(fieldId, rawValue == null ? null : String(rawValue));
    const row = {
      id: crypto.randomUUID(),
      extraction_id: extraction.id,
      field_id: fieldId,
      value,
      confidence: null,
      source_quote: null,
      page_hint: null,
      metric: definition.metric ?? null,
      status: value ? 'reported' : 'not_reported',
      updated_at: new Date().toISOString(),
      updated_by: PROFILE_ID,
    };
    if (APPLY) {
      const { error } = await supabase
        .from('extraction_fields')
        .upsert(row, { onConflict: 'extraction_id,field_id' });
      if (error) throw error;
      const { error: extractionUpdateError } = await supabase
        .from('extractions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', extraction.id);
      if (extractionUpdateError) throw extractionUpdateError;
    }
    existing.set(fieldId, value);
    paperReport.written.push(fieldId);
  };

  for (const [tab, fields] of Object.entries(item.fields ?? {})) {
    const extraction = await ensureExtraction(paper.id, tab);
    const { data: existingRows, error: existingError } = await supabase
      .from('extraction_fields')
      .select('field_id, value')
      .eq('extraction_id', extraction.id);
    if (existingError) throw existingError;
    const existing = new Map((existingRows ?? []).map((row) => [row.field_id, row.value]));

    for (const [fieldId, rawValue] of Object.entries(fields)) {
      await writeField(extraction, fieldId, rawValue, existing);
    }
  }

  if (COMPLETE_CORE_TABS) {
    for (const tab of CORE_TABS) {
      const extraction = await ensureExtraction(paper.id, tab);
      const { data: existingRows, error: existingError } = await supabase
        .from('extraction_fields')
        .select('field_id, value')
        .eq('extraction_id', extraction.id);
      if (existingError) throw existingError;
      const existing = new Map((existingRows ?? []).map((row) => [row.field_id, row.value]));
      for (const definition of extractionFieldDefinitions.filter((candidate) => candidate.tab === tab)) {
        if (!existing.has(definition.id)) {
          await writeField(extraction, definition.id, null, existing);
        }
      }
    }
  }

  if (APPLY && item.note) {
    const { error: noteError } = await supabase.from('paper_notes').insert({
      id: crypto.randomUUID(),
      paper_id: paper.id,
      body: item.note,
      created_at: new Date().toISOString(),
    });
    if (noteError) throw noteError;
  }

  paperReport.populationSync = await syncPopulations(paper.id, item.populationLabels ?? []);
  report.papers.push(paperReport);
}

console.log(JSON.stringify(report, null, 2));
