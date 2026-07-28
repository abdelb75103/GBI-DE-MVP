import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const INPUT_PATH = path.join(
  APP_DIR,
  'data/live-extraction/s016-2026-07-28/s016-manual-extraction-input-2026-07-28.json',
);
const OUTPUT_DIR = path.dirname(INPUT_PATH);
const PREPARE_PLAN = process.argv.includes('--prepare-plan');
const VALIDATE_PLAN_ID = process.argv.find((argument) => argument.startsWith('--validate-plan='))?.split('=')[1] ?? null;
const APPLY_PLAN_ID = process.argv.find((argument) => argument.startsWith('--apply-plan='))?.split('=')[1] ?? null;
const ROLLBACK_PLAN_ID = process.argv.find((argument) => argument.startsWith('--rollback-plan='))?.split('=')[1] ?? null;
const APPLY = Boolean(APPLY_PLAN_ID);
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const EXTRACTION_MODEL = 'codex-gpt-5-manual-xhigh';
const MUTABLE_TABS = new Set([
  'studyDetails',
  'participantCharacteristics',
  'definitions',
  'exposure',
  'injuryOutcome',
]);

const parseEnv = (contents) => Object.fromEntries(
  contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      return [key, value];
    }),
);

const canonicalJson = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalJson);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalJson(nested)]),
    );
  }
  return value;
};

const hashJson = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(canonicalJson(value)))
  .digest('hex');

const deterministicUuid = (seed) => {
  const bytes = crypto.createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const requireData = (result, label) => {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data ?? [];
};

const requireRows = (result, label, expectedCount) => {
  const rows = requireData(result, label);
  if (!Array.isArray(rows) || rows.length !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} rows, received ${Array.isArray(rows) ? rows.length : 'non-array'}`);
  }
  return rows;
};

const writeImmutableJson = (filePath, value) => {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  try {
    fs.writeFileSync(filePath, contents, { flag: 'wx' });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing !== contents) {
      throw new Error(`Immutable artefact already exists with different content: ${filePath}`);
    }
  }
};

const appendEvent = (planId, event) => {
  if (!planId) return;
  const eventPath = path.join(OUTPUT_DIR, `s016-apply-events-${planId}.jsonl`);
  fs.appendFileSync(eventPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
};

const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const scriptSha256 = crypto.createHash('sha256').update(fs.readFileSync(SCRIPT_PATH)).digest('hex');
const env = parseEnv(fs.readFileSync(path.join(APP_DIR, '.env.local'), 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { extractionFieldDefinitions } = await import('../src/lib/extraction/schema.ts');
const { createPopulationSignature, derivePopulationGroups } = await import('../src/lib/extraction/populations.ts');

const definitionById = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));
const definitionIdsByTab = new Map(
  [...MUTABLE_TABS].map((tab) => [
    tab,
    new Set(extractionFieldDefinitions.filter((definition) => definition.tab === tab).map((definition) => definition.id)),
  ]),
);

const downloadPrimaryFileHash = async (paper, files) => {
  if (files.length !== 1) {
    throw new Error(`Expected exactly one S016 paper_files row, found ${files.length}`);
  }
  const file = files[0];
  const bucket = file.storage_bucket ?? paper.storage_bucket ?? 'papers';
  const objectPath = file.storage_object_path ?? paper.storage_object_path;
  if (!objectPath) {
    throw new Error('S016 primary storage object path is missing');
  }
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) {
    throw new Error(`S016 primary PDF download: ${error.message}`);
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    bucket,
    objectPath,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
};

const fetchSnapshot = async () => {
  const paper = requireData(
    await supabase.from('papers').select('*').eq('id', input.paperId).single(),
    'paper',
  );
  const paperId = paper.id;
  const files = requireData(
    await supabase.from('paper_files').select('*').eq('paper_id', paperId).order('uploaded_at'),
    'paper_files',
  );
  const extractions = requireData(
    await supabase
      .from('extractions')
      .select('*, extraction_fields(*)')
      .eq('paper_id', paperId)
      .order('tab'),
    'extractions',
  );
  const populationGroups = requireData(
    await supabase.from('population_groups').select('*').eq('paper_id', paperId).order('position'),
    'population_groups',
  );
  const populationValues = requireData(
    await supabase.from('population_values').select('*').eq('paper_id', paperId).order('population_group_id'),
    'population_values',
  );
  const notes = requireData(
    await supabase.from('paper_notes').select('*').eq('paper_id', paperId).order('created_at'),
    'paper_notes',
  );
  const screeningByPaper = requireData(
    await supabase.from('screening_records').select('*').eq('promoted_paper_id', paperId),
    'screening_records by promoted paper',
  );
  const screeningByStudyId = requireData(
    await supabase.from('screening_records').select('*').eq('assigned_study_id', input.studyId),
    'screening_records by study ID',
  );
  const screeningRecords = [
    ...new Map([...screeningByPaper, ...screeningByStudyId].map((row) => [row.id, row])).values(),
  ].sort((left, right) => left.id.localeCompare(right.id));
  const screeningVotes = screeningRecords.length
    ? requireData(
      await supabase
        .from('screening_votes')
        .select('*')
        .in('screening_record_id', screeningRecords.map((row) => row.id))
        .order('vote_order'),
      'screening_votes',
    )
    : [];
  const aiReviewDecisions = requireData(
    await supabase
      .from('ai_review_decisions')
      .select('*')
      .eq('paper_id', paperId)
      .order('tab')
      .order('field_id')
      .order('reviewer_profile_id'),
    'ai_review_decisions',
  );
  const sourceFile = await downloadPrimaryFileHash(paper, files);
  return {
    capturedAt: new Date().toISOString(),
    paper,
    files,
    sourceFile,
    extractions,
    populationGroups,
    populationValues,
    notes,
    screeningRecords,
    screeningVotes,
    aiReviewDecisions,
  };
};

const protectedState = (snapshot) => ({
  screeningRecords: snapshot.screeningRecords,
  screeningVotes: snapshot.screeningVotes,
  aiReviewDecisions: snapshot.aiReviewDecisions,
  notes: snapshot.notes,
  paperIdentity: {
    id: snapshot.paper.id,
    assigned_study_id: snapshot.paper.assigned_study_id,
    primary_file_id: snapshot.paper.primary_file_id,
    storage_bucket: snapshot.paper.storage_bucket,
    storage_object_path: snapshot.paper.storage_object_path,
  },
  paperFiles: snapshot.files,
});

const sortRows = (rows, key) => [...rows].sort((left, right) => {
  const leftValue = key(left);
  const rightValue = key(right);
  return leftValue.localeCompare(rightValue);
});

const snapshotState = (snapshot) => ({
  paper: snapshot.paper,
  files: sortRows(snapshot.files, (row) => row.id),
  sourceFile: snapshot.sourceFile,
  extractions: sortRows(snapshot.extractions, (row) => `${row.tab}:${row.id}`).map((row) => ({
    ...row,
    extraction_fields: sortRows(row.extraction_fields ?? [], (field) => `${field.field_id}:${field.id}`),
  })),
  populationGroups: sortRows(snapshot.populationGroups, (row) => `${String(row.position).padStart(4, '0')}:${row.id}`),
  populationValues: sortRows(
    snapshot.populationValues,
    (row) => `${row.population_group_id}:${row.field_id}:${row.id}`,
  ),
  notes: sortRows(snapshot.notes, (row) => row.id),
  screeningRecords: sortRows(snapshot.screeningRecords, (row) => row.id),
  screeningVotes: sortRows(snapshot.screeningVotes, (row) => `${row.screening_record_id}:${row.vote_order}:${row.id}`),
  aiReviewDecisions: sortRows(
    snapshot.aiReviewDecisions,
    (row) => `${row.tab}:${row.field_id}:${row.reviewer_profile_id}`,
  ),
});

const assertNoRecentActiveSession = (snapshot) => {
  const heartbeat = snapshot.paper.metadata?.activeSession?.lastHeartbeatAt;
  if (!heartbeat) return;
  const heartbeatTime = Date.parse(heartbeat);
  if (!Number.isFinite(heartbeatTime)) {
    throw new Error(`S016 active-session heartbeat is invalid: ${String(heartbeat)}`);
  }
  const ageMilliseconds = Date.now() - heartbeatTime;
  if (ageMilliseconds < 10 * 60 * 1000) {
    throw new Error(`S016 has an active extraction session heartbeat from ${heartbeat}; no live writes were attempted`);
  }
};

const assertExpectedBeforeState = (snapshot) => {
  const expected = input.expectedLiveState;
  const paper = snapshot.paper;
  if (paper.id !== input.paperId || paper.assigned_study_id !== input.studyId) {
    throw new Error('S016 paper identity mismatch');
  }
  if (paper.status !== expected.status) {
    throw new Error(`S016 expected status ${expected.status}, found ${paper.status}`);
  }
  if (paper.flag_reason !== expected.flagReason) {
    throw new Error(`S016 flag reason changed: ${String(paper.flag_reason)}`);
  }
  if (paper.assigned_to !== expected.assignedTo) {
    throw new Error(`S016 assignment changed: ${String(paper.assigned_to)}`);
  }
  if (paper.primary_file_id !== expected.primaryFileId) {
    throw new Error(`S016 primary_file_id changed: ${String(paper.primary_file_id)}`);
  }
  if (snapshot.files[0]?.id !== expected.primaryFileId) {
    throw new Error('S016 paper_files primary row no longer matches papers.primary_file_id');
  }
  if (snapshot.sourceFile.sha256 !== expected.primaryFileSha256) {
    throw new Error(
      `S016 primary PDF hash changed: expected ${expected.primaryFileSha256}, found ${snapshot.sourceFile.sha256}`,
    );
  }
};

const validatePayload = () => {
  const errors = [];
  const unknownFields = [];
  const missingFields = [];
  for (const tab of MUTABLE_TABS) {
    const staged = input.fields[tab];
    if (!staged || typeof staged !== 'object' || Array.isArray(staged)) {
      errors.push(`${tab}: staged field object missing`);
      continue;
    }
    const expectedIds = definitionIdsByTab.get(tab);
    for (const fieldId of Object.keys(staged)) {
      if (!expectedIds.has(fieldId)) {
        unknownFields.push(`${tab}.${fieldId}`);
      }
    }
    for (const fieldId of expectedIds) {
      if (!Object.hasOwn(staged, fieldId)) {
        missingFields.push(`${tab}.${fieldId}`);
      }
    }
  }

  const fields = Object.entries(input.fields).flatMap(([tab, values]) =>
    Object.entries(values).map(([fieldId, value]) => ({
      fieldId,
      value,
      metric: definitionById.get(fieldId)?.metric ?? null,
      tab,
    })),
  );
  const groups = derivePopulationGroups(fields);
  groups.forEach((group, index) => {
    group.label = input.populationLabels[index] ?? group.label;
  });
  if (groups.length !== input.populationLabels.length) {
    errors.push(
      `Population count mismatch: staged fields derive ${groups.length}, labels provide ${input.populationLabels.length}`,
    );
  }

  const numericOnlyIds = [
    'sampleSizePlayers',
    'injuryTotalCount',
    'injuryIncidenceOverall',
  ];
  for (const fieldId of numericOnlyIds) {
    const value = Object.values(input.fields)
      .map((tab) => tab[fieldId])
      .find((candidate) => candidate !== undefined);
    if (
      typeof value !== 'string'
      || value.split('\n').some((line) => line.trim() && !/^-?\d+(?:\.\d+)?$/.test(line.trim()))
    ) {
      errors.push(`${fieldId}: expected numeric-only newline-aligned values`);
    }
  }

  return { errors, unknownFields, missingFields, groups, fields };
};

const createDesiredPopulationRows = (groups, now, planId = 'dry-run') => {
  const groupRows = groups.map((group) => ({
    id: deterministicUuid(`${planId}:population-group:${group.position}:${group.label}`),
    paper_id: input.paperId,
    tab: 'participantCharacteristics',
    label: group.label,
    position: group.position,
    created_at: now,
    updated_at: now,
  }));
  const valueRows = [];
  for (const groupRow of groupRows) {
    const group = groups[groupRow.position];
    for (const [fieldId, value] of Object.entries(group.values)) {
      valueRows.push({
        id: deterministicUuid(`${planId}:population-value:${groupRow.position}:${fieldId}`),
        population_group_id: groupRow.id,
        paper_id: input.paperId,
        field_id: fieldId,
        value,
        metric: definitionById.get(fieldId)?.metric ?? null,
        unit: null,
        source_field_id: fieldId,
        created_at: now,
        updated_at: now,
      });
    }
  }
  return { groupRows, valueRows };
};

const ensureExtraction = async (tab, existingByTab, now, planId) => {
  const existing = existingByTab.get(tab);
  if (existing) {
    if (APPLY) {
      requireRows(
        await supabase
          .from('extractions')
          .update({ model: EXTRACTION_MODEL, updated_at: now })
          .eq('id', existing.id)
          .eq('paper_id', input.paperId)
          .eq('tab', tab)
          .eq('model', existing.model)
          .eq('updated_at', existing.updated_at)
          .select('*'),
        `update ${tab} extraction`,
        1,
      );
      appendEvent(planId, { action: 'update_extraction', tab, id: existing.id });
    }
    return { ...existing, model: EXTRACTION_MODEL, updated_at: now };
  }
  const row = {
    id: deterministicUuid(`${planId}:extraction:${tab}`),
    paper_id: input.paperId,
    tab,
    model: EXTRACTION_MODEL,
    created_at: now,
    updated_at: now,
  };
  if (APPLY) {
    requireRows(
      await supabase.from('extractions').insert(row).select('*'),
      `insert ${tab} extraction`,
      1,
    );
    appendEvent(planId, { action: 'insert_extraction', tab, id: row.id });
  }
  return { ...row, extraction_fields: [] };
};

const writeExtractionFields = async (extraction, tab, stagedFields, now, report, planId) => {
  const existingByField = new Map(
    (extraction.extraction_fields ?? []).map((row) => [row.field_id, row]),
  );
  for (const [fieldId, rawValue] of Object.entries(stagedFields)) {
    const evidence = input.evidence[`${tab}.${fieldId}`] ?? {};
    const value = rawValue == null ? null : String(rawValue).replace(/\r\n/g, '\n');
    const existing = existingByField.get(fieldId);
    const row = {
      extraction_id: extraction.id,
      field_id: fieldId,
      value,
      confidence: null,
      source_quote: evidence.sourceQuote ?? null,
      page_hint: evidence.pageHint ?? null,
      metric: definitionById.get(fieldId)?.metric ?? null,
      status: value == null || value.trim() === '' ? 'not_reported' : 'reported',
      updated_at: now,
      updated_by: PROFILE_ID,
    };
    if (APPLY) {
      if (existing) {
        requireRows(
          await supabase
            .from('extraction_fields')
            .update(row)
            .eq('id', existing.id)
            .eq('extraction_id', extraction.id)
            .eq('field_id', fieldId)
            .eq('updated_at', existing.updated_at)
            .select('*'),
          `update ${tab}.${fieldId}`,
          1,
        );
        appendEvent(planId, { action: 'update_field', tab, fieldId, id: existing.id });
      } else {
        const fieldIdValue = deterministicUuid(`${planId}:extraction-field:${tab}:${fieldId}`);
        requireRows(
          await supabase
            .from('extraction_fields')
            .insert({ id: fieldIdValue, ...row })
            .select('*'),
          `insert ${tab}.${fieldId}`,
          1,
        );
        appendEvent(planId, { action: 'insert_field', tab, fieldId, id: fieldIdValue });
      }
    }
    report.push({
      tab,
      fieldId,
      action: existing ? 'update' : 'insert',
      priorValue: existing?.value ?? null,
      stagedValue: value,
    });
  }
};

const applyExtraction = async (
  before,
  validation,
  planId = 'dry-run',
  writeTimestamp = new Date().toISOString(),
) => {
  const now = writeTimestamp;
  const existingByTab = new Map(before.extractions.map((row) => [row.tab, row]));
  const writes = [];
  for (const tab of MUTABLE_TABS) {
    const extraction = await ensureExtraction(tab, existingByTab, now, planId);
    await writeExtractionFields(extraction, tab, input.fields[tab], now, writes, planId);
  }

  const desiredPopulations = createDesiredPopulationRows(validation.groups, now, planId);
  if (APPLY) {
    for (const row of before.populationValues) {
      requireRows(
        await supabase
          .from('population_values')
          .delete()
          .eq('id', row.id)
          .eq('paper_id', input.paperId)
          .eq('population_group_id', row.population_group_id)
          .eq('field_id', row.field_id)
          .eq('updated_at', row.updated_at)
          .select('id'),
        `delete old S016 population value ${row.id}`,
        1,
      );
      appendEvent(planId, { action: 'delete_population_value', id: row.id });
    }
    for (const row of before.populationGroups) {
      requireRows(
        await supabase
          .from('population_groups')
          .delete()
          .eq('id', row.id)
          .eq('paper_id', input.paperId)
          .eq('label', row.label)
          .eq('position', row.position)
          .eq('updated_at', row.updated_at)
          .select('id'),
        `delete old S016 population group ${row.id}`,
        1,
      );
      appendEvent(planId, { action: 'delete_population_group', id: row.id });
    }
    requireRows(
      await supabase.from('population_groups').insert(desiredPopulations.groupRows).select('*'),
      'insert S016 population_groups',
      desiredPopulations.groupRows.length,
    );
    appendEvent(planId, {
      action: 'insert_population_groups',
      ids: desiredPopulations.groupRows.map((row) => row.id),
    });
    requireRows(
      await supabase.from('population_values').insert(desiredPopulations.valueRows).select('*'),
      'insert S016 population_values',
      desiredPopulations.valueRows.length,
    );
    appendEvent(planId, {
      action: 'insert_population_values',
      ids: desiredPopulations.valueRows.map((row) => row.id),
    });

    const metadata = {
      ...(before.paper.metadata ?? {}),
      populationLabels: validation.groups.map((group) => group.label),
      populationHash: createPopulationSignature(validation.groups),
    };
    requireRows(
      await supabase
        .from('papers')
        .update({ metadata, updated_at: now })
        .eq('id', input.paperId)
        .eq('assigned_study_id', input.studyId)
        .eq('status', input.expectedLiveState.status)
        .eq('flag_reason', input.expectedLiveState.flagReason)
        .eq('assigned_to', input.expectedLiveState.assignedTo)
        .eq('primary_file_id', input.expectedLiveState.primaryFileId)
        .eq('updated_at', before.paper.updated_at)
        .select('*'),
      'update S016 population metadata',
      1,
    );
    appendEvent(planId, { action: 'update_population_metadata', paperId: input.paperId });
  }
  return {
    writes,
    desiredPopulations: {
      groups: desiredPopulations.groupRows,
      values: desiredPopulations.valueRows,
    },
  };
};

const expectedFieldMap = () => new Map(
  Object.entries(input.fields).flatMap(([tab, values]) =>
    Object.entries(values).map(([fieldId, value]) => [
      `${tab}.${fieldId}`,
      value == null ? null : String(value).replace(/\r\n/g, '\n'),
    ]),
  ),
);

const verifyAfterApply = (before, after, validation) => {
  const findings = [];
  const liveFieldMap = new Map(
    after.extractions.flatMap((extraction) =>
      (extraction.extraction_fields ?? []).map((field) => [
        `${extraction.tab}.${field.field_id}`,
        field.value,
      ]),
    ),
  );
  const fieldMismatches = [];
  for (const [key, expected] of expectedFieldMap()) {
    if (!liveFieldMap.has(key) || liveFieldMap.get(key) !== expected) {
      fieldMismatches.push({ key, expected, actual: liveFieldMap.get(key) ?? null });
    }
  }

  const populationLabels = after.populationGroups.map((row) => row.label);
  const populationLayoutMatches =
    JSON.stringify(populationLabels) === JSON.stringify(input.populationLabels)
    && after.populationGroups.length === input.populationLabels.length;

  const groupById = new Map(after.populationGroups.map((row) => [row.id, row]));
  const livePopulationMap = new Map(
    after.populationValues.map((row) => {
      const group = groupById.get(row.population_group_id);
      return [`${group?.position}.${row.field_id}`, row.value];
    }),
  );
  const stagedPopulationMap = new Map(
    validation.groups.flatMap((group) =>
      Object.entries(group.values).map(([fieldId, value]) => [`${group.position}.${fieldId}`, value]),
    ),
  );
  const structuredDualWriteMismatches = [];
  for (const [key, expected] of stagedPopulationMap) {
    if (livePopulationMap.get(key) !== expected) {
      structuredDualWriteMismatches.push({ key, expected, actual: livePopulationMap.get(key) ?? null });
    }
  }
  for (const [key, actual] of livePopulationMap) {
    if (!stagedPopulationMap.has(key)) {
      structuredDualWriteMismatches.push({ key, expected: null, actual });
    }
  }

  const protectedBeforeHash = hashJson(protectedState(before));
  const protectedAfterHash = hashJson(protectedState(after));
  const protectedUnchanged = protectedBeforeHash === protectedAfterHash;
  const sourceHashMatches =
    after.sourceFile.sha256 === input.expectedLiveState.primaryFileSha256
    && before.sourceFile.sha256 === after.sourceFile.sha256;
  const studyIdMatches = liveFieldMap.get('studyDetails.studyId') === after.paper.assigned_study_id;
  const assignmentPreserved = after.paper.assigned_to === input.expectedLiveState.assignedTo;
  const statusFlagPreservedDuringGate =
    after.paper.status === input.expectedLiveState.status
    && after.paper.flag_reason === input.expectedLiveState.flagReason;
  const extractionModelsCorrect = after.extractions
    .filter((row) => MUTABLE_TABS.has(row.tab))
    .every((row) => row.model === EXTRACTION_MODEL);

  if (fieldMismatches.length) findings.push('source-to-live field transfer mismatch');
  if (!populationLayoutMatches) findings.push('population layout mismatch');
  if (structuredDualWriteMismatches.length) findings.push('population dual-write mismatch');
  if (!protectedUnchanged) findings.push('protected state changed');
  if (!sourceHashMatches) findings.push('primary source hash mismatch');
  if (!studyIdMatches) findings.push('studyId mismatch');
  if (!assignmentPreserved) findings.push('assignment changed');
  if (!statusFlagPreservedDuringGate) findings.push('status or flag changed before gate completion');
  if (!extractionModelsCorrect) findings.push('manual extraction model provenance mismatch');

  return {
    result: findings.length ? 'blocked' : 'passed',
    findings,
    fieldMismatches,
    populationLayoutMatches,
    populationLabels,
    structuredDualWriteMismatches,
    protectedBeforeHash,
    protectedAfterHash,
    protectedUnchanged,
    sourceHashMatches,
    studyIdMatches,
    assignmentPreserved,
    statusFlagPreservedDuringGate,
    extractionModelsCorrect,
  };
};

const finalisePaper = async (expectedUpdatedAt, planId, writeTimestamp) => {
  if (!APPLY) return null;
  const now = writeTimestamp;
  const rows = requireRows(
    await supabase
      .from('papers')
      .update({
        status: 'extracted',
        flag_reason: null,
        updated_at: now,
      })
      .eq('id', input.paperId)
      .eq('assigned_study_id', input.studyId)
      .eq('status', input.expectedLiveState.status)
      .eq('flag_reason', input.expectedLiveState.flagReason)
      .eq('assigned_to', input.expectedLiveState.assignedTo)
      .eq('primary_file_id', input.expectedLiveState.primaryFileId)
      .eq('updated_at', expectedUpdatedAt)
      .select('*'),
    'finalise S016 status',
    1,
  );
  appendEvent(planId, { action: 'finalise_paper', paperId: input.paperId });
  return rows[0];
};

const planPath = (planId) => path.join(OUTPUT_DIR, `s016-immutable-apply-plan-${planId}.json`);

const readPlan = (planId) => {
  if (!/^[a-f0-9]{16}$/.test(planId ?? '')) {
    throw new Error(`Invalid S016 plan ID: ${String(planId)}`);
  }
  const filePath = planPath(planId);
  const plan = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (
    plan.planId !== planId
    || plan.inputHash !== hashJson(input)
    || plan.scriptSha256 !== scriptSha256
  ) {
    throw new Error(`S016 plan identity, input hash, or script hash mismatch: ${filePath}`);
  }
  return plan;
};

const preparePlan = (before, validation) => {
  const beforeStateHash = hashJson(snapshotState(before));
  const inputHash = hashJson(input);
  const planId = hashJson({ beforeStateHash, inputHash, scriptSha256 }).slice(0, 16);
  const filePath = planPath(planId);
  if (fs.existsSync(filePath)) {
    const existing = readPlan(planId);
    if (existing.beforeStateHash !== beforeStateHash) {
      throw new Error(`Existing S016 plan ${planId} has a different rollback baseline`);
    }
    return existing;
  }
  const plannedAt = new Date().toISOString();
  const desiredPopulations = createDesiredPopulationRows(validation.groups, plannedAt, planId);
  const plan = {
    schemaVersion: 1,
    planId,
    preparedAt: plannedAt,
    scope: input.scope,
    inputPath: INPUT_PATH,
    inputHash,
    scriptPath: SCRIPT_PATH,
    scriptSha256,
    beforeStateHash,
    protectedStateHash: hashJson(protectedState(before)),
    sourceFileSha256: before.sourceFile.sha256,
    before,
    intended: {
      fields: input.fields,
      populationLabels: input.populationLabels,
      populationGroups: desiredPopulations.groupRows,
      populationValues: desiredPopulations.valueRows,
      finalPaperStatus: 'extracted',
      finalFlagReason: null,
      backlogState: 'pending_review',
    },
    destructiveTargets: {
      populationGroupIds: before.populationGroups.map((row) => row.id),
      populationValueIds: before.populationValues.map((row) => row.id),
    },
    rollback: {
      command: `node --experimental-strip-types scripts/s016-local-cohort-extraction-2026-07-28.mjs --rollback-plan=${planId}`,
      restores: [
        'S016 extraction rows and fields from the immutable before snapshot',
        'S016 population groups and values from the immutable before snapshot',
        'S016 paper metadata, status, and flag reason from the immutable before snapshot',
      ],
      protectedTablesWritten: [],
    },
  };
  writeImmutableJson(filePath, plan);
  return plan;
};

const assertPlanStillCurrent = (current, plan) => {
  const currentStateHash = hashJson(snapshotState(current));
  if (currentStateHash !== plan.beforeStateHash) {
    throw new Error(
      `S016 live state changed after plan ${plan.planId} was prepared; expected ${plan.beforeStateHash}, found ${currentStateHash}. No live writes were attempted.`,
    );
  }
  if (hashJson(protectedState(current)) !== plan.protectedStateHash) {
    throw new Error(`S016 protected state changed after plan ${plan.planId} was prepared`);
  }
  assertNoRecentActiveSession(current);
};

const withoutExtractionFields = (extraction) => {
  const row = { ...extraction };
  delete row.extraction_fields;
  return row;
};

const normaliseComparableTimestamps = (value, key = '') => {
  if (Array.isArray(value)) {
    return value.map((nested) => normaliseComparableTimestamps(nested));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nested]) => [
        nestedKey,
        normaliseComparableTimestamps(nested, nestedKey),
      ]),
    );
  }
  if (
    typeof value === 'string'
    && /(?:_at|At)$/.test(key)
    && Number.isFinite(Date.parse(value))
  ) {
    return new Date(value).toISOString();
  }
  return value;
};

const rowsEqual = (left, right) =>
  hashJson(normaliseComparableTimestamps(left))
  === hashJson(normaliseComparableTimestamps(right));

const buildPlannedRows = (plan) => {
  const extractionByTab = new Map(plan.before.extractions.map((row) => [row.tab, row]));
  const extractions = [];
  const fields = [];
  for (const tab of MUTABLE_TABS) {
    const baseline = extractionByTab.get(tab);
    const extraction = baseline
      ? {
        ...withoutExtractionFields(baseline),
        model: EXTRACTION_MODEL,
        updated_at: plan.preparedAt,
      }
      : {
        id: deterministicUuid(`${plan.planId}:extraction:${tab}`),
        paper_id: input.paperId,
        tab,
        model: EXTRACTION_MODEL,
        notes: null,
        created_at: plan.preparedAt,
        updated_at: plan.preparedAt,
        created_by: null,
      };
    extractions.push(extraction);
    const baselineFieldById = new Map(
      (baseline?.extraction_fields ?? []).map((row) => [row.field_id, row]),
    );
    for (const [fieldId, rawValue] of Object.entries(input.fields[tab])) {
      const existing = baselineFieldById.get(fieldId);
      const evidence = input.evidence[`${tab}.${fieldId}`] ?? {};
      const value = rawValue == null ? null : String(rawValue).replace(/\r\n/g, '\n');
      fields.push({
        ...(existing ?? {
          id: deterministicUuid(`${plan.planId}:extraction-field:${tab}:${fieldId}`),
          updated_by_agent: null,
        }),
        extraction_id: extraction.id,
        field_id: fieldId,
        value,
        confidence: null,
        source_quote: evidence.sourceQuote ?? null,
        page_hint: evidence.pageHint ?? null,
        metric: definitionById.get(fieldId)?.metric ?? null,
        status: value == null || value.trim() === '' ? 'not_reported' : 'reported',
        updated_at: plan.preparedAt,
        updated_by: PROFILE_ID,
      });
    }
  }
  const metadata = {
    ...(plan.before.paper.metadata ?? {}),
    populationLabels: input.populationLabels,
    populationHash: createPopulationSignature(validatePayload().groups),
  };
  const paperDuringGate = {
    ...plan.before.paper,
    metadata,
    updated_at: plan.preparedAt,
  };
  return {
    extractions,
    fields,
    populationGroups: plan.intended.populationGroups,
    populationValues: plan.intended.populationValues,
    paperDuringGate,
    paperFinal: {
      ...paperDuringGate,
      status: plan.intended.finalPaperStatus,
      flag_reason: plan.intended.finalFlagReason,
    },
  };
};

const assertRowsAreBaselineOrPlanned = (label, currentRows, baselineRows, plannedRows) => {
  const baselineById = new Map(baselineRows.map((row) => [row.id, row]));
  const plannedById = new Map(plannedRows.map((row) => [row.id, row]));
  for (const row of currentRows) {
    const baseline = baselineById.get(row.id);
    const planned = plannedById.get(row.id);
    if (
      (!baseline && !planned)
      || (baseline && planned && !rowsEqual(row, baseline) && !rowsEqual(row, planned))
      || (baseline && !planned && !rowsEqual(row, baseline))
      || (!baseline && planned && !rowsEqual(row, planned))
    ) {
      throw new Error(
        `S016 rollback refused because ${label} row ${row.id} is neither the immutable baseline nor the exact planned state`,
      );
    }
  }
};

const assertRollbackSafe = (current, plan, planned) => {
  if (current.paper.id !== input.paperId || current.paper.assigned_study_id !== input.studyId) {
    throw new Error('S016 rollback target identity mismatch');
  }
  if (current.paper.assigned_to !== input.expectedLiveState.assignedTo) {
    throw new Error('S016 rollback refused because assignment changed');
  }
  if (
    current.paper.primary_file_id !== input.expectedLiveState.primaryFileId
    || current.sourceFile.sha256 !== plan.sourceFileSha256
  ) {
    throw new Error('S016 rollback refused because the primary source changed');
  }
  if (hashJson(protectedState(current)) !== plan.protectedStateHash) {
    throw new Error('S016 rollback refused because protected human state changed');
  }
  assertNoRecentActiveSession(current);

  const currentExtractions = current.extractions.map(withoutExtractionFields);
  const baselineExtractions = plan.before.extractions.map(withoutExtractionFields);
  const currentFields = current.extractions.flatMap((row) => row.extraction_fields ?? []);
  const baselineFields = plan.before.extractions.flatMap((row) => row.extraction_fields ?? []);
  assertRowsAreBaselineOrPlanned(
    'extraction',
    currentExtractions,
    baselineExtractions,
    planned.extractions,
  );
  assertRowsAreBaselineOrPlanned(
    'extraction field',
    currentFields,
    baselineFields,
    planned.fields,
  );
  assertRowsAreBaselineOrPlanned(
    'population group',
    current.populationGroups,
    plan.before.populationGroups,
    planned.populationGroups,
  );
  assertRowsAreBaselineOrPlanned(
    'population value',
    current.populationValues,
    plan.before.populationValues,
    planned.populationValues,
  );
  if (
    !rowsEqual(current.paper, plan.before.paper)
    && !rowsEqual(current.paper, planned.paperDuringGate)
    && !rowsEqual(current.paper, planned.paperFinal)
  ) {
    throw new Error(
      'S016 rollback refused because the paper row is neither the immutable baseline nor an exact planned apply state',
    );
  }
};

const reconcileRows = async ({
  table,
  label,
  currentRows,
  baselineRows,
  plannedRows,
  planId,
  deletePlannedOnly = true,
}) => {
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const baselineById = new Map(baselineRows.map((row) => [row.id, row]));
  for (const baseline of baselineRows) {
    const current = currentById.get(baseline.id);
    if (!current) {
      requireRows(
        await supabase.from(table).insert(baseline).select('*'),
        `rollback: restore missing ${label} ${baseline.id}`,
        1,
      );
      appendEvent(planId, { action: `rollback_insert_${label}`, id: baseline.id });
    } else if (!rowsEqual(current, baseline)) {
      const { id, ...restoredValues } = baseline;
      requireRows(
        await supabase
          .from(table)
          .update(restoredValues)
          .eq('id', id)
          .eq('updated_at', current.updated_at)
          .select('*'),
        `rollback: restore changed ${label} ${id}`,
        1,
      );
      appendEvent(planId, { action: `rollback_update_${label}`, id });
    }
  }

  if (deletePlannedOnly) {
    for (const planned of plannedRows) {
      if (baselineById.has(planned.id)) continue;
      const current = currentById.get(planned.id);
      if (!current) continue;
      requireRows(
        await supabase
          .from(table)
          .delete()
          .eq('id', current.id)
          .eq('updated_at', current.updated_at)
          .select('id'),
        `rollback: remove planned-only ${label} ${current.id}`,
        1,
      );
      appendEvent(planId, { action: `rollback_delete_${label}`, id: current.id });
    }
  }
};

const rollbackPlan = async (plan) => {
  const current = await fetchSnapshot();
  const planned = buildPlannedRows(plan);
  assertRollbackSafe(current, plan, planned);
  const rollbackSnapshotPath = path.join(OUTPUT_DIR, `s016-pre-rollback-live-snapshot-${plan.planId}.json`);
  if (!fs.existsSync(rollbackSnapshotPath)) {
    writeImmutableJson(rollbackSnapshotPath, current);
  }
  appendEvent(plan.planId, { action: 'rollback_started', snapshot: rollbackSnapshotPath });

  const originalExtractions = plan.before.extractions.map(withoutExtractionFields);
  const originalFields = plan.before.extractions.flatMap((row) => row.extraction_fields ?? []);
  await reconcileRows({
    table: 'extractions',
    label: 'extraction',
    currentRows: current.extractions.map(withoutExtractionFields),
    baselineRows: originalExtractions,
    plannedRows: planned.extractions,
    planId: plan.planId,
    deletePlannedOnly: false,
  });
  await reconcileRows({
    table: 'extraction_fields',
    label: 'extraction_field',
    currentRows: current.extractions.flatMap((row) => row.extraction_fields ?? []),
    baselineRows: originalFields,
    plannedRows: planned.fields,
    planId: plan.planId,
  });
  const afterExtractionFieldReconciliation = await fetchSnapshot();
  await reconcileRows({
    table: 'extractions',
    label: 'extraction',
    currentRows: afterExtractionFieldReconciliation.extractions.map(withoutExtractionFields),
    baselineRows: originalExtractions,
    plannedRows: planned.extractions,
    planId: plan.planId,
  });
  await reconcileRows({
    table: 'population_values',
    label: 'population_value',
    currentRows: current.populationValues,
    baselineRows: [],
    plannedRows: planned.populationValues,
    planId: plan.planId,
  });
  await reconcileRows({
    table: 'population_groups',
    label: 'population_group',
    currentRows: current.populationGroups,
    baselineRows: [],
    plannedRows: planned.populationGroups,
    planId: plan.planId,
  });
  const afterPlannedPopulationRemoval = await fetchSnapshot();
  await reconcileRows({
    table: 'population_groups',
    label: 'population_group',
    currentRows: afterPlannedPopulationRemoval.populationGroups,
    baselineRows: plan.before.populationGroups,
    plannedRows: [],
    planId: plan.planId,
  });
  const afterPopulationGroupRestoration = await fetchSnapshot();
  await reconcileRows({
    table: 'population_values',
    label: 'population_value',
    currentRows: afterPopulationGroupRestoration.populationValues,
    baselineRows: plan.before.populationValues,
    plannedRows: [],
    planId: plan.planId,
  });
  const beforePaperRestoration = await fetchSnapshot();
  if (!rowsEqual(beforePaperRestoration.paper, plan.before.paper)) {
    const restoredPaper = { ...plan.before.paper };
    delete restoredPaper.id;
    requireRows(
      await supabase
        .from('papers')
        .update(restoredPaper)
        .eq('id', input.paperId)
        .eq('assigned_study_id', input.studyId)
        .eq('assigned_to', input.expectedLiveState.assignedTo)
        .eq('primary_file_id', input.expectedLiveState.primaryFileId)
        .eq('updated_at', beforePaperRestoration.paper.updated_at)
        .select('*'),
      'rollback: restore paper state',
      1,
    );
    appendEvent(plan.planId, { action: 'rollback_restore_paper', paperId: input.paperId });
  }

  const restored = await fetchSnapshot();
  if (hashJson(snapshotState(restored)) !== plan.beforeStateHash) {
    throw new Error('S016 rollback verification failed: restored state does not match immutable baseline');
  }
  appendEvent(plan.planId, { action: 'rollback_verified' });
  const rollbackAuditPath = path.join(OUTPUT_DIR, `s016-rollback-audit-${plan.planId}.json`);
  writeImmutableJson(rollbackAuditPath, {
    schemaVersion: 1,
    planId: plan.planId,
    result: 'passed',
    restoredStateHash: hashJson(snapshotState(restored)),
    protectedStateHash: hashJson(protectedState(restored)),
    sourceFileSha256: restored.sourceFile.sha256,
    rollbackSnapshotPath,
  });
  return { restored, rollbackAuditPath };
};

const buildAudit = ({
  before,
  validation,
  applyResult,
  integrityGate,
  finalSnapshot,
  finalisedPaper,
  mode,
  plan,
}) => ({
  schemaVersion: 1,
  date: input.date,
  mode,
  planId: plan?.planId ?? null,
  scope: input.scope,
  model: input.model,
  eligibility: input.eligibility,
  sourceCoverage: input.sourceCoverage,
  sourceFile: before.sourceFile,
  before: {
    stateHash: hashJson(snapshotState(before)),
    status: before.paper.status,
    flagReason: before.paper.flag_reason,
    assignment: before.paper.assigned_to,
    extractionTabs: before.extractions.map((row) => row.tab),
    populationLabels: before.populationGroups.map((row) => row.label),
    populationCount: before.populationGroups.length,
    populationValues: before.populationValues.length,
    protectedHash: hashJson(protectedState(before)),
    screeningRecordsResolvedByStudyIdOrPaperId: before.screeningRecords.length,
    screeningVotes: before.screeningVotes.length,
  },
  preApplyCompleteness: {
    result: 'passed',
    unknownFieldIds: validation.unknownFields,
    missingRequiredPayloadFields: validation.missingFields,
    populationLabels: validation.groups.map((group) => group.label),
    populationCount: validation.groups.length,
    stagedPopulationValues: applyResult.desiredPopulations.values.length,
    tabsPopulated: Object.entries(input.fields)
      .filter(([, fields]) => Object.values(fields).some((value) => value != null && String(value).trim()))
      .map(([tab]) => tab),
    intentionallyBlank: input.intentionallyBlank,
    derivedOrBackCalculatedValues: [],
  },
  applyResult: {
    result: mode === 'apply' ? 'passed' : 'not_run_dry_run',
    fieldWrites: applyResult.writes,
    oldPopulationGroupsToReplace: before.populationGroups.map((row) => ({
      id: row.id,
      label: row.label,
      position: row.position,
    })),
    oldPopulationValueCountToReplace: before.populationValues.length,
    newPopulationGroups: applyResult.desiredPopulations.groups.map((row) => ({
      id: row.id,
      label: row.label,
      position: row.position,
    })),
    newPopulationValueCount: applyResult.desiredPopulations.values.length,
  },
  integrityGate,
  final: finalSnapshot ? {
    status: finalSnapshot.paper.status,
    flagReason: finalSnapshot.paper.flag_reason,
    assignment: finalSnapshot.paper.assigned_to,
    studyId: finalSnapshot.paper.assigned_study_id,
    primaryFileId: finalSnapshot.paper.primary_file_id,
    primaryFileSha256: finalSnapshot.sourceFile.sha256,
    populationLabels: finalSnapshot.populationGroups.map((row) => row.label),
    populationCount: finalSnapshot.populationGroups.length,
    populationValues: finalSnapshot.populationValues.length,
    protectedHash: hashJson(protectedState(finalSnapshot)),
    finalisedPaperUpdatedAt: finalisedPaper.updated_at,
  } : null,
  backlogUpdateRequired: mode === 'apply'
    ? 'docs/review-backlog.md: add S016 as extracted with pending_review after this passed gate'
    : 'Deferred until live apply and focused integrity gate pass',
  readyFor: mode === 'apply'
    ? 'Human extraction review'
    : 'Explicit approval of the immutable S016 population replacement plan',
});

const main = async () => {
  if (
    [PREPARE_PLAN, Boolean(VALIDATE_PLAN_ID), Boolean(APPLY_PLAN_ID), Boolean(ROLLBACK_PLAN_ID)]
      .filter(Boolean).length > 1
  ) {
    throw new Error(
      'Choose exactly one S016 mode: --prepare-plan, --validate-plan=<id>, --apply-plan=<id>, or --rollback-plan=<id>',
    );
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (VALIDATE_PLAN_ID) {
    const plan = readPlan(VALIDATE_PLAN_ID);
    const current = await fetchSnapshot();
    assertExpectedBeforeState(current);
    assertPlanStillCurrent(current, plan);
    console.log(JSON.stringify({
      mode: 'validate-plan',
      planId: plan.planId,
      result: 'passed',
      beforeStateHash: plan.beforeStateHash,
      currentStateHash: hashJson(snapshotState(current)),
      protectedStateHash: hashJson(protectedState(current)),
      sourceFileSha256: current.sourceFile.sha256,
      destructiveTargets: plan.destructiveTargets,
      applyCommand: `node --experimental-strip-types scripts/s016-local-cohort-extraction-2026-07-28.mjs --apply-plan=${plan.planId}`,
      rollbackCommand: plan.rollback.command,
    }, null, 2));
    return;
  }

  if (ROLLBACK_PLAN_ID) {
    const plan = readPlan(ROLLBACK_PLAN_ID);
    const result = await rollbackPlan(plan);
    console.log(JSON.stringify({
      mode: 'rollback',
      planId: plan.planId,
      result: 'passed',
      restoredStateHash: hashJson(snapshotState(result.restored)),
      audit: result.rollbackAuditPath,
    }, null, 2));
    return;
  }

  const validation = validatePayload();
  if (
    validation.errors.length
    || validation.unknownFields.length
    || validation.missingFields.length
  ) {
    throw new Error(JSON.stringify({
      validationErrors: validation.errors,
      unknownFields: validation.unknownFields,
      missingFields: validation.missingFields,
    }, null, 2));
  }

  let before;
  let plan = null;
  if (APPLY_PLAN_ID) {
    plan = readPlan(APPLY_PLAN_ID);
    before = plan.before;
    const current = await fetchSnapshot();
    assertExpectedBeforeState(current);
    assertPlanStillCurrent(current, plan);
    const eventPath = path.join(OUTPUT_DIR, `s016-apply-events-${plan.planId}.jsonl`);
    fs.writeFileSync(eventPath, '', { flag: 'wx' });
    appendEvent(plan.planId, {
      action: 'apply_started',
      beforeStateHash: plan.beforeStateHash,
      rollbackCommand: plan.rollback.command,
    });
  } else {
    before = await fetchSnapshot();
    assertExpectedBeforeState(before);
    if (PREPARE_PLAN) {
      plan = preparePlan(before, validation);
    }
  }

  const executionPlanId = plan?.planId ?? 'dry-run';
  const writeTimestamp = plan?.preparedAt ?? new Date().toISOString();
  const applyResult = await applyExtraction(before, validation, executionPlanId, writeTimestamp);
  const afterExtraction = APPLY ? await fetchSnapshot() : before;
  const integrityGate = APPLY
    ? verifyAfterApply(before, afterExtraction, validation)
    : {
      result: 'not_run_dry_run',
      stagedPopulationLabels: validation.groups.map((group) => group.label),
      stagedPopulationCount: validation.groups.length,
      stagedPopulationValues: applyResult.desiredPopulations.values.length,
    };

  if (APPLY && integrityGate.result !== 'passed') {
    throw new Error(`S016 focused live integrity gate blocked: ${integrityGate.findings.join('; ')}`);
  }

  const finalisedPaper = await finalisePaper(
    afterExtraction.paper.updated_at,
    executionPlanId,
    writeTimestamp,
  );
  const finalSnapshot = APPLY ? await fetchSnapshot() : null;
  if (APPLY) {
    if (finalSnapshot.paper.status !== 'extracted' || finalSnapshot.paper.flag_reason !== null) {
      throw new Error('S016 final status/flag verification failed');
    }
    if (hashJson(protectedState(before)) !== hashJson(protectedState(finalSnapshot))) {
      throw new Error('S016 protected state changed during final status update');
    }
    if (finalSnapshot.sourceFile.sha256 !== input.expectedLiveState.primaryFileSha256) {
      throw new Error('S016 primary source changed during final status update');
    }
    appendEvent(executionPlanId, { action: 'apply_verified' });
  }

  const mode = APPLY ? 'apply' : PREPARE_PLAN ? 'prepared-plan' : 'dry-run';
  const audit = buildAudit({
    before,
    validation,
    applyResult,
    integrityGate,
    finalSnapshot,
    finalisedPaper,
    mode,
    plan,
  });
  const auditPath = path.join(
    OUTPUT_DIR,
    APPLY
      ? `s016-manual-extraction-live-apply-audit-${executionPlanId}.json`
      : PREPARE_PLAN
        ? `s016-manual-extraction-prepared-plan-audit-${executionPlanId}.json`
        : 's016-manual-extraction-dry-run-audit-2026-07-28.json',
  );
  if (APPLY || PREPARE_PLAN) {
    writeImmutableJson(auditPath, audit);
  } else {
    fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  }
  const beforePath = APPLY || PREPARE_PLAN
    ? planPath(executionPlanId)
    : path.join(OUTPUT_DIR, 's016-pre-apply-live-snapshot-2026-07-28.json');
  if (!APPLY && !PREPARE_PLAN) {
    fs.writeFileSync(beforePath, `${JSON.stringify(before, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    mode,
    planId: plan?.planId ?? null,
    eligibility: audit.eligibility.decision,
    sourceHash: audit.sourceFile.sha256,
    preApplyCompleteness: audit.preApplyCompleteness.result,
    intendedPopulationLabels: audit.preApplyCompleteness.populationLabels,
    intendedPopulationCount: audit.preApplyCompleteness.populationCount,
    intendedPopulationValues: audit.preApplyCompleteness.stagedPopulationValues,
    integrityGate: audit.integrityGate.result,
    final: audit.final,
    immutablePlan: plan ? planPath(plan.planId) : null,
    applyCommand: plan
      ? `node --experimental-strip-types scripts/s016-local-cohort-extraction-2026-07-28.mjs --apply-plan=${plan.planId}`
      : null,
    rollbackCommand: plan?.rollback.command ?? null,
    audit: auditPath,
  }, null, 2));
};

main().catch((error) => {
  if (APPLY_PLAN_ID) {
    appendEvent(APPLY_PLAN_ID, {
      action: 'apply_failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
  throw error;
});
