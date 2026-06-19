#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  compact,
  expandCompactRecommendation,
  preTriageRecord,
  validateScreeningOutput,
} from './title_abstract_screening_rules.mjs';

const require = createRequire(import.meta.url);
const { jsonrepair } = require('../../../fifa-gbi-data-extraction/node_modules/jsonrepair');

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(SKILL_DIR, '../..');

export { expandCompactRecommendation, preTriageRecord };

const DEFAULT_SOURCE_CSV = '/Users/abdelbabiker/Desktop/FIFA/ENTitle and Abstract Screening Results .csv';
const DEFAULT_OUTPUT_ROOT = path.resolve(REPO_ROOT, 'outputs/title-abstract-validation/first-batch-rayyan-2026-06-02');
const DEFAULT_CRITERIA_FILE = path.resolve(SKILL_DIR, 'references/runtime-criteria.md');
const DEFAULT_CRITERIA_VERSION = 'fifa-gbi-title-abstract-v1.5-2026-06-08';
export const DEFAULT_PROVIDER = 'codex-cli';

export const resolveProvider = (value = DEFAULT_PROVIDER) => {
  const provider = String(value || DEFAULT_PROVIDER);
  if (provider !== DEFAULT_PROVIDER) {
    throw new Error('Title/abstract screening uses codex-cli only; direct API, auto routing, and Gemini are disabled.');
  }
  return DEFAULT_PROVIDER;
};

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase();

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => String(cell ?? '').trim()));
};

const getColumn = (row, headerMap, names) => {
  for (const name of names) {
    const index = headerMap.get(normalizeHeader(name));
    if (index !== undefined) return row[index] ?? '';
  }
  return '';
};

export const parseRayyanCsv = (text) => {
  const parsed = parseCsvRows(String(text ?? '').replace(/^\uFEFF/, ''));
  if (parsed.length === 0) return [];
  const headers = parsed[0];
  const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const decisionIndex = headers.findIndex((header) => normalizeHeader(header) === 'screening decision');
  if (decisionIndex === -1) {
    throw new Error('Source CSV must contain a Screening Decision column.');
  }

  return parsed.slice(1).map((row, index) => {
    const key = getColumn(row, headerMap, ['key']) || `row-${index + 1}`;
    return {
      rowNumber: index + 2,
      key,
      title: getColumn(row, headerMap, ['title']),
      year: getColumn(row, headerMap, ['year']),
      month: getColumn(row, headerMap, ['month']),
      day: getColumn(row, headerMap, ['day']),
      journal: getColumn(row, headerMap, ['journal']),
      issn: getColumn(row, headerMap, ['issn']),
      volume: getColumn(row, headerMap, ['volume']),
      issue: getColumn(row, headerMap, ['issue']),
      pages: getColumn(row, headerMap, ['pages']),
      authors: getColumn(row, headerMap, ['authors']),
      url: getColumn(row, headerMap, ['url']),
      language: getColumn(row, headerMap, ['language']),
      publisher: getColumn(row, headerMap, ['publisher']),
      location: getColumn(row, headerMap, ['location']),
      abstract: getColumn(row, headerMap, ['abstract']),
      notes: getColumn(row, headerMap, ['notes']),
      doi: getColumn(row, headerMap, ['doi']),
      keywords: getColumn(row, headerMap, ['keywords']),
      pubmedId: getColumn(row, headerMap, ['pubmed_id', 'pubmed id']),
      pmcId: getColumn(row, headerMap, ['pmc_id', 'pmc id']),
      humanDecision: row[decisionIndex] ?? '',
      split: assignSplit(key),
    };
  });
};

export const assignSplit = (key, calibrationRatio = 0.8) => {
  const numericSuffix = String(key ?? '').match(/(\d+)$/);
  if (numericSuffix) {
    const bucket = (Number(numericSuffix[1]) - 1) % 10;
    return bucket < Math.round(calibrationRatio * 10) ? 'calibration' : 'holdout';
  }
  const digest = createHash('sha256').update(String(key ?? '')).digest();
  const bucket = digest.readUInt32BE(0) % 100;
  return bucket < Math.round(calibrationRatio * 100) ? 'calibration' : 'holdout';
};

const stableSampleScore = (key) => createHash('sha256').update(`sample:${String(key ?? '')}`).digest('hex');

export const selectDeterministicSample = (rows, sampleRate = 1, sampleIndex = 0) => {
  const rate = Math.max(0, Math.min(1, Number(sampleRate)));
  if (rate >= 1) return [...rows];
  if (rate <= 0 || rows.length === 0) return [];
  const sampleSize = Math.max(1, Math.round(rows.length * rate));
  const sortedRows = [...rows]
    .sort((left, right) => {
      const scoreComparison = stableSampleScore(left.key).localeCompare(stableSampleScore(right.key));
      return scoreComparison || Number(left.rowNumber ?? 0) - Number(right.rowNumber ?? 0);
    });
  const start = Math.max(0, Math.floor(Number(sampleIndex) || 0)) * sampleSize;
  return sortedRows
    .slice(start, start + sampleSize)
    .sort((left, right) => Number(left.rowNumber ?? 0) - Number(right.rowNumber ?? 0));
};

export const createBlindRecord = (row, abstractChars = 1800) => ({
  recordId: row.key,
  title: compact(row.title, 500),
  abstract: compact(row.abstract, abstractChars),
  journal: compact(row.journal, 180),
  year: row.year,
  doi: compact(row.doi, 180),
  authors: compact(row.authors, 400),
  language: compact(row.language, 80),
  keywords: compact(row.keywords, 300),
  sourceMetadata: compact([
    row.publisher && `Publisher: ${row.publisher}`,
    row.location && `Location: ${row.location}`,
    row.notes && `Notes: ${row.notes}`,
    row.url && `URL: ${row.url}`,
    row.pubmedId && `PMID: ${row.pubmedId}`,
    row.pmcId && `PMCID: ${row.pmcId}`,
  ].filter(Boolean).join(' | '), 500),
});

const parseJson = (text) => {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(jsonrepair(fenced));
};

const extractRecommendations = (parsed) => {
  if (Array.isArray(parsed?.recommendations)) return parsed.recommendations;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed)) return parsed;
  return [];
};

export const validateModelOutput = (rows, rawItems, modelLabel) => {
  return validateScreeningOutput(rows, rawItems, `${modelLabel} first-batch blinded validation`, {
    includeStudyId: false,
  });
};

export const buildMetrics = (rows, predictionsById) => {
  const modelDecisionCounts = { include: 0, exclude: 0, undecided: 0, missing: 0 };
  const byHumanDecision = {};
  let matches = 0;
  let falseExcludes = 0;

  for (const row of rows) {
    const prediction = predictionsById.get(row.key);
    const decision = prediction?.decision ?? 'missing';
    modelDecisionCounts[decision] = (modelDecisionCounts[decision] ?? 0) + 1;
    byHumanDecision[row.humanDecision] ||= { total: 0, include: 0, exclude: 0, undecided: 0, missing: 0, matches: 0, falseExcludes: 0 };
    byHumanDecision[row.humanDecision].total += 1;
    byHumanDecision[row.humanDecision][decision] = (byHumanDecision[row.humanDecision][decision] ?? 0) + 1;
    if (decision === 'exclude' || decision === 'missing') {
      falseExcludes += 1;
      byHumanDecision[row.humanDecision].falseExcludes += 1;
    } else {
      matches += 1;
      byHumanDecision[row.humanDecision].matches += 1;
    }
  }

  return {
    total: rows.length,
    matches,
    falseExcludes,
    knownPositiveSafety: rows.length ? matches / rows.length : 0,
    falseExclusionRate: rows.length ? falseExcludes / rows.length : 0,
    modelDecisionCounts,
    byHumanDecision,
  };
};

const pct = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const metricTable = (metrics) => [
  '| Set | Records | Known-positive safety | False excludes | Include | Undecided | Exclude | Missing |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(metrics).map(([name, item]) => `| ${name} | ${item.total} | ${pct(item.knownPositiveSafety)} | ${item.falseExcludes} (${pct(item.falseExclusionRate)}) | ${item.modelDecisionCounts.include ?? 0} | ${item.modelDecisionCounts.undecided ?? 0} | ${item.modelDecisionCounts.exclude ?? 0} | ${item.modelDecisionCounts.missing ?? 0} |`),
].join('\n');

const humanDecisionTable = (byHumanDecision) => [
  '| Human decision label | Records | Model include | Model undecided | Model exclude | Missing | Safety |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(byHumanDecision).sort(([left], [right]) => left.localeCompare(right)).map(([label, item]) => `| ${label || '(blank)'} | ${item.total} | ${item.include ?? 0} | ${item.undecided ?? 0} | ${item.exclude ?? 0} | ${item.missing ?? 0} | ${pct(item.total ? item.matches / item.total : 0)} |`),
].join('\n');

export const buildReportMarkdown = ({
  phase,
  model,
  reasoning,
  provider,
  criteriaVersion,
  sourceCsv,
  generatedAt,
  metrics,
  auditFiles,
  sourceRows,
  sampledRows,
  sampleRate,
  sampleIndex,
  runStats,
}) => `# First-Batch Rayyan Title/Abstract AI Validation

Generated: ${generatedAt}

## Summary

- Phase: ${phase}
- Source CSV: \`${sourceCsv}\`
- Model: \`${model}\`
- Reasoning: \`${reasoning}\`
- Provider: \`${provider}\`
- Criteria version: \`${criteriaVersion}\`
- Source rows: ${sourceRows ?? metrics.all.total}
- Sampled rows: ${sampledRows ?? metrics.all.total}
- Sample rate: ${sampleRate ?? 'all'}
- Sample index: ${sampleIndex ?? 0}
- Validation set: known-positive Rayyan pass-through records only. Human labels all represent records that reached full-text consideration, so the primary metric is false-exclusion safety, not full include/exclude accuracy.

## Runtime Stats

- Deterministic decisions: ${runStats?.deterministicDecisions ?? 0}
- Model-reviewed records: ${runStats?.modelReviewedRecords ?? metrics.all.total}
- Model calls: ${runStats?.modelCalls ?? 'n/a'}
- Retry count: ${runStats?.retryCount ?? 0}
- Elapsed seconds: ${runStats?.elapsedSeconds ?? 'n/a'}
- Records/minute: ${runStats?.recordsPerMinute ?? 'n/a'}
- Seconds/model call: ${runStats?.secondsPerModelCall ?? 'n/a'}

## Metrics

${metricTable(metrics)}

## Human Label Breakdown

${humanDecisionTable(metrics.all.byHumanDecision)}

## Audit Files

- Blind model predictions: \`${auditFiles.predictions}\`
- Revealed comparison CSV: \`${auditFiles.comparison}\`
- False-exclude review CSV: \`${auditFiles.errors}\`

## Interpretation Rule

Known-positive safety counts model \`include\` and \`undecided\` as aligned with the human pass-through set. Model \`exclude\` or missing prediction is counted as a false exclusion for this validation.
`;

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const writeCsv = (filePath, rows, headers) => {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];
  writeFileSync(filePath, `${lines.join('\n')}\n`);
};

const sha256File = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

export const buildPrompt = ({ rows, criteriaText, criteriaVersion, abstractChars, previousFailure = '' }) => `You are doing blinded title/abstract screening validation for the FIFA GBI review. Use local Codex reasoning only. Do not use Gemini or direct API calls. Use only the supplied records.

Task: classify each record as include, exclude, or undecided. The human decisions are deliberately hidden.

Criteria version: ${criteriaVersion}

${criteriaText}

Return JSON only:
[{"id":"record-id","d":"include|exclude|undecided","r":"reason_code","c":0.0,"t":["optional_tag"],"n":"short optional note"}]

For every exclude, the reason code and note must directly explain the eligibility rule that makes the supplied record ineligible. Do not return quote or source-location fields. Use tag "referee" for referee/match-official records and "systematic_review" for systematic reviews retained for reference-list checks.

${previousFailure ? `Previous output failed validation. Correct this problem: ${previousFailure}\n` : ''}

Records:
${JSON.stringify(rows.map((row) => createBlindRecord(row, abstractChars)))}`;

const runCodexCli = ({ prompt, model, reasoning, timeoutMs }) => new Promise((resolve, reject) => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'gbi-first-batch-validation-'));
  const out = path.join(tmp, 'last-message.txt');
  const child = spawn('codex', [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--ignore-rules',
    '-m', model,
    '-c', `model_reasoning_effort="${reasoning}"`,
    '--output-last-message', out,
    '-',
  ], {
    cwd: REPO_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    rmSync(tmp, { recursive: true, force: true });
    reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  child.stdout.on('data', (chunkData) => { stdout += String(chunkData); });
  child.stderr.on('data', (chunkData) => { stderr += String(chunkData); });
  child.on('error', (error) => {
    clearTimeout(timer);
    rmSync(tmp, { recursive: true, force: true });
    reject(error);
  });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (code !== 0) {
      rmSync(tmp, { recursive: true, force: true });
      reject(new Error(`codex exec failed with status ${code}: ${compact(stderr || stdout, 4000)}`));
      return;
    }
    const text = readFileSync(out, 'utf8');
    rmSync(tmp, { recursive: true, force: true });
    resolve(text);
  });
  child.stdin.end(prompt);
});

const runModelBatch = async ({ rows, criteriaText, criteriaVersion, abstractChars, provider, model, reasoning, timeoutMs, maxRetries }) => {
  resolveProvider(provider);
  let failure = '';
  const startedAt = Date.now();
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const prompt = buildPrompt({ rows, criteriaText, criteriaVersion, abstractChars, previousFailure: failure });
    try {
      const text = await runCodexCli({ prompt, model, reasoning, timeoutMs });
      return {
        recommendations: validateModelOutput(rows, extractRecommendations(parseJson(text)), `${model} (${reasoning}) via ${provider}`),
        attempts: attempt + 1,
        retryCount: attempt,
        elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      };
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      if (attempt >= maxRetries) throw new Error(`Batch failed after ${attempt + 1} attempt(s): ${failure}`);
    }
  }
  throw new Error('unreachable batch retry state');
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const recommendationCounts = (items) => items.reduce((accumulator, item) => {
  accumulator[item.decision] = (accumulator[item.decision] || 0) + 1;
  return accumulator;
}, {});

const buildComparisonRows = (rows, predictionsById) => rows.map((row) => {
  const prediction = predictionsById.get(row.key);
  const modelDecision = prediction?.decision ?? 'missing';
  const aligned = modelDecision === 'include' || modelDecision === 'undecided';
  return {
    split: row.split,
    rowNumber: row.rowNumber,
    key: row.key,
    title: row.title,
    year: row.year,
    journal: row.journal,
    humanDecision: row.humanDecision,
    modelDecision,
    alignedKnownPositive: aligned ? 'yes' : 'no',
    confidence: prediction?.confidence ?? '',
    targetTag: prediction?.targetTag ?? '',
    reason: prediction?.reason ?? '',
    exclusionReason: prediction?.exclusionReason ?? '',
    sourceQuote: prediction?.sourceQuote ?? '',
    sourceLocation: prediction?.sourceLocation ?? '',
  };
});

const buildManifest = ({ rows, sourceRows, sampleRate, sampleIndex, sourceCsv, outputDir, phase, model, reasoning, provider, criteriaVersion, criteriaFile, generatedAt, runStats }) => ({
  generatedAt,
  phase,
  sourceCsv,
  sourceSha256: sha256File(sourceCsv),
  sourceRows,
  sampledRows: rows.length,
  sampleRate,
  sampleIndex,
  sampleMethod: sampleRate < 1 ? 'deterministic_sha256_key_sample' : 'all_rows',
  calibrationRows: rows.filter((row) => row.split === 'calibration').length,
  holdoutRows: rows.filter((row) => row.split === 'holdout').length,
  humanDecisionCounts: rows.reduce((accumulator, row) => {
    accumulator[row.humanDecision] = (accumulator[row.humanDecision] || 0) + 1;
    return accumulator;
  }, {}),
  outputDir,
  model,
  reasoning,
  provider,
  criteriaVersion,
  criteriaFile,
  runStats,
  databaseWrites: false,
});

const parseArgs = () => {
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
  return args;
};

const asNumber = (args, key, fallback) => {
  const value = Number(args.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
};

const main = async () => {
  const args = parseArgs();
  if (args.has('help')) {
    console.log(`Usage:
  node skills/fifa-title-abstract-screening-review/scripts/validate_first_batch_rayyan_ai.mjs [options]

Options:
  --source PATH             Rayyan CSV with Screening Decision column.
  --output-dir PATH         Local audit output directory.
  --phase baseline          baseline | tuned | smoke.
  --provider codex-cli      Local Codex CLI only. Direct API/auto routing disabled.
  --model gpt-5.5           Model for blinded screening.
  --reasoning medium        Reasoning effort.
  --criteria-file PATH      Compact runtime criteria markdown.
  --criteria-version VALUE  Criteria version recorded in audit.
  --batch-size 150          Model records per call.
  --concurrency 1           Parallel Codex workers, capped at 2.
  --limit N                 Process only N rows for smoke testing.
  --sample-rate 0.1         Deterministic sample fraction from all rows.
  --sample-index 1          Zero-based non-overlapping sample window.
  --timeout-ms 600000       Per-model-call timeout.
  --force                   Recompute existing predictions.
  --quiet                   Reduce console output.

No database writes are performed.`);
    return;
  }

  loadEnvFile(path.resolve(REPO_ROOT, 'fifa-gbi-data-extraction/.env.local'));
  loadEnvFile(path.resolve(REPO_ROOT, '.env.local'));

  const sourceCsv = path.resolve(String(args.get('source') || DEFAULT_SOURCE_CSV));
  const outputDir = path.resolve(String(args.get('output-dir') || DEFAULT_OUTPUT_ROOT));
  const criteriaFile = path.resolve(String(args.get('criteria-file') || DEFAULT_CRITERIA_FILE));
  const criteriaVersion = String(args.get('criteria-version') || DEFAULT_CRITERIA_VERSION);
  const phase = String(args.get('phase') || 'baseline');
  const model = String(args.get('model') || 'gpt-5.5');
  const reasoning = String(args.get('reasoning') || 'medium');
  const provider = resolveProvider(args.get('provider') || DEFAULT_PROVIDER);
  const batchSize = Math.max(1, Math.min(250, asNumber(args, 'batch-size', 150)));
  const concurrency = Math.max(1, Math.min(2, Math.floor(asNumber(args, 'concurrency', 1))));
  const abstractChars = Math.max(400, Math.min(4000, asNumber(args, 'abstract-chars', 1800)));
  const limit = Math.max(0, asNumber(args, 'limit', 0));
  const sampleRate = Math.max(0, Math.min(1, asNumber(args, 'sample-rate', 1)));
  const sampleIndex = Math.max(0, Math.floor(asNumber(args, 'sample-index', 0)));
  const timeoutMs = Math.max(60000, Math.min(1800000, asNumber(args, 'timeout-ms', 600000)));
  const maxRetries = Math.max(0, Math.min(5, asNumber(args, 'max-retries', 2)));
  const force = Boolean(args.get('force'));
  const quiet = Boolean(args.get('quiet'));

  if (!existsSync(sourceCsv)) throw new Error(`Source CSV not found: ${sourceCsv}`);
  if (!existsSync(criteriaFile)) throw new Error(`Criteria file not found: ${criteriaFile}`);

  mkdirSync(outputDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const logPath = path.join(outputDir, `${phase}-events.jsonl`);
  const predictionsPath = path.join(outputDir, `${phase}-blind-predictions.json`);
  const comparisonPath = path.join(outputDir, `${phase}-revealed-comparison.csv`);
  const errorsPath = path.join(outputDir, `${phase}-false-excludes.csv`);
  const reportPath = path.join(outputDir, `${phase}-validation-report.md`);
  const manifestPath = path.join(outputDir, `${phase}-source-manifest.json`);

  const allRows = parseRayyanCsv(readFileSync(sourceCsv, 'utf8'));
  const sampledRows = selectDeterministicSample(allRows, sampleRate, sampleIndex);
  const rows = limit ? sampledRows.slice(0, limit) : sampledRows;
  const criteriaText = readFileSync(criteriaFile, 'utf8');
  const existingPayload = existsSync(predictionsPath) && !force ? JSON.parse(readFileSync(predictionsPath, 'utf8')) : null;
  const recommendationsById = new Map((existingPayload?.recommendations ?? []).map((item) => [item.recordId, item]));

  const log = async (event) => {
    await appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
    if (!quiet && event.message) console.log(event.message);
  };

  const runStartedAt = Date.now();
  const runStats = {
    deterministicDecisions: 0,
    modelReviewedRecords: 0,
    modelCalls: 0,
    retryCount: 0,
    modelCallSeconds: [],
    concurrency,
    batchSize,
  };

  await log({ type: 'start', sourceRows: allRows.length, sampledRows: rows.length, sampleRate, sampleIndex, concurrency, batchSize, message: `phase=${phase} rows=${rows.length}/${allRows.length} sampleRate=${sampleRate} sampleIndex=${sampleIndex} provider=${provider} model=${model} output=${outputDir}` });

  const pending = rows.filter((row) => !recommendationsById.has(row.key));
  const modelPending = [];
  for (const row of pending) {
    const deterministic = preTriageRecord(row, `${model} (${reasoning}) via ${provider}`);
    if (deterministic) {
      recommendationsById.set(deterministic.recordId, deterministic);
      runStats.deterministicDecisions += 1;
    } else {
      modelPending.push(row);
    }
  }

  if (runStats.deterministicDecisions > 0) {
    const payload = {
      generatedAt: new Date().toISOString(),
      phase,
      model,
      reasoning,
      provider,
      criteriaVersion,
      sourceCsv,
      blinded: true,
      databaseWrites: false,
      recommendations: Array.from(recommendationsById.values()),
    };
    writeFileSync(predictionsPath, `${JSON.stringify(payload, null, 2)}\n`);
    await log({
      type: 'deterministic-pre-triage',
      count: runStats.deterministicDecisions,
      counts: recommendationCounts(Array.from(recommendationsById.values())),
      message: `deterministic=${runStats.deterministicDecisions} modelPending=${modelPending.length}`,
    });
  }

  const batches = chunk(modelPending, batchSize);
  let nextBatchIndex = 0;
  const runWorker = async () => {
    while (nextBatchIndex < batches.length) {
      const index = nextBatchIndex;
      nextBatchIndex += 1;
      const batch = batches[index];
      const result = await runModelBatch({
        rows: batch,
        criteriaText,
        criteriaVersion,
        abstractChars,
        provider,
        model,
        reasoning,
        timeoutMs,
        maxRetries,
      });
      for (const item of result.recommendations) recommendationsById.set(item.recordId, item);
      runStats.modelCalls += 1;
      runStats.retryCount += result.retryCount;
      runStats.modelReviewedRecords += batch.length;
      runStats.modelCallSeconds.push(result.elapsedSeconds);
    const payload = {
      generatedAt: new Date().toISOString(),
      phase,
      model,
      reasoning,
      provider,
      criteriaVersion,
      sourceCsv,
      blinded: true,
      databaseWrites: false,
      recommendations: Array.from(recommendationsById.values()),
    };
    writeFileSync(predictionsPath, `${JSON.stringify(payload, null, 2)}\n`);
    await log({
      type: 'model-batch',
      batch: index + 1,
        batches: batches.length,
        count: result.recommendations.length,
        elapsedSeconds: result.elapsedSeconds,
      counts: recommendationCounts(Array.from(recommendationsById.values())),
        message: `batch=${index + 1}/${batches.length} recommendations=${result.recommendations.length} seconds=${result.elapsedSeconds}`,
    });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => runWorker()));

  const elapsedSeconds = Number(((Date.now() - runStartedAt) / 1000).toFixed(2));
  const enrichedRunStats = {
    ...runStats,
    elapsedSeconds,
    recordsPerMinute: elapsedSeconds ? Number(((rows.length / elapsedSeconds) * 60).toFixed(2)) : null,
    secondsPerModelCall: runStats.modelCalls ? Number((runStats.modelCallSeconds.reduce((sum, value) => sum + value, 0) / runStats.modelCalls).toFixed(2)) : null,
    decisionCounts: recommendationCounts(Array.from(recommendationsById.values())),
  };

  const comparisonRows = buildComparisonRows(rows, recommendationsById);
  writeCsv(comparisonPath, comparisonRows, [
    'split',
    'rowNumber',
    'key',
    'title',
    'year',
    'journal',
    'humanDecision',
    'modelDecision',
    'alignedKnownPositive',
    'confidence',
    'targetTag',
    'reason',
    'exclusionReason',
    'sourceQuote',
    'sourceLocation',
  ]);
  writeCsv(errorsPath, comparisonRows.filter((row) => row.modelDecision === 'exclude' || row.modelDecision === 'missing'), [
    'split',
    'rowNumber',
    'key',
    'title',
    'year',
    'journal',
    'humanDecision',
    'modelDecision',
    'confidence',
    'reason',
    'exclusionReason',
    'sourceQuote',
    'sourceLocation',
  ]);

  const metrics = {
    all: buildMetrics(rows, recommendationsById),
    calibration: buildMetrics(rows.filter((row) => row.split === 'calibration'), recommendationsById),
    holdout: buildMetrics(rows.filter((row) => row.split === 'holdout'), recommendationsById),
  };
  const auditFiles = {
    predictions: predictionsPath,
    comparison: comparisonPath,
    errors: errorsPath,
  };
  writeFileSync(reportPath, buildReportMarkdown({
    phase,
    model,
    reasoning,
    provider,
    criteriaVersion,
    sourceCsv,
    generatedAt,
    metrics,
    auditFiles,
    sourceRows: allRows.length,
    sampledRows: rows.length,
    sampleRate,
    sampleIndex,
    runStats: enrichedRunStats,
  }));
  writeFileSync(manifestPath, `${JSON.stringify(buildManifest({
    rows,
    sourceRows: allRows.length,
    sampleRate,
    sampleIndex,
    sourceCsv,
    outputDir,
    phase,
    model,
    reasoning,
    provider,
    criteriaVersion,
    criteriaFile,
    generatedAt,
    runStats: enrichedRunStats,
  }), null, 2)}\n`);

  await log({ type: 'done', metrics, message: `done safety=${pct(metrics.all.knownPositiveSafety)} falseExcludes=${metrics.all.falseExcludes} report=${reportPath}` });
};

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
