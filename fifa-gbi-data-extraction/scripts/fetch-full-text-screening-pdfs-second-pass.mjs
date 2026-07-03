#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const args = process.argv.slice(2);
const outDirArg = args.find((arg) => arg.startsWith('--out-dir='));
const OUT_DIR = outDirArg
  ? path.resolve(outDirArg.split('=')[1])
  : path.join(ROOT, 'data', 'full-text-pdf-retrieval', 'awaiting-pdf-second-pass-2026-06-23');
const FILES_DIR = path.join(OUT_DIR, 'files');
const MAX_FILE_BYTES = 35 * 1024 * 1024;
const AWAITING_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');

const SHOULD_UPLOAD = args.includes('--upload');
const LIMIT = Number.parseInt((args.find((arg) => arg.startsWith('--limit=')) ?? '').split('=')[1] ?? '', 10);
const ONLY_STUDY_IDS = new Set(
  args
    .filter((arg) => arg.startsWith('--only-study-id='))
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

const compact = (value) => normalize(value).replace(/\s+/g, '');
const doiCompact = (value) => compact(String(value ?? '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''));
const safeName = (value) => normalize(value).replace(/\s+/g, '-').slice(0, 110) || 'full-text';
const doiPath = (doi) => encodeURIComponent(String(doi ?? '').trim());

const tokenSet = (value) => {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'based', 'study', 'studies', 'systematic',
    'review', 'meta', 'analysis', 'football', 'soccer', 'players', 'player', 'injury',
    'injuries', 'risk', 'incidence', 'prevalence', 'relationship', 'association', 'effect',
    'effects', 'impact', 'characteristics', 'epidemiology', 'professional', 'youth',
    'male', 'female', 'elite', 'prospective', 'cohort', 'among', 'using',
  ]);
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !stop.has(token)));
};

const tokenCoverage = (target, text) => {
  const targetTokens = tokenSet(target);
  const textTokens = tokenSet(text);
  let hits = 0;
  for (const token of targetTokens) if (textTokens.has(token)) hits += 1;
  return hits / Math.max(1, targetTokens.size);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const htmlDecode = (value) => String(value ?? '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const fetchBuffer = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'Accept': 'text/html,application/pdf,application/xhtml+xml,*/*',
        'User-Agent': 'FIFA-GBI-full-text-retrieval/2.0 (open-access PDF lookup; contact: systematic-review-team)',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      finalUrl: response.url,
      buffer,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJson = async (url) => {
  const result = await fetchBuffer(url, { headers: { Accept: 'application/json' }, timeoutMs: 25000 });
  if (!result.ok) return null;
  return JSON.parse(result.buffer.toString('utf8'));
};

const isPdfBuffer = (buffer) => buffer.subarray(0, 2048).includes(Buffer.from('%PDF'));

const extractPdfText = (buffer, label) => {
  const filePath = path.join(OUT_DIR, `.text-${label}.pdf`);
  fs.writeFileSync(filePath, buffer);
  const result = spawnSync('pdftotext', ['-f', '1', '-l', '8', '-layout', filePath, '-'], {
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 2_000_000,
  });
  fs.rmSync(filePath, { force: true });
  return result.status === 0 ? result.stdout : '';
};

const addCandidate = (items, seen, url, source) => {
  if (!url) return;
  try {
    const normalizedUrl = new URL(String(url).replace(/&amp;/g, '&')).toString();
    if (seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    items.push({ url: normalizedUrl, source });
  } catch {
    // Ignore malformed source URLs.
  }
};

const pdfUrlsFromHtml = (html, baseUrl) => {
  const urls = [];
  const seen = new Set();
  const add = (raw, source) => {
    try {
      const url = new URL(raw.replace(/&amp;/g, '&'), baseUrl).toString();
      if (!seen.has(url)) {
        seen.add(url);
        urls.push({ url, source });
      }
    } catch {
      // Ignore malformed HTML URLs.
    }
  };

  const metaPatterns = [
    /<meta[^>]+name=["']citation_pdf_url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']citation_pdf_url["']/gi,
    /<meta[^>]+property=["']og:pdf["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:pdf["']/gi,
  ];
  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) add(match[1], 'html-meta-pdf');
  }

  const linkPattern = /<(a|link|iframe|embed|object)[^>]+(?:href|src|data)=["']([^"']+)["'][^>]*>(?:([\s\S]*?)<\/a>)?/gi;
  for (const match of html.matchAll(linkPattern)) {
    const rawUrl = match[2];
    const tag = match[0].toLowerCase();
    const text = normalize(match[3] ?? tag);
    const looksPdf = /\.pdf(?:[?#]|$)/i.test(rawUrl)
      || /\/pdf(?:[/?#]|$)/i.test(rawUrl)
      || /download.*pdf|pdf.*download|citation_pdf_url|article-pdf|full-pdf/i.test(rawUrl)
      || text === 'pdf'
      || text.includes('download pdf')
      || text.includes('view pdf')
      || text.includes('full text pdf');
    if (looksPdf) add(rawUrl, 'html-link-pdf');
  }

  return urls;
};

const pubmedCandidates = async (record) => {
  const items = [];
  const seen = new Set();
  if (record.doi) {
    const idconv = await fetchJson(`https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${doiPath(record.doi)}&format=json`).catch(() => null);
    for (const item of idconv?.records ?? []) {
      if (item.pmcid) addCandidate(items, seen, `https://pmc.ncbi.nlm.nih.gov/articles/${item.pmcid}/pdf/`, 'ncbi-idconv-pmc');
      if (item.pmid) {
        const links = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pmc&id=${encodeURIComponent(item.pmid)}&retmode=json`).catch(() => null);
        const linksets = links?.linksets?.[0]?.linksetdbs ?? [];
        for (const linkset of linksets) {
          for (const id of linkset.links ?? []) addCandidate(items, seen, `https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/pdf/`, 'pubmed-elink-pmc');
        }
      }
    }
  }

  const searches = [];
  if (record.doi) searches.push(`${record.doi}[DOI]`);
  if (record.title) searches.push(`"${record.title.replace(/"/g, '')}"`);
  for (const term of searches) {
    const result = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&retmode=json&retmax=5&term=${encodeURIComponent(term)}`).catch(() => null);
    for (const id of result?.esearchresult?.idlist ?? []) addCandidate(items, seen, `https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/pdf/`, 'pmc-esearch');
  }
  return items;
};

const europePmcCandidates = async (record) => {
  const items = [];
  const seen = new Set();
  const queries = [];
  if (record.doi) queries.push(`DOI:"${record.doi}"`);
  if (record.title) queries.push(`TITLE:"${record.title.replace(/"/g, '')}"`);
  for (const query of queries) {
    const payload = await fetchJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=3`).catch(() => null);
    for (const result of payload?.resultList?.result ?? []) {
      if (result.pmcid) {
        addCandidate(items, seen, `https://www.ncbi.nlm.nih.gov/pmc/articles/${result.pmcid}/pdf/`, 'europepmc-pmcid');
        addCandidate(items, seen, `https://europepmc.org/api/getPdf?pmcid=${result.pmcid}`, 'europepmc-getpdf');
      }
      for (const item of result.fullTextUrlList?.fullTextUrl ?? []) addCandidate(items, seen, item.url, 'europepmc-fulltext-url');
    }
  }
  return items;
};

const openAlexCandidates = async (record) => {
  if (!record.doi) return [];
  const work = await fetchJson(`https://api.openalex.org/works/doi:${doiPath(record.doi)}`).catch(() => null);
  const items = [];
  const seen = new Set();
  for (const location of [work?.primary_location, work?.best_oa_location, ...(work?.locations ?? [])].filter(Boolean)) {
    addCandidate(items, seen, location.pdf_url, 'openalex-pdf');
    addCandidate(items, seen, location.landing_page_url, 'openalex-landing');
  }
  addCandidate(items, seen, work?.open_access?.oa_url, 'openalex-oa-url');
  return items;
};

const crossrefCandidates = async (record) => {
  if (!record.doi) return [];
  const work = await fetchJson(`https://api.crossref.org/works/${doiPath(record.doi)}`).catch(() => null);
  const message = work?.message;
  const items = [];
  const seen = new Set();
  addCandidate(items, seen, message?.URL, 'crossref-url');
  addCandidate(items, seen, message?.resource?.primary?.URL, 'crossref-primary-url');
  for (const link of message?.link ?? []) {
    if (/pdf/i.test(`${link['content-type'] ?? ''} ${link.URL ?? ''}`)) addCandidate(items, seen, link.URL, 'crossref-pdf-link');
  }
  return items;
};

const semanticScholarCandidates = async (record) => {
  if (!record.doi) return [];
  const payload = await fetchJson(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doiPath(record.doi)}?fields=title,openAccessPdf,url,externalIds`).catch(() => null);
  const items = [];
  const seen = new Set();
  addCandidate(items, seen, payload?.openAccessPdf?.url, 'semantic-scholar-open-pdf');
  addCandidate(items, seen, payload?.url, 'semantic-scholar-url');
  return items;
};

const unpaywallCandidates = async (record) => {
  if (!record.doi) return [];
  const payload = await fetchJson(`https://api.unpaywall.org/v2/${doiPath(record.doi)}?email=systematic-review-team@example.com`).catch(() => null);
  const items = [];
  const seen = new Set();
  addCandidate(items, seen, payload?.best_oa_location?.url_for_pdf, 'unpaywall-best-pdf');
  addCandidate(items, seen, payload?.best_oa_location?.url, 'unpaywall-best-url');
  for (const location of payload?.oa_locations ?? []) {
    addCandidate(items, seen, location.url_for_pdf, 'unpaywall-location-pdf');
    addCandidate(items, seen, location.url, 'unpaywall-location-url');
  }
  return items;
};

const titleDoiCandidates = async (record) => {
  if (record.doi || !record.title) return [];
  const payload = await fetchJson(`https://api.crossref.org/works?rows=3&query.title=${encodeURIComponent(record.title)}`).catch(() => null);
  const items = [];
  const seen = new Set();
  for (const item of payload?.message?.items ?? []) {
    const candidateTitle = item.title?.[0] ?? '';
    if (tokenCoverage(record.title, candidateTitle) < 0.85) continue;
    addCandidate(items, seen, item.URL, 'crossref-title-url');
    if (item.DOI) {
      addCandidate(items, seen, `https://doi.org/${item.DOI}`, 'crossref-title-doi');
      for (const candidate of publisherPatternCandidates({ ...record, doi: item.DOI })) {
        addCandidate(items, seen, candidate.url, `crossref-title-${candidate.source}`);
      }
    }
  }
  return items;
};

const duckDuckGoCandidates = async (record) => {
  const queries = [
    record.doi && `"${record.doi}" pdf`,
    record.title && `"${record.title.replace(/"/g, '')}" pdf`,
    record.title && `"${record.title.replace(/"/g, '')}" filetype:pdf`,
    record.title && `"${record.title.replace(/"/g, '')}" "accepted manuscript"`,
    record.title && `"${record.title.replace(/"/g, '')}" repository`,
  ].filter(Boolean);
  const items = [];
  const seen = new Set();
  for (const query of queries) {
    const result = await fetchBuffer(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      timeoutMs: 25000,
      headers: { Accept: 'text/html,*/*', 'User-Agent': 'Mozilla/5.0 open-access systematic-review PDF lookup' },
    }).catch(() => null);
    if (!result?.ok) continue;
    const html = result.buffer.toString('utf8');
    for (const match of html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["']/gi)) {
      let raw = htmlDecode(match[1]);
      try {
        const url = new URL(raw, 'https://duckduckgo.com');
        if (url.pathname === '/l/' && url.searchParams.get('uddg')) raw = url.searchParams.get('uddg');
      } catch {
        // Keep raw URL; addCandidate will drop malformed values.
      }
      addCandidate(items, seen, raw, 'duckduckgo-result');
      if (items.length >= 12) break;
    }
    await sleep(500);
  }
  return items;
};

const publisherPatternCandidates = (record) => {
  const doi = String(record.doi ?? '').trim();
  if (!doi) return [];
  const lower = doi.toLowerCase();
  const items = [];
  const seen = new Set();
  addCandidate(items, seen, `https://doi.org/${doi}`, 'doi-resolver');
  if (lower.startsWith('10.1177/')) {
    addCandidate(items, seen, `https://journals.sagepub.com/doi/pdf/${doi}`, 'sage-pdf-pattern');
    addCandidate(items, seen, `https://journals.sagepub.com/doi/epdf/${doi}`, 'sage-epdf-pattern');
  }
  if (lower.startsWith('10.1080/')) addCandidate(items, seen, `https://www.tandfonline.com/doi/pdf/${doi}`, 'taylor-francis-pdf-pattern');
  if (lower.startsWith('10.1002/')) {
    addCandidate(items, seen, `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, 'wiley-pdfdirect-pattern');
    addCandidate(items, seen, `https://onlinelibrary.wiley.com/doi/pdf/${doi}`, 'wiley-pdf-pattern');
  }
  if (lower.startsWith('10.1136/')) addCandidate(items, seen, `https://bjsm.bmj.com/content/${doi.split('/').at(-1)}.full.pdf`, 'bmj-full-pdf-pattern');
  if (lower.startsWith('10.1371/')) addCandidate(items, seen, `https://journals.plos.org/plosone/article/file?id=${encodeURIComponent(doi)}&type=printable`, 'plos-printable-pattern');
  if (lower.startsWith('10.3389/')) addCandidate(items, seen, `https://www.frontiersin.org/articles/${doi}/pdf`, 'frontiers-pdf-pattern');
  if (lower.startsWith('10.3390/')) addCandidate(items, seen, `https://www.mdpi.com/search?q=${encodeURIComponent(doi)}`, 'mdpi-search');
  if (lower.startsWith('10.7759/')) addCandidate(items, seen, `https://www.cureus.com/articles/${doi.split('.').at(-1)}.pdf`, 'cureus-pdf-pattern');
  if (lower.startsWith('10.52965/001c.')) addCandidate(items, seen, `https://journalofsportsmedicine.org/article/${doi.split('.').at(-1)}/pdf`, 'scholastica-pdf-pattern');
  return items;
};

const candidateUrls = async (record) => {
  const items = [];
  const seen = new Set();
  for (const sourceItems of [
    publisherPatternCandidates(record),
    await pubmedCandidates(record).catch(() => []),
    await europePmcCandidates(record).catch(() => []),
    await unpaywallCandidates(record).catch(() => []),
    await openAlexCandidates(record).catch(() => []),
    await crossrefCandidates(record).catch(() => []),
    await semanticScholarCandidates(record).catch(() => []),
    await titleDoiCandidates(record).catch(() => []),
    await duckDuckGoCandidates(record).catch(() => []),
  ]) {
    for (const item of sourceItems) addCandidate(items, seen, item.url, item.source);
  }
  return items;
};

const downloadCandidate = async (candidate, depth = 0) => {
  const result = await fetchBuffer(candidate.url).catch((error) => ({ error }));
  if (result.error || !result.ok) return { status: result.status ?? 'fetch_error', finalUrl: candidate.url };
  if (result.buffer.length > MAX_FILE_BYTES || result.buffer.length < 1000) {
    return { status: 'bad_size', finalUrl: result.finalUrl, size: result.buffer.length };
  }
  if (isPdfBuffer(result.buffer) || result.contentType.toLowerCase().includes('pdf')) {
    return { status: 'pdf', finalUrl: result.finalUrl, buffer: result.buffer, contentType: result.contentType };
  }
  if (depth >= 2) return { status: 'html_no_pdf', finalUrl: result.finalUrl };
  const html = result.buffer.toString('utf8');
  if (!/html|<!doctype|<html|<meta|<a\s/i.test(`${result.contentType}\n${html.slice(0, 500)}`)) {
    return { status: 'not_pdf_or_html', finalUrl: result.finalUrl, contentType: result.contentType };
  }
  for (const nested of pdfUrlsFromHtml(html, result.finalUrl).slice(0, 12)) {
    const nestedResult = await downloadCandidate(nested, depth + 1).catch(() => null);
    if (nestedResult?.status === 'pdf') return nestedResult;
  }
  return { status: 'html_no_pdf', finalUrl: result.finalUrl };
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
    record.metadata?.titleAbstractRecordId
    && (record.metadata?.awaitingFullTextPdf === true
      || (!record.storage_object_path && record.data_base64 === AWAITING_SENTINEL)),
  );
};

const listExistingHashes = async () => {
  const hashes = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('screening_records')
      .select('file_sha256')
      .eq('stage', 'full_text')
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) if (row.file_sha256) hashes.add(row.file_sha256);
    if (!data || data.length < 1000) break;
  }
  const { data, error } = await supabase.from('papers').select('primary_file_sha256');
  if (error) throw error;
  for (const row of data ?? []) if (row.primary_file_sha256) hashes.add(row.primary_file_sha256);
  return hashes;
};

const uploadPdf = async (record, buffer, fileName, sha256, sourceUrl) => {
  const fileId = crypto.randomUUID();
  const objectPath = `${fileId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const { error: uploadError } = await supabase.storage.from('papers').upload(objectPath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const now = new Date().toISOString();
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
      file_sha256: sha256,
      metadata: {
        ...(record.metadata ?? {}),
        awaitingFullTextPdf: false,
        fullTextPdfAttachedAt: now,
        fullTextPdfAttachedBy: 'script:fetch-full-text-screening-pdfs-second-pass',
        fullTextPdfSourceUrl: sourceUrl,
      },
      updated_at: now,
    })
    .eq('id', record.id);
  if (updateError) throw updateError;
  return objectPath;
};

const verifyUpload = async (record, sha256) => {
  const { data, error } = await supabase
    .from('screening_records')
    .select('storage_object_path,file_sha256,metadata')
    .eq('id', record.id)
    .single();
  if (error) throw error;
  return data?.storage_object_path && data.file_sha256 === sha256 && data.metadata?.awaitingFullTextPdf === false;
};

fs.mkdirSync(FILES_DIR, { recursive: true });
const records = (await listAwaitingRecords())
  .filter((record) => ONLY_STUDY_IDS.size === 0 || ONLY_STUDY_IDS.has(record.assigned_study_id))
  .slice(0, Number.isFinite(LIMIT) ? LIMIT : Number.POSITIVE_INFINITY);
const existingHashes = await listExistingHashes();
const report = [];

for (const [index, record] of records.entries()) {
  const entry = {
    studyId: record.assigned_study_id,
    recordId: record.id,
    title: record.title,
    doi: record.doi,
    status: 'not_found',
    tried: [],
    rejected: [],
  };
  console.error(`[${index + 1}/${records.length}] ${record.assigned_study_id} ${record.doi || ''}`);
  const candidates = await candidateUrls(record);
  for (const candidate of candidates) {
    await sleep(150);
    const tried = { source: candidate.source, url: candidate.url };
    const downloaded = await downloadCandidate(candidate).catch((error) => ({ status: 'error', error: String(error) }));
    tried.result = downloaded.status;
    if (downloaded.finalUrl) tried.finalUrl = downloaded.finalUrl;
    entry.tried.push(tried);
    if (downloaded.status !== 'pdf' || !isPdfBuffer(downloaded.buffer)) continue;

    const sha256 = crypto.createHash('sha256').update(downloaded.buffer).digest('hex');
    if (existingHashes.has(sha256)) {
      entry.rejected.push({ url: downloaded.finalUrl, reason: 'duplicate_hash', sha256 });
      continue;
    }

    const text = extractPdfText(downloaded.buffer, `${record.assigned_study_id}-${sha256.slice(0, 10)}`);
    const normalizedText = normalize(text);
    const doiMatch = record.doi ? compact(normalizedText).includes(doiCompact(record.doi)) : false;
    const exactTitleMatch = normalize(record.title).length >= 24 && normalizedText.includes(normalize(record.title));
    const coverage = tokenCoverage(record.title, text);
    const valid = doiMatch || exactTitleMatch || coverage >= 0.72;
    if (!valid) {
      entry.rejected.push({ url: downloaded.finalUrl, reason: 'weak_text_match', coverage, doiMatch, exactTitleMatch, sha256 });
      continue;
    }

    const fileName = `${record.assigned_study_id}-${safeName(record.title)}.pdf`;
    const localPath = path.join(FILES_DIR, fileName);
    fs.writeFileSync(localPath, downloaded.buffer);
    entry.status = SHOULD_UPLOAD ? 'uploaded' : 'found';
    entry.sourceUrl = downloaded.finalUrl;
    entry.fileName = fileName;
    entry.localPath = localPath;
    entry.size = downloaded.buffer.length;
    entry.sha256 = sha256;
    entry.validation = { doiMatch, exactTitleMatch, titleTokenCoverage: coverage };
    if (SHOULD_UPLOAD) {
      entry.objectPath = await uploadPdf(record, downloaded.buffer, fileName, sha256, downloaded.finalUrl);
      entry.verified = await verifyUpload(record, sha256);
      entry.status = entry.verified ? 'uploaded_verified' : 'uploaded_unverified';
      existingHashes.add(sha256);
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
console.log(JSON.stringify({ upload: SHOULD_UPLOAD, scanned: records.length, counts, outDir: OUT_DIR, filesDir: FILES_DIR }, null, 2));
