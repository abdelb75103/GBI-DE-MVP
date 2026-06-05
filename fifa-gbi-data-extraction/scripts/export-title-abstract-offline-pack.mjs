#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const MAX_NOTE_CHARS = 500;
const DEFAULT_LIMIT = 2000;
const RESERVATION_KEY = 'titleAbstractOfflineReservation';
const SELECT_COLUMNS = [
  'id',
  'stage',
  'assigned_study_id',
  'title',
  'abstract',
  'lead_author',
  'journal',
  'year',
  'doi',
  'source_label',
  'source_record_id',
  'ai_status',
  'ai_suggested_decision',
  'ai_reason',
  'ai_evidence_quote',
  'ai_source_location',
  'ai_confidence',
  'ai_raw_response',
  'metadata',
  'created_at',
  'updated_at',
].join(',');

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

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

loadEnvFile(path.resolve(process.cwd(), 'fifa-gbi-data-extraction/.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before exporting an offline pack.');
}

const reviewerProfileId = String(args.get('reviewer-profile-id') || '').trim();
if (!reviewerProfileId) {
  throw new Error('Pass --reviewer-profile-id <profile-id>.');
}

const limit = Math.max(1, Number(args.get('limit') || DEFAULT_LIMIT));
const outputPath = path.resolve(String(args.get('output') || `title-abstract-offline-${new Date().toISOString().slice(0, 10)}.html`));
const manifestPath = path.resolve(String(args.get('manifest') || `${outputPath}.manifest.json`));
const apply = Boolean(args.get('apply'));
const dryRunHtml = Boolean(args.get('dry-run-html'));
const existingPackId = String(args.get('existing-pack-id') || '').trim();
const packId = String(existingPackId || args.get('pack-id') || `ta-offline-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`);
if (existingPackId && apply) {
  throw new Error('--existing-pack-id rebuilds an already reserved pack and does not accept --apply.');
}
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const metadataObject = (metadata) => metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};

const getDecisions = (metadata) => {
  const decisions = metadataObject(metadata).titleAbstractDecisions;
  return Array.isArray(decisions)
    ? decisions.filter((decision) =>
      decision &&
      typeof decision === 'object' &&
      decision.reviewerProfileId &&
      ['include', 'exclude', 'flag'].includes(decision.decision) &&
      decision.decidedAt
    ).slice(0, 3)
    : [];
};

const reviewerHasVoted = (metadata, profileId) =>
  getDecisions(metadata).some((decision) => decision.action !== 'resolver_decision' && decision.reviewerProfileId === profileId);

const hasAnyHumanVote = (metadata) =>
  getDecisions(metadata).some((decision) => decision.action !== 'resolver_decision');

const hasActiveReservation = (metadata) => {
  const reservation = metadataObject(metadata)[RESERVATION_KEY];
  return reservation && typeof reservation === 'object' && reservation.status === 'active';
};

const isCandidate = (record) => {
  const metadata = metadataObject(record.metadata);
  return record.stage === 'title_abstract' &&
    !metadata.titleAbstractPromotedRecordId &&
    !reviewerHasVoted(metadata, reviewerProfileId) &&
    !hasAnyHumanVote(metadata) &&
    !hasActiveReservation(metadata);
};

const mapPackRecord = (record) => ({
  recordId: record.id,
  studyId: record.assigned_study_id,
  title: record.title,
  abstract: record.abstract,
  leadAuthor: record.lead_author,
  journal: record.journal,
  year: record.year,
  doi: record.doi,
  sourceLabel: record.source_label,
  sourceRecordId: record.source_record_id,
  aiStatus: record.ai_status,
  aiSuggestedDecision: record.ai_suggested_decision,
  aiReason: record.ai_reason,
  aiEvidenceQuote: record.ai_evidence_quote,
  aiSourceLocation: record.ai_source_location,
  aiConfidence: record.ai_confidence,
  aiTargetTag: record.ai_raw_response?.targetTag === 'systematic_review' ? 'systematic_review' : null,
  sourceUpdatedAt: record.updated_at,
});

const htmlSafeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const buildHtml = (pack) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>GBI Offline Title/Abstract Pack</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100svh; background: #f8fafc; }
    header { position: sticky; top: 0; z-index: 2; padding: max(12px, env(safe-area-inset-top)) 14px 10px; background: rgba(248,250,252,.96); border-bottom: 1px solid #e2e8f0; backdrop-filter: blur(12px); }
    main { padding: 14px; max-width: 840px; margin: 0 auto; }
    h1 { margin: 0; font-size: 16px; }
    .meta, .small { color: #64748b; font-size: 12px; line-height: 1.35; }
    .bar { height: 8px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin-top: 10px; }
    .bar span { display: block; height: 100%; width: 0; background: #0b3a70; }
    .toolbar { display: flex; gap: 8px; margin-top: 10px; }
    button, select, textarea { font: inherit; }
    button { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 10px; padding: 10px 12px; font-weight: 700; }
    button.primary { background: #0b3a70; border-color: #0b3a70; color: white; }
    button.include { background: #047857; border-color: #047857; color: white; }
    button.exclude { background: #be123c; border-color: #be123c; color: white; }
    button.flag { background: #b45309; border-color: #b45309; color: white; }
    button:disabled { opacity: .45; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; box-shadow: 0 10px 30px rgba(15,23,42,.05); }
    .record-nav { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; margin-bottom: 10px; }
    .record-nav button:last-child { justify-self: end; }
    .badge { display: inline-flex; border-radius: 999px; padding: 4px 8px; background: #e0f2fe; color: #075985; font-size: 12px; font-weight: 800; }
    .title { font-size: 20px; font-weight: 800; line-height: 1.2; margin: 12px 0 8px; }
    .citation { color: #475569; font-size: 13px; line-height: 1.4; }
    .abstract { white-space: pre-wrap; line-height: 1.48; font-size: 15px; margin-top: 14px; }
    .ai { margin-top: 14px; padding: 10px; border-radius: 10px; background: #f1f5f9; color: #334155; font-size: 13px; line-height: 1.4; }
    .decision-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    textarea { width: 100%; min-height: 76px; margin-top: 10px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; resize: vertical; }
    .notice { margin-top: 10px; color: #be123c; font-size: 13px; font-weight: 700; }
    .warning { margin-top: 10px; border-radius: 10px; background: #fef3c7; color: #92400e; padding: 10px; font-size: 13px; font-weight: 800; }
    .export { margin-top: 16px; }
    .export textarea { min-height: 180px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    @media (max-width: 560px) {
      main { padding: 10px; }
      .decision-grid { grid-template-columns: 1fr; }
      .toolbar { display: grid; grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>GBI offline title/abstract screening</h1>
    <div class="meta" id="packMeta"></div>
    <div class="warning" id="packWarning" hidden></div>
    <div class="bar" aria-label="Progress"><span id="progressBar"></span></div>
  </header>
  <main>
    <section class="card">
      <div class="record-nav">
        <button id="prevBtn" type="button">Previous</button>
        <select id="recordSelect" aria-label="Record"></select>
        <button id="nextBtn" type="button">Next</button>
      </div>
      <div id="record"></div>
      <div class="decision-grid">
        <button class="include" type="button" data-decision="include">Include</button>
        <button class="exclude" type="button" data-decision="exclude">Exclude</button>
        <button class="flag" type="button" data-decision="flag">Flag</button>
      </div>
      <textarea id="note" maxlength="${MAX_NOTE_CHARS}" placeholder="Optional note. Required for Flag."></textarea>
      <div class="small"><span id="noteCount">0</span>/${MAX_NOTE_CHARS}</div>
      <div class="notice" id="notice"></div>
    </section>
    <section class="card export">
      <div class="toolbar">
        <button class="primary" id="exportBtn" type="button">Export decisions</button>
        <button id="copyBtn" type="button">Copy JSON</button>
        <button id="downloadBtn" type="button">Download JSON</button>
        <button id="clearBtn" type="button">Clear local progress</button>
      </div>
      <textarea id="exportJson" readonly placeholder="Your exported decisions JSON will appear here."></textarea>
      <p class="small">Keep this HTML file until decisions are imported. Progress is stored only in this browser on this phone.</p>
    </section>
  </main>
  <script>
    const PACK = ${htmlSafeJson(pack)};
    const storageKey = 'gbi-ta-offline:' + PACK.packId;
    const memoryStorage = new Map();
    let browserStorageAvailable = true;
    const storage = (() => {
      try {
        const testKey = storageKey + ':storage-test';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return localStorage;
      } catch {
        browserStorageAvailable = false;
        return {
          getItem: (key) => memoryStorage.has(key) ? memoryStorage.get(key) : null,
          setItem: (key, value) => memoryStorage.set(key, String(value)),
          removeItem: (key) => memoryStorage.delete(key),
        };
      }
    })();
    const parseStoredState = () => {
      try {
        return JSON.parse(storage.getItem(storageKey) || '{}');
      } catch {
        return {};
      }
    };
    let state = parseStoredState();
    let index = Number(storage.getItem(storageKey + ':index') || 0);
    const el = (id) => document.getElementById(id);
    const save = () => storage.setItem(storageKey, JSON.stringify(state));
    const selectedRecord = () => PACK.records[index] || PACK.records[0];
    const completedCount = () => Object.values(state).filter((item) => item && item.decision).length;
    const backupInterval = 25;
    function renderSelect() {
      el('recordSelect').innerHTML = PACK.records.map((record, i) => {
        const done = state[record.recordId]?.decision ? '✓ ' : '';
        return '<option value="' + i + '">' + done + record.studyId + '</option>';
      }).join('');
    }
    function render() {
      index = Math.min(Math.max(index, 0), PACK.records.length - 1);
      storage.setItem(storageKey + ':index', String(index));
      const record = selectedRecord();
      const decision = state[record.recordId] || {};
      el('packMeta').textContent = PACK.records.length + ' records · pack ' + PACK.packId + ' · ' + completedCount() + ' decided · ' + (PACK.reserved ? 'reserved' : 'not reserved');
      if (!PACK.reserved) {
        el('packWarning').hidden = false;
        el('packWarning').textContent = 'DRY RUN ONLY - this file is not reserved and decisions from it cannot be imported.';
      } else if (!browserStorageAvailable) {
        el('packWarning').hidden = false;
        el('packWarning').textContent = 'Browser storage is unavailable for this file. Decisions work in this open page, but export JSON backups before leaving or reloading it.';
      }
      el('progressBar').style.width = PACK.records.length ? Math.round((completedCount() / PACK.records.length) * 100) + '%' : '0%';
      renderSelect();
      el('recordSelect').value = String(index);
      el('prevBtn').disabled = index === 0;
      el('nextBtn').disabled = index >= PACK.records.length - 1;
      el('note').value = decision.note || '';
      el('noteCount').textContent = String(el('note').value.length);
      el('notice').textContent = decision.decision ? 'Saved: ' + decision.decision : '';
      el('record').innerHTML = '<span class="badge">' + record.studyId + '</span>' +
        '<div class="title"></div>' +
        '<div class="citation"></div>' +
        '<div class="abstract"></div>' +
        '<div class="ai"></div>';
      el('record').querySelector('.title').textContent = record.title || 'Untitled';
      el('record').querySelector('.citation').textContent = [record.leadAuthor, record.year, record.journal, record.doi].filter(Boolean).join(' · ') || 'No citation metadata';
      el('record').querySelector('.abstract').textContent = record.abstract || 'No abstract imported.';
      el('record').querySelector('.ai').textContent = 'AI: ' + (record.aiSuggestedDecision || record.aiStatus || 'not run') + (record.aiReason ? ' — ' + record.aiReason : '');
      document.querySelectorAll('[data-decision]').forEach((button) => { button.disabled = !PACK.reserved; });
    }
    function setDecision(decision) {
      const record = selectedRecord();
      const note = el('note').value.trim();
      if (decision === 'flag' && !note) {
        el('notice').textContent = 'Add a note before flagging.';
        return;
      }
      state[record.recordId] = {
        recordId: record.recordId,
        studyId: record.studyId,
        decision,
        note,
        sourceUpdatedAt: record.sourceUpdatedAt,
        decidedAt: new Date().toISOString()
      };
      save();
      refreshExport();
      const shouldRemindBackup = completedCount() > 0 && completedCount() % backupInterval === 0;
      const shouldAdvance = index < PACK.records.length - 1;
      if (index < PACK.records.length - 1) index += 1;
      render();
      if (shouldAdvance) {
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      }
      if (shouldRemindBackup) {
        el('notice').textContent = 'Backup reminder: tap Download JSON or Copy JSON before continuing.';
      }
    }
    function exportPayload() {
      return {
        schemaVersion: 1,
        packId: PACK.packId,
        exportedAt: PACK.exportedAt,
        reviewerProfileId: PACK.reviewerProfileId,
        decisions: PACK.records.map((record) => state[record.recordId]).filter(Boolean)
      };
    }
    function refreshExport() {
      el('exportJson').value = JSON.stringify(exportPayload(), null, 2);
    }
    document.querySelectorAll('[data-decision]').forEach((button) => button.addEventListener('click', () => setDecision(button.dataset.decision)));
    el('note').addEventListener('input', () => {
      const record = selectedRecord();
      if (state[record.recordId]?.decision) {
        state[record.recordId].note = el('note').value.trim();
        save();
      }
      el('noteCount').textContent = String(el('note').value.length);
    });
    el('recordSelect').addEventListener('change', (event) => { index = Number(event.target.value); render(); });
    el('prevBtn').addEventListener('click', () => { index -= 1; render(); });
    el('nextBtn').addEventListener('click', () => { index += 1; render(); });
    el('exportBtn').addEventListener('click', refreshExport);
    el('copyBtn').addEventListener('click', async () => {
      refreshExport();
      try {
        await navigator.clipboard.writeText(el('exportJson').value);
      } catch {
        el('exportJson').focus();
        el('exportJson').select();
        document.execCommand('copy');
      }
    });
    el('downloadBtn').addEventListener('click', () => {
      refreshExport();
      const blob = new Blob([el('exportJson').value + '\\n'], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = PACK.packId + '-decisions.json';
      link.click();
      URL.revokeObjectURL(link.href);
    });
    el('clearBtn').addEventListener('click', () => {
      if (prompt('Type DELETE to clear all local progress for this pack on this device.') !== 'DELETE') return;
      state = {};
      save();
      render();
      refreshExport();
    });
    render();
  </script>
</body>
</html>
`;

const loadReviewer = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', reviewerProfileId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load reviewer profile: ${error.message}`);
  if (!data) throw new Error(`Reviewer profile not found: ${reviewerProfileId}`);
  return data;
};

const fetchCandidates = async () => {
  const selected = [];
  const pageSize = 1000;
  for (let from = 0; selected.length < limit; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select(SELECT_COLUMNS)
      .eq('stage', 'title_abstract')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to load title/abstract records: ${error.message}`);
    for (const record of data ?? []) {
      if (isCandidate(record)) selected.push(record);
      if (selected.length >= limit) break;
    }
    if (!data || data.length < pageSize) break;
  }
  return selected;
};

const fetchExistingPackRecords = async () => {
  const selected = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select(SELECT_COLUMNS)
      .eq('stage', 'title_abstract')
      .eq('metadata->titleAbstractOfflineReservation->>packId', existingPackId)
      .eq('metadata->titleAbstractOfflineReservation->>reviewerProfileId', reviewerProfileId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load existing offline pack ${existingPackId}: ${error.message}`);
    selected.push(...(data ?? []).filter((record) => metadataObject(record.metadata)[RESERVATION_KEY]?.status === 'active'));
    if (!data || data.length < pageSize) break;
  }

  return selected;
};

const writeManifest = async (content) => {
  await fs.writeFile(manifestPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
};

const reserveRecords = async (records, reviewer) => {
  if (!apply) return { reserved: records, skipped: [] };
  const reservedAt = new Date().toISOString();
  const reserved = [];
  const skipped = [];

  await writeManifest({
    packId,
    reviewerProfileId,
    reviewerName: reviewer.full_name ?? null,
    reservedAt,
    status: 'selected',
    selected: records.map((record) => ({
      recordId: record.id,
      studyId: record.assigned_study_id,
      sourceUpdatedAt: record.updated_at,
    })),
  });

  for (const record of records) {
    const metadata = {
      ...metadataObject(record.metadata),
      [RESERVATION_KEY]: {
        packId,
        reviewerProfileId,
        reviewerName: reviewer.full_name ?? null,
        reservedAt,
        status: 'active',
      },
    };
    const { data, error } = await supabase
      .from('screening_records')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', record.id)
      .eq('updated_at', record.updated_at)
      .select(SELECT_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Failed to reserve ${record.assigned_study_id}: ${error.message}`);
    if (!data) {
      skipped.push({
        recordId: record.id,
        studyId: record.assigned_study_id,
        reason: 'Record changed before reservation could be written.',
      });
      continue;
    }
    reserved.push(data);
  }

  await writeManifest({
    packId,
    reviewerProfileId,
    reviewerName: reviewer.full_name ?? null,
    reservedAt,
    status: 'reserved',
    outputPath,
    reserved: reserved.map((record) => ({
      recordId: record.id,
      studyId: record.assigned_study_id,
      sourceUpdatedAt: record.updated_at,
    })),
    skipped,
  });

  return { reserved, skipped };
};

const reviewer = await loadReviewer();
if (existingPackId) {
  const existingRecords = await fetchExistingPackRecords();
  if (existingRecords.length === 0) {
    throw new Error(`No active records found for existing offline pack ${existingPackId}.`);
  }

  const pack = {
    schemaVersion: 1,
    packId,
    exportedAt: new Date().toISOString(),
    reviewerProfileId,
    reviewerName: reviewer.full_name ?? '',
    reserved: true,
    records: existingRecords.map(mapPackRecord),
  };

  await fs.writeFile(outputPath, buildHtml(pack), 'utf8');
  console.log(`Rebuilt existing reserved pack HTML with ${pack.records.length} records.`);
  console.log(`Pack ID: ${packId}`);
  console.log(`HTML: ${outputPath}`);
  console.log('No database changes were made.');
  process.exit(0);
}

const candidates = await fetchCandidates();
if (candidates.length === 0) {
  throw new Error('No eligible title/abstract records found for offline reservation.');
}
if (candidates.length < limit) {
  console.warn(`Only ${candidates.length} eligible records found for requested limit ${limit}.`);
}

if (!apply && !dryRunHtml) {
  console.log(`Dry-run found ${candidates.length} eligible records for requested limit ${limit}.`);
  console.log('No HTML pack was written because records were not reserved.');
  console.log('Re-run with --apply to reserve records and write a usable phone pack.');
  console.log('Use --dry-run-html only for local UI testing; that file will be marked unusable.');
  process.exit(0);
}

const { reserved: finalRecords, skipped } = await reserveRecords(candidates, reviewer);
if (apply && finalRecords.length === 0) {
  throw new Error(`No records were reserved. See manifest for selected records: ${manifestPath}`);
}

const pack = {
  schemaVersion: 1,
  packId,
  exportedAt: new Date().toISOString(),
  reviewerProfileId,
  reviewerName: reviewer.full_name ?? '',
  reserved: apply,
  records: finalRecords.map(mapPackRecord),
};

await fs.writeFile(outputPath, buildHtml(pack), 'utf8');

console.log(`${apply ? 'Reserved and exported' : 'Dry-run HTML exported'} ${pack.records.length} records.`);
console.log(`Pack ID: ${packId}`);
console.log(`HTML: ${outputPath}`);
if (apply) {
  console.log(`Manifest: ${manifestPath}`);
  if (skipped.length > 0) {
    console.log(`Skipped during reservation: ${skipped.length}`);
  }
} else {
  console.log('No database changes were made. This dry-run HTML is marked unusable for import.');
}
