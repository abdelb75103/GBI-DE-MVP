#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const OUT_DIR = path.join(ROOT, 'tmp', 'full-text-pdf-retrieval');
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const AWAITING_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');

const args = new Set(process.argv.slice(2));
const SHOULD_UPLOAD = args.has('--upload');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split('=')[1] ?? '', 10) : Number.POSITIVE_INFINITY;
const SKIP_STUDY_IDS = new Set(
  process.argv
    .filter((arg) => arg.startsWith('--skip-study-id='))
    .flatMap((arg) => (arg.split('=')[1] ?? '').split(','))
    .map((value) => value.trim())
    .filter(Boolean),
);

const loadEnv = (filePath) => {
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
  return env;
};

const env = loadEnv(ENV_PATH);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenSet = (value) => {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'based', 'study', 'studies', 'systematic',
    'review', 'meta', 'analysis', 'football', 'soccer', 'players', 'player', 'injury',
    'injuries', 'risk', 'incidence', 'prevalence', 'relationship', 'association', 'effect',
    'effects', 'impact', 'characteristics', 'epidemiology', 'professional', 'youth',
    'male', 'female', 'elite', 'prospective', 'cohort',
  ]);
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !stop.has(token)));
};

const tokenCoverage = (target, text) => {
  const targetTokens = tokenSet(target);
  const textTokens = tokenSet(text);
  let hits = 0;
  for (const token of targetTokens) {
    if (textTokens.has(token)) hits += 1;
  }
  return hits / Math.max(1, targetTokens.size);
};

const sanitizeFileName = (value) => normalize(value).slice(0, 120).replace(/\s+/g, '-') || 'full-text';

const doiPath = (doi) => encodeURIComponent(String(doi ?? '').trim());

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
  try {
    return await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'FIFA-GBI-full-text-retrieval/1.0 (open-access PDF lookup)',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const isPdfBuffer = (buffer) => buffer.subarray(0, 1024).includes(Buffer.from('%PDF'));

const extractPdfText = (buffer, label) => {
  const filePath = path.join(OUT_DIR, `${label}.pdf`);
  fs.writeFileSync(filePath, buffer);
  const result = spawnSync('pdftotext', ['-f', '1', '-l', '3', '-layout', filePath, '-'], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 500000,
  });
  return result.status === 0 ? result.stdout : '';
};

const parseMetaPdfUrls = (html, baseUrl) => {
  const urls = new Set();
  const patterns = [
    /<meta[^>]+name=["']citation_pdf_url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']citation_pdf_url["']/gi,
    /<meta[^>]+property=["']og:pdf["'][^>]+content=["']([^"']+)["']/gi,
    /href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      try {
        urls.add(new URL(match[1].replace(/&amp;/g, '&'), baseUrl).toString());
      } catch {
        // Ignore malformed page URLs.
      }
    }
  }
  return [...urls];
};

const openAlexUrls = async (doi) => {
  if (!doi) return [];
  const response = await fetchWithTimeout(`https://api.openalex.org/works/doi:${doiPath(doi)}`);
  if (!response.ok) return [];
  const work = await response.json();
  const urls = new Set();
  for (const location of [work.primary_location, work.best_oa_location, ...(work.locations ?? [])].filter(Boolean)) {
    if (location.pdf_url) urls.add(location.pdf_url);
    if (location.landing_page_url) urls.add(location.landing_page_url);
  }
  if (work.open_access?.oa_url) urls.add(work.open_access.oa_url);
  return [...urls];
};

const europePmcUrls = async (doi) => {
  if (!doi) return [];
  const query = encodeURIComponent(`DOI:"${doi}"`);
  const response = await fetchWithTimeout(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${query}&format=json&pageSize=1`);
  if (!response.ok) return [];
  const payload = await response.json();
  const result = payload.resultList?.result?.[0];
  if (!result) return [];
  const urls = new Set();
  if (result.pmcid) {
    urls.add(`https://www.ncbi.nlm.nih.gov/pmc/articles/${result.pmcid}/pdf/`);
    urls.add(`https://pmc.ncbi.nlm.nih.gov/articles/${result.pmcid}/pdf/`);
  }
  if (result.fullTextUrlList?.fullTextUrl) {
    for (const item of result.fullTextUrlList.fullTextUrl) {
      if (item.url) urls.add(item.url);
    }
  }
  return [...urls];
};

const publisherPatternUrls = (doi) => {
  if (!doi) return [];
  const lower = doi.toLowerCase();
  const encoded = encodeURIComponent(doi);
  const urls = [];
  if (lower.startsWith('10.1371/')) urls.push(`https://journals.plos.org/plosone/article/file?id=${encoded}&type=printable`);
  if (lower.startsWith('10.3390/')) urls.push(`https://www.mdpi.com/${doi.replace(/^10\.3390\//i, '')}/pdf`);
  if (lower.startsWith('10.3389/')) urls.push(`https://www.frontiersin.org/articles/${doi}/pdf`);
  if (lower.startsWith('10.7717/')) urls.push(`https://peerj.com/articles/${doi.split('.').at(-1)}.pdf`);
  if (lower.startsWith('10.7759/')) urls.push(`https://www.cureus.com/articles/${doi.split('.').at(-1)}.pdf`);
  return urls;
};

const doiLandingUrls = (doi) => doi ? [`https://doi.org/${doi}`] : [];

const candidateUrls = async (record) => {
  const urls = new Set();
  for (const url of publisherPatternUrls(record.doi)) urls.add(url);
  for (const url of await europePmcUrls(record.doi).catch(() => [])) urls.add(url);
  for (const url of await openAlexUrls(record.doi).catch(() => [])) urls.add(url);
  for (const url of doiLandingUrls(record.doi)) urls.add(url);
  return [...urls];
};

const downloadCandidate = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'FIFA-GBI-full-text-retrieval/1.0 (open-access PDF lookup)',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    const finalUrl = response.url;
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_FILE_BYTES || body.length < 1000) return null;
    if (isPdfBuffer(body) || contentType.toLowerCase().includes('pdf')) {
      return { buffer: body, finalUrl, sourceUrl: url };
    }
    const text = body.toString('utf8');
    if (/text\/html|<!doctype html|<html/i.test(`${contentType}\n${text.slice(0, 200)}`)) {
      for (const pdfUrl of parseMetaPdfUrls(text, finalUrl).slice(0, 8)) {
        const nested = await downloadCandidate(pdfUrl).catch(() => null);
        if (nested) return nested;
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const listAwaitingRecords = async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id,assigned_study_id,title,lead_author,year,doi,storage_object_path,data_base64,file_sha256,metadata')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows.filter((record) =>
    record.metadata?.titleAbstractRecordId &&
    (record.metadata?.awaitingFullTextPdf === true || (!record.storage_object_path && record.data_base64 === AWAITING_SENTINEL))
  );
};

const listExistingHashes = async () => {
  const screeningRows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('id,file_sha256')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    screeningRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { data: papers, error: paperError } = await supabase
    .from('papers')
    .select('id,primary_file_sha256');
  if (paperError) throw paperError;
  return new Set([
    ...screeningRows.map((row) => row.file_sha256).filter(Boolean),
    ...(papers ?? []).map((row) => row.primary_file_sha256).filter(Boolean),
  ]);
};

const uploadPdf = async (record, buffer, fileName, sourceUrl) => {
  const fileId = crypto.randomUUID();
  const objectPath = `${fileId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const { error: uploadError } = await supabase.storage.from('papers').upload(objectPath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const now = new Date().toISOString();
  const fileSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const { error: updateError } = await supabase
    .from('screening_records')
    .update({
      storage_bucket: 'papers',
      storage_object_path: objectPath,
      data_base64: null,
      file_name: fileName,
      original_file_name: fileName,
      mime_type: 'application/pdf',
      size: buffer.length,
      file_sha256: fileSha256,
      metadata: {
        ...(record.metadata ?? {}),
        awaitingFullTextPdf: false,
        fullTextPdfAttachedAt: now,
        fullTextPdfAttachedBy: 'script:fetch-full-text-screening-pdfs',
        fullTextPdfSourceUrl: sourceUrl,
      },
      updated_at: now,
    })
    .eq('id', record.id);
  if (updateError) throw updateError;
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const records = (await listAwaitingRecords())
  .filter((record) => !SKIP_STUDY_IDS.has(record.assigned_study_id))
  .slice(0, LIMIT);
const existingHashes = await listExistingHashes();
const report = [];

for (const [index, record] of records.entries()) {
  const entry = {
    studyId: record.assigned_study_id,
    id: record.id,
    title: record.title,
    doi: record.doi,
    status: 'not_found',
    tried: [],
  };
  console.error(`[${index + 1}/${records.length}] ${record.assigned_study_id} ${record.doi || ''}`);
  if (!record.doi) {
    entry.status = 'no_doi';
    report.push(entry);
    continue;
  }

  for (const url of await candidateUrls(record)) {
    entry.tried.push(url);
    const candidate = await downloadCandidate(url).catch(() => null);
    if (!candidate || !isPdfBuffer(candidate.buffer)) continue;

    const hash = crypto.createHash('sha256').update(candidate.buffer).digest('hex');
    if (existingHashes.has(hash)) {
      entry.status = 'duplicate_hash';
      entry.sourceUrl = candidate.finalUrl;
      continue;
    }

    const text = extractPdfText(candidate.buffer, `${record.assigned_study_id}-${hash.slice(0, 10)}`);
    const coverage = tokenCoverage(record.title, text);
    const doiMatch = normalize(text).replace(/\s+/g, '').includes(normalize(record.doi).replace(/\s+/g, ''));
    if (coverage < 0.45 && !doiMatch) {
      entry.rejected = { url: candidate.finalUrl, coverage, doiMatch };
      continue;
    }

    const fileName = `${record.assigned_study_id}-${sanitizeFileName(record.title)}.pdf`;
    fs.writeFileSync(path.join(OUT_DIR, fileName), candidate.buffer);
    entry.status = SHOULD_UPLOAD ? 'uploaded' : 'found';
    entry.sourceUrl = candidate.finalUrl;
    entry.fileName = fileName;
    entry.size = candidate.buffer.length;
    entry.sha256 = hash;
    entry.validation = { coverage, doiMatch };
    if (SHOULD_UPLOAD) {
      await uploadPdf(record, candidate.buffer, fileName, candidate.finalUrl);
      existingHashes.add(hash);
    }
    break;
  }
  report.push(entry);
  fs.writeFileSync(path.join(OUT_DIR, SHOULD_UPLOAD ? 'upload-report.json' : 'dry-run-report.json'), JSON.stringify(report, null, 2));
}

const counts = report.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ upload: SHOULD_UPLOAD, counts, outDir: OUT_DIR }, null, 2));
