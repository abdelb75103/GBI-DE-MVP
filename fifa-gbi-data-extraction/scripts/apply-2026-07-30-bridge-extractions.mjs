#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(APP_ROOT, '.env.local');
const OUT_DIR = path.join(
  APP_ROOT,
  'data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30/extraction-gate-audit-2026-07-30',
);
const VERSION = 'full-text-ai-one-human-bridge-2026-07-30-v1';
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const PRIMARY_IDS = ['S683', 'S2761', 'S3931', 'S4859', 'S4860'];
const SYSTEMATIC_REVIEW_ID = 'S2699';
const TABS = [
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
];
const CORE_TABS = new Set([
  'studyDetails',
  'participantCharacteristics',
  'definitions',
  'exposure',
]);
const APPLY = process.argv.includes('--apply');
const inputArg = process.argv.find((arg) => arg.startsWith('--input='));
if (!inputArg) {
  throw new Error('Usage: node --experimental-strip-types scripts/apply-2026-07-30-bridge-extractions.mjs --input=/absolute/path.json [--apply]');
}
const INPUT_PATH = path.resolve(inputArg.slice('--input='.length));

function loadEnv(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
  return env;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function deterministicUuid(key) {
  const bytes = Buffer.from(crypto.createHash('sha256').update(key).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function query(supabase, table, columns, configure) {
  let request = supabase.from(table).select(columns);
  if (configure) request = configure(request);
  const { data, error } = await request;
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}

async function insertOrVerify(supabase, table, row, identityFields, auditSteps) {
  const existing = await query(
    supabase,
    table,
    '*',
    (request) => request.eq('id', row.id),
  );
  if (existing.length === 1) {
    for (const field of identityFields) {
      if (stableHash(existing[0][field] ?? null) !== stableHash(row[field] ?? null)) {
        throw new Error(`${table} ${row.id}: existing ${field} does not match payload.`);
      }
    }
    auditSteps.push(`${table}:${row.id}:already_present`);
    return existing[0];
  }
  if (existing.length > 1) throw new Error(`${table} ${row.id}: duplicate ID rows.`);
  if (!APPLY) {
    auditSteps.push(`${table}:${row.id}:planned`);
    return row;
  }
  const { data, error } = await supabase.from(table).insert(row).select('*');
  if (error || data?.length !== 1) {
    throw new Error(`${table} ${row.id}: insert failed: ${error?.message ?? 'guard count'}`);
  }
  auditSteps.push(`${table}:${row.id}:inserted`);
  return data[0];
}

function appendJournal(filePath, payload) {
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function validateInput(payload) {
  if (payload.version !== VERSION) throw new Error('Extraction payload version mismatch.');
  if (!Array.isArray(payload.papers)) throw new Error('Extraction payload requires papers[].');
  const studyIds = payload.papers.map((paper) => paper.studyId);
  if (JSON.stringify(studyIds) !== JSON.stringify(PRIMARY_IDS)) {
    throw new Error('Extraction payload does not contain the exact five primary studies in order.');
  }
  if (payload.systematicReview?.studyId !== SYSTEMATIC_REVIEW_ID) {
    throw new Error('Extraction payload is missing S2699 reference-only handling.');
  }
  for (const paper of payload.papers) {
    if (
      !Array.isArray(paper.populationLabels)
      || paper.populationLabels.length === 0
      || !paper.fields
      || typeof paper.fields !== 'object'
      || !paper.note
      || !paper.source
    ) {
      throw new Error(`${paper.studyId}: incomplete extraction payload.`);
    }
    for (const tab of Object.keys(paper.fields)) {
      if (!TABS.includes(tab)) throw new Error(`${paper.studyId}: unknown tab ${tab}.`);
    }
  }
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  validateInput(payload);
  const [
    { extractionFieldDefinitions },
    { createPopulationSignature, derivePopulationGroups },
    { normalizeGlobalFieldValue },
  ] = await Promise.all([
    import('../src/lib/extraction/schema.ts'),
    import('../src/lib/extraction/populations.ts'),
    import('../src/lib/extraction/normalize.ts'),
  ]);
  const definitionById = new Map(
    extractionFieldDefinitions.map((definition) => [definition.id, definition]),
  );
  const env = loadEnv(ENV_PATH);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables.');
  }
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runSlug = timestampSlug();
  const journalPath = path.join(
    OUT_DIR,
    `extraction-${APPLY ? 'apply' : 'dry-run'}-${runSlug}.ndjson`,
  );
  const auditPath = path.join(
    OUT_DIR,
    `extraction-${APPLY ? 'apply' : 'dry-run'}-${runSlug}.json`,
  );
  const audit = {
    artifactType: 'Additive-only exact-cohort manual extraction apply',
    version: VERSION,
    mode: APPLY ? 'apply' : 'dry_run',
    inputPath: INPUT_PATH,
    generatedAt: new Date().toISOString(),
    papers: [],
    systematicReview: null,
    passed: false,
    failure: null,
    rollback:
      'All created row IDs are deterministic and listed here. Deletion is destructive and requires explicit approval.',
  };

  try {
    for (const item of payload.papers) {
      const paperRows = await query(
        supabase,
        'papers',
        '*',
        (request) => request.eq('assigned_study_id', item.studyId),
      );
      if (paperRows.length !== 1) {
        throw new Error(`${item.studyId}: expected one promoted paper.`);
      }
      let paper = paperRows[0];
      if (
        paper.status !== 'processing'
        || paper.assigned_to !== PROFILE_ID
        || paper.metadata?.temporaryExtractionPromotionVersion !== VERSION
        || paper.metadata?.referenceCheckingOnly !== false
        || !paper.primary_file_id
        || !paper.primary_file_sha256
      ) {
        throw new Error(`${item.studyId}: promoted paper guard failed.`);
      }
      if (
        item.source.sha256 !== paper.primary_file_sha256
        || item.source.screeningRecordId !== paper.metadata?.screeningRecordId
      ) {
        throw new Error(`${item.studyId}: source identity does not match the promoted paper.`);
      }

      const [existingExtractions, existingGroups, existingValues, existingNotes] =
        await Promise.all([
          query(supabase, 'extractions', '*', (request) => request.eq('paper_id', paper.id)),
          query(supabase, 'population_groups', '*', (request) => request.eq('paper_id', paper.id)),
          query(supabase, 'population_values', '*', (request) => request.eq('paper_id', paper.id)),
          query(supabase, 'paper_notes', '*', (request) => request.eq('paper_id', paper.id)),
        ]);
      const existingExtractionIds = existingExtractions.map((row) => row.id);
      const existingFields = existingExtractionIds.length
        ? await query(
            supabase,
            'extraction_fields',
            '*',
            (request) => request.in('extraction_id', existingExtractionIds),
          )
        : [];
      const allowedExtractionIds = new Set(
        TABS.map((tab) => deterministicUuid(`${VERSION}:${item.studyId}:extraction:${tab}`)),
      );
      if (existingExtractions.some((row) => !allowedExtractionIds.has(row.id))) {
        throw new Error(`${item.studyId}: unexpected extraction row already exists.`);
      }
      const paperAudit = {
        studyId: item.studyId,
        paperId: paper.id,
        source: item.source,
        populationLabels: item.populationLabels,
        existingCounts: {
          extractions: existingExtractions.length,
          fields: existingFields.length,
          groups: existingGroups.length,
          values: existingValues.length,
          notes: existingNotes.length,
        },
        steps: [],
        fieldCount: 0,
        populationGroupCount: 0,
        populationValueCount: 0,
      };
      audit.papers.push(paperAudit);

      const normalizedFields = [];
      for (const tab of TABS) {
        const itemFields = { ...(item.fields[tab] ?? {}) };
        if (CORE_TABS.has(tab)) {
          for (const definition of extractionFieldDefinitions.filter(
            (candidate) => candidate.tab === tab,
          )) {
            if (!(definition.id in itemFields)) itemFields[definition.id] = null;
          }
        }
        for (const [fieldId, rawValue] of Object.entries(itemFields)) {
          const definition = definitionById.get(fieldId);
          if (!definition) throw new Error(`${item.studyId}: unknown field ${fieldId}.`);
          if (definition.tab !== tab) {
            throw new Error(`${item.studyId}: field ${fieldId} belongs to ${definition.tab}, not ${tab}.`);
          }
          const value = fieldId === 'studyId'
            ? item.studyId
            : normalizeGlobalFieldValue(
                fieldId,
                rawValue == null ? null : String(rawValue),
              );
          normalizedFields.push({
            tab,
            fieldId,
            value,
            metric: definition.metric ?? null,
          });
        }
      }

      const extractionIdByTab = new Map();
      for (const tab of TABS) {
        const extractionId = deterministicUuid(
          `${VERSION}:${item.studyId}:extraction:${tab}`,
        );
        extractionIdByTab.set(tab, extractionId);
        await insertOrVerify(
          supabase,
          'extractions',
          {
            id: extractionId,
            paper_id: paper.id,
            tab,
            model: 'human-input',
            created_at: payload.generatedAt,
            updated_at: payload.generatedAt,
          },
          ['paper_id', 'tab', 'model'],
          paperAudit.steps,
        );
      }

      for (const field of normalizedFields) {
        const extractionId = extractionIdByTab.get(field.tab);
        const fieldRow = {
          id: deterministicUuid(
            `${VERSION}:${item.studyId}:field:${field.tab}:${field.fieldId}`,
          ),
          extraction_id: extractionId,
          field_id: field.fieldId,
          value: field.value,
          confidence: null,
          source_quote: null,
          page_hint: null,
          metric: field.metric,
          status: field.value ? 'reported' : 'not_reported',
          updated_at: payload.generatedAt,
          updated_by: PROFILE_ID,
        };
        await insertOrVerify(
          supabase,
          'extraction_fields',
          fieldRow,
          ['extraction_id', 'field_id', 'value', 'metric', 'status', 'updated_by'],
          paperAudit.steps,
        );
      }
      paperAudit.fieldCount = normalizedFields.length;

      const populationInput = normalizedFields.map((field) => ({
        fieldId: field.fieldId,
        value: field.value,
        metric: field.metric,
      }));
      const groups = derivePopulationGroups(populationInput);
      if (groups.length !== item.populationLabels.length) {
        throw new Error(
          `${item.studyId}: derived ${groups.length} populations, expected ${item.populationLabels.length}.`,
        );
      }
      groups.forEach((group, index) => {
        group.label = item.populationLabels[index];
      });
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const groupId = deterministicUuid(
          `${VERSION}:${item.studyId}:population-group:${index}:${group.label}`,
        );
        await insertOrVerify(
          supabase,
          'population_groups',
          {
            id: groupId,
            paper_id: paper.id,
            tab: 'participantCharacteristics',
            label: group.label,
            position: index,
            created_at: payload.generatedAt,
            updated_at: payload.generatedAt,
          },
          ['paper_id', 'tab', 'label', 'position'],
          paperAudit.steps,
        );
        for (const [fieldId, value] of Object.entries(group.values)) {
          const definition = definitionById.get(fieldId);
          const populationValue = {
            id: deterministicUuid(
              `${VERSION}:${item.studyId}:population-value:${index}:${fieldId}`,
            ),
            population_group_id: groupId,
            paper_id: paper.id,
            field_id: fieldId,
            source_field_id: fieldId,
            value,
            metric: definition?.metric ?? null,
            unit: null,
            created_at: payload.generatedAt,
            updated_at: payload.generatedAt,
          };
          await insertOrVerify(
            supabase,
            'population_values',
            populationValue,
            ['population_group_id', 'paper_id', 'field_id', 'value', 'metric'],
            paperAudit.steps,
          );
          paperAudit.populationValueCount += 1;
        }
      }
      paperAudit.populationGroupCount = groups.length;

      const noteRow = {
        id: deterministicUuid(`${VERSION}:${item.studyId}:paper-note`),
        paper_id: paper.id,
        body: item.note,
        created_at: payload.generatedAt,
      };
      await insertOrVerify(
        supabase,
        'paper_notes',
        noteRow,
        ['paper_id', 'body'],
        paperAudit.steps,
      );

      const nextMetadata = {
        ...paper.metadata,
        populationLabels: groups.map((group) => group.label),
        populationHash: createPopulationSignature(groups),
        extractionBridge20260730: {
          version: VERSION,
          sourcePayload: INPUT_PATH,
          sourcePayloadHash: stableHash(item),
          stageACompletedAt: payload.generatedAt,
          stageBStatus: APPLY ? 'applied_pending_verification' : 'dry_run_validated',
          referenceCheckingOnly: false,
        },
      };
      if (APPLY) {
        const updatedAt = new Date().toISOString();
        const { data, error } = await supabase
          .from('papers')
          .update({ metadata: nextMetadata, updated_at: updatedAt })
          .eq('id', paper.id)
          .eq('updated_at', paper.updated_at)
          .eq('status', 'processing')
          .eq('assigned_to', PROFILE_ID)
          .select('*');
        if (error || data?.length !== 1) {
          throw new Error(`${item.studyId}: paper metadata compare-and-swap failed.`);
        }
        [paper] = data;
        paperAudit.steps.push('paper_metadata_updated');
      } else {
        paperAudit.steps.push('paper_metadata_update_planned');
      }
      appendJournal(journalPath, {
        at: new Date().toISOString(),
        studyId: item.studyId,
        paperId: paper.id,
        fieldCount: paperAudit.fieldCount,
        groupCount: paperAudit.populationGroupCount,
        valueCount: paperAudit.populationValueCount,
        mode: audit.mode,
      });
    }

    const systematicItem = payload.systematicReview;
    const systematicPapers = await query(
      supabase,
      'papers',
      '*',
      (request) => request.eq('assigned_study_id', SYSTEMATIC_REVIEW_ID),
    );
    if (systematicPapers.length !== 1) throw new Error('S2699: expected one promoted paper.');
    const systematicPaper = systematicPapers[0];
    if (
      systematicPaper.status !== 'systematic_review'
      || systematicPaper.assigned_to !== PROFILE_ID
      || systematicPaper.metadata?.temporaryExtractionPromotionVersion !== VERSION
      || systematicPaper.metadata?.referenceCheckingOnly !== true
    ) {
      throw new Error('S2699: systematic-review paper guard failed.');
    }
    const [systematicExtractions, systematicGroups, systematicValues] =
      await Promise.all([
        query(supabase, 'extractions', '*', (request) => request.eq('paper_id', systematicPaper.id)),
        query(supabase, 'population_groups', '*', (request) => request.eq('paper_id', systematicPaper.id)),
        query(supabase, 'population_values', '*', (request) => request.eq('paper_id', systematicPaper.id)),
      ]);
    if (
      systematicExtractions.length
      || systematicGroups.length
      || systematicValues.length
    ) {
      throw new Error('S2699: reference-only paper unexpectedly has extraction data.');
    }
    const systematicAudit = {
      studyId: SYSTEMATIC_REVIEW_ID,
      paperId: systematicPaper.id,
      status: systematicPaper.status,
      extractionRows: 0,
      populationRows: 0,
      steps: [],
    };
    audit.systematicReview = systematicAudit;
    await insertOrVerify(
      supabase,
      'paper_notes',
      {
        id: deterministicUuid(`${VERSION}:${SYSTEMATIC_REVIEW_ID}:paper-note`),
        paper_id: systematicPaper.id,
        body: systematicItem.note,
        created_at: payload.generatedAt,
      },
      ['paper_id', 'body'],
      systematicAudit.steps,
    );
    audit.passed = true;
  } catch (error) {
    audit.failure = error instanceof Error ? error.stack : String(error);
  }

  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({
    auditPath,
    journalPath,
    passed: audit.passed,
    mode: audit.mode,
    papers: audit.papers.map((paper) => ({
      studyId: paper.studyId,
      fieldCount: paper.fieldCount,
      populationGroupCount: paper.populationGroupCount,
      populationValueCount: paper.populationValueCount,
    })),
    systematicReview: audit.systematicReview,
    failure: audit.failure,
  }, null, 2));
  if (!audit.passed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
