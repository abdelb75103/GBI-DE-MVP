#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/package.json'));
const { createClient } = require('@supabase/supabase-js');
const { jsonrepair } = require('jsonrepair');

const SEARCH_BATCH_LABEL = 'Second search - Ishanka - 2026-05-26';
const CRITERIA_VERSION = 'fifa-gbi-title-abstract-v1-2026-05-27';
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
  --provider auto             auto | openai-responses | codex-cli. Default: auto.
  --model gpt-5.4             Model to use. Default: gpt-5.4.
  --reasoning medium          Reasoning effort. Default: medium.
  --batch-size 80             Sequential internal batch size, 1-150.
  --abstract-chars 900        Max abstract chars sent per record, 400-4000.
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

const options = {
  apply: asBoolean('apply'),
  force: asBoolean('force'),
  quiet: asBoolean('quiet'),
  selfTest: asBoolean('self-test'),
  provider: String(args.get('provider') || 'auto'),
  model: String(args.get('model') || 'gpt-5.4'),
  reasoning: String(args.get('reasoning') || 'medium'),
  outputPath: path.resolve(String(args.get('output') || DEFAULT_OUTPUT)),
  logPath: path.resolve(String(args.get('log') || DEFAULT_LOG)),
  batchLabel: String(args.get('batch-label') || SEARCH_BATCH_LABEL),
  batchSize: clamp(asNumber('batch-size', 80), 1, 150),
  abstractChars: clamp(asNumber('abstract-chars', 900), 400, 4000),
  limit: Math.max(0, asNumber('limit', 0)),
  maxRetries: clamp(asNumber('max-retries', 2), 0, 5),
  timeoutMs: clamp(asNumber('timeout-ms', 600000), 60000, 1800000),
};

const log = (message) => {
  if (!options.quiet) console.log(message);
};

const compact = (value, max) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const parseJson = (text) => {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(jsonrepair(fenced));
};

const sourceText = (record) => [
  record.title,
  record.abstract,
  record.journal,
  record.source_label,
  record.doi,
  record.source_record_id,
].filter(Boolean).join('\n');

const quoteAppearsInRecord = (record, quote) => {
  const normalizedQuote = normalizeText(quote);
  return Boolean(normalizedQuote) && normalizeText(sourceText(record)).includes(normalizedQuote);
};

const looksLikeSystematicReview = (record) => {
  const text = `${record.title ?? ''} ${record.abstract ?? ''}`;
  return /(systematic|scoping|umbrella|meta[- ]?analysis|evidence synthesis)/i.test(text)
    && /(soccer|football|futbol|fútbol|futsal|beach soccer|para football|blind football)/i.test(text)
    && /(injur|illness|concussion|hamstring|acl|return[- ]?to[- ]?(play|sport|competition)|epidemiolog|surveillance|health|pain)/i.test(text);
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

const buildPrompt = (records, previousFailure = '') => `You are doing title/abstract screening for the FIFA GBI review. Do not use Gemini. Use only the supplied records.

Task: classify each record as include, exclude, or undecided against the criteria below.

Include when the title/abstract/citation plausibly indicates football/soccer/futsal/beach/para football players with injury, illness, concussion, epidemiology, incidence, prevalence, burden, surveillance, observed injury risk factors, or return-to-play/return-to-competition health outcomes.

Include with targetTag "systematic_review" when a systematic review, scoping review, umbrella review, evidence synthesis, or meta-analysis is relevant to football/soccer injury or illness.

Exclude when clearly ineligible: wrong football code (NFL/American, Gaelic, Australian rules, rugby), no concrete football/soccer/futsal signal, protocol, case report, editorial/commentary, narrative review, conference abstract/poster, performance-only, physiology-only, biomechanics-only, measurement-only, intervention-only without eligible injury/illness epidemiology, public-media-only dataset without a player-level denominator, non-human, or unrelated.

Undecided only when the abstract/citation is too incomplete to review.

For every exclude, sourceQuote must be copied exactly from the supplied title, abstract, journal, source label, DOI, or source id. For include/undecided, exclusionReason/sourceQuote/sourceLocation must be null.

Return JSON only:
{"recommendations":[{"recordId":"uuid","decision":"include|exclude|undecided","reason":"short rationale","exclusionReason":null,"sourceQuote":null,"sourceLocation":null,"confidence":0.0,"targetTag":null,"tags":[]}]}

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

const normalizeRecommendation = (record, item) => {
  const decision = String(item.decision || '').toLowerCase();
  if (!['include', 'exclude', 'undecided'].includes(decision)) {
    throw new Error(`${record.assigned_study_id}: invalid decision ${item.decision}`);
  }

  let confidence = Number(item.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.65;
  confidence = clamp(confidence, 0, 1);

  let targetTag = item.targetTag === 'systematic_review' ? 'systematic_review' : null;
  const tags = Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean).slice(0, 8) : [];
  if (decision === 'include' && looksLikeSystematicReview(record)) {
    targetTag = 'systematic_review';
    if (!tags.includes('systematic_review')) tags.push('systematic_review');
  }

  const reason = compact(item.reason, 500);
  if (!reason) throw new Error(`${record.assigned_study_id}: missing reason`);

  if (decision === 'exclude') {
    const exclusionReason = compact(item.exclusionReason, 300);
    let sourceQuote = String(item.sourceQuote ?? '').trim();
    let sourceLocation = compact(item.sourceLocation, 80);
    let auditNote = compact(item.auditNotes, 300) || `${options.model} ${options.reasoning} title/abstract screening.`;
    if (!exclusionReason || !sourceQuote || !sourceLocation) {
      throw new Error(`${record.assigned_study_id}: exclude missing reason, quote, or location`);
    }
    if (!quoteAppearsInRecord(record, sourceQuote)) {
      sourceQuote = String(record.title ?? '').trim();
      sourceLocation = 'Title';
      auditNote = `${auditNote} Exact quote repaired to title after model returned a non-matching quote.`;
    }
    if (!sourceQuote || !quoteAppearsInRecord(record, sourceQuote)) {
      throw new Error(`${record.assigned_study_id}: exclusion quote is not present in supplied record`);
    }
    return {
      recordId: record.id,
      studyId: record.assigned_study_id,
      title: record.title,
      decision,
      reason,
      exclusionReason,
      sourceQuote,
      sourceLocation,
      confidence,
      targetTag: null,
      tags,
      auditNotes: compact(auditNote, 500),
    };
  }

  return {
    recordId: record.id,
    studyId: record.assigned_study_id,
    title: record.title,
    decision,
    reason,
    exclusionReason: null,
    sourceQuote: null,
    sourceLocation: null,
    confidence,
    targetTag,
    tags,
    auditNotes: compact(item.auditNotes, 300) || `${options.model} ${options.reasoning} title/abstract screening.`,
  };
};

const validateModelOutput = (records, rawItems) => {
  const byId = new Map(records.map((record) => [record.id, record]));
  const seen = new Set();
  const normalized = [];

  for (const item of rawItems) {
    const recordId = item?.recordId;
    const record = byId.get(recordId);
    if (!record) throw new Error(`unexpected recordId ${recordId || '(missing)'}`);
    if (seen.has(recordId)) throw new Error(`${record.assigned_study_id}: duplicate recommendation`);
    seen.add(recordId);
    normalized.push(normalizeRecommendation(record, item));
  }

  const missing = records.filter((record) => !seen.has(record.id)).map((record) => record.assigned_study_id);
  if (missing.length > 0) {
    throw new Error(`missing recommendations: ${missing.slice(0, 10).join(', ')}`);
  }

  return normalized.sort((a, b) => {
    const left = records.findIndex((record) => record.id === a.recordId);
    const right = records.findIndex((record) => record.id === b.recordId);
    return left - right;
  });
};

const runCodexCli = (prompt) => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'gbi-ta-codex-'));
  const out = path.join(tmp, 'last-message.txt');
  const result = spawnSync('codex', [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--ignore-rules',
    '-m', options.model,
    '-c', `model_reasoning_effort="${options.reasoning}"`,
    '--output-last-message', out,
    '-',
  ], {
    cwd: process.cwd(),
    input: prompt,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 1024 * 1024 * 80,
  });

  if (result.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    if (result.error?.code === 'ETIMEDOUT') {
      throw new Error(`codex exec timed out after ${options.timeoutMs}ms`);
    }
    throw new Error(`codex exec failed with status ${result.status}: ${compact(result.stderr || result.stdout, 4000)}`);
  }

  const text = readFileSync(out, 'utf8');
  rmSync(tmp, { recursive: true, force: true });
  return text;
};

const responseText = (data) => {
  if (typeof data.output_text === 'string') return data.output_text;
  const parts = [];
  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  if (parts.length > 0) return parts.join('\n');
  if (typeof data.choices?.[0]?.message?.content === 'string') return data.choices[0].message.content;
  return '';
};

const runOpenAIResponses = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for --provider openai-responses');
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      input: prompt,
      reasoning: { effort: options.reasoning },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI Responses API failed ${response.status}: ${JSON.stringify(data).slice(0, 2000)}`);
  }
  return responseText(data);
};

const chooseProvider = () => {
  if (options.provider !== 'auto') return options.provider;
  return process.env.OPENAI_API_KEY ? 'openai-responses' : 'codex-cli';
};

const runModelBatch = async (records) => {
  let failure = '';
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      const prompt = buildPrompt(records, failure);
      const text = chooseProvider() === 'openai-responses'
        ? await runOpenAIResponses(prompt)
        : runCodexCli(prompt);
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
if (!['openai-responses', 'codex-cli'].includes(provider)) {
  throw new Error('--provider must be auto, openai-responses, or codex-cli');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const checkpoint = loadCheckpoint();
const recommendationsById = new Map(checkpoint.recommendations.map((item) => [item.recordId, item]));
const pending = await fetchRecords(supabase);
const toProcess = [];
const checkpointReady = [];

for (const record of pending) {
  const existing = !options.force ? recommendationsById.get(record.id) : null;
  if (existing) {
    checkpointReady.push(existing);
  } else if (!record.abstract?.trim()) {
    toProcess.push({ type: 'deterministic', record });
  } else {
    toProcess.push({ type: 'model', record });
  }
}

log(`provider=${provider} model=${options.model} reasoning=${options.reasoning} apply=${options.apply}`);
log(`pending=${pending.length} checkpointReady=${checkpointReady.length} new=${toProcess.length} batchSize=${options.batchSize}`);

if (checkpointReady.length > 0) {
  await applyRecommendations(supabase, checkpointReady);
  await appendJsonl({ type: 'checkpoint-ready', count: checkpointReady.length });
  log(`applied checkpoint-ready=${options.apply ? checkpointReady.length : 0}`);
}

let processed = 0;
const deterministic = toProcess.filter((item) => item.type === 'deterministic').map((item) => missingAbstractRecommendation(item.record));
if (deterministic.length > 0) {
  for (const item of deterministic) recommendationsById.set(item.recordId, item);
  writeCheckpoint(checkpoint, recommendationsById);
  await applyRecommendations(supabase, deterministic);
  await appendJsonl({ type: 'deterministic-missing-abstract', count: deterministic.length });
  processed += deterministic.length;
  log(`missingAbstract=${deterministic.length}`);
}

const modelRecords = toProcess.filter((item) => item.type === 'model').map((item) => item.record);
const batches = chunk(modelRecords, options.batchSize);
for (let index = 0; index < batches.length; index += 1) {
  const batch = batches[index];
  const recommendations = await runModelBatch(batch);
  for (const item of recommendations) recommendationsById.set(item.recordId, item);
  writeCheckpoint(checkpoint, recommendationsById);
  await applyRecommendations(supabase, recommendations);
  processed += recommendations.length;
  const counts = recommendationCounts(Array.from(recommendationsById.values()));
  await appendJsonl({
    type: 'model-batch',
    batch: index + 1,
    batches: batches.length,
    count: recommendations.length,
    applied: options.apply,
    counts,
  });
  log(`batch=${index + 1}/${batches.length} records=${recommendations.length} processed=${processed}/${toProcess.length} counts=${JSON.stringify(counts)}`);
}

const finalCounts = recommendationCounts(Array.from(recommendationsById.values()));
log(`done recommendations=${recommendationsById.size} counts=${JSON.stringify(finalCounts)} output=${options.outputPath}`);
if (!options.apply) log('dry-run only; rerun with --apply to write to Supabase.');
