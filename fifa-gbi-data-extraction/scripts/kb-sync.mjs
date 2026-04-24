#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default ?? pdfParseModule.pdf ?? null);

const EXCLUDED_STATUSES = new Set(['archived', 'no_exposure', 'retrospective_substudy_analysis']);
const DEFAULT_VAULT_PATH = path.join(os.homedir(), 'Desktop', 'Obsidian Vault', 'FIFA GBI Knowledge Vault');
const MANIFEST_FILE = '.gbi-kb-manifest.json';
const FIGURE_PATTERN = /\b(?:Figure|Fig\.?)\s*(\d+[A-Za-z]?)/gi;
const STUDY_ID_PATTERN = /\bS\d{3,}\b/g;
const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi;
const CHUNK_MAX_CHARS = 3500;
const PAGE_RENDER_WIDTH = 1600;
const DOC_ROOTS = ['../docs', 'docs'];
const SUPABASE_BATCH_SIZE = 100;
const TITLE_KEYWORD_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'during',
  'among',
  'over',
  'under',
  'than',
  'that',
  'this',
  'these',
  'those',
  'study',
  'prospective',
  'cohort',
  'systematic',
  'review',
  'analysis',
  'players',
  'player',
  'football',
  'soccer',
  'futsal',
  'injury',
  'injuries',
  'elite',
  'male',
  'female',
  'youth',
  'professional',
  'randomized',
  'randomised',
]);
const AUTHOR_PARTICLES = new Set(['van', 'von', 'de', 'del', 'da', 'di', 'la', 'le', 'du', 'den', 'der', 'ten', 'ter', 'dos', 'das', 'al', 'bin']);
const AUTHOR_BLOCK_STOPWORDS = [
  'abstract',
  'introduction',
  'background',
  'objective',
  'objectives',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'conclusions',
  'to cite',
  'doi:',
  'doi.',
  'received',
  'accepted',
  'published',
  'copyright',
  'correspondence',
  'editor',
  'reviewed by',
  'journal',
  'original research',
  'original article',
  'review',
  'research report',
  'affiliation',
  'university',
  'department',
  'hospital',
  'school of',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.resolve(__dirname, '..');
const bundledPython = '/Users/abdelbabiker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pdfPageDumpScript = path.join(__dirname, 'pdf-page-dump.py');

function usage() {
  console.log(`Usage:
  node scripts/kb-sync.mjs [--vault <path>] [--paper <studyId|paperId>] [--force]

Defaults:
  vault path: ${DEFAULT_VAULT_PATH}
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }
    env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function createSupabase() {
  const env = {
    ...loadEnv(path.join(appRoot, '.env.local')),
    ...process.env,
  };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rmrf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeDoi(value) {
  return String(value ?? '')
    .replace(/https?:\/\/(dx\.)?doi\.org\//gi, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .toLowerCase();
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleForIndex(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .toLowerCase(),
  );
}

function normalizeJournalForIndex(value) {
  return normalizeTitleForIndex(value);
}

function titleKeywords(title) {
  return Array.from(
    new Set(
      normalizeTitleForIndex(title)
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !TITLE_KEYWORD_STOPWORDS.has(token)),
    ),
  ).sort();
}

function cleanAuthorToken(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(?:ORCID|MD|PhD|MSc|MSci|PT|MBChB|DMSc|FACSP|BSc|MPH|MA|MAppSc|DPT|DO|RN|FRCS|Prof|Professor)\b\.?/gi, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/[•*†‡§¶‖|]/g, ' ')
      .replace(/[,_]/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

function isAuthorLikeName(value) {
  const cleaned = cleanAuthorToken(value);
  if (!cleaned || cleaned.length < 5) {
    return false;
  }

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 5) {
    return false;
  }

  const stopwordCount = parts.filter((part) => TITLE_KEYWORD_STOPWORDS.has(part.toLowerCase())).length;
  if (stopwordCount >= 2) {
    return false;
  }

  let nameParts = 0;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (AUTHOR_PARTICLES.has(lower)) {
      continue;
    }
    if (!/^[A-Z][A-Za-z'’.-]+$/.test(part)) {
      return false;
    }
    nameParts += 1;
  }

  return nameParts >= 2;
}

function normalizeAuthorName(value) {
  const cleaned = cleanAuthorToken(value);
  if (!isAuthorLikeName(cleaned)) {
    return null;
  }

  const parts = cleaned.split(' ').filter(Boolean);
  const collapsed = [];
  for (const part of parts) {
    if (part.length === 1 && !AUTHOR_PARTICLES.has(part.toLowerCase())) {
      continue;
    }
    collapsed.push(part);
  }

  if (collapsed.length < 2) {
    return null;
  }

  return collapsed.join(' ');
}

function authorLookupVariants(author) {
  const normalized = normalizeAuthorName(author);
  if (!normalized) {
    return [];
  }

  const parts = normalized.split(' ');
  let surnameStart = parts.length - 1;
  while (surnameStart > 0 && AUTHOR_PARTICLES.has(parts[surnameStart - 1].toLowerCase())) {
    surnameStart -= 1;
  }

  const given = parts.slice(0, surnameStart).join(' ');
  const surname = parts.slice(surnameStart).join(' ');
  const variants = new Set([
    normalized.toLowerCase(),
    `${surname} ${given}`.trim().toLowerCase(),
    `${surname}, ${given}`.trim().toLowerCase(),
  ]);

  if (given) {
    const initials = given
      .split(' ')
      .map((part) => part[0])
      .join('');
    if (initials) {
      variants.add(`${surname} ${initials}`.toLowerCase());
      variants.add(`${surname}, ${initials}`.toLowerCase());
    }
  }

  return Array.from(variants).sort();
}

function authorBlockStopReason(value) {
  const lower = value.toLowerCase();
  return AUTHOR_BLOCK_STOPWORDS.find((token) => lower.includes(token)) ?? null;
}

function splitAuthorSegments(value) {
  return String(value ?? '')
    .replace(/\set al\.?$/i, '')
    .split(/\s*(?:\||;|,| and |&|•)\s*/i)
    .map((segment) => normalizeAuthorName(segment))
    .filter(Boolean);
}

function parseAuthorsFromFirstPage(pages) {
  const firstPageText = normalizeText(pages[0]?.text ?? '');
  if (!firstPageText) {
    return { authors: [], authorsNormalized: [], confidence: 'missing', reason: 'no_first_page_text' };
  }

  const lines = firstPageText
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 140);

  let best = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const stopReason = authorBlockStopReason(line);
    if (stopReason) {
      if (best) {
        break;
      }
      continue;
    }

    const authorLines = [line];
    for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 4); lookahead += 1) {
      const nextLine = lines[lookahead];
      if (authorBlockStopReason(nextLine)) {
        break;
      }
      const nextSegments = splitAuthorSegments(nextLine);
      if (nextSegments.length === 0) {
        break;
      }
      authorLines.push(nextLine);
    }

    const segments = splitAuthorSegments(authorLines.join(' | '));

    const unique = Array.from(new Set(segments));
    if (unique.length >= 2) {
      best = {
        authors: unique,
        confidence: unique.length >= 2 && index <= 120 ? 'confident' : 'uncertain',
        reason: index <= 120 ? 'author_block_detected' : 'author_block_far_down_page',
      };
      break;
    }
  }

  if (!best) {
    return { authors: [], authorsNormalized: [], confidence: 'uncertain', reason: 'no_confident_author_block' };
  }

  const authorsNormalized = Array.from(new Set(best.authors.flatMap((author) => authorLookupVariants(author))));
  return {
    authors: best.authors,
    authorsNormalized,
    confidence: best.confidence,
    reason: best.reason,
  };
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readExistingAuthorMeta(paperDir) {
  const citationPath = path.join(paperDir, 'citation.md');
  if (!fs.existsSync(citationPath)) {
    return { authors: [], authorsNormalized: [], confidence: 'missing', reason: 'missing_citation_file' };
  }

  const text = fs.readFileSync(citationPath, 'utf8');
  const authorsLine = text.match(/^- Authors:\s*(.*)$/m)?.[1]?.trim() ?? 'Unknown';
  const confidence = text.match(/^- Author extraction confidence:\s*(.*)$/m)?.[1]?.trim() ?? 'missing';
  const reason = text.match(/^- Author extraction note:\s*(.*)$/m)?.[1]?.trim() ?? '';
  const normalizedSection = text.split('## Normalized Author Variants')[1] ?? '';
  const authorsNormalized = normalizedSection
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  return {
    authors: authorsLine === 'Unknown' ? [] : authorsLine.split(';').map((item) => item.trim()).filter(Boolean),
    authorsNormalized,
    confidence,
    reason,
  };
}

function frontmatterBlock(data) {
  const lines = ['---'];
  for (const [key, rawValue] of Object.entries(data)) {
    if (Array.isArray(rawValue)) {
      lines.push(`${key}:`);
      for (const item of rawValue) {
        lines.push(`  - ${yamlScalar(item)}`);
      }
      continue;
    }
    lines.push(`${key}: ${yamlScalar(rawValue)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function yamlScalar(value) {
  if (value === null || value === undefined || value === '') {
    return '""';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const text = String(value).replace(/\r?\n/g, ' ').trim();
  return JSON.stringify(text);
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function chunkText(pages) {
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const page of pages) {
    const text = normalizeText(page.text);
    if (!text) {
      continue;
    }
    const sections = text.split(/\n{2,}/).filter(Boolean);
    for (const section of sections) {
      const nextLength = currentLength + section.length + 2;
      if (current.length > 0 && nextLength > CHUNK_MAX_CHARS) {
        chunks.push(current.join('\n\n'));
        current = [];
        currentLength = 0;
      }
      current.push(`Page ${page.page}\n${section}`);
      currentLength += section.length + 2;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'));
  }

  return chunks;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(`${command} ${args.join(' ')} failed: ${stderr || stdout || `exit ${result.status}`}`);
  }
  return result;
}

async function withRetry(fn, attempts = 3, label = 'operation') {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      console.warn(`${label} failed on attempt ${attempt}/${attempts}: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

function dumpPdfPages(pdfPath) {
  const python = fs.existsSync(bundledPython) ? bundledPython : 'python3';
  const result = runCommand(python, [pdfPageDumpScript, pdfPath]);
  const parsed = JSON.parse(result.stdout || '{"pages": []}');
  return parsed.pages ?? [];
}

function renderPageImage(pdfPath, pageNumber, outputPrefix) {
  runCommand('pdftoppm', [
    '-f',
    String(pageNumber),
    '-l',
    String(pageNumber),
    '-png',
    '-scale-to',
    String(PAGE_RENDER_WIDTH),
    pdfPath,
    outputPrefix,
  ]);
  const outputDir = path.dirname(outputPrefix);
  const outputBase = path.basename(outputPrefix);
  const match = fs
    .readdirSync(outputDir)
    .find((name) => name.startsWith(`${outputBase}-`) && name.endsWith('.png'));
  if (!match) {
    throw new Error(`Could not locate rendered page image for ${pdfPath} page ${pageNumber}`);
  }
  return path.join(outputDir, match);
}

function extractEmbeddedImages(pdfPath, outputDir) {
  ensureDir(outputDir);
  let listResult;
  try {
    listResult = runCommand('pdfimages', ['-list', pdfPath]);
  } catch (error) {
    console.warn(`Skipping embedded image extraction for ${pdfPath}: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
  const lines = listResult.stdout.trim().split('\n').slice(2);
  const pageMap = new Map();

  for (const line of lines) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 10) {
      continue;
    }
    const page = Number(columns[0]);
    if (!Number.isFinite(page)) {
      continue;
    }
    const imageNum = columns[1];
    const type = columns[2];
    const width = columns[3];
    const height = columns[4];
    const entry = {
      page,
      imageNum,
      type,
      width,
      height,
    };
    const list = pageMap.get(page) ?? [];
    list.push(entry);
    pageMap.set(page, list);
  }

  if (pageMap.size === 0) {
    return pageMap;
  }

  try {
    runCommand('pdfimages', ['-all', pdfPath, path.join(outputDir, 'embedded')]);
  } catch (error) {
    console.warn(`Skipping embedded image export for ${pdfPath}: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
  const files = fs.readdirSync(outputDir).filter((name) => name.startsWith('embedded-')).sort();
  let cursor = 0;
  for (const page of Array.from(pageMap.keys()).sort((a, b) => a - b)) {
    const entries = pageMap.get(page) ?? [];
    for (const entry of entries) {
      entry.fileName = files[cursor] ?? null;
      cursor += 1;
    }
  }

  return pageMap;
}

function detectFigureMentions(pageText) {
  const labels = [];
  const seen = new Set();
  let match;
  while ((match = FIGURE_PATTERN.exec(pageText)) !== null) {
    const label = `Figure ${match[1]}`;
    if (!seen.has(label)) {
      labels.push({ label, index: match.index });
      seen.add(label);
    }
  }
  return labels;
}

function excerptAround(text, index, radius = 700) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return normalizeText(text.slice(start, end));
}

function buildFigureEntries(pages) {
  const entries = [];
  for (const page of pages) {
    const text = normalizeText(page.text);
    if (!text) {
      continue;
    }
    const labels = detectFigureMentions(text);
    for (const { label, index } of labels) {
      entries.push({
        label,
        page: page.page,
        excerpt: excerptAround(text, index),
      });
    }
  }
  return entries;
}

function buildPaperSignature({ paper, file, notes, extractions }) {
  const extractionUpdates = extractions
    .flatMap((item) => [item.updated_at, ...(item.extraction_fields ?? []).map((field) => field.updated_at)])
    .filter(Boolean)
    .sort();
  const noteUpdates = notes.map((item) => item.created_at).filter(Boolean).sort();
  return hashJson({
    paperUpdatedAt: paper.updated_at,
    fileSha256: file?.file_sha256 ?? null,
    noteUpdates,
    extractionUpdates,
    status: paper.status,
  });
}

async function fetchIncludedPapers(supabase, filter) {
  const { data, error } = await withRetry(async () => {
    let query = supabase
      .from('papers')
      .select('*')
      .order('assigned_study_id', { ascending: true });

    if (filter) {
      const isStudyId = /^S\d+$/i.test(filter);
      query = isStudyId
        ? query.eq('assigned_study_id', filter.toUpperCase())
        : query.eq('id', filter);
    }

    return query;
  }, 3, 'load papers');
  if (error) {
    throw new Error(`Failed to load papers: ${error.message}`);
  }

  return (data ?? []).filter((paper) => !EXCLUDED_STATUSES.has(paper.status));
}

async function fetchRelatedRows(supabase, paperIds) {
  if (paperIds.length === 0) {
    return {
      files: [],
      notes: [],
      extractions: [],
      populationGroups: [],
      populationValues: [],
    };
  }

  const files = [];
  const notes = [];
  const extractions = [];
  const populationGroups = [];
  const populationValues = [];

  for (const batchIds of chunkArray(paperIds, SUPABASE_BATCH_SIZE)) {
    const [
      filesResult,
      notesResult,
      extractionsResult,
      populationGroupsResult,
      populationValuesResult,
    ] = await Promise.all([
      withRetry(() => supabase.from('paper_files').select('*').in('paper_id', batchIds), 3, 'load paper_files'),
      withRetry(
        () => supabase.from('paper_notes').select('*').in('paper_id', batchIds).order('created_at', { ascending: true }),
        3,
        'load paper_notes',
      ),
      withRetry(
        () => supabase.from('extractions').select('*, extraction_fields(*)').in('paper_id', batchIds),
        3,
        'load extractions',
      ),
      withRetry(
        () => supabase.from('population_groups').select('*').in('paper_id', batchIds).order('position', { ascending: true }),
        3,
        'load population_groups',
      ),
      withRetry(() => supabase.from('population_values').select('*').in('paper_id', batchIds), 3, 'load population_values'),
    ]);

    for (const result of [filesResult, notesResult, extractionsResult, populationGroupsResult, populationValuesResult]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    files.push(...(filesResult.data ?? []));
    notes.push(...(notesResult.data ?? []));
    extractions.push(...(extractionsResult.data ?? []));
    populationGroups.push(...(populationGroupsResult.data ?? []));
    populationValues.push(...(populationValuesResult.data ?? []));
  }

  return {
    files,
    notes,
    extractions,
    populationGroups,
    populationValues,
  };
}

async function downloadPaperFile(supabase, fileRow, outputPath) {
  if (fileRow.storage_bucket && fileRow.storage_object_path) {
    const { data, error } = await withRetry(
      () => supabase.storage.from(fileRow.storage_bucket).download(fileRow.storage_object_path),
      3,
      `download ${fileRow.storage_bucket}/${fileRow.storage_object_path}`,
    );
    if (error) {
      throw new Error(`Failed to download storage file ${fileRow.storage_bucket}/${fileRow.storage_object_path}: ${error.message}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    return;
  }

  if (fileRow.data_base64) {
    fs.writeFileSync(outputPath, Buffer.from(fileRow.data_base64, 'base64'));
    return;
  }

  throw new Error(`Paper file ${fileRow.id} has no accessible content`);
}

function buildProcessingErrorMarkdown(message) {
  return `# Processing Error\n\n${message}\n`;
}

function buildNotesMarkdown(notes) {
  const lines = ['# Notes', ''];
  if (notes.length === 0) {
    lines.push('No paper notes in Supabase.');
    return `${lines.join('\n')}\n`;
  }

  for (const note of notes) {
    lines.push(`## ${note.created_at}`);
    lines.push('');
    lines.push(note.body?.trim() || '(blank)');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildExtractionsMarkdown(extractions, populationGroups, populationValues) {
  const lines = ['# Extractions', ''];
  if (extractions.length === 0) {
    lines.push('No extraction records in Supabase.');
    return `${lines.join('\n')}\n`;
  }

  const valuesByGroup = new Map();
  for (const value of populationValues) {
    const list = valuesByGroup.get(value.population_group_id) ?? [];
    list.push(value);
    valuesByGroup.set(value.population_group_id, list);
  }

  for (const extraction of extractions.sort((a, b) => a.tab.localeCompare(b.tab))) {
    lines.push(`## ${extraction.tab}`);
    lines.push('');
    lines.push(`- Model: \`${extraction.model}\``);
    lines.push(`- Updated: \`${extraction.updated_at}\``);
    lines.push('');
    lines.push('| Field | Value | Status | Metric | Source Quote | Page Hint |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const field of (extraction.extraction_fields ?? []).sort((a, b) => a.field_id.localeCompare(b.field_id))) {
      lines.push(
        `| ${markdownEscape(field.field_id)} | ${markdownEscape(field.value ?? '')} | ${markdownEscape(field.status)} | ${markdownEscape(field.metric ?? '')} | ${markdownEscape(field.source_quote ?? '')} | ${markdownEscape(field.page_hint ?? '')} |`,
      );
    }
    lines.push('');

    const groups = populationGroups.filter((group) => group.tab === extraction.tab);
    if (groups.length > 0) {
      lines.push(`### Population Rows (${extraction.tab})`);
      lines.push('');
      for (const group of groups) {
        lines.push(`#### ${group.label}`);
        lines.push('');
        lines.push('| Field | Value | Metric | Unit | Source Field |');
        lines.push('| --- | --- | --- | --- | --- |');
        for (const value of (valuesByGroup.get(group.id) ?? []).sort((a, b) => a.field_id.localeCompare(b.field_id))) {
          lines.push(
            `| ${markdownEscape(value.field_id)} | ${markdownEscape(value.value ?? '')} | ${markdownEscape(value.metric ?? '')} | ${markdownEscape(value.unit ?? '')} | ${markdownEscape(value.source_field_id)} |`,
          );
        }
        lines.push('');
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildPaperIndexMarkdown({ paper, fileRow, notes, extractions, figureEntries, authorMeta }) {
  const frontmatter = frontmatterBlock({
    paper_id: paper.id,
    study_id: paper.assigned_study_id,
    status: paper.status,
    title: paper.title,
    title_normalized: normalizeTitleForIndex(paper.title),
    lead_author: paper.lead_author ?? '',
    journal: paper.journal ?? '',
    journal_normalized: normalizeJournalForIndex(paper.journal ?? ''),
    year: paper.year ?? '',
    doi: paper.doi ?? '',
    doi_normalized: normalizeDoi(paper.doi ?? ''),
    updated_at: paper.updated_at,
    has_notes: notes.length > 0,
    has_fulltext: Boolean(fileRow),
    has_extractions: extractions.length > 0,
    figure_count: figureEntries.length,
    authors: authorMeta.authors,
    authors_normalized: authorMeta.authorsNormalized,
    metadata_confidence: authorMeta.confidence,
  });

  const lines = [
    frontmatter,
    `# ${paper.assigned_study_id} - ${paper.title}`,
    '',
    `- Status: \`${paper.status}\``,
    `- Lead author: ${paper.lead_author ?? 'Unknown'}`,
    `- Journal: ${paper.journal ?? 'Unknown'}`,
    `- Year: ${paper.year ?? 'Unknown'}`,
    `- DOI: ${paper.doi ?? 'Not available'}`,
    `- Authors: ${authorMeta.authors.length > 0 ? authorMeta.authors.join('; ') : 'Unknown'}`,
    `- File: ${fileRow ? '[[source.pdf]]' : 'Missing'}`,
    `- Notes: [[notes]]`,
    `- Extractions: [[extractions]]`,
    `- Full text: [[fulltext]]`,
    `- Figures: [[figures/index]]`,
    `- Backlinks: [[backlinks]]`,
    `- Query card: [[query-card]]`,
    `- Citation: [[citation]]`,
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function buildCitationMarkdown({ paper, authorMeta }) {
  const lines = ['# Citation', ''];
  lines.push(`- Study ID: ${paper.assigned_study_id}`);
  lines.push(`- Title: ${paper.title}`);
  lines.push(`- Authors: ${authorMeta.authors.length > 0 ? authorMeta.authors.join('; ') : 'Unknown'}`);
  lines.push(`- Journal: ${paper.journal ?? 'Unknown'}`);
  lines.push(`- Year: ${paper.year ?? 'Unknown'}`);
  lines.push(`- DOI: ${paper.doi ?? 'Not available'}`);
  lines.push(`- Author extraction confidence: ${authorMeta.confidence}`);
  if (authorMeta.reason) {
    lines.push(`- Author extraction note: ${authorMeta.reason}`);
  }
  lines.push('');
  lines.push('## Normalized Author Variants');
  lines.push('');
  if (authorMeta.authorsNormalized.length === 0) {
    lines.push('No confident normalized author variants.');
  } else {
    for (const author of authorMeta.authorsNormalized) {
      lines.push(`- ${author}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildQueryCardMarkdown({ paper, authorMeta, notes, extractions, figureEntries, backlinks }) {
  const lines = ['# Query Card', ''];
  lines.push(`- Study ID: ${paper.assigned_study_id}`);
  lines.push(`- Status: ${paper.status}`);
  lines.push(`- Title: ${paper.title}`);
  lines.push(`- Authors: ${authorMeta.authors.length > 0 ? authorMeta.authors.join('; ') : 'Unknown'}`);
  lines.push(`- Journal: ${paper.journal ?? 'Unknown'}`);
  lines.push(`- Year: ${paper.year ?? 'Unknown'}`);
  lines.push(`- DOI: ${paper.doi ?? 'Not available'}`);
  lines.push(`- Notes count: ${notes.length}`);
  lines.push(`- Extraction tabs: ${extractions.length}`);
  lines.push(`- Figure references: ${figureEntries.length}`);
  lines.push(`- Backlinks: ${backlinks.length}`);
  lines.push(`- Author metadata confidence: ${authorMeta.confidence}`);
  lines.push('');
  lines.push('## Query Signals');
  lines.push('');
  const querySignals = [
    normalizeTitleForIndex(paper.title),
    normalizeJournalForIndex(paper.journal ?? ''),
    normalizeDoi(paper.doi ?? ''),
    ...titleKeywords(paper.title),
    ...authorMeta.authorsNormalized,
  ].filter(Boolean);
  for (const signal of Array.from(new Set(querySignals)).sort()) {
    lines.push(`- ${signal}`);
  }
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  if (extractions.length === 0) {
    lines.push('- No extraction tabs saved.');
  } else {
    for (const extraction of extractions.sort((a, b) => a.tab.localeCompare(b.tab))) {
      lines.push(`- ${extraction.tab}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildFullTextMarkdown(pages) {
  const lines = ['# Full Text', ''];
  if (pages.length === 0) {
    lines.push('No page-level text could be extracted from this PDF.');
    return `${lines.join('\n')}\n`;
  }

  for (const page of pages) {
    lines.push(`## Page ${page.page}`);
    lines.push('');
    lines.push(normalizeText(page.text) || '(No extractable text on this page)');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildFigureIndexMarkdown(figureEntries) {
  const lines = ['# Figures', ''];
  if (figureEntries.length === 0) {
    lines.push('No figure references were detected from page text. Page renders can still be added later if needed.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('| Figure | Page | Note |');
  lines.push('| --- | --- | --- |');
  for (const entry of figureEntries) {
    lines.push(`| ${markdownEscape(entry.label)} | ${entry.page} | [[${entry.fileName.replace(/\.md$/i, '')}|${entry.label}]] |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildFigureMarkdown(entry, pageImageRelative, embeddedImages) {
  const lines = [
    `# ${entry.label}`,
    '',
    `- Page: ${entry.page}`,
    `- Page render: ![[${pageImageRelative}]]`,
  ];

  if (embeddedImages.length > 0) {
    lines.push('- Embedded images:');
    for (const image of embeddedImages) {
      if (image.fileName) {
        lines.push(`  - ![[embedded/${image.fileName}]]`);
      }
    }
  }

  lines.push('', '## Nearby Text', '', entry.excerpt || 'No nearby text found.', '');
  return `${lines.join('\n')}\n`;
}

function extractDocReferences(text, doiLookup) {
  const studyIds = new Set(text.match(STUDY_ID_PATTERN) ?? []);
  const doiMatches = text.match(DOI_PATTERN) ?? [];
  for (const doi of doiMatches) {
    const normalized = normalizeDoi(doi);
    const studyId = doiLookup.get(normalized);
    if (studyId) {
      studyIds.add(studyId);
    }
  }
  return Array.from(studyIds).sort();
}

function rewriteDocLinks(text, includedStudyIds) {
  return text.replace(STUDY_ID_PATTERN, (match) => {
    if (!includedStudyIds.has(match)) {
      return match;
    }
    return `[[papers/${match}/index|${match}]]`;
  });
}

function collectMarkdownDocs() {
  const docs = [];
  for (const root of DOC_ROOTS) {
    const absoluteRoot = path.resolve(repoRoot, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }
    walkDocs(absoluteRoot, absoluteRoot, docs);
  }
  return docs;
}

function walkDocs(rootDir, currentDir, docs) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkDocs(rootDir, absolutePath, docs);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    docs.push({
      absolutePath,
      relativePath: path.relative(rootDir, absolutePath).replace(/\\/g, '/'),
      rootName: path.basename(rootDir),
    });
  }
}

function buildBacklinksMarkdown(studyId, backlinks) {
  const lines = ['# Backlinks', ''];
  if (backlinks.length === 0) {
    lines.push(`No mirrored markdown docs explicitly reference \`${studyId}\`.`);
    return `${lines.join('\n')}\n`;
  }

  for (const backlink of backlinks) {
    lines.push(`- [[${backlink}|${backlink}]]`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildInstructionFile(kind) {
  return `# ${kind}\n
This vault is a generated, read-only mirror of the live FIFA GBI data.

Rules:
- Start from [[_indexes/master]].
- Prefer exact study ID, DOI, author, and title index lookups before broader text search.
- Query \`_indexes/by-author-all\`, \`_indexes/by-doi\`, \`_indexes/by-title-keyword\`, and the paper's \`query-card\` and \`citation\` before opening full paper text.
- Use the paper's \`fulltext\`, \`chunks/\`, and \`figures/index\` only when the query-first metadata is not enough.
- For cross-paper questions, start from [[_syntheses/index]] and then open the relevant topic folder before scanning many individual papers.
- Use \`source.pdf\` or figure page renders for source verification.
- Treat mirrored project docs as workflow context, not a source of truth over Supabase.
- Do not edit generated paper notes manually; regenerate them from the sync script instead.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const vaultRoot = path.resolve(args.vault || process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH);
  const paperFilter = args.paper ? String(args.paper).trim() : null;
  const partialSync = Boolean(paperFilter);
  const force = Boolean(args.force);

  ensureDir(vaultRoot);
  ensureDir(path.join(vaultRoot, '_indexes'));
  ensureDir(path.join(vaultRoot, '_project_docs'));
  writeFile(path.join(vaultRoot, 'CLAUDE.md'), buildInstructionFile('CLAUDE'));
  writeFile(path.join(vaultRoot, 'AGENTS.md'), buildInstructionFile('AGENTS'));

  const supabase = createSupabase();
  const manifestPath = path.join(vaultRoot, MANIFEST_FILE);
  const previousManifest = readJson(manifestPath, { papers: {} });

  const papers = await fetchIncludedPapers(supabase, paperFilter);
  const paperIds = papers.map((paper) => paper.id);
  const related = await fetchRelatedRows(supabase, paperIds);

  const filesByPaperId = new Map();
  for (const fileRow of related.files) {
    const list = filesByPaperId.get(fileRow.paper_id) ?? [];
    list.push(fileRow);
    filesByPaperId.set(fileRow.paper_id, list);
  }
  const notesByPaperId = new Map();
  for (const note of related.notes) {
    const list = notesByPaperId.get(note.paper_id) ?? [];
    list.push(note);
    notesByPaperId.set(note.paper_id, list);
  }
  const extractionsByPaperId = new Map();
  for (const extraction of related.extractions) {
    const list = extractionsByPaperId.get(extraction.paper_id) ?? [];
    list.push(extraction);
    extractionsByPaperId.set(extraction.paper_id, list);
  }
  const populationGroupsByPaperId = new Map();
  for (const group of related.populationGroups) {
    const list = populationGroupsByPaperId.get(group.paper_id) ?? [];
    list.push(group);
    populationGroupsByPaperId.set(group.paper_id, list);
  }
  const populationValuesByPaperId = new Map();
  for (const value of related.populationValues) {
    const list = populationValuesByPaperId.get(value.paper_id) ?? [];
    list.push(value);
    populationValuesByPaperId.set(value.paper_id, list);
  }

  const includedStudyIds = new Set(papers.map((paper) => paper.assigned_study_id));
  const doiLookup = new Map();
  for (const paper of papers) {
    const normalized = normalizeDoi(paper.normalized_doi || paper.doi || '');
    if (normalized) {
      doiLookup.set(normalized, paper.assigned_study_id);
    }
  }

  const docs = collectMarkdownDocs();
  const backlinksByStudyId = new Map();
  for (const doc of docs) {
    const sourceText = fs.readFileSync(doc.absolutePath, 'utf8');
    const mirroredText = rewriteDocLinks(sourceText, includedStudyIds);
    const targetRelative = path.join('_project_docs', doc.rootName, doc.relativePath).replace(/\\/g, '/');
    writeFile(path.join(vaultRoot, targetRelative), mirroredText);

    const references = extractDocReferences(sourceText, doiLookup);
    for (const studyId of references) {
      if (!includedStudyIds.has(studyId)) {
        continue;
      }
      const list = backlinksByStudyId.get(studyId) ?? [];
      list.push(targetRelative.replace(/\.md$/i, ''));
      backlinksByStudyId.set(studyId, list);
    }
  }

  const currentManifest = partialSync
    ? {
        ...previousManifest,
        generatedAt: new Date().toISOString(),
        excludedStatuses: Array.from(EXCLUDED_STATUSES),
        papers: { ...(previousManifest.papers ?? {}) },
      }
    : {
        generatedAt: new Date().toISOString(),
        paperCount: papers.length,
        excludedStatuses: Array.from(EXCLUDED_STATUSES),
        papers: {},
      };

  const indexRows = [];
  const authorBuckets = new Map();
  const authorAllBuckets = new Map();
  const yearBuckets = new Map();
  const statusBuckets = new Map();
  const journalBuckets = new Map();
  const titleKeywordBuckets = new Map();
  const querySignalBuckets = new Map();
  const doiBuckets = [];
  const uncertainAuthorRows = [];

  for (const paper of papers) {
    const paperDir = path.join(vaultRoot, 'papers', paper.assigned_study_id);
    const paperFiles = filesByPaperId.get(paper.id) ?? [];
    const primaryFile = paperFiles.find((fileRow) => fileRow.id === paper.primary_file_id) ?? paperFiles[0] ?? null;
    const notes = notesByPaperId.get(paper.id) ?? [];
    const extractions = extractionsByPaperId.get(paper.id) ?? [];
    const populationGroups = populationGroupsByPaperId.get(paper.id) ?? [];
    const populationValues = populationValuesByPaperId.get(paper.id) ?? [];
    const signature = buildPaperSignature({ paper, file: primaryFile, notes, extractions });
    currentManifest.papers[paper.assigned_study_id] = { signature };

    const previousSignature = previousManifest.papers?.[paper.assigned_study_id]?.signature;
    const shouldRebuild =
      force ||
      previousSignature !== signature ||
      !fs.existsSync(path.join(paperDir, 'index.md')) ||
      !fs.existsSync(path.join(paperDir, 'query-card.md')) ||
      !fs.existsSync(path.join(paperDir, 'citation.md'));
    if (!shouldRebuild) {
      indexRows.push({ ...paper, _authorMeta: readExistingAuthorMeta(paperDir) });
      continue;
    }

    rmrf(paperDir);
    ensureDir(paperDir);
    ensureDir(path.join(paperDir, 'chunks'));
    ensureDir(path.join(paperDir, 'figures'));
    ensureDir(path.join(paperDir, 'figures', 'embedded'));

    let pages = [];
    let figureEntries = [];
    let resolvedAuthorMeta = { authors: [], authorsNormalized: [], confidence: 'missing', reason: 'not_processed_yet' };
    try {
      if (primaryFile) {
        const pdfPath = path.join(paperDir, 'source.pdf');
        await downloadPaperFile(supabase, primaryFile, pdfPath);

        try {
          pages = dumpPdfPages(pdfPath);
        } catch (error) {
          const buffer = fs.readFileSync(pdfPath);
          if (!pdfParse) {
            throw error;
          }
          const parsed = await pdfParse(buffer);
          pages = [{ page: 1, text: parsed.text }];
        }

        resolvedAuthorMeta = parseAuthorsFromFirstPage(pages);

        writeFile(path.join(paperDir, 'fulltext.md'), buildFullTextMarkdown(pages));

        const chunks = chunkText(pages);
        if (chunks.length === 0) {
          writeFile(path.join(paperDir, 'chunks', 'chunk-001.md'), '# Chunk 1\n\nNo chunkable text extracted.\n');
        } else {
          chunks.forEach((chunk, index) => {
            writeFile(path.join(paperDir, 'chunks', `chunk-${String(index + 1).padStart(3, '0')}.md`), `# Chunk ${index + 1}\n\n${chunk}\n`);
          });
        }

        figureEntries = buildFigureEntries(pages);
        const embeddedByPage = extractEmbeddedImages(pdfPath, path.join(paperDir, 'figures', 'embedded'));
        figureEntries.forEach((entry, index) => {
          const baseName = `figure-${String(index + 1).padStart(2, '0')}`;
          const outputPrefix = path.join(paperDir, 'figures', `${baseName}-page`);
          const pageImage = renderPageImage(pdfPath, entry.page, outputPrefix);
          entry.fileName = `${baseName}.md`;
          const embeddedImages = embeddedByPage.get(entry.page) ?? [];
          writeFile(
            path.join(paperDir, 'figures', entry.fileName),
            buildFigureMarkdown(entry, path.relative(path.join(paperDir, 'figures'), pageImage).replace(/\\/g, '/'), embeddedImages),
          );
        });
      } else {
        writeFile(path.join(paperDir, 'fulltext.md'), '# Full Text\n\nNo primary PDF file is attached to this paper.\n');
        writeFile(path.join(paperDir, 'chunks', 'chunk-001.md'), '# Chunk 1\n\nNo primary PDF file is attached to this paper.\n');
        resolvedAuthorMeta = { authors: [], authorsNormalized: [], confidence: 'missing', reason: 'no_primary_pdf' };
      }
    } catch (error) {
      const message = `PDF processing failed for ${paper.assigned_study_id}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(message);
      writeFile(path.join(paperDir, 'fulltext.md'), buildProcessingErrorMarkdown(message));
      writeFile(path.join(paperDir, 'chunks', 'chunk-001.md'), buildProcessingErrorMarkdown(message));
      writeFile(path.join(paperDir, 'figures', 'index.md'), '# Figures\n\nPDF processing failed before figure assets could be generated.\n');
      resolvedAuthorMeta = { authors: [], authorsNormalized: [], confidence: 'uncertain', reason: message };
    }

    writeFile(path.join(paperDir, 'notes.md'), buildNotesMarkdown(notes));
    writeFile(path.join(paperDir, 'extractions.md'), buildExtractionsMarkdown(extractions, populationGroups, populationValues));
    if (!fs.existsSync(path.join(paperDir, 'figures', 'index.md'))) {
      writeFile(path.join(paperDir, 'figures', 'index.md'), buildFigureIndexMarkdown(figureEntries));
    }
    const backlinks = backlinksByStudyId.get(paper.assigned_study_id) ?? [];
    writeFile(path.join(paperDir, 'backlinks.md'), buildBacklinksMarkdown(paper.assigned_study_id, backlinks));
    writeFile(path.join(paperDir, 'citation.md'), buildCitationMarkdown({ paper, authorMeta: resolvedAuthorMeta }));
    writeFile(path.join(paperDir, 'query-card.md'), buildQueryCardMarkdown({ paper, authorMeta: resolvedAuthorMeta, notes, extractions, figureEntries, backlinks }));
    writeFile(path.join(paperDir, 'index.md'), buildPaperIndexMarkdown({ paper, fileRow: primaryFile, notes, extractions, figureEntries, authorMeta: resolvedAuthorMeta }));

    indexRows.push({ ...paper, _authorMeta: resolvedAuthorMeta });
  }

  for (const paper of indexRows.sort((a, b) => a.assigned_study_id.localeCompare(b.assigned_study_id))) {
    const paperLink = `[[papers/${paper.assigned_study_id}/index|${paper.assigned_study_id}]]`;
    const masterRow = `| ${paperLink} | ${markdownEscape(paper.title)} | ${markdownEscape(paper.status)} | ${markdownEscape(paper.lead_author ?? '')} | ${markdownEscape(paper.year ?? '')} |`;
    doiBuckets.push([paper.doi ?? '', paperLink, paper.title]);
    const authorKey = paper.lead_author ?? 'Unknown';
    const yearKey = paper.year ?? 'Unknown';
    const statusKey = paper.status;
    const journalKey = paper.journal ?? 'Unknown';
    (authorBuckets.get(authorKey) ?? authorBuckets.set(authorKey, []).get(authorKey)).push(paperLink);
    (yearBuckets.get(yearKey) ?? yearBuckets.set(yearKey, []).get(yearKey)).push(paperLink);
    (statusBuckets.get(statusKey) ?? statusBuckets.set(statusKey, []).get(statusKey)).push(paperLink);
    (journalBuckets.get(journalKey) ?? journalBuckets.set(journalKey, []).get(journalKey)).push(paperLink);
    for (const keyword of titleKeywords(paper.title)) {
      (titleKeywordBuckets.get(keyword) ?? titleKeywordBuckets.set(keyword, []).get(keyword)).push(paperLink);
    }
    const authorMeta = paper._authorMeta ?? { authors: [], authorsNormalized: [], confidence: 'missing', reason: 'no_author_meta' };
    if (authorMeta.confidence === 'confident') {
      for (const author of authorMeta.authors) {
        (authorAllBuckets.get(author) ?? authorAllBuckets.set(author, []).get(author)).push(paperLink);
      }
      (querySignalBuckets.get('strong_metadata') ?? querySignalBuckets.set('strong_metadata', []).get('strong_metadata')).push(paperLink);
    } else if (authorMeta.confidence === 'uncertain') {
      uncertainAuthorRows.push(`| ${paperLink} | ${markdownEscape(authorMeta.reason ?? 'uncertain')} |`);
      (querySignalBuckets.get('uncertain_author_metadata') ?? querySignalBuckets.set('uncertain_author_metadata', []).get('uncertain_author_metadata')).push(paperLink);
    } else {
      uncertainAuthorRows.push(`| ${paperLink} | ${markdownEscape(authorMeta.reason ?? 'missing')} |`);
      (querySignalBuckets.get('missing_author_metadata') ?? querySignalBuckets.set('missing_author_metadata', []).get('missing_author_metadata')).push(paperLink);
    }
    if (!partialSync) {
      if (!currentManifest.masterRows) {
        currentManifest.masterRows = [];
      }
      currentManifest.masterRows.push(masterRow);
    }
  }

  if (!partialSync) {
    writeFile(
      path.join(vaultRoot, '_indexes', 'master.md'),
      ['# Master Index', '', `Included papers: ${indexRows.length}`, '', '| Study ID | Title | Status | Lead Author | Year |', '| --- | --- | --- | --- | --- |', ...(currentManifest.masterRows ?? []), ''].join('\n'),
    );

    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-author.md'), '# By Author', authorBuckets);
    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-author-all.md'), '# By Author (All)', authorAllBuckets);
    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-year.md'), '# By Year', yearBuckets);
    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-status.md'), '# By Status', statusBuckets);
    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-journal.md'), '# By Journal', journalBuckets);
    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-title-keyword.md'), '# By Title Keyword', titleKeywordBuckets);
    writeBucketIndex(path.join(vaultRoot, '_indexes', 'by-query-signal.md'), '# By Query Signal', querySignalBuckets);
    writeFile(
      path.join(vaultRoot, '_indexes', 'by-doi.md'),
      ['# By DOI', '', '| DOI | Study | Title |', '| --- | --- | --- |', ...doiBuckets.filter(([doi]) => doi).sort((a, b) => a[0].localeCompare(b[0])).map(([doi, link, title]) => `| ${markdownEscape(doi)} | ${link} | ${markdownEscape(title)} |`), ''].join('\n'),
    );
    writeFile(
      path.join(vaultRoot, '_indexes', 'review', 'author-extraction-uncertain.md'),
      ['# Author Extraction Uncertain', '', '| Study | Reason |', '| --- | --- |', ...uncertainAuthorRows.sort(), ''].join('\n'),
    );
  }

  writeFile(manifestPath, `${JSON.stringify(currentManifest, null, 2)}\n`);
  console.log(`Vault sync complete: ${vaultRoot}`);
  console.log(`Included papers: ${indexRows.length}`);
}

function writeBucketIndex(filePath, title, bucketMap) {
  const lines = [title, ''];
  for (const key of Array.from(bucketMap.keys()).sort((a, b) => a.localeCompare(b))) {
    lines.push(`## ${key}`);
    lines.push('');
    for (const link of bucketMap.get(key) ?? []) {
      lines.push(`- ${link}`);
    }
    lines.push('');
  }
  writeFile(filePath, `${lines.join('\n')}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
