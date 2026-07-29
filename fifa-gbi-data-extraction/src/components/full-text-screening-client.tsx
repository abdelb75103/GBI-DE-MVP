'use client';

import {
  ArrowCircleUpRight,
  CheckCircle,
  Clock,
  FileArrowUp,
  Files,
  ListChecks,
  MagnifyingGlass,
  UploadSimple,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { ChangeEvent, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  buttonClasses,
  Card,
  cn,
  EmptyState,
  Field,
  Input,
  Meter,
  PageHead,
  PanelHead,
  Pill,
  RecordRow,
  StatTile,
  Select,
  t,
  Table,
  Tag,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import type { StatTone, Tone } from '@/components/ui';
import {
  getReviewerDecisions,
  getScreeningResolution,
  getScreeningWorkStatus,
  isAwaitingFullTextPdf,
  type ScreeningWorkStatus,
} from '@/lib/screening/reviewer-decisions';
import {
  buildFullTextQueueUrl,
  buildFullTextReaderUrl,
  getFullTextFilterLabel,
  type FullTextQueueContext,
  type FullTextQueueFilter,
  type FullTextQueuePage,
} from '@/lib/screening/full-text-queue';
import { isMentalHealthScreeningRecord } from '@/lib/screening/mental-health';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

type Props = {
  initialQueue: FullTextQueuePage | null;
  context: FullTextQueueContext;
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type Notice = { tone: 'positive' | 'negative' | 'info'; message: string } | null;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const cleanDisplayTitle = (title: string) => title.replace(/^Mock QA #\d+\s*-\s*/i, '');

/**
 * The seven queue states, each with the one tone it is allowed to carry.
 *
 * Amber is work waiting on this reviewer: a study needing their vote, a conflict
 * needing a third decision. Neutral is waiting on somebody else or on a file, so
 * a queue that is merely slow does not read as a queue that is in trouble. The
 * same map feeds the row rail and the row's pill, so the two can never disagree.
 */
const STATUS_META: Record<ScreeningWorkStatus, { label: string; tone: Tone; icon: Icon }> = {
  awaiting_pdf: { label: 'Upload full text', tone: 'neutral', icon: FileArrowUp },
  needs_your_vote: { label: 'Needs my vote', tone: 'attention', icon: ListChecks },
  awaiting_other_reviewer: { label: 'Awaiting other reviewer', tone: 'neutral', icon: Clock },
  ready_for_extraction: { label: 'Ready for extraction', tone: 'positive', icon: CheckCircle },
  excluded: { label: 'Excluded', tone: 'negative', icon: XCircle },
  conflict: { label: 'Conflict', tone: 'attention', icon: Warning },
  promoted: { label: 'Promoted', tone: 'info', icon: ArrowCircleUpRight },
};

const FILTER_OPTIONS: { value: FullTextQueueFilter; label: string }[] = [
  { value: 'all', label: 'All records' },
  { value: 'awaiting_pdf', label: 'Upload full text' },
  { value: 'needs_your_vote', label: 'Needs my vote' },
  { value: 'awaiting_other_reviewer', label: 'Awaiting other reviewer' },
  { value: 'ready_for_extraction', label: 'Included' },
  { value: 'excluded', label: 'Excluded' },
  { value: 'conflict', label: 'Conflicts' },
  { value: 'promoted', label: 'Promoted to extraction' },
];

export function FullTextScreeningClient({
  initialQueue,
  context,
  currentReviewerId,
  profileRole,
  loadError,
}: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(context.search);
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploadPending, setIsUploadPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = profileRole === 'admin';
  const records = initialQueue?.records ?? [];
  const counts = initialQueue?.counts ?? {
    all: 0,
    awaitingPdf: 0,
    needsYourVote: 0,
    awaitingOther: 0,
    complete: 0,
    conflicts: 0,
    noVotes: 0,
    oneVote: 0,
  };
  const progressPercent = counts.all > 0 ? Math.round((counts.complete / counts.all) * 100) : 0;
  const activeFilterLabel = getFullTextFilterLabel(context.filter);

  const navigateQueue = useCallback((next: Partial<Pick<FullTextQueueContext, 'filter' | 'search' | 'page'>>) => {
    startTransition(() => {
      const nextContext = {
        ...context,
        ...next,
        notice: null,
      };
      if (
        nextContext.filter === context.filter &&
        nextContext.search === context.search &&
        nextContext.page === context.page &&
        nextContext.notice === context.notice
      ) {
        return;
      }
      router.replace(buildFullTextQueueUrl(nextContext), { scroll: false });
    });
  }, [context, router]);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === context.search) return;
    const timer = window.setTimeout(() => navigateQueue({ search: nextSearch, page: 1 }), 600);
    return () => window.clearTimeout(timer);
  }, [context.search, navigateQueue, searchInput]);

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setIsUploadPending(true);
    void (async () => {
      const failures: string[] = [];
      let successCount = 0;
      try {
        for (const file of files) {
          if (!file.name.toLowerCase().endsWith('.pdf')) {
            failures.push(`${file.name}: not a PDF`);
            continue;
          }
          if (file.size > MAX_FILE_BYTES) {
            failures.push(`${file.name}: exceeds 20 MB`);
            continue;
          }

          const data = new FormData();
          data.set('file', file);
          const response = await fetch('/api/full-text-screening/uploads', { method: 'POST', body: data });
          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            failures.push(`${file.name}: ${payload.error ?? 'upload failed'}`);
            continue;
          }
          successCount += 1;
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
        router.refresh();
        setNotice({
          tone: failures.length > 0 ? 'negative' : 'positive',
          message: failures.length > 0
            ? `Uploaded ${successCount}; ${failures.length} failed. ${failures.slice(0, 2).join(' | ')}`
            : `Uploaded ${successCount} PDF${successCount === 1 ? '' : 's'} to screening.`,
        });
      } finally {
        setIsUploadPending(false);
      }
    })();
  };

  const handleRecordPdfSelected = (recordId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setNotice({ tone: 'negative', message: `${file.name}: not a PDF` });
        event.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setNotice({ tone: 'negative', message: `${file.name}: exceeds 20 MB` });
        event.target.value = '';
        return;
      }

      const data = new FormData();
      data.set('file', file);
      const response = await fetch(`/api/full-text-screening/${recordId}/file`, { method: 'POST', body: data });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      event.target.value = '';
      if (!response.ok) {
        setNotice({ tone: 'negative', message: payload.error ?? 'PDF attach failed' });
        return;
      }
      router.refresh();
      setNotice({ tone: 'positive', message: `Attached ${file.name} to the full-text record.` });
    });
  };

  const rows = records.map((record, position) => ({
    record,
    href: buildFullTextReaderUrl(record.id, context, position),
  }));

  return (
    <div className="space-y-6">
      <PageHeadWithUpload
        isAdmin={isAdmin}
        isUploadPending={isUploadPending}
        fileInputRef={fileInputRef}
        onFilesSelected={handleFilesSelected}
      />

      {/* Tone is what the count means, never where the tile sits in the row.
          Amber is work waiting on this reviewer; the two counts that wait on
          somebody else stay neutral. */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <QueueTile
          tone="attention"
          label="Screen studies"
          value={counts.needsYourVote}
          meta={`${counts.noVotes} no votes · ${counts.oneVote} one vote`}
          onClick={() => navigateQueue({ filter: 'needs_your_vote', page: 1 })}
        />
        <QueueTile
          tone="attention"
          label="Resolve conflicts"
          value={counts.conflicts}
          meta="A third decision is final"
          onClick={() => navigateQueue({ filter: 'conflict', page: 1 })}
        />
        <QueueTile
          tone="neutral"
          label="Upload full text"
          value={counts.awaitingPdf}
          meta="Included at title and abstract"
          onClick={() => navigateQueue({ filter: 'awaiting_pdf', page: 1 })}
        />
        <QueueTile
          tone="neutral"
          label="Awaiting other reviewer"
          value={counts.awaitingOther}
          meta="You have already voted"
          onClick={() => navigateQueue({ filter: 'awaiting_other_reviewer', page: 1 })}
        />
        <QueueTile
          tone="positive"
          label="Complete"
          value={counts.complete}
          meta="Included, excluded, or promoted"
          onClick={() => navigateQueue({ filter: 'ready_for_extraction', page: 1 })}
        />
        <QueueTile
          tone="total"
          label="Total records"
          value={counts.all}
          meta="Every full-text record"
          onClick={() => navigateQueue({ filter: 'all', page: 1 })}
        />
      </div>

      <Card>
        <PanelHead
          title="Full-text progress"
          description={`${counts.complete} of ${counts.all} records have a final screening outcome.`}
          actions={<span className={`${t.title} ${t.num} text-positive-ink`}>{progressPercent}%</span>}
        />
        <Meter value={progressPercent} tone="positive" label="Full-text records with a final outcome" />
        <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
          <p className={t.caption}>{counts.needsYourVote} need your vote</p>
          <p className={t.caption}>{counts.awaitingPdf} need a PDF upload</p>
          <p className={t.caption}>{counts.conflicts} in conflict</p>
        </div>
      </Card>

      {loadError ? <Alert tone="negative">{loadError}</Alert> : null}
      {context.notice === 'filter_empty' ? (
        <Alert tone="info">No more papers in “{activeFilterLabel}”.</Alert>
      ) : null}
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

      <Card flush aria-busy={isPending}>
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <Field label="Queue">
                {({ id }) => (
                  <Select
                    id={id}
                    value={context.filter}
                    disabled={isPending}
                    onChange={(event) => navigateQueue({ filter: event.target.value as FullTextQueueFilter, page: 1 })}
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {/* The search box had no label at all before this. */}
              <Field label="Search">
                {({ id }) => (
                  <span className="relative block">
                    <MagnifyingGlass
                      aria-hidden
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                    />
                    <Input
                      id={id}
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Title, study ID, author, DOI…"
                      className="pl-8"
                    />
                  </span>
                )}
              </Field>
            </div>
            <p className={`${t.caption} pb-2`} aria-live="polite">
              {isPending ? 'Updating…' : 'Queue ready'}
            </p>
          </div>
        </div>

        <div className={cn('transition-opacity duration-[160ms] ease-gbi', isPending && 'opacity-70')}>
          {/* Mobile card list. A four-column table on a phone is a horizontal
              scroll nobody wins. */}
          <div className="space-y-2.5 p-4 md:hidden">
            {rows.length === 0 ? (
              <QueueEmptyState filterLabel={activeFilterLabel} />
            ) : (
              rows.map(({ record, href }) => (
                <QueueCardRow
                  key={record.id}
                  record={record}
                  href={href}
                  currentReviewerId={currentReviewerId}
                  isAdmin={isAdmin}
                  isPending={isPending}
                  onAttachPdf={handleRecordPdfSelected}
                />
              ))
            )}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table className="min-w-[880px]">
                <thead>
                  <tr>
                    <Th>Study</Th>
                    <Th>AI suggestion</Th>
                    <Th>Reviewers</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ record, href }) => (
                    <QueueTableRow
                      key={record.id}
                      record={record}
                      href={href}
                      currentReviewerId={currentReviewerId}
                      isAdmin={isAdmin}
                      isPending={isPending}
                      onAttachPdf={handleRecordPdfSelected}
                    />
                  ))}
                </tbody>
              </Table>
            </div>
            {rows.length === 0 ? <QueueEmptyState filterLabel={activeFilterLabel} /> : null}
          </div>
        </div>

        {initialQueue ? (
          <QueuePagination
            queue={initialQueue}
            onPageChange={(page) => navigateQueue({ page })}
            isPending={isPending}
          />
        ) : null}
      </Card>
    </div>
  );
}

function QueueEmptyState({ filterLabel }: { filterLabel: string }) {
  return (
    <EmptyState
      icon={<Files />}
      title="Nothing in this queue"
      description={`No papers are currently in “${filterLabel}”. Try another queue or clear the search.`}
    />
  );
}

/**
 * The page header, split out only because the upload control is a file input
 * wearing a button, which needs a label element rather than a `Button`.
 */
function PageHeadWithUpload({
  isAdmin,
  isUploadPending,
  fileInputRef,
  onFilesSelected,
}: {
  isAdmin: boolean;
  isUploadPending: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <PageHead
      eyebrow="Full-text screening"
      title="Your full-text queue"
      description="Vote on full-text PDFs, resolve conflicts, and promote included studies to extraction."
      actions={
        isAdmin ? (
          <div className="flex flex-col items-start gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={onFilesSelected}
              className="sr-only"
              id="full-text-upload"
            />
            <label
              htmlFor="full-text-upload"
              className={buttonClasses(
                'primary',
                'md',
                cn('cursor-pointer', isUploadPending && 'pointer-events-none opacity-60'),
              )}
            >
              {isUploadPending ? (
                <>
                  <span
                    aria-hidden
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white"
                  />
                  Uploading…
                </>
              ) : (
                <>
                  <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />
                  Upload full text
                </>
              )}
            </label>
            <p className={t.caption}>PDF only, up to 20 MB each</p>
          </div>
        ) : null
      }
    />
  );
}

/** A stat tile that is also the filter for the count it shows. */
function QueueTile({
  tone,
  label,
  value,
  meta,
  onClick,
}: {
  tone: StatTone;
  label: string;
  value: number;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card text-left transition-[box-shadow] duration-[160ms] ease-gbi hover:shadow-e2 focus-visible:outline-none focus-visible:shadow-focus"
    >
      <StatTile tone={tone} label={label} value={value} meta={meta} className="h-full" />
    </button>
  );
}

function QueuePagination({
  queue,
  onPageChange,
  isPending,
}: {
  queue: FullTextQueuePage;
  onPageChange: (page: number) => void;
  isPending: boolean;
}) {
  const firstPage = Math.max(1, Math.min(queue.page - 2, queue.totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, queue.totalPages) },
    (_, index) => firstPage + index,
  );

  return (
    <nav
      aria-label="Full-text screening queue pagination"
      className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className={`${t.caption} ${t.num}`} aria-live="polite">
        {queue.filteredTotal > 0
          ? `Showing ${queue.rangeStart}–${queue.rangeEnd} of ${queue.filteredTotal}`
          : 'Showing 0 of 0'}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          disabled={queue.page === 1 || isPending}
          onClick={() => onPageChange(queue.page - 1)}
          aria-label="Previous queue page"
        >
          Previous
        </Button>
        {visiblePages.map((page) => (
          <Button
            key={page}
            size="sm"
            variant={page === queue.page ? 'primary' : 'secondary'}
            onClick={() => onPageChange(page)}
            disabled={isPending}
            aria-label={`Queue page ${page}`}
            aria-current={page === queue.page ? 'page' : undefined}
            className={`min-w-8 ${t.num}`}
          >
            {page}
          </Button>
        ))}
        <Button
          size="sm"
          disabled={queue.page === queue.totalPages || isPending}
          onClick={() => onPageChange(queue.page + 1)}
          aria-label="Next queue page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

/** Everything a row needs, derived once so the table and the card agree. */
function deriveRowModel(record: ScreeningRecord, currentReviewerId: string) {
  const resolution = getScreeningResolution(record);
  const reviewerDecisions = getReviewerDecisions(record);
  const status = getScreeningWorkStatus(record, currentReviewerId);
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #')
    ? record.leadAuthor
    : 'Author pending';

  return {
    resolution,
    reviewerDecisions,
    status,
    authorLabel,
    displayTitle: cleanDisplayTitle(record.title),
    includeVotes: reviewerDecisions.filter((d) => d.decision === 'include').length,
    excludeVotes: reviewerDecisions.filter((d) => d.decision === 'exclude').length,
    awaitingPdf: isAwaitingFullTextPdf(record),
    isMentalHealth: isMentalHealthScreeningRecord(record),
  };
}

type RowProps = {
  record: ScreeningRecord;
  href: string;
  currentReviewerId: string;
  isAdmin: boolean;
  isPending: boolean;
  onAttachPdf: (recordId: string, event: ChangeEvent<HTMLInputElement>) => void;
};

function QueueTableRow({ record, href, currentReviewerId, isAdmin, isPending, onAttachPdf }: RowProps) {
  const model = deriveRowModel(record, currentReviewerId);

  return (
    <Tr className="group">
      <Td className="relative max-w-[440px] pl-5">
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 w-[3px]', RAIL[STATUS_META[model.status].tone])}
        />
        <Link
          href={href}
          className="block rounded-ctl focus-visible:outline-none focus-visible:shadow-focus"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Tag mono>{record.assignedStudyId}</Tag>
            <span className={t.caption}>{model.authorLabel}</span>
            {model.isMentalHealth ? <Tag category="mental">Mental health</Tag> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-ink group-hover:text-navy-600">
            {model.displayTitle}
          </p>
        </Link>
      </Td>
      <Td>
        <AiSuggestion record={record} />
      </Td>
      <Td>
        <VoteReadout
          decisions={model.reviewerDecisions}
          includeVotes={model.includeVotes}
          excludeVotes={model.excludeVotes}
        />
      </Td>
      <Td>
        <div className="flex flex-col items-start gap-1.5">
          <StatusPill status={model.status} />
          {model.resolution === 'conflict' ? (
            <span className="text-[11px] font-semibold text-attention-ink">Resolve conflict</span>
          ) : null}
          {record.promotedPaperId ? (
            <Link href={`/paper/${record.promotedPaperId}`} className={buttonClasses('secondary', 'sm')}>
              Open extraction
            </Link>
          ) : null}
          {isAdmin && model.awaitingPdf ? (
            <AttachPdfControl recordId={record.id} isPending={isPending} onAttachPdf={onAttachPdf} />
          ) : null}
        </div>
      </Td>
    </Tr>
  );
}

function QueueCardRow({ record, href, currentReviewerId, isAdmin, isPending, onAttachPdf }: RowProps) {
  const model = deriveRowModel(record, currentReviewerId);

  return (
    <RecordRow tone={STATUS_META[model.status].tone}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag mono>{record.assignedStudyId}</Tag>
          <StatusPill status={model.status} />
          {model.isMentalHealth ? <Tag category="mental">Mental health</Tag> : null}
        </div>
        <Link
          href={href}
          className="block text-[13px] font-semibold leading-snug text-ink underline-offset-2 hover:text-navy-600 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
        >
          {model.displayTitle}
        </Link>
        <p className={t.caption}>{model.authorLabel}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <AiSuggestion record={record} />
          <VoteReadout
            decisions={model.reviewerDecisions}
            includeVotes={model.includeVotes}
            excludeVotes={model.excludeVotes}
          />
        </div>
        {record.promotedPaperId || (isAdmin && model.awaitingPdf) ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {record.promotedPaperId ? (
              <Link href={`/paper/${record.promotedPaperId}`} className={buttonClasses('secondary', 'sm')}>
                Open extraction
              </Link>
            ) : null}
            {isAdmin && model.awaitingPdf ? (
              <AttachPdfControl recordId={record.id} isPending={isPending} onAttachPdf={onAttachPdf} />
            ) : null}
          </div>
        ) : null}
      </div>
    </RecordRow>
  );
}

function AttachPdfControl({
  recordId,
  isPending,
  onAttachPdf,
}: {
  recordId: string;
  isPending: boolean;
  onAttachPdf: (recordId: string, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputId = `full-text-upload-${recordId}`;
  return (
    <>
      <input
        id={inputId}
        type="file"
        accept="application/pdf"
        className="sr-only"
        disabled={isPending}
        onChange={(event) => onAttachPdf(recordId, event)}
      />
      <label
        htmlFor={inputId}
        className={buttonClasses(
          'secondary',
          'sm',
          cn('cursor-pointer', isPending && 'pointer-events-none opacity-60'),
        )}
      >
        <FileArrowUp aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Attach PDF
      </label>
    </>
  );
}

const RAIL: Record<Tone, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  attention: 'bg-attention',
  neutral: 'bg-n-300',
  info: 'bg-navy-600',
};

function StatusPill({ status }: { status: ScreeningWorkStatus }) {
  const meta = STATUS_META[status];
  const Glyph = meta.icon;
  return (
    <Pill tone={meta.tone} icon={<Glyph weight="fill" />}>
      {meta.label}
    </Pill>
  );
}

/**
 * The AI carries the decision colours: green for include, red for exclude. It is
 * a suggestion rather than a decision, so the word "AI" and the reviewer columns
 * beside it are what say who is talking. Requested directly, over an earlier
 * attempt at the info tone, which made include and exclude too alike to scan.
 */
function AiSuggestion({ record }: { record: ScreeningRecord }) {
  if (record.aiStatus === 'running') {
    return (
      <Pill tone="neutral" dot>
        AI running
      </Pill>
    );
  }
  if (record.aiStatus === 'failed') {
    return (
      <Pill tone="attention" icon={<Warning weight="fill" />}>
        AI failed
      </Pill>
    );
  }
  if (record.aiSuggestedDecision === 'include') {
    return (
      <Pill tone="positive" icon={<CheckCircle weight="fill" />}>
        AI include
      </Pill>
    );
  }
  if (record.aiSuggestedDecision === 'exclude') {
    return (
      <Pill tone="negative" icon={<XCircle weight="fill" />}>
        AI exclude
      </Pill>
    );
  }
  return <Tag>Not run</Tag>;
}

function VoteReadout({
  decisions,
  includeVotes,
  excludeVotes,
}: {
  decisions: ReadonlyArray<{ decision: ScreeningDecision }>;
  includeVotes: number;
  excludeVotes: number;
}) {
  const totalVotes = decisions.length;
  const slots = [decisions[0]?.decision, decisions[1]?.decision];

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1">
        {slots.map((slot, index) => {
          if (slot === 'include') {
            return (
              <CheckCircle
                key={index}
                aria-hidden
                weight="fill"
                className="h-[18px] w-[18px] shrink-0 text-positive"
              />
            );
          }
          if (slot === 'exclude') {
            return (
              <XCircle
                key={index}
                aria-hidden
                weight="fill"
                className="h-[18px] w-[18px] shrink-0 text-negative"
              />
            );
          }
          return (
            <span
              key={index}
              aria-hidden
              className="h-[18px] w-[18px] shrink-0 rounded-full border border-dashed border-line-strong"
            />
          );
        })}
      </div>
      <div className="leading-tight">
        <span className={`text-[13px] font-semibold text-ink ${t.num}`}>
          {totalVotes}
          <span className="text-ink-soft">/2</span>
        </span>
        <span className="sr-only"> reviewer votes recorded. </span>
        <p className={t.caption}>
          {totalVotes === 0
            ? 'No votes'
            : [includeVotes > 0 ? `${includeVotes} include` : null, excludeVotes > 0 ? `${excludeVotes} exclude` : null]
                .filter(Boolean)
                .join(' · ')}
        </p>
      </div>
    </div>
  );
}
