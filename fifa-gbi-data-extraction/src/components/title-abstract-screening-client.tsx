'use client';

import {
  ArrowCircleUpRight,
  CaretRight,
  CheckCircle,
  CircleDashed,
  Files,
  MagnifyingGlass,
  SlidersHorizontal,
  Sparkle,
  UploadSimple,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react';
import { ChangeEvent, ReactNode, UIEvent, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';

import { FlagReasonModal } from '@/components/flag-reason-modal';
import {
  Alert,
  Button,
  buttonClasses,
  Card,
  cn,
  Decide,
  EmptyState,
  Field,
  Input,
  Meter,
  PageHead,
  Pill,
  Segmented,
  StatTile,
  t,
  Tag,
  TONE_PANEL,
  Textarea,
} from '@/components/ui';
import type { Tone } from '@/components/ui';
import {
  adjustTitleAbstractQueueCountsAfterDecision,
  getDefaultTitleAbstractDecisionAction,
  getTitleAbstractDecisions,
  getTitleAbstractMetadata,
  getTitleAbstractResolution,
  getTitleAbstractWorkStatus,
  type TitleAbstractDecision,
  type TitleAbstractDecisionAction,
  type TitleAbstractResolution,
  type TitleAbstractWorkStatus,
} from '@/lib/screening/title-abstract-decisions';
import { advanceAfterTitleAbstractDecision } from '@/lib/screening/title-abstract-navigation';
import { splitStructuredAbstract } from '@/lib/screening/title-abstract-sections';
import type { ScreeningRecord } from '@/lib/types';

type Props = {
  initialQueue: TitleAbstractQueuePage | null;
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type QueueFilter =
  | 'all'
  | 'needs_your_vote'
  | 'awaiting_ai_recommendation'
  | 'awaiting_other_reviewer'
  | 'needs_resolver'
  | 'included'
  | 'ready_for_full_text'
  | 'excluded'
  | 'promoted_to_full_text'
  | 'missing_abstract'
  | 'flagged'
  | 'ai_include'
  | 'ai_exclude'
  | 'ai_systematic_review'
  | 'ai_not_run'
  | 'reserved_offline';

type Notice = { tone: 'positive' | 'negative' | 'info'; message: string } | null;
type MobileDrawer = 'references' | 'filters' | null;
type QueueCounts = {
  all: number;
  myVotes: number;
  needsYourVote: number;
  awaitingOther: number;
  resolver: number;
  ready: number;
  excluded: number;
  promoted: number;
  missingAbstract: number;
  flagged: number;
  aiInclude: number;
  aiExclude: number;
  aiSystematicReview: number;
  aiNotRun: number;
  reservedOffline: number;
};
type TitleAbstractQueuePage = {
  records: ScreeningRecord[];
  counts: QueueCounts;
  filteredTotal: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};
type DuplicateWarning = {
  target: 'full_text' | 'extraction';
  matchedStudyId: string | null;
  matchedTitle: string;
  reason: string;
  score: number;
};

const MAX_REFERENCE_FILE_BYTES = 25 * 1024 * 1024;
const QUEUE_PAGE_SIZE = 50;
const EMPTY_COUNTS: QueueCounts = {
  all: 0,
  myVotes: 0,
  needsYourVote: 0,
  awaitingOther: 0,
  resolver: 0,
  ready: 0,
  excluded: 0,
  promoted: 0,
  missingAbstract: 0,
  flagged: 0,
  aiInclude: 0,
  aiExclude: 0,
  aiSystematicReview: 0,
  aiNotRun: 0,
  reservedOffline: 0,
};

const RESOLUTION_LABELS: Record<TitleAbstractResolution, string> = {
  pending: 'Pending',
  flagged: 'Flagged',
  ready_for_full_text: 'Included',
  excluded: 'Excluded',
  needs_resolver: 'Conflict',
  promoted_to_full_text: 'Included',
};

const STATUS_LABELS: Record<TitleAbstractWorkStatus, string> = {
  needs_your_vote: 'Needs my vote',
  awaiting_ai_recommendation: 'Awaiting AI recommendation',
  awaiting_other_reviewer: 'Awaiting AI recommendation',
  flagged: 'Flagged',
  ready_for_full_text: 'Included',
  excluded: 'Excluded',
  needs_resolver: 'Conflict',
  promoted_to_full_text: 'Included',
};

export function TitleAbstractScreeningClient({
  initialQueue,
  currentReviewerId,
  profileRole,
  loadError,
}: Props) {
  const [records, setRecords] = useState(initialQueue?.records ?? []);
  const [counts, setCounts] = useState<QueueCounts>(initialQueue?.counts ?? EMPTY_COUNTS);
  const [filteredTotal, setFilteredTotal] = useState(initialQueue?.filteredTotal ?? 0);
  const [hasMore, setHasMore] = useState(initialQueue?.hasMore ?? false);
  const [nextOffset, setNextOffset] = useState(initialQueue ? initialQueue.offset + initialQueue.records.length : 0);
  const [selectedId, setSelectedId] = useState(initialQueue?.records[0]?.id ?? '');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawer>(null);
  const [decision, setDecision] = useState<TitleAbstractDecision | null>(null);
  const [decisionAction, setDecisionAction] = useState<TitleAbstractDecisionAction>('reviewer_vote');
  const [note, setNote] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [isFlagReasonModalOpen, setIsFlagReasonModalOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [detailScrollTarget, setDetailScrollTarget] = useState({ recordId: '', version: 0 });
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queueInitializedRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const recordsRef = useRef(records);
  const isAdmin = profileRole === 'admin';

  const selected = selectedId ? records.find((record) => record.id === selectedId) ?? null : null;
  const defaultDecisionAction = selected
    ? getDefaultTitleAbstractDecisionAction(selected, currentReviewerId)
    : 'reviewer_vote';

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useLayoutEffect(() => {
    setDecisionAction(defaultDecisionAction);
  }, [selectedId, defaultDecisionAction]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const includedCount = counts.ready + counts.promoted;
  const completedCount = includedCount + counts.excluded;
  const progressPercent = counts.all > 0 ? Math.round((completedCount / counts.all) * 100) : 0;
  const personalProgressPercent = counts.all > 0 ? Math.round((counts.myVotes / counts.all) * 100) : 0;

  // Precompute each visible row's work status once per records change so the
  // sidebar list does not recompute it on every keystroke/render.
  const statusById = useMemo(() => {
    const map = new Map<string, TitleAbstractWorkStatus>();
    for (const record of records) {
      map.set(record.id, getTitleAbstractWorkStatus(record, currentReviewerId));
    }
    return map;
  }, [records, currentReviewerId]);

  const handleSelectRecord = useCallback((id: string) => {
    setSelectedId(id);
    setMobileDrawer(null);
  }, []);

  const fetchQueuePage = useCallback(async (offset: number, replace: boolean, signal?: AbortSignal) => {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const params = new URLSearchParams({
        filter,
        search,
        offset: String(offset),
        limit: String(QUEUE_PAGE_SIZE),
      });
      const response = await fetch(`/api/title-abstract-screening?${params.toString()}`, {
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error('Failed to refresh title/abstract records');
      const payload = await response.json() as TitleAbstractQueuePage;
      setCounts(payload.counts ?? EMPTY_COUNTS);
      setFilteredTotal(payload.filteredTotal ?? 0);
      setHasMore(Boolean(payload.hasMore));
      setNextOffset((payload.offset ?? 0) + (payload.records?.length ?? 0));
      setRecords((current) => {
        const nextRecords = replace ? payload.records ?? [] : [...current, ...(payload.records ?? [])];
        const deduped = Array.from(new Map(nextRecords.map((record) => [record.id, record])).values());
        if (replace && !deduped.some((record) => record.id === selectedIdRef.current)) {
          setSelectedId(deduped[0]?.id ?? '');
        }
        return deduped;
      });
    } finally {
      setIsLoadingQueue(false);
    }
  }, [filter, search]);

  useEffect(() => {
    if (!queueInitializedRef.current) {
      queueInitializedRef.current = true;
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchQueuePage(0, true, controller.signal).catch((error) => {
        if (!controller.signal.aborted) {
          setQueueError(error instanceof Error ? error.message : 'Failed to load records.');
        }
      });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [fetchQueuePage]);

  const refreshRecords = async () => {
    await fetchQueuePage(0, true);
  };

  const loadMoreRecords = () => {
    if (!hasMore || isLoadingQueue) return;
    fetchQueuePage(nextOffset, false).catch((error) => {
      setQueueError(error instanceof Error ? error.message : 'Failed to load more records.');
    });
  };

  const handleFilterChange = (nextFilter: QueueFilter) => {
    setMobileDrawer(null);
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    setSelectedId('');
    setRecords([]);
    setFilteredTotal(0);
    setHasMore(false);
    setNextOffset(0);
  };

  const handleQueueScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom < 360) {
      loadMoreRecords();
    }
  };

  useEffect(() => {
    if (!mobileDrawer) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileDrawer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawer]);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_REFERENCE_FILE_BYTES) {
      setNotice({ tone: 'negative', message: 'Reference file exceeds 25 MB.' });
      return;
    }

    startTransition(async () => {
      const body = new FormData();
      body.set('file', file);
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
        setNotice({ tone: 'negative', message: payload.error ?? 'Reference import failed' });
        return;
      }
      await refreshRecords();
      const insertedCount = payload.inserted?.length ?? 0;
      const skippedCount = payload.skipped?.length ?? 0;
      const failedCount = payload.failures?.length ?? 0;
      setNotice({
        tone: failedCount > 0 ? 'negative' : 'positive',
        message: `Imported ${insertedCount} of ${payload.totalParsed ?? insertedCount} references. ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped${failedCount ? `; ${failedCount} failed` : ''}.`,
      });
      const firstInserted = payload.inserted?.[0];
      if (firstInserted) setSelectedId(firstInserted.id);
    });
  };

  const saveDecision = (nextDecision: TitleAbstractDecision, nextNote = note) => {
    if (!selected) return;
    const trimmedNote = nextNote.trim();
    if (nextDecision === 'flag' && !trimmedNote) {
      setNotice({ tone: 'negative', message: 'Add a reason before flagging this reference.' });
      return;
    }

    const recordBeingSaved = selected;
    setDecision(nextDecision);
    startTransition(async () => {
      const currentRecordId = recordBeingSaved.id;
      const response = await fetch(`/api/title-abstract-screening/${recordBeingSaved.id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: nextDecision, decisionAction, note: trimmedNote }),
      });
      const payload = await response.json().catch(() => ({})) as {
        record?: ScreeningRecord;
        error?: string;
        duplicateWarnings?: DuplicateWarning[];
      };
      if (!response.ok || !payload.record) {
        setNotice({ tone: 'negative', message: payload.error ?? 'Failed to save decision.' });
        return;
      }
      const savedRecord = payload.record;
      const nextQueue = advanceAfterTitleAbstractDecision(recordsRef.current, currentRecordId);
      setRecords(nextQueue.records);
      setSelectedId(nextQueue.selectedId);
      if (nextQueue.shouldScrollSelectedRecordToTop) {
        setDetailScrollTarget((current) => ({
          recordId: nextQueue.scrollTargetId,
          version: current.version + 1,
        }));
      }
      setCounts((current) => adjustTitleAbstractQueueCountsAfterDecision(current, recordBeingSaved, savedRecord, currentReviewerId));
      setFilteredTotal((current) => Math.max(0, current - 1));
      setNextOffset((current) => Math.max(0, current - 1));
      setNote('');
      setFlagReason('');
      setIsFlagReasonModalOpen(false);
      setDecision(null);
      setDecisionAction('reviewer_vote');
      const duplicateMessage = formatDuplicateWarningMessage(payload.duplicateWarnings ?? []);
      setNotice({
        tone: duplicateMessage ? 'info' : 'positive',
        message: duplicateMessage ? `Decision saved and advanced. ${duplicateMessage}` : 'Decision saved and advanced.',
      });
    });
  };


  return (
    <div className="-mx-4 -my-8 flex w-[calc(100%+2rem)] max-w-none flex-col gap-6 md:mx-auto md:my-0 md:w-full">
      {/* The hero is desktop only. On a phone the three-pane workspace takes the
          whole viewport and a summary above it would push the queue off-screen. */}
      <div className="hidden flex-col gap-6 md:flex">
        <PageHead
          eyebrow="Title and abstract screening"
          title="Your screening queue"
          description="Import references, vote, and promote eligible studies to full-text review."
          actions={
            isAdmin ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ris,.nbib,.txt"
                  onChange={handleImport}
                  className="sr-only"
                  id="reference-import"
                />
                <label
                  htmlFor="reference-import"
                  className={buttonClasses(
                    'primary',
                    'md',
                    cn('cursor-pointer', isPending && 'pointer-events-none opacity-60'),
                  )}
                >
                  <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />
                  {isPending ? 'Working…' : 'Import references'}
                </label>
              </>
            ) : null
          }
        />

        {/* Amber is work waiting on this reviewer, as on the full-text queue. */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile tone="total" label="Total records" value={counts.all} meta="All imported references" />
          <StatTile
            tone="attention"
            label="Needs my vote"
            value={counts.needsYourVote}
            meta="Awaiting your decision"
          />
          <StatTile tone="attention" label="Conflicts" value={counts.resolver} meta="Need a resolver" />
          <StatTile tone="positive" label="Included" value={includedCount} meta="Sent to full-text screening" />
        </div>

        <Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <ProgressReadout
              label="My progress"
              percent={personalProgressPercent}
              value={counts.myVotes}
              total={counts.all}
              caption="records voted"
              tone="info"
            />
            <ProgressReadout
              label="Final outcomes"
              percent={progressPercent}
              value={completedCount}
              total={counts.all}
              caption="records resolved"
              tone="positive"
            />
          </div>
        </Card>
      </div>

      {loadError ? <Alert tone="negative">{loadError}</Alert> : null}
      {queueError ? <Alert tone="negative">{queueError}</Alert> : null}
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

      <section className="relative grid h-[calc(100svh-4.25rem)] min-h-[520px] overflow-hidden border-y border-line bg-surface md:h-auto md:min-h-0 md:rounded-card md:border md:shadow-e1 lg:h-[calc(100vh-7rem)] lg:min-h-[560px] lg:grid-cols-[300px_minmax(0,1fr)_220px]">
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-start justify-between px-3 md:hidden">
          <MobileDrawerButton label="Open references" onClick={() => setMobileDrawer('references')}>
            <CaretRight weight="bold" />
          </MobileDrawerButton>
          <MobileDrawerButton label="Open filters" onClick={() => setMobileDrawer('filters')}>
            <SlidersHorizontal weight="bold" />
          </MobileDrawerButton>
        </div>

        {mobileDrawer ? (
          <button
            type="button"
            aria-label="Close mobile panel"
            className="absolute inset-0 z-40 bg-[rgba(15,23,42,0.45)] md:hidden"
            onClick={() => setMobileDrawer(null)}
          />
        ) : null}

        <aside
          aria-label="References"
          className={cn(
            'absolute inset-y-0 left-0 z-50 flex h-full w-[86vw] min-w-0 max-w-[340px] flex-col border-r border-line bg-surface-sunk shadow-e2',
            'transition-transform duration-[200ms] ease-gbi',
            'md:static md:z-auto md:h-auto md:max-h-[70vh] md:min-h-[420px] md:w-auto md:max-w-none md:translate-x-0 md:border-b md:border-r-0 md:shadow-none',
            'lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r',
            mobileDrawer === 'references' ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]',
          )}
        >
          <div className="border-b border-line px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className={t.label}>References</p>
              <div className="flex items-center gap-2">
                <Tag>{counts.all}</Tag>
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:hidden"
                  aria-label="Close references"
                  onClick={() => setMobileDrawer(null)}
                  icon={<X weight="bold" />}
                />
              </div>
            </div>
            {/* This search box had no label. */}
            <Field className="mt-3" label="Search the queue" hideLabel>
              {({ id }) => (
                <span className="relative block">
                  <MagnifyingGlass
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                  />
                  <Input
                    id={id}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search queue"
                    className="pl-8"
                  />
                </span>
              )}
            </Field>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" onScroll={handleQueueScroll}>
            {records.map((record) => (
              <ReferenceRow
                key={record.id}
                record={record}
                active={selectedId === record.id}
                status={statusById.get(record.id) ?? getTitleAbstractWorkStatus(record, currentReviewerId)}
                onSelect={handleSelectRecord}
              />
            ))}
            {records.length === 0 && !isLoadingQueue ? (
              <EmptyState
                icon={<Files />}
                title="Nothing in this view"
                description="No references match the current filter or search."
              />
            ) : null}
            {records.length > 0 ? (
              <div className={`border-t border-line px-4 py-3 text-center ${t.caption} ${t.num}`}>
                Showing {records.length} of {filteredTotal}
              </div>
            ) : null}
            {isLoadingQueue ? (
              <p className={`px-4 py-4 text-center ${t.label}`} aria-live="polite">
                Loading references
              </p>
            ) : null}
            {!hasMore && records.length > 0 ? (
              <p className={`px-4 pb-4 text-center ${t.caption}`}>End of this queue</p>
            ) : null}
          </div>
        </aside>

        <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface md:max-h-[75vh] md:min-h-[520px] lg:max-h-none lg:min-h-0">
          {selected ? (
            <ReferenceDetail
              key={selected.id}
              record={selected}
              currentReviewerId={currentReviewerId}
              decision={decision}
              decisionAction={decisionAction}
              note={note}
              scrollVersion={selected.id === detailScrollTarget.recordId ? detailScrollTarget.version : 0}
              isPending={isPending}
              onChangeDecision={setDecision}
              onChangeDecisionAction={setDecisionAction}
              onChangeNote={setNote}
              onRequestFlag={() => {
                setDecision('flag');
                setFlagReason(note);
                setIsFlagReasonModalOpen(true);
              }}
              onSaveDecision={saveDecision}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <EmptyState
                icon={<Files />}
                title={records.length > 0 ? 'Nothing selected' : 'No references yet'}
                description={
                  records.length > 0
                    ? 'No more loaded references in this queue. Pick one from the list, or change the filter.'
                    : 'Import references to begin screening.'
                }
              />
            </div>
          )}
        </main>

        <aside
          aria-label="Filters"
          className={cn(
            'absolute inset-y-0 right-0 z-50 flex h-full w-[82vw] min-w-0 max-w-[300px] flex-col border-l border-line bg-surface-sunk shadow-e2',
            'transition-transform duration-[200ms] ease-gbi',
            'md:static md:z-auto md:h-auto md:max-h-[60vh] md:min-h-[300px] md:w-auto md:max-w-none md:translate-x-0 md:border-l-0 md:border-t md:shadow-none',
            'lg:max-h-none lg:min-h-0 lg:border-l lg:border-t-0',
            mobileDrawer === 'filters' ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <p className={t.label}>Filters</p>
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              aria-label="Close filters"
              onClick={() => setMobileDrawer(null)}
              icon={<X weight="bold" />}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1">
              <FilterButton label="All records" count={counts.all} active={filter === 'all'} onClick={() => handleFilterChange('all')} />
              <FilterButton label="Needs my vote" count={counts.needsYourVote} active={filter === 'needs_your_vote'} onClick={() => handleFilterChange('needs_your_vote')} dot="attention" />
              <FilterButton label="Awaiting AI" count={counts.awaitingOther} active={filter === 'awaiting_ai_recommendation' || filter === 'awaiting_other_reviewer'} onClick={() => handleFilterChange('awaiting_ai_recommendation')} />
              <FilterButton label="Conflicts" count={counts.resolver} active={filter === 'needs_resolver'} onClick={() => handleFilterChange('needs_resolver')} dot="attention" />
              <FilterButton label="Included" count={includedCount} active={filter === 'included' || filter === 'ready_for_full_text' || filter === 'promoted_to_full_text'} onClick={() => handleFilterChange('included')} dot="positive" />
              <FilterButton label="Excluded" count={counts.excluded} active={filter === 'excluded'} onClick={() => handleFilterChange('excluded')} dot="negative" />
              <FilterButton label="Flagged" count={counts.flagged} active={filter === 'flagged'} onClick={() => handleFilterChange('flagged')} dot="attention" />
              <FilterButton label="Missing abstract" count={counts.missingAbstract} active={filter === 'missing_abstract'} onClick={() => handleFilterChange('missing_abstract')} />
              <div className="my-3 border-t border-line" />
              <FilterButton label="AI include" count={counts.aiInclude} active={filter === 'ai_include'} onClick={() => handleFilterChange('ai_include')} dot="positive" />
              <FilterButton label="AI exclude" count={counts.aiExclude} active={filter === 'ai_exclude'} onClick={() => handleFilterChange('ai_exclude')} dot="negative" />
              <FilterButton label="AI systematic review" count={counts.aiSystematicReview} active={filter === 'ai_systematic_review'} onClick={() => handleFilterChange('ai_systematic_review')} dot="attention" />
              <FilterButton label="AI not run" count={counts.aiNotRun} active={filter === 'ai_not_run'} onClick={() => handleFilterChange('ai_not_run')} />
              <div className="my-3 border-t border-line" />
              <FilterButton label="Reserved offline" count={counts.reservedOffline} active={filter === 'reserved_offline'} onClick={() => handleFilterChange('reserved_offline')} />
            </div>
          </div>
        </aside>
      </section>

      <FlagReasonModal
        isOpen={isFlagReasonModalOpen}
        title="Flag reference"
        description="Give a quick reason why this reference is being flagged."
        initialReason={flagReason}
        isPending={isPending}
        onCancel={() => {
          setIsFlagReasonModalOpen(false);
          setFlagReason('');
          setDecision(null);
        }}
        onSubmit={(reason) => saveDecision('flag', reason)}
      />
    </div>
  );
}

/**
 * Work status and resolution both describe where a reference has got to, so they
 * read from one map. Amber is work waiting on this reviewer, neutral is waiting
 * on the pipeline, and `promoted` takes the info tone the token layer reserves
 * for it.
 *
 * `flagged` is amber here rather than the red it takes in extraction, because on
 * this screen flagging is one of the three things the `Decide` control does, and
 * that control fills amber when pressed. A pill contradicting the button that
 * set it is worse than a tone that differs from another screen.
 */
const STATE_TONE = {
  needs_your_vote: 'attention',
  awaiting_ai_recommendation: 'neutral',
  awaiting_other_reviewer: 'neutral',
  flagged: 'attention',
  ready_for_full_text: 'positive',
  excluded: 'negative',
  needs_resolver: 'attention',
  promoted_to_full_text: 'info',
  pending: 'neutral',
} as const satisfies Record<TitleAbstractWorkStatus | TitleAbstractResolution, Tone>;

const STATE_ICON = {
  attention: Warning,
  positive: CheckCircle,
  negative: XCircle,
  neutral: CircleDashed,
  info: ArrowCircleUpRight,
} as const satisfies Record<Tone, typeof CheckCircle>;

const RAIL: Record<Tone, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  attention: 'bg-attention',
  neutral: 'bg-n-300',
  info: 'bg-navy-600',
};

const DECISION_TONE: Record<TitleAbstractDecision, Tone> = {
  include: 'positive',
  exclude: 'negative',
  flag: 'attention',
};

const ReferenceRow = memo(function ReferenceRow({
  record,
  active,
  status,
  onSelect,
}: {
  record: ScreeningRecord;
  active: boolean;
  status: TitleAbstractWorkStatus;
  onSelect: (id: string) => void;
}) {
  const decisions = getTitleAbstractDecisions(record);
  const tone = STATE_TONE[status];
  return (
    <button
      type="button"
      onClick={() => onSelect(record.id)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'relative block w-full border-b border-line px-4 py-4 pl-[19px] text-left',
        'transition-colors duration-[160ms] ease-gbi focus-visible:outline-none focus-visible:shadow-focus',
        active ? 'bg-surface' : 'bg-transparent hover:bg-surface',
      )}
    >
      {/* The rail carries the state on every row; on the selected row it turns
          navy, because selection is not a state of the reference. */}
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-[3px]', active ? 'bg-navy-600' : RAIL[tone])}
      />
      <div className="flex items-center justify-between gap-3">
        <Tag mono>{record.assignedStudyId}</Tag>
        <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', RAIL[tone])} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{record.title}</p>
      <p className={`mt-1.5 truncate ${t.caption}`}>
        {[record.leadAuthor, record.year, record.journal].filter(Boolean).join(' · ') || 'Citation details pending'}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <VoteMarks decisions={decisions} record={record} />
        <span className={t.caption}>{STATUS_LABELS[status]}</span>
      </div>
    </button>
  );
});

function ReferenceDetail({
  record,
  currentReviewerId,
  decision,
  decisionAction,
  note,
  scrollVersion,
  isPending,
  onChangeDecision,
  onChangeDecisionAction,
  onChangeNote,
  onRequestFlag,
  onSaveDecision,
}: {
  record: ScreeningRecord;
  currentReviewerId: string;
  decision: TitleAbstractDecision | null;
  decisionAction: TitleAbstractDecisionAction;
  note: string;
  scrollVersion: number;
  isPending: boolean;
  onChangeDecision: (next: TitleAbstractDecision | null) => void;
  onChangeDecisionAction: (next: TitleAbstractDecisionAction) => void;
  onChangeNote: (next: string) => void;
  onRequestFlag: () => void;
  onSaveDecision: (decision: TitleAbstractDecision) => void;
}) {
  const detailRef = useRef<HTMLElement | null>(null);
  const decisions = getTitleAbstractDecisions(record);
  const metadata = getTitleAbstractMetadata(record);
  const linkedFullTextId = typeof metadata.titleAbstractPromotedRecordId === 'string'
    ? metadata.titleAbstractPromotedRecordId
    : null;
  const resolution = getTitleAbstractResolution(record);
  const currentReviewerVote = decisions.find((item) => item.reviewerProfileId === currentReviewerId);
  const canResolve = resolution === 'needs_resolver';
  const abstractSections = splitStructuredAbstract(record.abstract);

  useLayoutEffect(() => {
    if (scrollVersion > 0) {
      const scrollToTop = () => {
        if (!detailRef.current) return;
        detailRef.current.scrollTop = 0;
        detailRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      };

      scrollToTop();
      const frame = window.requestAnimationFrame(scrollToTop);
      return () => window.cancelAnimationFrame(frame);
    }
  }, [record.id, scrollVersion]);

  return (
    <article ref={detailRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pb-7 pt-16 sm:px-8 sm:py-8 xl:px-10">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Tag mono>{record.assignedStudyId}</Tag>
            <StatePill state={resolution}>{RESOLUTION_LABELS[resolution]}</StatePill>
            {!record.abstract?.trim() ? (
              <Pill tone="attention" icon={<Warning weight="fill" />}>
                Missing abstract
              </Pill>
            ) : null}
            {linkedFullTextId ? (
              <Pill tone="info" icon={<ArrowCircleUpRight weight="fill" />}>
                Full-text record created
              </Pill>
            ) : null}
          </div>
          <h2 className={`mt-3 break-words ${t.title}`}>{record.title}</h2>
        </header>

        <MetadataStrip
          items={[
            { label: 'DOI', value: record.doi },
            { label: 'Lead author', value: record.leadAuthor },
            { label: 'Year', value: record.year },
            { label: 'Journal', value: record.journal },
          ]}
        />

        <Card>
          <p className={t.label}>Abstract</p>
          {abstractSections.length > 0 ? (
            <div className="mt-3 space-y-3">
              {abstractSections.map((section, index) => (
                <div
                  key={`${section.heading ?? 'abstract'}-${index}`}
                  className={cn(
                    'rounded-card px-4 py-3',
                    section.heading ? 'bg-surface-sunk' : 'border border-line',
                  )}
                >
                  {section.heading ? (
                    <p className={`mb-1.5 ${t.label} text-navy-600`}>{section.heading}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-ink-body">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-ink-body">
              No abstract was imported or found through the free metadata lookup. Screen from title and
              citation details, or retrieve metadata before final adjudication.
            </p>
          )}
        </Card>

        <AiRecommendationCard record={record} />

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
          onRequestFlag={onRequestFlag}
          onSaveDecision={onSaveDecision}
        />

        <section className="border-t border-line pt-5">
          <p className={t.label}>Reviewer notes</p>
          <div className="mt-3 space-y-2">
            {decisions.length > 0 ? (
              decisions.map((entry) => (
                <ReviewerNoteCard
                  key={`${entry.reviewerProfileId}-${entry.decidedAt}`}
                  entry={entry}
                  isCurrentReviewer={entry.reviewerProfileId === currentReviewerId}
                />
              ))
            ) : (
              <p className={`rounded-card border border-dashed border-line px-4 py-6 text-center ${t.caption}`}>
                No reviewer decisions yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

function MobileDrawerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface text-navy-600 shadow-e2 transition-colors duration-[160ms] ease-gbi hover:border-navy-300 focus-visible:outline-none focus-visible:shadow-focus [&>svg]:h-[18px] [&>svg]:w-[18px]"
    >
      {children}
    </button>
  );
}

function formatDuplicateWarningMessage(warnings: DuplicateWarning[]) {
  const warning = warnings[0];
  if (!warning) {
    return '';
  }
  const location = warning.target === 'full_text' ? 'full-text screening' : 'extraction';
  const study = warning.matchedStudyId ? `${warning.matchedStudyId}: ` : '';
  const extraCount = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : '';
  return `Possible duplicate found in ${location}: ${study}${warning.matchedTitle}${extraCount}. Please check before continuing.`;
}

/**
 * The AI verdict carries the decision colours, matching the full-text screens:
 * green for include, red for exclude, amber for a failed run, neutral for no
 * verdict.
 */
function AiRecommendationCard({ record }: { record: ScreeningRecord }) {
  const targetLabel = record.aiTargetTag === 'systematic_review' ? 'Systematic review' : null;
  const hasDecision = record.aiSuggestedDecision === 'include' || record.aiSuggestedDecision === 'exclude';
  const label = record.aiStatus === 'running'
    ? 'Running'
    : record.aiStatus === 'failed'
      ? 'Failed'
      : record.aiSuggestedDecision === 'include'
        ? 'Include'
        : record.aiSuggestedDecision === 'exclude'
          ? 'Exclude'
          : 'Not run';
  const tone: Tone = record.aiStatus === 'failed'
    ? 'attention'
    : record.aiSuggestedDecision === 'include'
      ? 'positive'
      : record.aiSuggestedDecision === 'exclude'
        ? 'negative'
        : 'neutral';

  return (
    <Card className={cn('shadow-e0', TONE_PANEL[tone])}>
      <div className="flex items-center justify-between gap-3">
        {/* `ink-muted`, not the `t.label` default of `ink-soft`: on a tinted panel
            `ink-soft` is 3.8:1, under the 4.5 floor for text this small. */}
        <p className={cn(t.label, 'text-ink-muted')}>
          <Sparkle aria-hidden weight="fill" className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
          AI recommendation
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {targetLabel ? <Tag category="system">{targetLabel}</Tag> : null}
          <Pill
            tone={tone}
            dot={!hasDecision}
            icon={
              hasDecision
                ? record.aiSuggestedDecision === 'include'
                  ? <CheckCircle weight="fill" />
                  : <XCircle weight="fill" />
                : undefined
            }
          >
            {label}
          </Pill>
        </div>
      </div>
      {record.aiReason ? (
        <p className={`mt-3 ${t.body}`}>{record.aiReason}</p>
      ) : (
        <p className={`mt-3 ${t.body} text-ink-muted`}>
          No local title and abstract AI recommendation has been recorded yet.
        </p>
      )}
    </Card>
  );
}

function MetadataStrip({ items }: { items: Array<{ label: string; value: string | null | undefined }> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-surface px-4 py-3">
          <dt className={t.label}>{item.label}</dt>
          <dd className="mt-1 truncate text-[13px] font-medium text-ink" title={item.value ?? undefined}>
            {item.value || <span className="text-ink-soft">—</span>}
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
  onRequestFlag,
  onSaveDecision,
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
  onRequestFlag: () => void;
  onSaveDecision: (decision: TitleAbstractDecision) => void;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={t.section}>Decision</h3>
        {currentReviewerVoteLabel ? (
          <span className={t.caption}>
            You voted <span className="font-semibold capitalize text-ink-body">{currentReviewerVoteLabel}</span>
          </span>
        ) : null}
      </div>

      {canResolve ? (
        <Segmented
          className="mt-3"
          label="What this decision records"
          value={decisionAction}
          onChange={onChangeDecisionAction}
          items={[
            { value: 'reviewer_vote', label: 'My vote' },
            { value: 'resolver_decision', label: 'Resolve' },
          ]}
        />
      ) : null}

      {/* These three save on click, so `Decide` is doing the job of a submit
          control here, not of a radio group. */}
      <Decide
        className="mt-3 grid w-full grid-cols-3 [&>button]:w-full"
        label="Screening decision"
        value={decision}
        onChange={(kind) => {
          const next = kind as TitleAbstractDecision;
          onChangeDecision(next);
          if (next === 'flag') {
            onRequestFlag();
            return;
          }
          onSaveDecision(next);
        }}
        options={[
          { kind: 'include', label: isPending && decision === 'include' ? 'Saving…' : 'Include', disabled: isPending },
          { kind: 'exclude', label: isPending && decision === 'exclude' ? 'Saving…' : 'Exclude', disabled: isPending },
          { kind: 'flag', label: isPending && decision === 'flag' ? 'Saving…' : 'Flag', disabled: isPending },
        ]}
      />

      {/* The note box had no label either. */}
      <Field className="mt-3" label="Reviewer note" help="Optional. Saved with your decision.">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            value={note}
            onChange={(event) => onChangeNote(event.target.value)}
            placeholder="Optional reviewer note"
            rows={2}
          />
        )}
      </Field>
    </Card>
  );
}

function ReviewerNoteCard({
  entry,
  isCurrentReviewer,
}: {
  entry: ReturnType<typeof getTitleAbstractDecisions>[number];
  isCurrentReviewer: boolean;
}) {
  const tone = DECISION_TONE[entry.decision];
  const Glyph = STATE_ICON[tone];
  const initials = (entry.reviewerName ?? 'Reviewer')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'R';
  const isResolver = entry.action === 'resolver_decision';

  return (
    <div className="relative flex items-start gap-3 overflow-hidden rounded-card bg-surface py-3 pl-[19px] pr-4 shadow-e1">
      {/* Whose vote it is is not a decision, so the avatar stays neutral and the
          rail and the pill carry the colour. */}
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', RAIL[tone])} />
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-sunk text-[11px] font-semibold tracking-wide text-ink-muted"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-ink">{entry.reviewerName ?? 'Reviewer'}</span>
          {isCurrentReviewer && !isResolver ? <Tag>Your vote</Tag> : null}
          {isResolver ? <Tag>Resolver</Tag> : null}
        </div>
        {entry.note ? (
          <p className={`mt-1 break-words ${t.body}`}>{entry.note}</p>
        ) : (
          <p className={`mt-1 ${t.caption}`}>No note.</p>
        )}
      </div>
      <Pill tone={tone} icon={<Glyph weight="fill" />} className="shrink-0 capitalize">
        {entry.decision}
      </Pill>
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  dot,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  dot?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-9 w-full items-center justify-between gap-2 rounded-ctl px-3 text-[13px] font-medium',
        'transition-colors duration-[160ms] ease-gbi focus-visible:outline-none focus-visible:shadow-focus',
        active ? 'bg-navy-600 font-semibold text-white' : 'text-ink-muted hover:bg-surface hover:text-ink',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', active ? 'bg-white/70' : dot ? RAIL[dot] : 'bg-n-300')}
        />
        {label}
      </span>
      <span className={cn('text-[11px] font-semibold', t.num, active ? 'text-white/70' : 'text-ink-soft')}>
        {count}
      </span>
    </button>
  );
}

function StatePill({
  state,
  children,
}: {
  state: TitleAbstractWorkStatus | TitleAbstractResolution;
  children: ReactNode;
}) {
  const tone = STATE_TONE[state];
  const Glyph = STATE_ICON[tone];
  return (
    <Pill tone={tone} icon={<Glyph weight="fill" />}>
      {children}
    </Pill>
  );
}

function ProgressReadout({
  label,
  percent,
  value,
  total,
  caption,
  tone,
}: {
  label: string;
  percent: number;
  value: number;
  total: number;
  caption: string;
  tone: Tone;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={t.label}>{label}</p>
          <p className={`mt-2 text-[13px] text-ink-body ${t.num}`}>
            <span className="font-semibold text-ink">{value}</span>
            <span className="text-ink-soft"> / </span>
            <span>{total}</span> {caption}
          </p>
        </div>
        <p className={`shrink-0 ${t.title} ${t.num}`}>{percent}%</p>
      </div>
      <Meter className="mt-3" value={percent} tone={tone} label={`${label}: ${percent}%`} />
    </div>
  );
}

type DecisionMark = {
  key: string;
  decision: TitleAbstractDecision | null;
  label: string;
};

const getAiDecisionMark = (record: ScreeningRecord): DecisionMark => {
  if (record.aiSuggestedDecision === 'include' || record.aiSuggestedDecision === 'exclude') {
    return {
      key: 'ai',
      decision: record.aiSuggestedDecision,
      label: `AI ${record.aiSuggestedDecision}`,
    };
  }

  const label = record.aiStatus === 'running'
    ? 'AI running'
    : record.aiStatus === 'failed'
      ? 'AI failed'
      : record.aiStatus === 'completed'
        ? 'AI undecided'
        : 'AI not run';

  return {
    key: 'ai',
    decision: null,
    label,
  };
};

/**
 * Two marks per row: what a human decided and what the AI proposed. Both take
 * the decision colour, so a row can be scanned for agreement at a glance. The
 * marks are ordered human first, AI second, and each carries an accessible label
 * saying which it is.
 */
function VoteMarks({
  decisions,
  record,
}: {
  decisions: ReturnType<typeof getTitleAbstractDecisions>;
  record: ScreeningRecord;
}) {
  const humanDecision = decisions.find((entry) => entry.action !== 'resolver_decision') ?? null;
  const slots: Array<DecisionMark & { isAi: boolean }> = [
    {
      key: 'human',
      decision: humanDecision?.decision ?? null,
      label: humanDecision ? `Human ${humanDecision.decision}` : 'Human decision pending',
      isAi: false,
    },
    { ...getAiDecisionMark(record), isAi: true },
  ];

  return (
    <span className="flex items-center gap-1">
      {slots.map((entry) => {
        if (!entry.decision) {
          return (
            <span
              key={entry.key}
              aria-label={entry.label}
              title={entry.label}
              className="h-4 w-4 shrink-0 rounded-full border border-dashed border-line-strong"
            />
          );
        }
        const Glyph = entry.decision === 'include' ? CheckCircle : entry.decision === 'exclude' ? XCircle : Warning;
        return (
          // The label lives on the wrapper: a Phosphor icon takes no `title`,
          // and this mark is the only thing saying which way the vote went.
          <span
            key={entry.key}
            role="img"
            aria-label={entry.label}
            title={entry.label}
            className={cn('inline-flex h-4 w-4 shrink-0', DECISION_MARK_COLOUR[entry.decision])}
          >
            <Glyph aria-hidden weight="fill" className="h-full w-full" />
          </span>
        );
      })}
    </span>
  );
}

const DECISION_MARK_COLOUR: Record<TitleAbstractDecision, string> = {
  include: 'text-positive',
  exclude: 'text-negative',
  flag: 'text-attention',
};
