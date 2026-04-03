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

  const [papers, extractions, extractionFields, populationGroups, populationValues] = await Promise.all([
    fetchAllRows(
      supabase,
      'papers',
      'id,assigned_study_id,title,status,uploaded_at',
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

  const headers = ['paper_id', 'paper_title', 'status', 'population_label', ...orderedFields.map((field) => field.id)];
  const lines = [headers.map(csvEscape).join(',')];

  for (const paper of papers) {
    const extractionRows = extractionsByPaper.get(paper.id) ?? [];
    const groupRows = groupsByPaper.get(paper.id) ?? [];
    const valueRows = valuesByPaper.get(paper.id) ?? [];
    const fieldMap = buildFieldMap(extractionRows);
    const groups = resolveGroups(paper, extractionRows, groupRows, valueRows);

    for (const group of groups) {
      const groupValues = new Map((group.values ?? []).map((entry) => [entry.fieldId, entry.value]));
      const row = [
        paper.assigned_study_id || paper.id,
        paper.title ?? '',
        paper.status ?? '',
        group.label ?? '',
      ];

      for (const field of orderedFields) {
        let value = normalizeValueForGroup(field.id, field.tab, group, groupValues, fieldMap);
        if (typeof value === 'string') {
          value = value.replace(/\r?\n/g, ' ').trim();
        }
        row.push(value ?? '');
      }

      lines.push(row.map(csvEscape).join(','));
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `all-studies-export-${stamp}.csv`);
  fs.writeFileSync(outputPath, `\uFEFF${lines.join('\r\n')}`);

  console.log(`papers=${papers.length}`);
  console.log(`rows=${lines.length - 1}`);
  console.log(`output=${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
