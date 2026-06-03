#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { finalizeTitleAbstractRecommendation } from './title_abstract_supabase_finalize.mjs';
import {
  compact,
  preTriageRecord,
  validateScreeningOutput,
} from './title_abstract_screening_rules.mjs';

const require = createRequire(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/package.json'));
const { createClient } = require('@supabase/supabase-js');
const { jsonrepair } = require('jsonrepair');

const SEARCH_BATCH_LABEL = 'Second search - Ishanka - 2026-05-26';
const CRITERIA_VERSION = 'fifa-gbi-title-abstract-v1.4-2026-06-02';
const DEFAULT_PROVIDER = 'codex-cli';
const DEFAULT_CRITERIA_FILE = path.resolve(process.cwd(), 'skills/fifa-title-abstract-screening-review/references/runtime-criteria.md');
const DEFAULT_OUTPUT = '/tmp/second-search-title-abstract-ai-codex.json';
const DEFAULT_LOG = '/tmp/second-search-title-abstract-ai-live.jsonl';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith('--')) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

if (args.has('help')) {
  console.log(`Usage:
  node skills/fifa-title-abstract-screening-review/scripts/run_second_search_ai_screening_codex.mjs --apply [options]

Options:
  --apply                     Write validated AI recommendations to Supabase.
  --provider codex-cli        Local Codex CLI only. Direct API/auto routing disabled.
  --model gpt-5.5             Model to use. Default: gpt-5.5.
  --reasoning medium          Reasoning effort. Default: medium.
  --criteria-file PATH        Compact runtime criteria markdown.
  --batch-size 150            Internal batch size, 1-250.
  --concurrency 1             Parallel Codex workers, capped at 2.
  --abstract-chars 900        Max abstract chars sent per record, 400-4000.
  --study-ids S1,S2           Restrict to assigned study IDs. Numeric values are normalized to S-prefixed IDs.
  --record-ids UUID,UUID      Restrict to specific screening_records IDs.
  --output PATH               Checkpoint JSON. Default: /tmp/second-search-title-abstract-ai-codex.json.
  --log PATH                  JSONL event log. Default: /tmp/second-search-title-abstract-ai-live.jsonl.
  --limit N                   Process only N pending records for a test run.
  --quiet                     Suppress progress lines except fatal errors.
  --force                     Re-review records even if Supabase has ai_status=completed.
  --timeout-ms 600000         Per-model-call timeout in milliseconds.
  --self-test                 Run local validation tests without calling a model or Supabase.

The runner is intentionally sequential and resumable. It may make multiple internal model calls, but it is one local workflow and does not require chat/subagent batching.`);
  process.exit(0);
}

const asBoolean = (name) => Boolean(args.get(name));
const asNumber = (name, fallback) => {
  const value = Number(args.get(name) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const parseCsv = (value) => String(value ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const parseStudyIds = (value) => parseCsv(value)
  .map((item) => (/^\d+$/.test(item) ? `S${item}` : item.toUpperCase()));

const options = {
  apply: asBoolean('apply'),
  force: asBoolean('force'),
  quiet: asBoolean('quiet'),
  selfTest: asBoolean('self-test'),
  provider: String(args.get('provider') || DEFAULT_PROVIDER),
  model: String(args.get('model') || 'gpt-5.5'),
  reasoning: String(args.get('reasoning') || 'medium'),
  criteriaFile: path.resolve(String(args.get('criteria-file') || DEFAULT_CRITERIA_FILE)),
  outputPath: path.resolve(String(args.get('output') || DEFAULT_OUTPUT)),
  logPath: path.resolve(String(args.get('log') || DEFAULT_LOG)),
  batchLabel: String(args.get('batch-label') || SEARCH_BATCH_LABEL),
  batchSize: clamp(asNumber('batch-size', 150), 1, 250),
  concurrency: clamp(Math.floor(asNumber('concurrency', 1)), 1, 2),
  abstractChars: clamp(asNumber('abstract-chars', 900), 400, 4000),
  studyIds: parseStudyIds(args.get('study-ids') || args.get('ids')),
  recordIds: parseCsv(args.get('record-ids')),
  limit: Math.max(0, asNumber('limit', 0)),
  maxRetries: clamp(asNumber('max-retries', 2), 0, 5),
  timeoutMs: clamp(asNumber('timeout-ms', 600000), 60000, 1800000),
};

const log = (message) => {
  if (!options.quiet) console.log(message);
};

const parseJson = (text) => {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(jsonrepair(fenced));
};

const missingAbstractRecommendation = (record) => ({
  recordId: record.id,
  studyId: record.assigned_study_id,
  title: record.title,
  decision: 'undecided',
  reason: 'Cannot review from title/abstract because no abstract was imported or recovered.',
  exclusionReason: null,
  sourceQuote: null,
  sourceLocation: null,
  confidence: 0.2,
  targetTag: null,
  tags: ['missing_abstract'],
  auditNotes: 'Deterministic rule: missing abstract marked undecided.',
});

const loadCriteriaText = () => readFileSync(options.criteriaFile, 'utf8');

const buildPrompt = (records, previousFailure = '') => `You are doing title/abstract screening for the FIFA GBI review. Use local Codex reasoning only. Do not use Gemini or direct API calls. Use only the supplied records.

Criteria version: ${CRITERIA_VERSION}

${loadCriteriaText()}

Return JSON only as a compact array:
[{"id":"record-id","d":"include|exclude|undecided","r":"reason_code","c":0.0,"t":["optional_tag"],"n":"short optional note","q":"exact quote for excludes","l":"Title|Abstract|Journal|Citation metadata"}]

For every exclude, q must be copied exactly from the supplied title, abstract, journal, source label, DOI, or source id. For include/undecided, omit q/l or set them null. Use tag "referee" for referee/match-official records and "systematic_review" for systematic reviews retained for reference-list checks.

${previousFailure ? `Previous output failed validation. Correct this problem: ${previousFailure}\n` : ''}
Records:
${JSON.stringify(records.map((record) => ({
  recordId: record.id,
  studyId: record.assigned_study_id,
  title: compact(record.title, 450),
  abstract: compact(record.abstract, options.abstractChars),
  journal: compact(record.journal, 160),
  year: record.year,
  doi: compact(record.doi, 160),
  sourceLabel: compact(record.source_label, 220),
  sourceRecordId: compact(record.source_record_id, 120),
})))}`;

const extractRecommendations = (parsed) => {
  if (Array.isArray(parsed?.recommendations)) return parsed.recommendations;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed)) return parsed;
  return [];
};

const validateModelOutput = (records, rawItems) => {
  return validateScreeningOutput(records, rawItems, `${options.model} ${options.reasoning}`, {
    reasonMax: 500,
    exclusionMax: 300,
    auditMax: 500,
  });
};

const runCodexCli = (prompt) => new Promise((resolve, reject) => {
  const child = spawn('codex', [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--ignore-rules',
    '-m', options.model,
    '-c', `model_reasoning_effort="${options.reasoning}"`,
    '-',
  ], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    reject(new Error(`codex exec timed out after ${options.timeoutMs}ms`));
  }, options.timeoutMs);

  child.stdout.on('data', (chunkData) => { stdout += String(chunkData); });
  child.stderr.on('data', (chunkData) => { stderr += String(chunkData); });
  child.on('error', (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (code !== 0) {
      reject(new Error(`codex exec failed with status ${code}: ${compact(stderr || stdout, 4000)}`));
      return;
    }
    const messages = [];
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
          messages.push(event.item.text);
        }
      } catch {
        // Ignore non-JSON progress lines; codex --json should not emit them, but keep parsing tolerant.
      }
    }
    const text = messages.at(-1);
    if (!text) {
      reject(new Error(`codex exec returned no agent_message. stderr=${compact(stderr, 2000)} stdout=${compact(stdout, 2000)}`));
      return;
    }
    resolve(text);
  });
  child.stdin.end(prompt);
});

const chooseProvider = () => {
  if (options.provider !== DEFAULT_PROVIDER) {
    throw new Error('Title/abstract screening uses codex-cli only; direct API, auto routing, and Gemini are disabled.');
  }
  return DEFAULT_PROVIDER;
};

const runModelBatch = async (records) => {
  let failure = '';
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      const prompt = buildPrompt(records, failure);
      const text = await runCodexCli(prompt);
      const parsed = parseJson(text);
      return validateModelOutput(records, extractRecommendations(parsed));
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      if (attempt >= options.maxRetries) throw new Error(`Batch failed after ${attempt + 1} attempt(s): ${failure}`);
    }
  }
  throw new Error('unreachable batch retry state');
};

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

const loadCheckpoint = () => {
  if (!existsSync(options.outputPath)) {
    return {
      searchBatchLabel: options.batchLabel,
      criteriaVersion: CRITERIA_VERSION,
      generatedAt: new Date().toISOString(),
      model: options.model,
      reasoning: options.reasoning,
      provider: chooseProvider(),
      recommendations: [],
    };
  }
  const payload = JSON.parse(readFileSync(options.outputPath, 'utf8'));
  payload.recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  return payload;
};

const writeCheckpoint = (payload, recommendationsById) => {
  payload.generatedAt = new Date().toISOString();
  payload.criteriaVersion = CRITERIA_VERSION;
  payload.model = options.model;
  payload.reasoning = options.reasoning;
  payload.provider = chooseProvider();
  payload.recommendations = Array.from(recommendationsById.values());
  writeFileSync(options.outputPath, `${JSON.stringify(payload, null, 2)}\n`);
};

const recommendationCounts = (items) => items.reduce((accumulator, item) => {
  accumulator[item.decision] = (accumulator[item.decision] || 0) + 1;
  if (item.targetTag === 'systematic_review') accumulator.systematic = (accumulator.systematic || 0) + 1;
  return accumulator;
}, {});

const applyRecommendation = async (supabase, item) => {
  const now = new Date().toISOString();
  const update = {
    ai_status: 'completed',
    ai_suggested_decision: item.decision === 'undecided' ? null : item.decision,
    ai_reason: item.reason,
    ai_evidence_quote: item.decision === 'exclude' ? item.sourceQuote : null,
    ai_source_location: item.decision === 'exclude' ? item.sourceLocation : null,
    ai_confidence: item.confidence,
    ai_model: `${options.model} (${options.reasoning}) via ${chooseProvider()}`,
    ai_criteria_version: CRITERIA_VERSION,
    ai_raw_response: item,
    ai_error: null,
    ai_reviewed_at: now,
    updated_at: now,
  };

  const { error } = await supabase
    .from('screening_records')
    .update(update)
    .eq('id', item.recordId)
    .eq('stage', 'title_abstract')
    .eq('metadata->>searchBatchLabel', options.batchLabel);
  if (error) throw new Error(`Failed to update ${item.studyId || item.recordId}: ${error.message}`);
  await finalizeTitleAbstractRecommendation(supabase, item.recordId, { quiet: options.quiet });
};

const applyRecommendations = async (supabase, items) => {
  if (!options.apply) return;
  for (const item of items) await applyRecommendation(supabase, item);
};

const appendJsonl = async (event) => {
  await appendFile(options.logPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
};

const fetchRecords = async (supabase) => {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('screening_records')
      .select('id, assigned_study_id, title, abstract, lead_author, journal, year, doi, source_label, source_record_id, ai_status, metadata, created_at')
      .eq('stage', 'title_abstract')
      .eq('metadata->>searchBatchLabel', options.batchLabel)
      .order('assigned_study_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (options.studyIds.length > 0) query = query.in('assigned_study_id', options.studyIds);
    if (options.recordIds.length > 0) query = query.in('id', options.recordIds);
    if (!options.force) query = query.or('ai_status.is.null,ai_status.neq.completed');

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch records: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    if (options.limit && rows.length >= options.limit) break;
  }
  return options.limit ? rows.slice(0, options.limit) : rows;
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const runSelfTest = () => {
  const record = {
    id: 'r1',
    assigned_study_id: 'S1',
    title: 'Systematic review of hamstring injuries in soccer players',
    abstract: 'This systematic review evaluates hamstring injuries in soccer players.',
    journal: 'Journal',
    doi: '10.1/example',
    source_label: 'source',
    source_record_id: 'abc',
  };
  const include = validateModelOutput([record], [{
    recordId: 'r1',
    decision: 'include',
    reason: 'Relevant soccer injury systematic review.',
    exclusionReason: null,
    sourceQuote: null,
    sourceLocation: null,
    confidence: 0.8,
    targetTag: null,
    tags: [],
  }]);
  if (include[0].targetTag !== 'systematic_review') throw new Error('self-test failed: systematic tag not enforced');
  const exclude = validateModelOutput([record], [{
    recordId: 'r1',
    decision: 'exclude',
    reason: 'Narrative review.',
    exclusionReason: 'Narrative review.',
    sourceQuote: 'Systematic review of hamstring injuries in soccer players',
    sourceLocation: 'Title',
    confidence: 0.7,
    targetTag: null,
    tags: [],
  }]);
  if (exclude[0].decision !== 'exclude') throw new Error('self-test failed: valid exclude rejected');
  const repaired = validateModelOutput([record], [{
    recordId: 'r1',
    decision: 'exclude',
    reason: 'Bad quote.',
    exclusionReason: 'Bad quote.',
    sourceQuote: 'not in the record',
    sourceLocation: 'Abstract',
    confidence: 0.7,
    targetTag: null,
    tags: [],
  }]);
  if (repaired[0].sourceQuote !== record.title || repaired[0].sourceLocation !== 'Title') {
    throw new Error('self-test failed: invalid quote was not repaired to title');
  }
  const parsed = parseJson('```json\n{"recommendations":[]}\n```');
  if (!Array.isArray(parsed.recommendations)) throw new Error('self-test failed: fenced JSON parsing');

  const metacarpalTreatmentRecord = {
    id: 'r2',
    assigned_study_id: 'S4075',
    title: 'Early return to play after minimally invasive treatment of metacarpal fractures in elite football players.',
    abstract: 'The study focused on return to play and complication rates. A total of 27 elite professional football athletes with metacarpal fractures were treated using closed reduction and crossed retrograde K-wire fixation. Clinical and functional outcomes were assessed using range of motion, grip strength, Visual Analog Scale for pain, DASH scores, time to return to training and competition, and radiographic healing.',
    journal: 'Journal',
    doi: '10.1/example',
    source_label: 'source',
    source_record_id: 'def',
  };
  const metacarpalTreatment = preTriageRecord(metacarpalTreatmentRecord, 'self-test');
  if (metacarpalTreatment?.decision !== 'exclude') {
    throw new Error(`self-test failed: already-injured treatment/RTP cohort should exclude, got ${metacarpalTreatment?.decision ?? 'null'}`);
  }

  const injuryHistoryRecord = {
    id: 'r3',
    assigned_study_id: 'S4720',
    title: 'Association Between Injury History and Navicular Drop in Male Youth Soccer Players.',
    abstract: 'This is a cross-sectional study. The study included 63 male youth soccer players. Participants self-reported their injury history. Binary logistic regression used injury history as the dependent variable and navicular drop as the independent variable.',
    journal: 'Journal',
    doi: '10.1/example',
    source_label: 'source',
    source_record_id: 'ghi',
  };
  const injuryHistory = preTriageRecord(injuryHistoryRecord, 'self-test');
  if (injuryHistory?.decision !== 'exclude') {
    throw new Error(`self-test failed: cross-sectional retrospective injury-history association should exclude, got ${injuryHistory?.decision ?? 'null'}`);
  }

  const downstreamConsequenceRecord = {
    id: 'r4',
    assigned_study_id: 'S1858',
    title: 'Unique Pattern of White Matter Hyperintensities in Middle Age and Older Adults with History of Repetitive Head Impact Exposure',
    abstract: 'Repetitive head impacts from contact sports can lead to long-term white matter injury visualized on FLAIR scans as white matter hyperintensities. Sources of RHI were American football, hockey, soccer, wrestling, field hockey, lacrosse, mixed martial arts, and rugby. Regression models examined years of American football play, controlling for age and vascular risk factors.',
    journal: 'Journal',
    doi: '10.1/example',
    source_label: 'source',
    source_record_id: 'jkl',
  };
  const downstreamConsequence = preTriageRecord(downstreamConsequenceRecord, 'self-test');
  if (downstreamConsequence?.decision !== 'exclude') {
    throw new Error(`self-test failed: downstream RHI imaging consequence should exclude, got ${downstreamConsequence?.decision ?? 'null'}`);
  }

  console.log('self-test passed');
};

if (options.selfTest) {
  runSelfTest();
  process.exit(0);
}

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const provider = chooseProvider();
if (!existsSync(options.criteriaFile)) throw new Error(`Criteria file not found: ${options.criteriaFile}`);

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const checkpoint = loadCheckpoint();
const recommendationsById = new Map(checkpoint.recommendations.map((item) => [item.recordId, item]));
const pending = await fetchRecords(supabase);
const toProcess = [];
const checkpointReady = [];
const runStartedAt = Date.now();
const runStats = {
  deterministicDecisions: 0,
  modelReviewedRecords: 0,
  modelCalls: 0,
  retryCount: 0,
  concurrency: options.concurrency,
  batchSize: options.batchSize,
};

for (const record of pending) {
  const existing = !options.force ? recommendationsById.get(record.id) : null;
  if (existing) {
    checkpointReady.push(existing);
  } else {
    const deterministic = preTriageRecord(record, `${options.model} (${options.reasoning}) via ${chooseProvider()}`);
    if (deterministic) {
      toProcess.push({ type: 'deterministic', record, deterministic });
    } else if (!record.abstract?.trim()) {
      toProcess.push({ type: 'deterministic', record, deterministic: missingAbstractRecommendation(record) });
    } else {
      toProcess.push({ type: 'model', record });
    }
  }
}

log(`provider=${provider} model=${options.model} reasoning=${options.reasoning} apply=${options.apply}`);
log(`pending=${pending.length} checkpointReady=${checkpointReady.length} new=${toProcess.length} batchSize=${options.batchSize} concurrency=${options.concurrency}`);

if (checkpointReady.length > 0) {
  await applyRecommendations(supabase, checkpointReady);
  await appendJsonl({ type: 'checkpoint-ready', count: checkpointReady.length });
  log(`applied checkpoint-ready=${options.apply ? checkpointReady.length : 0}`);
}

let processed = 0;
const deterministic = toProcess.filter((item) => item.type === 'deterministic').map((item) => item.deterministic);
if (deterministic.length > 0) {
  for (const item of deterministic) recommendationsById.set(item.recordId, item);
  writeCheckpoint(checkpoint, recommendationsById);
  await applyRecommendations(supabase, deterministic);
  runStats.deterministicDecisions += deterministic.length;
  await appendJsonl({ type: 'deterministic-pre-triage', count: deterministic.length });
  processed += deterministic.length;
  log(`deterministic=${deterministic.length}`);
}

const modelRecords = toProcess.filter((item) => item.type === 'model').map((item) => item.record);
const batches = chunk(modelRecords, options.batchSize);
let nextBatchIndex = 0;
const runWorker = async () => {
  while (nextBatchIndex < batches.length) {
    const index = nextBatchIndex;
    nextBatchIndex += 1;
    const batch = batches[index];
    const startedAt = Date.now();
    const recommendations = await runModelBatch(batch);
    const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    for (const item of recommendations) recommendationsById.set(item.recordId, item);
    writeCheckpoint(checkpoint, recommendationsById);
    await applyRecommendations(supabase, recommendations);
    processed += recommendations.length;
    runStats.modelCalls += 1;
    runStats.modelReviewedRecords += batch.length;
    const counts = recommendationCounts(Array.from(recommendationsById.values()));
    await appendJsonl({
      type: 'model-batch',
      batch: index + 1,
      batches: batches.length,
      count: recommendations.length,
      elapsedSeconds,
      applied: options.apply,
      counts,
    });
    log(`batch=${index + 1}/${batches.length} records=${recommendations.length} seconds=${elapsedSeconds} processed=${processed}/${toProcess.length} counts=${JSON.stringify(counts)}`);
  }
};

await Promise.all(Array.from({ length: Math.min(options.concurrency, batches.length) }, () => runWorker()));

const finalCounts = recommendationCounts(Array.from(recommendationsById.values()));
const elapsedSeconds = Number(((Date.now() - runStartedAt) / 1000).toFixed(2));
checkpoint.runStats = {
  ...runStats,
  elapsedSeconds,
  recordsPerMinute: elapsedSeconds ? Number(((pending.length / elapsedSeconds) * 60).toFixed(2)) : null,
  decisionCounts: finalCounts,
};
writeCheckpoint(checkpoint, recommendationsById);
await appendJsonl({ type: 'done', runStats: checkpoint.runStats, counts: finalCounts });
log(`done recommendations=${recommendationsById.size} counts=${JSON.stringify(finalCounts)} runStats=${JSON.stringify(checkpoint.runStats)} output=${options.outputPath}`);
if (!options.apply) log('dry-run only; rerun with --apply to write to Supabase.');
