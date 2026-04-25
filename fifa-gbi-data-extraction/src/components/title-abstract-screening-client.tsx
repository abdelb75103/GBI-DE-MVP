'use client';

import { ChangeEvent, FormEvent, useMemo, useRef, useState, useTransition } from 'react';

import {
  getTitleAbstractDecisions,
  getTitleAbstractResolution,
  getTitleAbstractWorkStatus,
  type TitleAbstractDecision,
  type TitleAbstractDecisionAction,
  type TitleAbstractResolution,
  type TitleAbstractWorkStatus,
} from '@/lib/screening/title-abstract-decisions';
import type { ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecords: ScreeningRecord[];
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type QueueFilter =
  | 'all'
  | 'needs_your_vote'
  | 'awaiting_other_reviewer'
  | 'needs_resolver'
  | 'ready_for_full_text'
  | 'excluded'
  | 'promoted_to_full_text'
  | 'missing_abstract'
  | 'flagged';

type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;

const MAX_REFERENCE_FILE_BYTES = 6 * 1024 * 1024;

const RESOLUTION_LABELS: Record<TitleAbstractResolution, string> = {
  pending: 'Pending',
  ready_for_full_text: 'Ready for full text',
  excluded: 'Excluded',
  needs_resolver: 'Needs resolver',
  promoted_to_full_text: 'Promoted',
};

const STATUS_LABELS: Record<TitleAbstractWorkStatus, string> = {
  needs_your_vote: 'Needs my vote',
  awaiting_other_reviewer: 'Awaiting other reviewer',
  ready_for_full_text: 'Ready for full text',
  excluded: 'Excluded',
  needs_resolver: 'Needs resolver',
  promoted_to_full_text: 'Promoted',
};

export function TitleAbstractScreeningClient({
  initialRecords,
  currentReviewerId,
  profileRole,
  loadError,
}: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id ?? '');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<TitleAbstractDecision | null>(null);
  const [decisionAction, setDecisionAction] = useState<TitleAbstractDecisionAction>('reviewer_vote');
  const [note, setNote] = useState('');
  const [sourceLabel, setSourceLabel] = useState('reference-import');
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = profileRole === 'admin';

  const selected = records.find((record) => record.id === selectedId) ?? records[0] ?? null;

  const counts = useMemo(() => {
    const statuses = records.map((record) => getTitleAbstractWorkStatus(record, currentReviewerId));
    return {
      all: records.length,
      needsYourVote: statuses.filter((status) => status === 'needs_your_vote').length,
      awaitingOther: statuses.filter((status) => status === 'awaiting_other_reviewer').length,
      resolver: statuses.filter((status) => status === 'needs_resolver').length,
      ready: statuses.filter((status) => status === 'ready_for_full_text').length,
      excluded: statuses.filter((status) => status === 'excluded').length,
      promoted: statuses.filter((status) => status === 'promoted_to_full_text').length,
      missingAbstract: records.filter((record) => !record.abstract?.trim()).length,
      flagged: records.filter((record) => getTitleAbstractDecisions(record).some((item) => item.decision === 'flag')).length,
    };
  }, [currentReviewerId, records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const status = getTitleAbstractWorkStatus(record, currentReviewerId);
      const decisions = getTitleAbstractDecisions(record);
      if (filter === 'missing_abstract' && record.abstract?.trim()) return false;
      if (filter === 'flagged' && !decisions.some((item) => item.decision === 'flag')) return false;
      if (!['all', 'missing_abstract', 'flagged'].includes(filter) && status !== filter) return false;
      if (!query) return true;
      return [
        record.assignedStudyId,
        record.title,
        record.abstract,
        record.leadAuthor,
        record.year,
        record.journal,
        record.doi,
        record.sourceRecordId,
        record.sourceLabel,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [currentReviewerId, filter, records, search]);

  const refreshRecords = async () => {
    const response = await fetch('/api/title-abstract-screening', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to refresh title/abstract records');
    const payload = await response.json() as { records: ScreeningRecord[] };
    const nextRecords = payload.records ?? [];
    setRecords(nextRecords);
    if (!nextRecords.some((record) => record.id === selectedId)) {
      setSelectedId(nextRecords[0]?.id ?? '');
    }
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_REFERENCE_FILE_BYTES) {
      setNotice({ tone: 'error', message: 'Reference file exceeds 6 MB.' });
      return;
    }

    startTransition(async () => {
      const body = new FormData();
      body.set('file', file);
      body.set('sourceLabel', sourceLabel);
      const response = await fetch('/api/title-abstract-screening/imports', { method: 'POST', body });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        inserted?: ScreeningRecord[];
        skipped?: Array<{ title: string; reason: string }>;
        failures?: Array<{ title: string; reason: string }>;
        totalParsed?: number;
      };
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'Reference import failed' });
        return;
      }
      await refreshRecords();
      const insertedCount = payload.inserted?.length ?? 0;
      const skippedCount = payload.skipped?.length ?? 0;
      const failedCount = payload.failures?.length ?? 0;
      setNotice({
        tone: failedCount > 0 ? 'error' : 'success',
        message: `Imported ${insertedCount} of ${payload.totalParsed ?? insertedCount} references. ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped${failedCount ? `; ${failedCount} failed` : ''}.`,
      });
      const firstInserted = payload.inserted?.[0];
      if (firstInserted) setSelectedId(firstInserted.id);
    });
  };

  const saveDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    if (!decision) {
      setNotice({ tone: 'error', message: 'Choose Include, Exclude, or Flag.' });
      return;
    }
    if (decision === 'flag' && !note.trim()) {
      setNotice({ tone: 'error', message: 'Add a note before flagging this reference.' });
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/title-abstract-screening/${selected.id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decisionAction, note }),
      });
      const payload = await response.json().catch(() => ({})) as { record?: ScreeningRecord; error?: string };
      if (!response.ok || !payload.record) {
        setNotice({ tone: 'error', message: payload.error ?? 'Failed to save decision.' });
        return;
      }
      setRecords((current) => current.map((record) => (record.id === payload.record?.id ? payload.record : record)));
      setNote('');
      setDecision(null);
      setDecisionAction('reviewer_vote');
      setNotice({ tone: 'success', message: 'Decision saved.' });
    });
  };

  const promoteReady = () => {
    const readyIds = records
      .filter((record) => getTitleAbstractResolution(record) === 'ready_for_full_text')
      .map((record) => record.id);
    if (readyIds.length === 0) {
      setNotice({ tone: 'neutral', message: 'No included title/abstract records are ready to promote.' });
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/title-abstract-screening/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: readyIds }),
      });
      const payload = await response.json().catch(() => ({})) as { promoted?: unknown[]; errors?: Array<{ message: string }>; error?: string };
      if (!response.ok) {
        setNotice({ tone: 'error', message: payload.error ?? 'Promotion failed.' });
        return;
      }
      await refreshRecords();
      const promoted = payload.promoted?.length ?? 0;
      const errors = payload.errors?.length ?? 0;
      setNotice({
        tone: errors > 0 ? 'error' : 'success',
        message: `Promoted ${promoted} record${promoted === 1 ? '' : 's'} to full-text screening${errors ? `; ${errors} failed` : ''}.`,
      });
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0b3a70]/70">Screening</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Title and abstract screening</h1>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                className="w-40 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                placeholder="Source label"
                aria-label="Source label"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ris,.nbib,.txt"
                onChange={handleImport}
                className="hidden"
                id="reference-import"
              />
              <label
                htmlFor="reference-import"
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0b3a70] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#092f5f] ${
                  isPending ? 'pointer-events-none opacity-70' : ''
                }`}
              >
                <UploadIcon />
                {isPending ? 'Working…' : 'Import references'}
              </label>
              <button
                type="button"
                onClick={promoteReady}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Promote ready
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="grid min-h-[calc(100vh-240px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[300px_minmax(0,1fr)_220px]">
        <aside className="flex min-h-[420px] min-w-0 flex-col border-b border-slate-200 bg-slate-50/60 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">References</p>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">{counts.all}</span>
            </div>
            <div className="relative mt-3">
              <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search queue"
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredRecords.map((record) => (
              <ReferenceRow
                key={record.id}
                record={record}
                active={selected?.id === record.id}
                status={getTitleAbstractWorkStatus(record, currentReviewerId)}
                onClick={() => setSelectedId(record.id)}
              />
            ))}
            {filteredRecords.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No references match this view.</p>
            ) : null}
          </div>
        </aside>

        <main className="flex min-h-[520px] min-w-0 flex-col bg-white lg:min-h-0">
          {selected ? (
            <ReferenceDetail
              record={selected}
              currentReviewerId={currentReviewerId}
              decision={decision}
              decisionAction={decisionAction}
              note={note}
              isPending={isPending}
              onChangeDecision={setDecision}
              onChangeDecisionAction={setDecisionAction}
              onChangeNote={setNote}
              onSaveDecision={saveDecision}
            />
          ) : (
            <div className="grid h-full place-items-center px-6 py-16 text-sm text-slate-500">
              Import references to begin screening.
            </div>
          )}
        </main>

        <aside className="flex min-h-[300px] min-w-0 flex-col border-t border-slate-200/70 bg-slate-50/40 lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="border-b border-slate-200/70 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Filters</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1">
              <FilterButton label="All records" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterButton label="Needs my vote" count={counts.needsYourVote} active={filter === 'needs_your_vote'} onClick={() => setFilter('needs_your_vote')} accent="brand" />
              <FilterButton label="Awaiting other" count={counts.awaitingOther} active={filter === 'awaiting_other_reviewer'} onClick={() => setFilter('awaiting_other_reviewer')} />
              <FilterButton label="Needs resolver" count={counts.resolver} active={filter === 'needs_resolver'} onClick={() => setFilter('needs_resolver')} accent="amber" />
              <FilterButton label="Ready for full text" count={counts.ready} active={filter === 'ready_for_full_text'} onClick={() => setFilter('ready_for_full_text')} accent="emerald" />
              <FilterButton label="Excluded" count={counts.excluded} active={filter === 'excluded'} onClick={() => setFilter('excluded')} accent="rose" />
              <FilterButton label="Flagged" count={counts.flagged} active={filter === 'flagged'} onClick={() => setFilter('flagged')} accent="amber" />
              <FilterButton label="Missing abstract" count={counts.missingAbstract} active={filter === 'missing_abstract'} onClick={() => setFilter('missing_abstract')} />
              <FilterButton label="Promoted" count={counts.promoted} active={filter === 'promoted_to_full_text'} onClick={() => setFilter('promoted_to_full_text')} accent="emerald" />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ReferenceRow({
  record,
  active,
  status,
  onClick,
}: {
  record: ScreeningRecord;
  active: boolean;
  status: TitleAbstractWorkStatus;
  onClick: () => void;
}) {
  const decisions = getTitleAbstractDecisions(record);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-full border-b border-slate-200 px-4 py-4 text-left transition ${
        active ? 'bg-white shadow-[inset_3px_0_0_0_#0b3a70]' : 'bg-transparent hover:bg-white/70'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold tracking-[0.08em] text-[#0b3a70]">{record.assignedStudyId}</span>
        <StatusDot status={status} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-slate-900">{record.title}</p>
      <p className="mt-1.5 truncate text-xs text-slate-500">
        {[record.leadAuthor, record.year, record.journal].filter(Boolean).join(' · ') || 'Citation details pending'}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <VoteMarks decisions={decisions} />
        <span className="text-[11px] font-medium text-slate-500">{STATUS_LABELS[status]}</span>
      </div>
    </button>
  );
}

function ReferenceDetail({
  record,
  currentReviewerId,
  decision,
  decisionAction,
  note,
  isPending,
  onChangeDecision,
  onChangeDecisionAction,
  onChangeNote,
  onSaveDecision,
}: {
  record: ScreeningRecord;
  currentReviewerId: string;
  decision: TitleAbstractDecision | null;
  decisionAction: TitleAbstractDecisionAction;
  note: string;
  isPending: boolean;
  onChangeDecision: (next: TitleAbstractDecision | null) => void;
  onChangeDecisionAction: (next: TitleAbstractDecisionAction) => void;
  onChangeNote: (next: string) => void;
  onSaveDecision: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const decisions = getTitleAbstractDecisions(record);
  const resolution = getTitleAbstractResolution(record);
  const currentReviewerVote = decisions.find((item) => item.reviewerProfileId === currentReviewerId);
  const canResolve = resolution === 'needs_resolver';

  return (
    <article className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-7 sm:px-8 sm:py-8">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#0b3a70] px-3 py-1 text-xs font-bold tracking-wide text-white">{record.assignedStudyId}</span>
            <ResolutionPill resolution={resolution}>{RESOLUTION_LABELS[resolution]}</ResolutionPill>
            {!record.abstract?.trim() ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <span aria-hidden>!</span> Missing abstract
              </span>
            ) : null}
          </div>
          <h2 className="break-words text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[1.65rem]">
            {record.title}
          </h2>
        </header>

        <MetadataStrip
          items={[
            { label: 'DOI', value: record.doi },
            { label: 'Lead author', value: record.leadAuthor },
            { label: 'Year', value: record.year },
            { label: 'Journal', value: record.journal },
          ]}
        />

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Abstract</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem] leading-7 text-slate-800">
            {record.abstract?.trim() || 'No abstract was imported or found through the free metadata lookup. Screen from title and citation details, or retrieve metadata before final adjudication.'}
          </p>
        </section>

        <DecisionPanel
          decision={decision}
          decisionAction={decisionAction}
          note={note}
          canResolve={canResolve}
          isPending={isPending}
          currentReviewerVoteLabel={currentReviewerVote?.decision ?? null}
          onChangeDecision={onChangeDecision}
          onChangeDecisionAction={onChangeDecisionAction}
          onChangeNote={onChangeNote}
          onSubmit={onSaveDecision}
        />

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Reviewer notes</p>
          <div className="mt-3 space-y-2">
            {decisions.length > 0 ? decisions.map((entry) => (
              <ReviewerNoteCard
                key={`${entry.reviewerProfileId}-${entry.decidedAt}`}
                entry={entry}
                isCurrentReviewer={entry.reviewerProfileId === currentReviewerId}
              />
            )) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
                No reviewer decisions yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

function MetadataStrip({ items }: { items: Array<{ label: string; value: string | null | undefined }> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white px-4 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</dt>
          <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={item.value ?? undefined}>
            {item.value || <span className="text-slate-400">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DecisionPanel({
  decision,
  decisionAction,
  note,
  canResolve,
  isPending,
  currentReviewerVoteLabel,
  onChangeDecision,
  onChangeDecisionAction,
  onChangeNote,
  onSubmit,
}: {
  decision: TitleAbstractDecision | null;
  decisionAction: TitleAbstractDecisionAction;
  note: string;
  canResolve: boolean;
  isPending: boolean;
  currentReviewerVoteLabel: TitleAbstractDecision | null;
  onChangeDecision: (next: TitleAbstractDecision | null) => void;
  onChangeDecisionAction: (next: TitleAbstractDecisionAction) => void;
  onChangeNote: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const noteRequired = decision === 'flag';
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#0b3a70]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Decision</p>
        </div>
        {currentReviewerVoteLabel ? (
          <span className="text-[11px] font-medium text-slate-500">
            You voted <span className="font-semibold text-slate-700 capitalize">{currentReviewerVoteLabel}</span>
          </span>
        ) : null}
      </div>

      {canResolve ? (
        <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChangeDecisionAction('reviewer_vote')}
            className={`rounded-full px-3 py-1 transition ${
              decisionAction === 'reviewer_vote' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My vote
          </button>
          <button
            type="button"
            onClick={() => onChangeDecisionAction('resolver_decision')}
            className={`rounded-full px-3 py-1 transition ${
              decisionAction === 'resolver_decision' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resolve
          </button>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <DecisionButton tone="include" active={decision === 'include'} onClick={() => onChangeDecision('include')} icon="✓" label="Include" />
        <DecisionButton tone="exclude" active={decision === 'exclude'} onClick={() => onChangeDecision('exclude')} icon="✕" label="Exclude" />
        <DecisionButton tone="flag" active={decision === 'flag'} onClick={() => onChangeDecision('flag')} icon="!" label="Flag" />
      </div>

      <textarea
        value={note}
        onChange={(event) => onChangeNote(event.target.value)}
        placeholder={noteRequired ? 'Required note for flag' : 'Optional reviewer note'}
        rows={2}
        className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
      />

      <button
        type="submit"
        disabled={isPending || !decision}
        className="mt-3 w-full rounded-xl bg-[#0b3a70] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#092f5f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Saving…' : decisionAction === 'resolver_decision' ? 'Save resolver decision' : 'Save decision'}
      </button>
    </form>
  );
}

function DecisionButton({
  tone,
  active,
  onClick,
  icon,
  label,
}: {
  tone: TitleAbstractDecision;
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  const palette = active ? DECISION_BUTTON_ACTIVE[tone] : DECISION_BUTTON_IDLE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${palette}`}
    >
      <span aria-hidden className="text-sm leading-none">{icon}</span>
      {label}
    </button>
  );
}

const DECISION_BUTTON_ACTIVE: Record<TitleAbstractDecision, string> = {
  include: 'border-emerald-500 bg-emerald-100 text-emerald-900 shadow-sm',
  exclude: 'border-rose-500 bg-rose-100 text-rose-900 shadow-sm',
  flag: 'border-amber-500 bg-amber-100 text-amber-900 shadow-sm',
};

const DECISION_BUTTON_IDLE: Record<TitleAbstractDecision, string> = {
  include: 'border-emerald-200/70 bg-emerald-50/50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50',
  exclude: 'border-rose-200/70 bg-rose-50/50 text-rose-700 hover:border-rose-300 hover:bg-rose-50',
  flag: 'border-amber-200/70 bg-amber-50/50 text-amber-800 hover:border-amber-300 hover:bg-amber-50',
};

function ReviewerNoteCard({
  entry,
  isCurrentReviewer,
}: {
  entry: ReturnType<typeof getTitleAbstractDecisions>[number];
  isCurrentReviewer: boolean;
}) {
  const tone = entry.decision;
  const rowClasses = REVIEWER_ROW_CLASSES[tone];
  const avatarClasses = REVIEWER_AVATAR_CLASSES[tone];
  const pillClasses = REVIEWER_PILL_CLASSES[tone];
  const initials = (entry.reviewerName ?? 'Reviewer')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'R';
  const isResolver = entry.action === 'resolver_decision';
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm shadow-slate-900/[0.02] ${rowClasses}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold tracking-wide ${avatarClasses}`}>
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{entry.reviewerName ?? 'Reviewer'}</span>
          {isCurrentReviewer && !isResolver ? (
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0b3a70]">Your vote</span>
          ) : null}
          {isResolver ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Resolver</span>
          ) : null}
        </div>
        {entry.note ? (
          <p className="mt-1 break-words text-sm leading-6 text-slate-700">{entry.note}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">No note.</p>
        )}
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${pillClasses}`}>
        {entry.decision}
      </span>
    </div>
  );
}

const REVIEWER_ROW_CLASSES: Record<TitleAbstractDecision, string> = {
  include: 'border-emerald-200/70 bg-emerald-50/60',
  exclude: 'border-rose-200/70 bg-rose-50/60',
  flag: 'border-amber-200/70 bg-amber-50/60',
};

const REVIEWER_AVATAR_CLASSES: Record<TitleAbstractDecision, string> = {
  include: 'bg-emerald-500/90 text-white',
  exclude: 'bg-rose-500/90 text-white',
  flag: 'bg-amber-500/90 text-white',
};

const REVIEWER_PILL_CLASSES: Record<TitleAbstractDecision, string> = {
  include: 'border-emerald-300/80 bg-white text-emerald-700',
  exclude: 'border-rose-300/80 bg-white text-rose-700',
  flag: 'border-amber-300/80 bg-white text-amber-800',
};

function FilterButton({
  label,
  count,
  active,
  onClick,
  accent,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accent?: 'brand' | 'emerald' | 'rose' | 'amber';
}) {
  const dotClass = accent ? FILTER_DOT_CLASSES[accent] : 'bg-slate-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900'
      }`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : dotClass}`} />
        {label}
      </span>
      <span className={`text-[11px] font-semibold ${active ? 'text-white/70' : 'text-slate-400'}`}>{count}</span>
    </button>
  );
}

const FILTER_DOT_CLASSES: Record<'brand' | 'emerald' | 'rose' | 'amber', string> = {
  brand: 'bg-[#0b3a70]',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
};

function StatusDot({ status }: { status: TitleAbstractWorkStatus }) {
  const classes: Record<TitleAbstractWorkStatus, string> = {
    needs_your_vote: 'bg-[#0b3a70]',
    awaiting_other_reviewer: 'bg-slate-300',
    ready_for_full_text: 'bg-emerald-500',
    excluded: 'bg-rose-500',
    needs_resolver: 'bg-amber-500',
    promoted_to_full_text: 'bg-emerald-500 ring-2 ring-emerald-100',
  };
  return <span aria-hidden className={`h-2 w-2 rounded-full ${classes[status]}`} />;
}

function VoteMarks({ decisions }: { decisions: ReturnType<typeof getTitleAbstractDecisions> }) {
  const slots = [decisions[0], decisions[1]];
  return (
    <span className="flex items-center gap-1">
      {slots.map((entry, index) => {
        if (!entry) {
          return (
            <span
              key={index}
              aria-hidden
              className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300 bg-white"
            />
          );
        }
        const classes = VOTE_MARK_CLASSES[entry.decision];
        return (
          <span
            key={index}
            aria-hidden
            className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold leading-none ${classes}`}
          >
            {entry.decision === 'include' ? '✓' : entry.decision === 'exclude' ? '✕' : '!'}
          </span>
        );
      })}
    </span>
  );
}

const VOTE_MARK_CLASSES: Record<TitleAbstractDecision, string> = {
  include: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-100',
  exclude: 'bg-rose-500 text-white shadow-sm shadow-rose-500/30 ring-1 ring-rose-100',
  flag: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30 ring-1 ring-amber-100',
};

function ResolutionPill({ resolution, children }: { resolution: TitleAbstractResolution; children: React.ReactNode }) {
  const classes: Record<TitleAbstractResolution, string> = {
    pending: 'border-slate-200 bg-slate-50 text-slate-600',
    ready_for_full_text: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    excluded: 'border-rose-200 bg-rose-50 text-rose-700',
    needs_resolver: 'border-amber-200 bg-amber-50 text-amber-800',
    promoted_to_full_text: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${classes[resolution]}`}>{children}</span>;
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200/70 bg-rose-50/80 text-rose-700'
    : tone === 'success'
      ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700'
      : 'border-slate-200/70 bg-slate-50/80 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 11V2.5" />
      <path d="m4.5 6 3.5-3.5L11.5 6" />
      <path d="M2.5 11.5v1A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="7" cy="7" r="5" />
      <path d="m13.5 13.5-3-3" />
    </svg>
  );
}
