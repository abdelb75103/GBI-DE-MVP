import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFLINE_REVIEWER_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const OFFLINE_REVIEWER_NAME = 'AbdelRahman Babiker';
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
    body { margin: 0; min-height: 100svh; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 48%, #f8fafc 100%); }
    .appbar { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 76px; padding: max(10px, env(safe-area-inset-top)) 20px 12px; border-bottom: 1px solid #e2e8f0; background: rgba(255,255,255,.98); backdrop-filter: blur(12px); }
    .brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
    .brand img { width: 48px; height: 48px; object-fit: contain; }
    .brand-title { color: #0f172a; font-size: 20px; font-weight: 850; letter-spacing: -.01em; }
    .menu-button { display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; border: 1px solid #e2e8f0; background: white; color: #0f172a; box-shadow: 0 8px 24px rgba(15,23,42,.08); }
    .menu-button span, .menu-button span::before, .menu-button span::after { display: block; width: 20px; height: 2px; border-radius: 999px; background: currentColor; content: ""; }
    .menu-button span { position: relative; }
    .menu-button span::before { position: absolute; top: -7px; left: 0; }
    .menu-button span::after { position: absolute; top: 7px; left: 0; }
    header { padding: 14px 14px 12px; background: rgba(248,250,252,.97); }
    main { padding: 12px; max-width: 920px; margin: 0 auto; }
    h1 { margin: 0; font-size: 16px; line-height: 1.2; color: #0b3a70; }
    .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .header-kicker { margin: 0 0 3px; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .meta, .small { color: #64748b; font-size: 12px; line-height: 1.35; }
    .counter-pill { flex: 0 0 auto; border: 1px solid #bfdbfe; background: #eff6ff; color: #0b3a70; border-radius: 999px; padding: 6px 9px; font-size: 12px; font-weight: 800; }
    .bar { height: 8px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin-top: 10px; }
    .bar span { display: block; height: 100%; width: 0; background: #0b3a70; }
    .toolbar { display: flex; gap: 8px; margin-top: 10px; }
    button, select, textarea { font: inherit; }
    button { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 12px; padding: 10px 12px; font-weight: 800; }
    button.primary { background: #0b3a70; border-color: #0b3a70; color: white; }
    button.include { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    button.exclude { background: #fff1f2; border-color: #fecdd3; color: #be123c; }
    button.flag { background: #fffbeb; border-color: #fde68a; color: #b45309; }
    button.include.active { border-color: #10b981; background: #d1fae5; color: #065f46; box-shadow: 0 0 0 1px rgba(16,185,129,.18) inset; }
    button.exclude.active { border-color: #f43f5e; background: #ffe4e6; color: #9f1239; box-shadow: 0 0 0 1px rgba(244,63,94,.18) inset; }
    button.flag.active { border-color: #f59e0b; background: #fef3c7; color: #92400e; box-shadow: 0 0 0 1px rgba(245,158,11,.18) inset; }
    button:disabled { opacity: .45; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; box-shadow: 0 10px 30px rgba(15,23,42,.05); }
    .record-nav { display: grid; grid-template-columns: 54px minmax(88px, auto) 54px; gap: 8px; align-items: center; justify-content: space-between; margin: 8px 0 12px; }
    .record-nav button { display: inline-grid; place-items: center; width: 48px; height: 48px; padding: 0; border-radius: 999px; color: #0b3a70; font-size: 28px; line-height: 1; box-shadow: 0 8px 24px rgba(15,23,42,.08); }
    .record-nav select { max-width: 120px; min-height: 42px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; color: #0f172a; font-size: 13px; font-weight: 800; text-align: center; }
    .record-nav button:last-child { justify-self: end; }
    .record-heading { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
    .badge { display: inline-flex; border-radius: 999px; padding: 5px 10px; background: #0b3a70; color: white; font-size: 12px; font-weight: 800; }
    .status-pill { display: inline-flex; border: 1px solid #e2e8f0; border-radius: 999px; padding: 5px 11px; background: #f8fafc; color: #475569; font-size: 12px; font-weight: 850; }
    .status-pill.include { border-color: #a7f3d0; background: #ecfdf5; color: #047857; }
    .status-pill.exclude { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
    .status-pill.flag { border-color: #fde68a; background: #fffbeb; color: #b45309; }
    .title { font-size: 22px; font-weight: 800; line-height: 1.18; margin: 12px 0 10px; letter-spacing: -.01em; }
    .citation { color: #475569; font-size: 13px; line-height: 1.4; }
    .metadata-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; overflow: hidden; border: 1px solid #e2e8f0; background: #e2e8f0; border-radius: 12px; margin: 12px 0; }
    .metadata-item { min-width: 0; background: white; padding: 9px 10px; }
    .metadata-label { display: block; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    .metadata-value { display: block; margin-top: 3px; color: #1e293b; font-size: 13px; font-weight: 650; overflow-wrap: anywhere; }
    .section-label { display: flex; align-items: center; gap: 8px; margin: 16px 0 8px; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .section-label::before { content: ""; width: 22px; height: 1px; background: #cbd5e1; }
    .abstract { white-space: pre-wrap; line-height: 1.62; font-size: 15px; margin: 0; padding: 13px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; color: #1e293b; }
    .ai { margin-top: 14px; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; font-size: 14px; line-height: 1.5; }
    .ai.exclude { border-color: #fecdd3; background: #fff7f8; }
    .ai.include { border-color: #a7f3d0; background: #f0fdf4; }
    .ai-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .ai-label, .decision-label, .notes-label { display: flex; align-items: center; gap: 8px; color: #475569; font-size: 11px; font-weight: 850; letter-spacing: .2em; text-transform: uppercase; }
    .ai-pill { display: inline-flex; border-radius: 999px; border: 1px solid #e2e8f0; background: white; padding: 6px 11px; font-size: 12px; font-weight: 850; }
    .ai-pill.exclude { border-color: #fecdd3; color: #be123c; }
    .ai-pill.include { border-color: #a7f3d0; color: #047857; }
    .ai-evidence { margin: 12px 0 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 13px; background: rgba(255,255,255,.86); color: #1e293b; font-weight: 650; }
    .decision-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .decision-card { margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; padding: 14px; box-shadow: 0 10px 26px rgba(15,23,42,.05); }
    .decision-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .current-vote { color: #64748b; font-size: 12px; font-weight: 700; }
    .current-vote strong { color: #0f172a; }
    .reviewer-notes { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .reviewer-note-card { display: flex; align-items: center; gap: 12px; margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 16px; background: #f8fafc; padding: 12px; }
    .reviewer-note-card.include { border-color: #a7f3d0; background: #f0fdf4; }
    .reviewer-note-card.exclude { border-color: #fecdd3; background: #fff7f8; }
    .reviewer-note-card.flag { border-color: #fde68a; background: #fffbeb; }
    .avatar { display: grid; place-items: center; flex: 0 0 auto; width: 42px; height: 42px; border-radius: 999px; background: #0b3a70; color: #fff; font-size: 12px; font-weight: 900; }
    .reviewer-copy { min-width: 0; flex: 1; }
    .reviewer-name { margin: 0; color: #0f172a; font-size: 14px; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .reviewer-note { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    textarea { width: 100%; min-height: 76px; margin-top: 10px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; resize: vertical; }
    .notice { margin-top: 10px; color: #be123c; font-size: 13px; font-weight: 700; }
    .warning { margin-top: 10px; border-radius: 10px; background: #fef3c7; color: #92400e; padding: 10px; font-size: 13px; font-weight: 800; }
    .export { margin-top: 16px; }
    .export textarea { min-height: 180px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    @media (max-width: 560px) {
      main { padding: 10px; }
      .brand-title { font-size: 19px; }
      .record-nav { grid-template-columns: 54px minmax(86px, auto) 54px; }
      .toolbar { display: grid; grid-template-columns: 1fr 1fr; }
    }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  </style>
</head>
<body>
  <div class="appbar">
    <div class="brand">
      <img src="/images/University_College_Dublin_logo.svg.png" alt="UCD">
      <div class="brand-title">FIFA GBI</div>
    </div>
    <button class="menu-button" type="button" aria-label="Jump to export controls" onclick="document.getElementById('exportPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">
      <span aria-hidden="true"></span>
    </button>
  </div>
  <noscript><div class="warning">This offline screening page needs JavaScript. If you see this, the file/page is being previewed instead of opened in a browser.</div></noscript>
  <header>
    <div class="header-row">
      <div>
        <p class="header-kicker">Offline Screening</p>
        <h1>Title/Abstract Review</h1>
      </div>
      <div class="counter-pill" id="counterPill">0/0</div>
    </div>
    <div class="meta" id="packMeta"></div>
    <div class="meta" id="cacheStatus">Checking offline cache...</div>
    <div class="warning" id="packWarning" hidden></div>
    <div class="bar" aria-label="Progress"><span id="progressBar"></span></div>
  </header>
  <main>
    <section class="card">
      <div class="record-nav">
        <button id="prevBtn" type="button"><span aria-hidden="true">‹</span><span class="sr-only">Previous</span></button>
        <select id="recordSelect" aria-label="Record"></select>
        <button id="nextBtn" type="button"><span aria-hidden="true">›</span><span class="sr-only">Next</span></button>
      </div>
      <div id="record"></div>
      <div class="decision-card">
        <div class="decision-head">
          <div class="decision-label">Decision</div>
          <div class="current-vote" id="currentVote">No vote yet</div>
        </div>
        <div class="decision-grid">
          <button class="include" type="button" data-decision="include">✓ Include</button>
          <button class="exclude" type="button" data-decision="exclude">× Exclude</button>
          <button class="flag" type="button" data-decision="flag">! Flag</button>
        </div>
        <textarea id="note" maxlength="${MAX_NOTE_CHARS}" placeholder="Optional reviewer note"></textarea>
        <div class="small"><span id="noteCount">0</span>/${MAX_NOTE_CHARS}</div>
        <div class="notice" id="notice"></div>
      </div>
      <div class="reviewer-notes" id="reviewerNotes"></div>
    </section>
    <section class="card export" id="exportPanel">
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
        const cache = await caches.open('gbi-title-abstract-offline-v2');
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
      const statusLabel = decision.decision ? decision.decision[0].toUpperCase() + decision.decision.slice(1) : 'Reserved offline';
      el('currentVote').innerHTML = decision.decision ? 'You voted <strong>' + statusLabel + '</strong>' : 'No vote yet';
      el('record').innerHTML = '<div class="record-heading"><span class="badge">' + (record.studyId || record.recordId) + '</span><span class="status-pill"></span></div>' +
        '<div class="title"></div>' +
        '<div class="citation"></div>' +
        '<div class="metadata-strip">' +
          '<div class="metadata-item"><span class="metadata-label">DOI</span><span class="metadata-value metadata-doi"></span></div>' +
          '<div class="metadata-item"><span class="metadata-label">Year</span><span class="metadata-value metadata-year"></span></div>' +
          '<div class="metadata-item"><span class="metadata-label">Author</span><span class="metadata-value metadata-author"></span></div>' +
          '<div class="metadata-item"><span class="metadata-label">Journal</span><span class="metadata-value metadata-journal"></span></div>' +
        '</div>' +
        '<div class="section-label">Abstract</div>' +
        '<div class="abstract"></div>' +
        '<div class="ai">' +
          '<div class="ai-head"><div class="ai-label">AI Recommendation</div><span class="ai-pill"></span></div>' +
          '<div class="ai-reason"></div>' +
          '<blockquote class="ai-evidence" hidden></blockquote>' +
        '</div>';
      const statusPill = el('record').querySelector('.status-pill');
      statusPill.textContent = statusLabel;
      statusPill.className = 'status-pill' + (decision.decision ? ' ' + decision.decision : '');
      el('record').querySelector('.title').textContent = record.title || 'Untitled';
      el('record').querySelector('.citation').textContent = [record.leadAuthor, record.year, record.journal, record.doi].filter(Boolean).join(' · ') || 'No citation metadata';
      el('record').querySelector('.metadata-doi').textContent = record.doi || '—';
      el('record').querySelector('.metadata-year').textContent = record.year || '—';
      el('record').querySelector('.metadata-author').textContent = record.leadAuthor || '—';
      el('record').querySelector('.metadata-journal').textContent = record.journal || '—';
      el('record').querySelector('.abstract').textContent = record.abstract || 'No abstract imported.';
      const aiTone = record.aiSuggestedDecision === 'include' || record.aiSuggestedDecision === 'exclude' ? record.aiSuggestedDecision : '';
      const aiPanel = el('record').querySelector('.ai');
      aiPanel.className = 'ai' + (aiTone ? ' ' + aiTone : '');
      const aiPill = el('record').querySelector('.ai-pill');
      aiPill.textContent = record.aiSuggestedDecision ? record.aiSuggestedDecision[0].toUpperCase() + record.aiSuggestedDecision.slice(1) : (record.aiStatus || 'Not run');
      aiPill.className = 'ai-pill' + (aiTone ? ' ' + aiTone : '');
      el('record').querySelector('.ai-reason').textContent = record.aiReason || 'No local title/abstract AI recommendation has been recorded yet.';
      const aiEvidence = el('record').querySelector('.ai-evidence');
      if (record.aiEvidenceQuote) {
        aiEvidence.hidden = false;
        aiEvidence.textContent = '“' + record.aiEvidenceQuote + '”' + (record.aiSourceLocation ? ' — ' + record.aiSourceLocation : '');
      } else {
        aiEvidence.hidden = true;
        aiEvidence.textContent = '';
      }
      el('counterPill').textContent = (index + 1) + '/' + PACK.records.length;
      document.querySelectorAll('[data-decision]').forEach((button) => {
        button.disabled = false;
        button.classList.toggle('active', decision.decision === button.dataset.decision);
      });
      renderReviewerNotes(record, decision);
    }
    function renderReviewerNotes(record, decision) {
      if (!decision.decision) {
        el('reviewerNotes').innerHTML = '<div class="notes-label">Reviewer Notes</div><div class="reviewer-note-card"><div class="avatar">AB</div><div class="reviewer-copy"><p class="reviewer-name">' + PACK.reviewerName + '</p><p class="reviewer-note">No vote recorded in this browser yet.</p></div></div>';
        return;
      }
      const label = decision.decision[0].toUpperCase() + decision.decision.slice(1);
      const note = decision.note || 'No note.';
      el('reviewerNotes').innerHTML = '<div class="notes-label">Reviewer Notes</div><div class="reviewer-note-card ' + decision.decision + '"><div class="avatar">AB</div><div class="reviewer-copy"><p class="reviewer-name">' + PACK.reviewerName + '</p><p class="reviewer-note">' + note.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char])) + '</p></div><span class="status-pill ' + decision.decision + '">' + label + '</span></div>';
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

  const rows = await fetchPackRows(packId, OFFLINE_REVIEWER_PROFILE_ID);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No active offline records found for this pack.' }, { status: 404 });
  }

  const html = buildHtml({
    schemaVersion: 1,
    packId,
    exportedAt: new Date().toISOString(),
    reviewerProfileId: OFFLINE_REVIEWER_PROFILE_ID,
    reviewerName: OFFLINE_REVIEWER_NAME,
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
