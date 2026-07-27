import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const APP_ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const DATA_DIR = path.join(
  APP_ROOT,
  'data',
  'tournament-family-reconciliation',
  '2026-07-27',
);
const INPUT_PATH = path.join(
  DATA_DIR,
  'fifa-international-tournament-additive-input-2026-07-27.json',
);
const PRE_APPLY_PATH = path.join(
  DATA_DIR,
  'fifa-international-tournament-pre-apply-live-snapshot-2026-07-27.json',
);
const FINAL_AUDIT_PATH = path.join(
  DATA_DIR,
  'fifa-international-tournament-final-live-integrity-audit-2026-07-27.json',
);
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');

for (const line of fs.readFileSync(path.join(APP_ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const { extractionFieldDefinitions } = await import('../src/lib/extraction/schema.ts');
const { normalizeGlobalFieldValue } = await import('../src/lib/extraction/normalize.ts');
const definitionById = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));
const payload = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const studyIds = payload.papers.map((paper) => paper.studyId);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortDeep(child)]),
    );
  }
  return value;
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(sortDeep(value)))
    .digest('hex');
}

function normalise(fieldId, rawValue) {
  if (rawValue == null) return null;
  if (fieldId === 'studyId') return String(rawValue);
  return normalizeGlobalFieldValue(fieldId, String(rawValue));
}

function flattenStagedFields(item) {
  const flattened = new Map();
  for (const [tab, fields] of Object.entries(item.fields ?? {})) {
    for (const [fieldId, rawValue] of Object.entries(fields)) {
      const definition = definitionById.get(fieldId);
      assert(definition, `${item.studyId}: unknown extraction field ${fieldId}`);
      assert(
        definition.tab === tab,
        `${item.studyId}: ${fieldId} belongs to ${definition.tab}, not ${tab}`,
      );
      flattened.set(fieldId, {
        tab,
        value: normalise(fieldId, rawValue),
        sourceQuote: item.sourceQuote,
        pageHint: item.sourcePageHint,
        reason: 'staged additive source transfer',
      });
    }
  }
  for (const [fieldId, correction] of Object.entries(item.corrections ?? {})) {
    const definition = definitionById.get(fieldId);
    assert(definition, `${item.studyId}: unknown correction field ${fieldId}`);
    flattened.set(fieldId, {
      tab: definition.tab,
      value: normalise(fieldId, correction.value),
      expected: normalise(fieldId, correction.expected),
      sourceQuote: item.sourceQuote,
      pageHint: item.sourcePageHint,
      reason: correction.justification,
      correction: true,
    });
  }
  return flattened;
}

async function loadState() {
  const { data: papers, error: paperError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,title,lead_author,journal,year,doi,status,assigned_to,flag_reason,primary_file_id,primary_file_sha256,storage_bucket,storage_object_path,original_file_name,metadata,updated_at')
    .in('assigned_study_id', studyIds)
    .order('assigned_study_id');
  if (paperError) throw paperError;

  const paperIds = (papers ?? []).map((paper) => paper.id);
  const { data: files, error: fileError } = await supabase
    .from('paper_files')
    .select('id,paper_id,name,original_file_name,size,mime_type,storage_bucket,storage_object_path,file_sha256,uploaded_at')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('uploaded_at');
  if (fileError) throw fileError;

  const { data: extractions, error: extractionError } = await supabase
    .from('extractions')
    .select('id,paper_id,tab,model,created_at,updated_at,extraction_fields(id,extraction_id,field_id,value,status,metric,confidence,page_hint,source_quote,updated_at,updated_by)')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('tab');
  if (extractionError) throw extractionError;

  const { data: groups, error: groupError } = await supabase
    .from('population_groups')
    .select('id,paper_id,tab,label,position,created_at,updated_at,population_values(id,population_group_id,paper_id,field_id,value,metric,unit,source_field_id,created_at,updated_at)')
    .in('paper_id', paperIds)
    .order('paper_id')
    .order('position');
  if (groupError) throw groupError;

  const { data: screeningRecords, error: screeningError } = await supabase
    .from('screening_records')
    .select('id,stage,assigned_study_id,manual_decision,manual_reason,manual_decided_by,manual_decided_at,promoted_paper_id,promoted_by,promoted_at,metadata,updated_at')
    .in('assigned_study_id', studyIds)
    .order('assigned_study_id')
    .order('stage');
  if (screeningError) throw screeningError;

  const screeningIds = (screeningRecords ?? []).map((record) => record.id);
  let screeningVotes = [];
  if (screeningIds.length > 0) {
    const { data, error } = await supabase
      .from('screening_votes')
      .select('id,screening_record_id,vote_order,vote_role,reviewer_profile_id,reviewer_name,decision,reason,decided_at,updated_at')
      .in('screening_record_id', screeningIds)
      .order('screening_record_id')
      .order('vote_order');
    if (error) throw error;
    screeningVotes = data ?? [];
  }

  return {
    papers: papers ?? [],
    files: files ?? [],
    extractions: extractions ?? [],
    groups: groups ?? [],
    screeningRecords: screeningRecords ?? [],
    screeningVotes,
  };
}

function paperState(state, studyId) {
  const paper = state.papers.find((candidate) => candidate.assigned_study_id === studyId);
  assert(paper, `Live paper ${studyId} is missing`);
  return {
    paper,
    files: state.files.filter((file) => file.paper_id === paper.id),
    extractions: state.extractions.filter((extraction) => extraction.paper_id === paper.id),
    groups: state.groups.filter((group) => group.paper_id === paper.id),
  };
}

function canonicalFields(localState) {
  const byId = new Map();
  for (const extraction of localState.extractions) {
    for (const field of extraction.extraction_fields ?? []) {
      const definition = definitionById.get(field.field_id);
      if (definition?.tab !== extraction.tab) continue;
      assert(!byId.has(field.field_id), `${localState.paper.assigned_study_id}: duplicate canonical ${field.field_id}`);
      byId.set(field.field_id, { ...field, tab: extraction.tab });
    }
  }
  return byId;
}

function buildPlan(state) {
  const blockers = [];
  const paperPlans = [];

  for (const item of payload.papers) {
    const localState = paperState(state, item.studyId);
    const currentFields = canonicalFields(localState);
    const intendedFields = new Map(
      [...currentFields.entries()].map(([fieldId, field]) => [
        fieldId,
        {
          tab: field.tab,
          value: field.value,
          sourceQuote: field.source_quote,
          pageHint: field.page_hint,
          reason: 'preserve current canonical value',
          current: field,
        },
      ]),
    );
    const staged = flattenStagedFields(item);
    const populationCount = item.populationLabels.length;

    if (localState.paper.assigned_to !== PROFILE_ID) {
      blockers.push(`${item.studyId}: assigned to ${localState.paper.assigned_to ?? 'nobody'}, not AbdelRahman Babiker`);
    }
    if (localState.paper.status !== item.expectedStatus && !(
      item.statusCorrection &&
      localState.paper.status === item.statusCorrection.value
    )) {
      blockers.push(`${item.studyId}: status ${localState.paper.status} does not match expected ${item.expectedStatus}`);
    }
    if (localState.files.length === 0 || !localState.files.some((file) => file.storage_object_path)) {
      blockers.push(`${item.studyId}: no attached source file is registered`);
    }

    for (const [fieldId, spec] of staged) {
      const current = currentFields.get(fieldId);
      if (
        current?.value &&
        String(current.value).trim() &&
        current.value !== spec.value &&
        !spec.correction &&
        !(item.expandSingletonsToPopulationCount && String(current.value).split('\n').length === 1)
      ) {
        blockers.push(`${item.studyId}: staged ${fieldId} conflicts with nonblank live value ${JSON.stringify(current.value)}`);
      }
      if (spec.correction && current?.value !== spec.expected && current?.value !== spec.value) {
        blockers.push(`${item.studyId}: correction ${fieldId} expected ${JSON.stringify(spec.expected)}, found ${JSON.stringify(current?.value)}`);
      }
      intendedFields.set(fieldId, { ...spec, current });
    }

    if (item.expandSingletonsToPopulationCount) {
      for (const [fieldId, spec] of intendedFields) {
        if (!spec.value || String(spec.value).split('\n').length !== 1 || staged.has(fieldId)) continue;
        intendedFields.set(fieldId, {
          ...spec,
          value: Array(populationCount).fill(spec.value).join('\n'),
          reason: item.layoutCorrectionJustification,
          layoutCorrection: true,
        });
      }
    }

    for (const [fieldId, spec] of intendedFields) {
      if (!spec.value || !String(spec.value).trim()) continue;
      const lineCount = String(spec.value).split('\n').length;
      if (lineCount !== populationCount) {
        blockers.push(`${item.studyId}: ${fieldId} has ${lineCount} population lines, expected ${populationCount}`);
      }
    }

    const liveLabels = localState.groups.map((group) => group.label);
    const labelsAlreadyFinal = JSON.stringify(liveLabels) === JSON.stringify(item.populationLabels);
    const labelsMatchExpected = JSON.stringify(liveLabels) === JSON.stringify(item.expectedExistingPopulationLabels ?? []);
    if (localState.groups.length > 0 && !labelsAlreadyFinal && !labelsMatchExpected) {
      blockers.push(`${item.studyId}: live population labels ${JSON.stringify(liveLabels)} do not match expected or final labels`);
    }

    if (localState.groups.length === populationCount) {
      for (const group of localState.groups) {
        const intendedByField = new Map(
          [...intendedFields.entries()]
            .filter(([, spec]) => spec.value && String(spec.value).trim())
            .map(([fieldId, spec]) => [fieldId, String(spec.value).split('\n')[group.position] ?? '']),
        );
        for (const populationValue of group.population_values ?? []) {
          const expectedValue = intendedByField.get(populationValue.field_id);
          if (
            expectedValue != null &&
            populationValue.value !== expectedValue &&
            !item.repairPopulationDualWrite &&
            !item.expandSingletonsToPopulationCount &&
            !staged.has(populationValue.field_id)
          ) {
            blockers.push(`${item.studyId}: population dual-write mismatch for ${populationValue.field_id}`);
          }
        }
      }
    }

    if (item.statusCorrection) {
      const correction = item.statusCorrection;
      if (
        localState.paper.status !== correction.expected &&
        localState.paper.status !== correction.value
      ) {
        blockers.push(`${item.studyId}: status correction expected ${correction.expected}, found ${localState.paper.status}`);
      }
      if (
        localState.paper.status === correction.expected &&
        localState.paper.flag_reason !== correction.expectedFlagReason
      ) {
        blockers.push(`${item.studyId}: flag reason changed from expected ${JSON.stringify(correction.expectedFlagReason)}`);
      }
    }

    paperPlans.push({ item, localState, currentFields, staged, intendedFields });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    papers: paperPlans,
    protectedScreeningHash: stableHash({
      records: state.screeningRecords,
      votes: state.screeningVotes,
    }),
  };
}

async function ensureExtraction(paperId, tab, localState, now) {
  const existing = localState.extractions.find((extraction) => extraction.tab === tab);
  if (existing) return existing;
  const row = {
    id: crypto.randomUUID(),
    paper_id: paperId,
    tab,
    model: 'human-input',
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from('extractions').insert(row);
  if (error) throw error;
  localState.extractions.push({ ...row, extraction_fields: [] });
  return row;
}

async function applyPlan(plan) {
  const now = new Date().toISOString();
  const report = [];

  for (const paperPlan of plan.papers) {
    const { item, localState, intendedFields } = paperPlan;
    const written = [];
    const unchanged = [];

    for (const [fieldId, spec] of intendedFields) {
      if (!spec.value || !String(spec.value).trim()) continue;
      const definition = definitionById.get(fieldId);
      const extraction = await ensureExtraction(localState.paper.id, definition.tab, localState, now);
      const existing = spec.current;
      if (existing?.value === spec.value) {
        unchanged.push(fieldId);
        continue;
      }
      const row = {
        id: existing?.id ?? crypto.randomUUID(),
        extraction_id: extraction.id,
        field_id: fieldId,
        value: spec.value,
        confidence: existing?.confidence ?? 0.95,
        source_quote: spec.sourceQuote ?? existing?.source_quote ?? null,
        page_hint: spec.pageHint ?? existing?.page_hint ?? null,
        metric: definition.metric ?? null,
        status: 'reported',
        updated_at: now,
        updated_by: PROFILE_ID,
      };
      const { error } = await supabase
        .from('extraction_fields')
        .upsert(row, { onConflict: 'extraction_id,field_id' });
      if (error) throw new Error(`${item.studyId}: failed ${fieldId}: ${error.message}`);
      written.push({ fieldId, prior: existing?.value ?? null, value: spec.value, reason: spec.reason });
    }

    let groups = localState.groups;
    if (groups.length === 0) {
      const rows = item.populationLabels.map((label, position) => ({
        id: crypto.randomUUID(),
        paper_id: localState.paper.id,
        tab: 'participantCharacteristics',
        label,
        position,
        created_at: now,
        updated_at: now,
      }));
      const { error } = await supabase.from('population_groups').insert(rows);
      if (error) throw new Error(`${item.studyId}: failed to insert populations: ${error.message}`);
      groups = rows.map((row) => ({ ...row, population_values: [] }));
    } else {
      for (const group of groups) {
        const finalLabel = item.populationLabels[group.position];
        if (group.label === finalLabel) continue;
        const { error } = await supabase
          .from('population_groups')
          .update({ label: finalLabel, updated_at: now })
          .eq('id', group.id);
        if (error) throw new Error(`${item.studyId}: failed to relabel population: ${error.message}`);
        group.label = finalLabel;
      }
    }

    const populationWrites = [];
    for (const group of groups) {
      const existingValues = new Map(
        (group.population_values ?? []).map((value) => [value.field_id, value]),
      );
      for (const [fieldId, spec] of intendedFields) {
        if (!spec.value || !String(spec.value).trim()) continue;
        const value = String(spec.value).split('\n')[group.position] ?? '';
        if (!value.trim()) continue;
        const existing = existingValues.get(fieldId);
        if (existing?.value === value) continue;
        const row = {
          id: existing?.id ?? crypto.randomUUID(),
          population_group_id: group.id,
          paper_id: localState.paper.id,
          field_id: fieldId,
          value,
          metric: definitionById.get(fieldId)?.metric ?? null,
          unit: null,
          source_field_id: fieldId,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        };
        const query = existing
          ? supabase
            .from('population_values')
            .update({
              value: row.value,
              metric: row.metric,
              unit: row.unit,
              source_field_id: row.source_field_id,
              updated_at: row.updated_at,
            })
            .eq('id', existing.id)
          : supabase.from('population_values').insert(row);
        const { error } = await query;
        if (error) throw new Error(`${item.studyId}: failed population ${fieldId}: ${error.message}`);
        populationWrites.push({ group: group.label, fieldId, prior: existing?.value ?? null, value });
      }
    }

    let statusWrite = null;
    if (item.statusCorrection && localState.paper.status !== item.statusCorrection.value) {
      const { error } = await supabase
        .from('papers')
        .update({
          status: item.statusCorrection.value,
          flag_reason: null,
          updated_at: now,
        })
        .eq('id', localState.paper.id);
      if (error) throw new Error(`${item.studyId}: failed status correction: ${error.message}`);
      statusWrite = {
        prior: localState.paper.status,
        value: item.statusCorrection.value,
        justification: item.statusCorrection.justification,
      };
    }

    report.push({
      studyId: item.studyId,
      written,
      unchanged,
      populationWrites,
      statusWrite,
    });
  }
  return report;
}

function compactState(state) {
  return {
    papers: state.papers,
    files: state.files,
    extractions: state.extractions,
    groups: state.groups,
    protectedScreening: {
      records: state.screeningRecords,
      votes: state.screeningVotes,
      hash: stableHash({ records: state.screeningRecords, votes: state.screeningVotes }),
    },
  };
}

function verifyState(before, after) {
  const findings = [];
  const plan = buildPlan(after);
  findings.push(...plan.blockers.map((message) => ({ severity: 'blocker', message })));

  for (const paperPlan of plan.papers) {
    const { item, localState, intendedFields } = paperPlan;
    if (localState.groups.length !== item.populationLabels.length) {
      findings.push({ severity: 'blocker', message: `${item.studyId}: wrong population count` });
      continue;
    }
    for (const group of localState.groups) {
      if (group.label !== item.populationLabels[group.position]) {
        findings.push({ severity: 'blocker', message: `${item.studyId}: population label mismatch` });
      }
      const values = new Map((group.population_values ?? []).map((value) => [value.field_id, value.value]));
      for (const [fieldId, spec] of intendedFields) {
        if (!spec.value || !String(spec.value).trim()) continue;
        const expected = String(spec.value).split('\n')[group.position] ?? '';
        if (expected.trim() && values.get(fieldId) !== expected) {
          findings.push({
            severity: 'blocker',
            message: `${item.studyId}: dual-write mismatch for ${fieldId}, expected ${JSON.stringify(expected)}, found ${JSON.stringify(values.get(fieldId))}`,
          });
        }
      }
    }
    if (!localState.files.some((file) => file.storage_object_path)) {
      findings.push({ severity: 'blocker', message: `${item.studyId}: source file detached` });
    }
    if (localState.paper.assigned_to !== PROFILE_ID) {
      findings.push({ severity: 'blocker', message: `${item.studyId}: assignment changed` });
    }
    const expectedStatus = item.statusCorrection?.value ?? item.expectedStatus;
    if (localState.paper.status !== expectedStatus) {
      findings.push({ severity: 'blocker', message: `${item.studyId}: final status ${localState.paper.status}` });
    }
  }

  const beforeScreeningHash = stableHash({
    records: before.screeningRecords,
    votes: before.screeningVotes,
  });
  const afterScreeningHash = stableHash({
    records: after.screeningRecords,
    votes: after.screeningVotes,
  });
  if (beforeScreeningHash !== afterScreeningHash) {
    findings.push({ severity: 'blocker', message: 'Protected screening records or votes changed' });
  }

  return {
    result: findings.some((finding) => finding.severity === 'blocker') ? 'failed' : 'passed',
    findings,
    protectedScreeningUnchanged: beforeScreeningHash === afterScreeningHash,
    protectedScreeningHash: afterScreeningHash,
    studyCount: plan.papers.length,
    populationCounts: Object.fromEntries(
      plan.papers.map(({ item, localState }) => [item.studyId, localState.groups.length]),
    ),
    sourceFilesAttached: Object.fromEntries(
      plan.papers.map(({ item, localState }) => [
        item.studyId,
        localState.files.some((file) => file.storage_object_path),
      ]),
    ),
  };
}

const before = await loadState();
const initialPlan = buildPlan(before);
if (!initialPlan.ready && !VERIFY) {
  console.log(JSON.stringify({
    mode: APPLY ? 'apply-blocked' : 'dry-run-blocked',
    input: path.relative(REPO_ROOT, INPUT_PATH),
    blockers: initialPlan.blockers,
  }, null, 2));
  process.exitCode = 1;
} else if (VERIFY) {
  const gate = verifyState(before, before);
  console.log(JSON.stringify({ mode: 'verify-only', gate }, null, 2));
  process.exitCode = gate.result === 'passed' ? 0 : 1;
} else if (!APPLY) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    ready: true,
    input: path.relative(REPO_ROOT, INPUT_PATH),
    studies: initialPlan.papers.map(({ item, localState, staged, intendedFields }) => ({
      studyId: item.studyId,
      status: localState.paper.status,
      finalStatus: item.statusCorrection?.value ?? item.expectedStatus,
      sourceFiles: localState.files.length,
      livePopulationLabels: localState.groups.map((group) => group.label),
      finalPopulationLabels: item.populationLabels,
      stagedFieldCount: staged.size,
      finalPopulatedCanonicalFieldCount: [...intendedFields.values()].filter(
        (spec) => spec.value && String(spec.value).trim(),
      ).length,
    })),
    protectedScreeningHash: initialPlan.protectedScreeningHash,
  }, null, 2));
} else {
  fs.writeFileSync(PRE_APPLY_PATH, `${JSON.stringify({
    artifactType: 'FIFA and international tournament pre-apply live snapshot',
    date: '2026-07-27',
    input: path.relative(REPO_ROOT, INPUT_PATH),
    state: compactState(before),
  }, null, 2)}\n`, 'utf8');

  const applyReport = await applyPlan(initialPlan);
  const after = await loadState();
  const gate = verifyState(before, after);
  fs.writeFileSync(FINAL_AUDIT_PATH, `${JSON.stringify({
    artifactType: 'FIFA and international tournament final live integrity audit',
    date: '2026-07-27',
    input: path.relative(REPO_ROOT, INPUT_PATH),
    preApplySnapshot: path.relative(REPO_ROOT, PRE_APPLY_PATH),
    applyReport,
    gate,
    finalState: compactState(after),
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    mode: 'apply',
    applyReport,
    gate,
    preApplySnapshot: path.relative(REPO_ROOT, PRE_APPLY_PATH),
    finalAudit: path.relative(REPO_ROOT, FINAL_AUDIT_PATH),
  }, null, 2));
  process.exitCode = gate.result === 'passed' ? 0 : 1;
}
