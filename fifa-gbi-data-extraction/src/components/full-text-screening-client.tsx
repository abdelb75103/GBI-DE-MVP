'use client';

import { FormEvent, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';

import { SCREENING_CRITERIA_VERSION } from '@/lib/screening/criteria';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecords: ScreeningRecord[];
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type Filter = 'all' | 'awaiting_ai' | 'ai_suggested' | 'included' | 'excluded' | 'promoted';
type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function FullTextScreeningClient({ initialRecords, profileRole, loadError }: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedRecordId, setSelectedRecordId] = useState(initialRecords[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = profileRole === 'admin';

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (filter === 'awaiting_ai' && record.aiStatus !== 'not_run') return false;
      if (filter === 'ai_suggested' && record.aiStatus !== 'completed') return false;
      if (filter === 'included' && record.manualDecision !== 'include') return false;
      if (filter === 'excluded' && record.manualDecision !== 'exclude') return false;
      if (filter === 'promoted' && !record.promotedPaperId) return false;
      if (!query) return true;
      return [
        record.assignedStudyId,
        record.title,
        record.leadAuthor,
        record.year,
        record.journal,
        record.doi,
        record.originalFileName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [records, filter, search]);

  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? filteredRecords[0] ?? null;
  const checkedIds = Object.entries(selectedIds).filter(([, checked]) => checked).map(([id]) => id);

  const counts = useMemo(() => ({
    all: records.length,
    awaitingAi: records.filter((record) => record.aiStatus === 'not_run').length,
    aiSuggested: records.filter((record) => record.aiStatus === 'completed').length,
    included: records.filter((record) => record.manualDecision === 'include').length,
    excluded: records.filter((record) => record.manualDecision === 'exclude').length,
    promoted: records.filter((record) => record.promotedPaperId).length,
  }), [records]);

  const refreshRecords = async () => {
    const response = await fetch('/api/full-text-screening', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to refresh screening records');
    }
    const payload = (await response.json()) as { records: ScreeningRecord[] };
    setRecords(payload.records ?? []);
    if (!selectedRecordId && payload.records?.[0]) {
      setSelectedRecordId(payload.records[0].id);
    }
  };

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const files = fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : [];
    if (files.length === 0) {
      setNotice({ tone: 'error', message: 'Select at least one PDF.' });
      return;
    }

    startTransition(async () => {
      const failures = [];
      let successCount = 0;
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          failures.push(`${file.name}: not a PDF`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          failures.push(`${file.name}: exceeds 20 MB`);
          continue;
        }

        const data = new FormData(form);
        data.delete('files');
        data.set('file', file);
        if (!data.get('title')) {
          data.set('title', file.name);
        }
        const response = await fetch('/api/full-text-screening/uploads', { method: 'POST', body: data });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          failures.push(`${file.name}: ${payload.error ?? 'upload failed'}`);
          continue;
        }
        successCount += 1;
      }

      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshRecords();
      setNotice({
        tone: failures.length > 0 ? 'error' : 'success',
        message: failures.length > 0
          ? `Uploaded ${successCount}; ${failures.length} failed. ${failures.slice(0, 2).join(' | ')}`
          : `Uploaded ${successCount} PDF${successCount === 1 ? '' : 's'} to screening.`,
      });
    });
  };

  const runAiReview = () => {
    const ids = checkedIds.length > 0 ? checkedIds : selectedRecord ? [selectedRecord.id] : [];
    if (ids.length === 0) return;
    startTransition(async () => {
      const response = await fetch('/api/full-text-screening/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'AI review failed' });
        return;
      }
      await refreshRecords();
      const errors = Array.isArray(payload.errors) ? payload.errors.length : 0;
      setNotice({
        tone: errors > 0 ? 'error' : 'success',
        message: errors > 0 ? `AI reviewed with ${errors} error${errors === 1 ? '' : 's'}.` : `AI reviewed ${ids.length} record${ids.length === 1 ? '' : 's'}.`,
      });
    });
  };

  const saveDecision = (decision: ScreeningDecision) => {
    if (!selectedRecord) return;
    startTransition(async () => {
      const response = await fetch(`/api/full-text-screening/${selectedRecord.id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: decisionReason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'Failed to save decision' });
        return;
      }
      await refreshRecords();
      setDecisionReason('');
      setNotice({ tone: 'success', message: `Saved ${decision} decision for ${selectedRecord.assignedStudyId}.` });
    });
  };

  const promoteIncluded = () => {
    const ids = checkedIds.length > 0 ? checkedIds : selectedRecord ? [selectedRecord.id] : [];
    if (ids.length === 0) return;
    startTransition(async () => {
      const response = await fetch('/api/full-text-screening/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'Promotion failed' });
        return;
      }
      await refreshRecords();
      const promoted = Array.isArray(payload.promoted) ? payload.promoted.length : 0;
      const errors = Array.isArray(payload.errors) ? payload.errors.length : 0;
      setNotice({
        tone: errors > 0 ? 'error' : 'success',
        message: `Promoted ${promoted}; ${errors} error${errors === 1 ? '' : 's'}.`,
      });
    });
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8">
        <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-cyan-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">
              Screening
            </span>
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">Full-text screening</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Upload candidate PDFs, run advisory AI screening, record manual Include/Exclude decisions, and promote
                included studies into extraction with the same study ID.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
            <Metric label="All" value={counts.all} />
            <Metric label="No AI" value={counts.awaitingAi} />
            <Metric label="AI" value={counts.aiSuggested} />
            <Metric label="Include" value={counts.included} />
            <Metric label="Exclude" value={counts.excluded} />
            <Metric label="Promoted" value={counts.promoted} />
          </div>
        </div>
      </section>

      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      {isAdmin ? (
        <form onSubmit={handleUpload} className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))_auto]">
          <input ref={fileInputRef} name="files" type="file" accept="application/pdf" multiple className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm text-indigo-700" />
          <input name="title" placeholder="Optional title override" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="leadAuthor" placeholder="Lead author" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="year" placeholder="Year" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="doi" placeholder="DOI" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button disabled={isPending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60">
            Upload
          </button>
        </form>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.35fr)]">
        <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-xl ring-1 ring-slate-200/60">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, study ID, author, DOI..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All records</option>
              <option value="awaiting_ai">Awaiting AI</option>
              <option value="ai_suggested">AI suggested</option>
              <option value="included">Included</option>
              <option value="excluded">Excluded</option>
              <option value="promoted">Promoted</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={runAiReview} disabled={isPending || (!selectedRecord && checkedIds.length === 0)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              Run AI review
            </button>
            {isAdmin ? (
              <button onClick={promoteIncluded} disabled={isPending || (!selectedRecord && checkedIds.length === 0)} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">
                Promote included
              </button>
            ) : null}
            <button onClick={() => setSelectedIds({})} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
              Clear selected
            </button>
          </div>
          <div className="max-h-[68vh] overflow-y-auto rounded-2xl border border-slate-100">
            {filteredRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedRecordId(record.id)}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-slate-100 p-3 text-left transition hover:bg-slate-50 ${selectedRecord?.id === record.id ? 'bg-indigo-50/70' : 'bg-white'}`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedIds[record.id])}
                  onChange={(event) => {
                    event.stopPropagation();
                    setSelectedIds((previous) => ({ ...previous, [record.id]: event.target.checked }));
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{record.assignedStudyId}</span>
                    <DecisionBadge record={record} />
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-900">{record.title}</p>
                  <p className="text-xs text-slate-500">{[record.leadAuthor, record.year, record.journal].filter(Boolean).join(' • ') || 'Metadata pending'}</p>
                </div>
              </button>
            ))}
            {filteredRecords.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No screening records match this view.</p> : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="min-h-[72vh] overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-100 shadow-xl ring-1 ring-slate-200/60">
            {selectedRecord ? (
              <object data={`/api/full-text-screening/${selectedRecord.id}/file`} type="application/pdf" className="h-full min-h-[72vh] w-full">
                <iframe src={`/api/full-text-screening/${selectedRecord.id}/file`} className="h-full min-h-[72vh] w-full border-0" title="Full-text screening PDF" />
              </object>
            ) : (
              <div className="flex h-full min-h-[72vh] items-center justify-center text-sm text-slate-500">Select a screening record.</div>
            )}
          </div>
          <aside className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-xl ring-1 ring-slate-200/60">
            {selectedRecord ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected record</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">{selectedRecord.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedRecord.assignedStudyId}</p>
                </div>
                <AuditBlock record={selectedRecord} />
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Manual decision</p>
                  <textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Reason required for Exclude; optional for Include" className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => saveDecision('include')} disabled={isPending} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Include</button>
                    <button onClick={() => saveDecision('exclude')} disabled={isPending} className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Exclude</button>
                  </div>
                </div>
                {selectedRecord.promotedPaperId ? (
                  <Link href={`/paper/${selectedRecord.promotedPaperId}`} className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
                    Open promoted extraction record
                  </Link>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a record to inspect AI evidence and save a decision.</p>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}

function DecisionBadge({ record }: { record: ScreeningRecord }) {
  if (record.promotedPaperId) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Promoted</span>;
  if (record.manualDecision === 'include') return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Included</span>;
  if (record.manualDecision === 'exclude') return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Excluded</span>;
  if (record.aiStatus === 'completed') return <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">AI: {record.aiSuggestedDecision}</span>;
  if (record.aiStatus === 'failed') return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">AI failed</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Awaiting AI</span>;
}

function AuditBlock({ record }: { record: ScreeningRecord }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI suggestion</p>
        <p className="mt-1 font-semibold text-slate-900">{record.aiSuggestedDecision ?? 'Not run'}</p>
        {record.aiReason ? <p className="mt-1 text-slate-600">{record.aiReason}</p> : null}
        {record.aiEvidenceQuote ? <blockquote className="mt-2 border-l-4 border-indigo-200 pl-3 text-slate-700">{record.aiEvidenceQuote}</blockquote> : null}
      </div>
      <div className="grid gap-2 text-xs text-slate-500">
        <p>Criteria: {record.aiCriteriaVersion ?? SCREENING_CRITERIA_VERSION}</p>
        <p>Model: {record.aiModel ?? 'Not run'}</p>
        <p>Confidence: {record.aiConfidence === null ? 'Not reported' : record.aiConfidence}</p>
        <p>Manual decision: {record.manualDecision ?? 'Not decided'}</p>
        {record.manualReason ? <p>Manual reason: {record.manualReason}</p> : null}
        {record.manualDecidedByName ? <p>Reviewer: {record.manualDecidedByName}</p> : null}
      </div>
    </div>
  );
}
