import { NextRequest, NextResponse } from 'next/server';

import { readActiveProfileSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabase/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NOTE_CHARS = 500;
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
  'updated_at',
].join(',');

type Row = {
  id: string;
  stage: string | null;
  assigned_study_id: string | null;
  title: string | null;
  abstract: string | null;
  lead_author: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  source_label: string | null;
  source_record_id: string | null;
  ai_status: string | null;
  ai_suggested_decision: string | null;
  ai_reason: string | null;
  ai_evidence_quote: string | null;
  ai_source_location: string | null;
  ai_confidence: number | null;
  ai_raw_response: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
};

const metadataObject = (metadata: unknown): Record<string, unknown> =>
  metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};

const htmlSafeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

const mapPackRecord = (record: Row) => ({
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

const buildHtml = (pack: unknown) => `<!doctype html>
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
  <noscript><div class="warning">This offline screening page needs JavaScript. If you see this, the file/page is being previewed instead of opened in a browser.</div></noscript>
  <header>
    <h1>GBI offline title/abstract screening</h1>
    <div class="meta" id="packMeta"></div>
    <div class="meta" id="cacheStatus">Checking offline cache...</div>
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
      <p class="small">Keep this page or the exported JSON until decisions are imported. Progress is stored only in this browser on this phone.</p>
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
    async function cacheForOffline() {
      const cacheStatus = el('cacheStatus');
      if (!location.protocol.startsWith('http') || !('serviceWorker' in navigator) || !('caches' in window)) {
        cacheStatus.textContent = 'Offline cache: keep this page open and export JSON backups.';
        return;
      }
      try {
        await navigator.serviceWorker.register('/title-abstract-offline-sw.js');
        await navigator.serviceWorker.ready;
        const cache = await caches.open('gbi-title-abstract-offline-v1');
        await cache.put(location.href, new Response('<!doctype html>\\n' + document.documentElement.outerHTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }));
        cacheStatus.textContent = 'Offline reload ready on this device.';
      } catch {
        cacheStatus.textContent = 'Offline cache failed. Keep this page open and export JSON backups.';
      }
    }
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
      if (!record) {
        el('packWarning').hidden = false;
        el('packWarning').textContent = 'No records were loaded into this pack.';
        return;
      }
      const decision = state[record.recordId] || {};
      el('packMeta').textContent = PACK.records.length + ' records · pack ' + PACK.packId + ' · ' + completedCount() + ' decided · reserved';
      if (!browserStorageAvailable) {
        el('packWarning').hidden = false;
        el('packWarning').textContent = 'Browser storage is unavailable. Decisions work in this open page, but export JSON backups before leaving or reloading it.';
      }
      el('progressBar').style.width = PACK.records.length ? Math.round((completedCount() / PACK.records.length) * 100) + '%' : '0%';
      renderSelect();
      el('recordSelect').value = String(index);
      el('prevBtn').disabled = index === 0;
      el('nextBtn').disabled = index >= PACK.records.length - 1;
      el('note').value = decision.note || '';
      el('noteCount').textContent = String(el('note').value.length);
      el('notice').textContent = decision.decision ? 'Saved: ' + decision.decision : '';
      el('record').innerHTML = '<span class="badge">' + (record.studyId || record.recordId) + '</span>' +
        '<div class="title"></div>' +
        '<div class="citation"></div>' +
        '<div class="abstract"></div>' +
        '<div class="ai"></div>';
      el('record').querySelector('.title').textContent = record.title || 'Untitled';
      el('record').querySelector('.citation').textContent = [record.leadAuthor, record.year, record.journal, record.doi].filter(Boolean).join(' · ') || 'No citation metadata';
      el('record').querySelector('.abstract').textContent = record.abstract || 'No abstract imported.';
      el('record').querySelector('.ai').textContent = 'AI: ' + (record.aiSuggestedDecision || record.aiStatus || 'not run') + (record.aiReason ? ' - ' + record.aiReason : '');
      document.querySelectorAll('[data-decision]').forEach((button) => { button.disabled = false; });
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
      if (index < PACK.records.length - 1) index += 1;
      render();
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
    cacheForOffline();
  </script>
</body>
</html>`;

const getPackId = (request: NextRequest) => {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  const index = parts.findIndex((part) => part === 'title-abstract-offline');
  return index >= 0 ? decodeURIComponent(parts[index + 1] ?? '') : '';
};

const fetchPackRows = async (packId: string, reviewerProfileId: string) => {
  const supabase = createSupabaseServerClient(undefined, { useServiceRole: true });
  const rows: Row[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('screening_records')
      .select(SELECT_COLUMNS)
      .eq('stage', 'title_abstract')
      .eq('metadata->titleAbstractOfflineReservation->>packId', packId)
      .eq('metadata->titleAbstractOfflineReservation->>reviewerProfileId', reviewerProfileId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load offline pack: ${error.message}`);
    }

    const pageRows = (data ?? []) as unknown as Row[];
    rows.push(...pageRows.filter((record) => {
      const reservation = metadataObject(record.metadata)[RESERVATION_KEY];
      const reservationObject = metadataObject(reservation);
      return reservationObject.status === 'active';
    }));

    if (!data || data.length < pageSize) break;
  }

  return rows;
};

export async function GET(request: NextRequest) {
  const packId = getPackId(request);
  if (!packId) {
    return NextResponse.json({ error: 'Pack id is required.' }, { status: 400 });
  }

  const profile = await readActiveProfileSession();
  if (!profile) {
    const redirectTo = new URL('/profiles/select', request.url);
    redirectTo.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectTo);
  }

  const rows = await fetchPackRows(packId, profile.id);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No active offline records found for this pack and profile.' }, { status: 404 });
  }

  const html = buildHtml({
    schemaVersion: 1,
    packId,
    exportedAt: new Date().toISOString(),
    reviewerProfileId: profile.id,
    reviewerName: profile.fullName,
    reserved: true,
    records: rows.map(mapPackRecord),
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
