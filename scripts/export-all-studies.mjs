import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'fifa-gbi-data-extraction');
const envPath = path.join(appRoot, '.env.local');
const schemaPath = path.join(appRoot, 'src/lib/extraction/schema.ts');
const outputDir = path.join(repoRoot, 'exports');

const GLOBAL_TABS = new Set(['studyDetails', 'participantCharacteristics', 'definitions', 'exposure']);
const TABLE_EDITOR_TABS = new Set(['injuryTissueType', 'injuryLocation', 'illnessRegion', 'illnessEtiology']);
const DEFAULT_OUTPUT_PREFIX = 'all-studies-export';

// Statuses that never belong in an analysis export:
//   systematic_review - held for reference checking only; re-reports primary studies counted separately.
//   archived, no_exposure - do not meet the inclusion criteria.
//   mental_health, referee - outside the analysis scope; kept for the descriptive breakdown only.
//   american_data - excluded by analytical decision, not by anything in the paper's own metadata.
// The papers stay in the database as an audit trail. Pass --allow-status <status> to override.
const DEFAULT_EXCLUDED_STATUSES = [
  'systematic_review',
  'archived',
  'no_exposure',
  'mental_health',
  'referee',
  'american_data',
];

function parseArgs(argv) {
  const includeStatuses = [];
  const excludeStatuses = [...DEFAULT_EXCLUDED_STATUSES];
  const allowStatuses = [];
  let outputPrefix = DEFAULT_OUTPUT_PREFIX;
  let scope = 'analysis';
  let keepEmpty = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--include-status') {
      includeStatuses.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--exclude-status') {
      excludeStatuses.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--allow-status') {
      allowStatuses.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--scope') {
      scope = argv[index + 1] === 'source' ? 'source' : 'analysis';
      index += 1;
      continue;
    }

    if (arg === '--keep-empty') {
      keepEmpty = true;
      continue;
    }

    if (arg === '--output-prefix') {
      outputPrefix = argv[index + 1] || DEFAULT_OUTPUT_PREFIX;
      index += 1;
    }
  }

  const allowed = new Set(allowStatuses.filter(Boolean));

  return {
    includeStatuses: includeStatuses.filter(Boolean),
    excludeStatuses: excludeStatuses.filter(Boolean).filter((status) => !allowed.has(status)),
    outputPrefix,
    scope,
    keepEmpty,
  };
}

// Mirrors src/lib/analysis-source-policy.ts: only the parts the export needs.
function readAnalysisTreatment(metadata) {
  const raw = metadata?.analysisSourceTreatment;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { role: 'standalone', includeInAnalysisExport: true, populationTreatments: [] };
  }
  return {
    role: typeof raw.role === 'string' ? raw.role : 'standalone',
    includeInAnalysisExport: raw.includeInAnalysisExport !== false,
    populationTreatments: Array.isArray(raw.populationTreatments) ? raw.populationTreatments : [],
  };
}

// Mirrors isSecondSearchPaper in src/lib/data-extraction-batch-filter.ts.
function searchBatchLabel(metadata) {
  const meta = metadata ?? {};
  const isSecond =
    meta.searchBatch === 'second' ||
    (typeof meta.searchBatchLabel === 'string' && meta.searchBatchLabel.includes('Second search'));
  if (isSecond) return '2nd search';
  if (meta.searchBatch === 'first') return '1st search';
  return typeof meta.searchBatchLabel === 'string' && meta.searchBatchLabel ? meta.searchBatchLabel : '';
}

function formatNotes(noteRows) {
  return noteRows
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((note) => {
      const date = String(note.created_at ?? '').slice(0, 10);
      const body = String(note.body ?? '').replace(/\r?\n/g, ' ').trim();
      return date ? `[${date}] ${body}` : body;
    })
    .filter(Boolean)
    .join(' || ');
}

// Paper is dropped from the analysis export, with the reason recorded in the audit file.
function paperExclusionReason(paper, treatment, hasExtractionData, keepEmpty) {
  const metadata = paper.metadata ?? {};
  if (!treatment.includeInAnalysisExport) {
    return `analysis_source_treatment:${treatment.role}`;
  }
  if (metadata.attachedReferenceOnly === true) return 'attached_reference_only';
  if (metadata.referenceCheckingOnly === true) return 'reference_checking_only';
  if (paper.dedupe_review_status === 'duplicate') return 'dedupe_review_status:duplicate';
  if (!keepEmpty && !hasExtractionData) return 'no_extraction_data';
  return null;
}

// Granular subgroup rows are kept in the export, but flagged: their numbers are already
// counted inside another row on the same paper, so summing every row double-counts.
// Also guards against stale population metadata drifting out of sync with the live groups.
function granularPopulationPositions(paper, treatment, groups) {
  const granular = new Set();
  const groupsByPosition = new Map(groups.map((group) => [group.position, group]));

  for (const row of treatment.populationTreatments) {
    if (!Number.isInteger(row.populationPosition)) continue;
    const group = groupsByPosition.get(row.populationPosition);
    if (!group || group.label !== row.expectedLabel) {
      throw new Error(
        `${paper.assigned_study_id}: population treatment no longer matches position ${row.populationPosition} (${row.expectedLabel})`,
      );
    }
    if (row.includeInAnalysisExport === false) {
      granular.add(row.populationPosition);
    }
  }

  return granular;
}

function loadEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function splitLines(value) {
  if (typeof value !== 'string' || value.length === 0) return [];
  return value.split(/\r?\n/);
}

function sanitizeLegacyValue(value) {
  if (!value) return null;
  const match = value.match(/^.+?\s*[:\-–-]\s*(.+)$/);
  return match ? match[1].trim() : value;
}

function parseFieldDefinitions(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const fields = [];
  const re = /{\s*id:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'.*?\s*tab:\s*'([^']+)'/gs;
  let match;
  while ((match = re.exec(source)) !== null) {
    const [, id, label, tab] = match;
    fields.push({ id, label, tab });
  }
  return fields;
}

function inferTabFromFieldId(fieldId) {
  if (fieldId.startsWith('injuryTissueType_')) return 'injuryTissueType';
  if (fieldId.startsWith('injuryLocation_')) return 'injuryLocation';
  if (fieldId.startsWith('illnessRegion_')) return 'illnessRegion';
  if (fieldId.startsWith('illnessEtiology_')) return 'illnessEtiology';
  return null;
}

function buildFieldMap(extractions) {
  const map = new Map();
  for (const extraction of extractions) {
    for (const field of extraction.fields ?? []) {
      map.set(field.field_id, {
        fieldId: field.field_id,
        value: field.value ?? null,
        tab: extraction.tab,
      });
    }
  }
  return map;
}

function deriveGroups(paperId, fieldMap) {
  const sexLines = splitLines(fieldMap.get('sex')?.value);
  const ageLines = splitLines(fieldMap.get('ageCategory')?.value);
  const sampleLines = splitLines(fieldMap.get('sampleSizePlayers')?.value);
  const maxCount = Math.max(sexLines.length, ageLines.length, sampleLines.length, 1);

  const groups = [];
  for (let index = 0; index < maxCount; index += 1) {
    const label = sexLines[index] || ageLines[index] || `Row ${index + 1}`;
    groups.push({
      id: `derived-${paperId}-${index}`,
      label,
      position: index,
      values: [],
    });
  }
  return groups;
}

function resolveGroups(paper, extractionRows, groupRows, valueRows) {
  const fieldMap = buildFieldMap(extractionRows);
  if (groupRows.length > 0 && valueRows.length > 0) {
    const valuesByGroup = new Map();
    for (const value of valueRows) {
      const bucket = valuesByGroup.get(value.population_group_id) ?? [];
      bucket.push({
        fieldId: value.field_id,
        value: sanitizeLegacyValue(value.value ?? null),
      });
      valuesByGroup.set(value.population_group_id, bucket);
    }
    return groupRows
      .map((group) => ({
        id: group.id,
        label: group.label,
        position: group.position,
        values: valuesByGroup.get(group.id) ?? [],
      }))
      .sort((a, b) => a.position - b.position);
  }
  return deriveGroups(paper.id, fieldMap);
}

function normalizeValueForGroup(fieldId, tab, group, groupValues, fieldMap) {
  const direct = groupValues.get(fieldId);
  const field = fieldMap.get(fieldId);
  const extractionValue = field?.value ?? null;

  if (GLOBAL_TABS.has(tab)) {
    const lines = splitLines(extractionValue);
    if (lines.length > 1) return lines[group.position] ?? '';
    if (lines.length === 1) return lines[0];
    return extractionValue ?? '';
  }

  if (direct != null) {
    if (TABLE_EDITOR_TABS.has(tab)) {
      if (typeof direct === 'string' && direct.includes('\n')) {
        const line = splitLines(direct)[group.position] ?? '';
        return line.trim();
      }
      return direct;
    }

    if (typeof direct === 'string' && direct.includes('\n')) {
      return splitLines(direct)[group.position] ?? '';
    }
    return direct;
  }

  if (TABLE_EDITOR_TABS.has(tab)) {
    return '';
  }

  if (typeof extractionValue === 'string') {
    if (extractionValue.includes('\n')) {
      return splitLines(extractionValue)[group.position] ?? '';
    }
    return extractionValue;
  }

  return '';
}

async function fetchAllRows(supabase, table, select, orderColumn) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;
    let query = supabase.from(table).select(select).range(from, to);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  const { includeStatuses, excludeStatuses, outputPrefix, scope, keepEmpty } = parseArgs(
    process.argv.slice(2),
  );
  const env = loadEnvFile(envPath);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials in fifa-gbi-data-extraction/.env.local');
  }

  const fieldDefs = parseFieldDefinitions(schemaPath);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const [papers, extractions, extractionFields, populationGroups, populationValues, paperNotes] = await Promise.all([
    fetchAllRows(
      supabase,
      'papers',
      'id,assigned_study_id,title,status,uploaded_at,metadata,dedupe_review_status',
      'assigned_study_id',
    ),
    fetchAllRows(supabase, 'extractions', 'id,paper_id,tab,model,updated_at', 'updated_at'),
    fetchAllRows(
      supabase,
      'extraction_fields',
      'id,extraction_id,field_id,value,updated_at',
      'updated_at',
    ),
    fetchAllRows(supabase, 'population_groups', 'id,paper_id,tab,label,position', 'position'),
    fetchAllRows(
      supabase,
      'population_values',
      'id,population_group_id,paper_id,field_id,value,metric,unit',
      'paper_id',
    ),
    fetchAllRows(supabase, 'paper_notes', 'id,paper_id,body,created_at', 'created_at'),
  ]);

  const fieldsByExtraction = new Map();
  for (const row of extractionFields) {
    const bucket = fieldsByExtraction.get(row.extraction_id) ?? [];
    bucket.push(row);
    fieldsByExtraction.set(row.extraction_id, bucket);
  }

  const extractionsByPaper = new Map();
  for (const extraction of extractions) {
    const bucket = extractionsByPaper.get(extraction.paper_id) ?? [];
    bucket.push({
      ...extraction,
      fields: fieldsByExtraction.get(extraction.id) ?? [],
    });
    extractionsByPaper.set(extraction.paper_id, bucket);
  }

  const groupsByPaper = new Map();
  for (const group of populationGroups) {
    const bucket = groupsByPaper.get(group.paper_id) ?? [];
    bucket.push(group);
    groupsByPaper.set(group.paper_id, bucket);
  }

  const valuesByPaper = new Map();
  for (const value of populationValues) {
    const bucket = valuesByPaper.get(value.paper_id) ?? [];
    bucket.push(value);
    valuesByPaper.set(value.paper_id, bucket);
  }

  const dynamicFieldIds = new Set();
  for (const field of extractionFields) dynamicFieldIds.add(field.field_id);
  for (const value of populationValues) dynamicFieldIds.add(value.field_id);

  const fieldDefMap = new Map(fieldDefs.map((field) => [field.id, field]));
  const orderedFields = [...fieldDefs];
  for (const fieldId of [...dynamicFieldIds].sort()) {
    if (!fieldDefMap.has(fieldId)) {
      orderedFields.push({
        id: fieldId,
        label: fieldId,
        tab: inferTabFromFieldId(fieldId) ?? 'unknown',
      });
    }
  }

  const notesByPaper = new Map();
  for (const note of paperNotes) {
    const bucket = notesByPaper.get(note.paper_id) ?? [];
    bucket.push(note);
    notesByPaper.set(note.paper_id, bucket);
  }

  const papersWithExtractionData = new Set();
  for (const extraction of extractions) {
    for (const field of fieldsByExtraction.get(extraction.id) ?? []) {
      if (field.value != null && String(field.value).trim() !== '') {
        papersWithExtractionData.add(extraction.paper_id);
      }
    }
  }
  for (const value of populationValues) {
    if (value.value != null && String(value.value).trim() !== '') {
      papersWithExtractionData.add(value.paper_id);
    }
  }

  const headers = [
    'paper_id',
    'paper_title',
    'status',
    'population_label',
    ...orderedFields.map((field) => field.id),
    'population_analysis_flag',
    'search_batch',
    'notes',
  ];
  const lines = [headers.map(csvEscape).join(',')];
  const includedStatusSet = new Set(includeStatuses);
  const excludedStatusSet = new Set(excludeStatuses);
  // Status filtering runs inside the main loop so every dropped paper reaches the audit file.
  const statusExclusionReason = (paper) => {
    if (includedStatusSet.size > 0 && !includedStatusSet.has(paper.status)) {
      return `status_not_in_include_list:${paper.status}`;
    }
    if (excludedStatusSet.has(paper.status)) {
      if (paper.status === 'systematic_review') return 'systematic_review:reference_checking_only';
      if (paper.status === 'archived' || paper.status === 'no_exposure') {
        return `${paper.status}:does_not_meet_inclusion_criteria`;
      }
      if (paper.status === 'mental_health' || paper.status === 'referee') {
        return `${paper.status}:outside_analysis_scope`;
      }
      if (paper.status === 'american_data') return 'american_data:analytical_decision';
      return `status_excluded:${paper.status}`;
    }
    return null;
  };
  const selectedPapers = papers;

  const excludedAudit = [];
  const granularAudit = [];
  let exportedPapers = 0;
  let granularPopulationRows = 0;

  for (const paper of selectedPapers) {
    const treatment = readAnalysisTreatment(paper.metadata);

    {
      const reason =
        statusExclusionReason(paper) ??
        (scope === 'analysis'
          ? paperExclusionReason(paper, treatment, papersWithExtractionData.has(paper.id), keepEmpty)
          : null);
      if (reason) {
        excludedAudit.push({
          studyId: paper.assigned_study_id || paper.id,
          title: paper.title ?? '',
          status: paper.status ?? '',
          scopeLevel: 'paper',
          populationLabel: '',
          reason,
        });
        continue;
      }
    }

    const extractionRows = extractionsByPaper.get(paper.id) ?? [];
    const groupRows = groupsByPaper.get(paper.id) ?? [];
    const valueRows = valuesByPaper.get(paper.id) ?? [];
    const fieldMap = buildFieldMap(extractionRows);
    const groups = resolveGroups(paper, extractionRows, groupRows, valueRows);
    const granularPositions =
      scope === 'analysis' ? granularPopulationPositions(paper, treatment, groups) : new Set();
    const notes = formatNotes(notesByPaper.get(paper.id) ?? []);
    const batchLabel = searchBatchLabel(paper.metadata);
    exportedPapers += 1;

    for (const group of groups) {
      const isGranular = granularPositions.has(group.position);
      if (isGranular) {
        granularPopulationRows += 1;
        granularAudit.push({
          studyId: paper.assigned_study_id || paper.id,
          title: paper.title ?? '',
          status: paper.status ?? '',
          populationLabel: group.label ?? '',
          position: group.position,
        });
      }
      const groupValues = new Map((group.values ?? []).map((entry) => [entry.fieldId, entry.value]));
      const row = [
        paper.assigned_study_id || paper.id,
        paper.title ?? '',
        paper.status ?? '',
        group.label ?? '',
      ];

      for (const field of orderedFields) {
        let value = normalizeValueForGroup(field.id, field.tab, group, groupValues, fieldMap);
        // Keep exported study IDs canonical even if an old extraction field is stale.
        if (field.id === 'studyId') {
          value = paper.assigned_study_id || paper.id;
        }
        if (typeof value === 'string') {
          value = value.replace(/\r?\n/g, ' ').trim();
        }
        row.push(value ?? '');
      }

      row.push(isGranular ? 'granular_subset' : '', batchLabel, notes);
      lines.push(row.map(csvEscape).join(','));
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${outputPrefix}-${stamp}.csv`);
  fs.writeFileSync(outputPath, `\uFEFF${lines.join('\r\n')}`);

  const auditHeaders = ['study_id', 'title', 'status', 'level', 'population_label', 'reason'];
  const auditLines = [auditHeaders.map(csvEscape).join(',')];
  for (const entry of excludedAudit) {
    auditLines.push(
      [entry.studyId, entry.title, entry.status, entry.scopeLevel, entry.populationLabel, entry.reason]
        .map(csvEscape)
        .join(','),
    );
  }
  const auditPath = path.join(outputDir, `${outputPrefix}-excluded-${stamp}.csv`);
  fs.writeFileSync(auditPath, `\uFEFF${auditLines.join('\r\n')}`);

  const granularHeaders = ['study_id', 'title', 'status', 'population_position', 'population_label'];
  const granularLines = [granularHeaders.map(csvEscape).join(',')];
  for (const entry of granularAudit) {
    granularLines.push(
      [entry.studyId, entry.title, entry.status, entry.position, entry.populationLabel]
        .map(csvEscape)
        .join(','),
    );
  }
  const granularPath = path.join(outputDir, `${outputPrefix}-granular-subset-rows-${stamp}.csv`);
  fs.writeFileSync(granularPath, `\uFEFF${granularLines.join('\r\n')}`);

  console.log(`scope=${scope}`);
  console.log(`papers_considered=${selectedPapers.length}`);
  console.log(`papers_exported=${exportedPapers}`);
  console.log(`papers_excluded=${excludedAudit.length}`);
  console.log(`population_rows_kept_but_flagged_granular=${granularPopulationRows}`);
  console.log(`rows=${lines.length - 1}`);
  console.log(`output=${outputPath}`);
  console.log(`excluded_audit=${auditPath}`);
  console.log(`granular_rows_audit=${granularPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
