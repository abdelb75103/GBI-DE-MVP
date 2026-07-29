'use client';

import {
  ArrowCircleUpRight,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  CircleDashed,
  FileArrowUp,
  Flag,
  NotePencil,
  Sparkle,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  buttonClasses,
  ButtonLink,
  Card,
  cn,
  Decide,
  Field,
  Input,
  Meter,
  PageHead,
  Pill,
  Segmented,
  Select,
  t,
  Tag,
  Textarea,
} from '@/components/ui';
import type { Tone } from '@/components/ui';
import {
  EXCLUSION_REASONS,
  getReviewerDecisions,
  getScreeningResolution,
  isAwaitingFullTextPdf,
  summarizeExclusionReasons,
  type FullTextDecisionAction,
  type ExclusionReason,
} from '@/lib/screening/reviewer-decisions';
import {
  buildFullTextQueueUrl,
  buildFullTextReaderUrl,
  type FullTextQueueContext,
  type FullTextReviewerProgress,
} from '@/lib/screening/full-text-queue';
import { MobilePdfViewer } from '@/components/mobile-pdf-viewer';
import { isMentalHealthScreeningRecord } from '@/lib/screening/mental-health';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecord: ScreeningRecord;
  currentReviewerId: string;
  profileRole: 'admin' | 'extractor' | 'observer';
  queueContext: FullTextQueueContext;
  queuePosition: number;
  reviewerProgress: FullTextReviewerProgress;
  previousRecordUrl: string | null;
  nextRecordUrl: string | null;
};

type Notice = { tone: 'positive' | 'negative' | 'info'; message: string } | null;
type DuplicateWarning = {
  target: 'full_text' | 'extraction';
  matchedStudyId: string | null;
  matchedTitle: string;
  reason: string;
  score: number;
};
type FullTextReviewNote = {
  id: string;
  body: string;
  createdAt: string;
  createdByName?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  legacy?: boolean;
};
const cleanDisplayTitle = (title: string) => title.replace(/^Mock QA #\d+\s*-\s*/i, '');
const REVIEW_COMMENT_MAX_CHARS = 2000;
const FULL_TEXT_REVIEW_FLAGGED_KEY = 'fullTextReviewFlagged';
const FULL_TEXT_REVIEW_UPDATED_AT_KEY = 'fullTextReviewUpdatedAt';
const FULL_TEXT_REVIEW_UPDATED_BY_NAME_KEY = 'fullTextReviewUpdatedByName';
const FULL_TEXT_REVIEW_NOTES_KEY = 'fullTextReviewNotes';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const getFullTextReviewFlagged = (record: Pick<ScreeningRecord, 'metadata'>) =>
  record.metadata?.[FULL_TEXT_REVIEW_FLAGGED_KEY] === true;

const getFullTextReviewUpdatedAt = (record: Pick<ScreeningRecord, 'metadata'>) => {
  const value = record.metadata?.[FULL_TEXT_REVIEW_UPDATED_AT_KEY];
  return typeof value === 'string' && value.trim() ? value : null;
};

const getFullTextReviewUpdatedByName = (record: Pick<ScreeningRecord, 'metadata'>) => {
  const value = record.metadata?.[FULL_TEXT_REVIEW_UPDATED_BY_NAME_KEY];
  return typeof value === 'string' && value.trim() ? value : null;
};

const isFullTextReviewNote = (value: unknown): value is FullTextReviewNote => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<FullTextReviewNote>;
  return typeof candidate.id === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.createdAt === 'string';
};

const getFullTextReviewNotes = (record: Pick<ScreeningRecord, 'metadata' | 'notes' | 'updatedAt'>): FullTextReviewNote[] => {
  const stored = record.metadata?.[FULL_TEXT_REVIEW_NOTES_KEY];
  const notes = Array.isArray(stored) ? stored.filter(isFullTextReviewNote) : [];
  if (!record.notes?.trim()) return notes;
  return [
    ...notes,
    {
      id: '__legacy_notes__',
      body: record.notes.trim(),
      createdAt: record.updatedAt,
      legacy: true,
    },
  ];
};

const getExtractionReturnReason = (record: Pick<ScreeningRecord, 'metadata'>) => {
  const extractionReturn = record.metadata?.extractionReturn;
  if (!extractionReturn || typeof extractionReturn !== 'object' || Array.isArray(extractionReturn)) return null;
  const reason = (extractionReturn as { reason?: unknown }).reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
};

export function FullTextScreeningWorkspaceClient({
  initialRecord,
  currentReviewerId,
  profileRole,
  queueContext,
  queuePosition,
  reviewerProgress,
  previousRecordUrl,
  nextRecordUrl,
}: Props) {
  const router = useRouter();
  const [record, setRecord] = useState(initialRecord);
  const [decisionAction, setDecisionAction] = useState<FullTextDecisionAction>('reviewer_vote');
  const [decision, setDecision] = useState<ScreeningDecision | null>(null);
  const [reason, setReason] = useState<ExclusionReason | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const [isReviewPending, startReviewTransition] = useTransition();
  const isMobile = useIsMobile();
  const isAdmin = profileRole === 'admin';
  const awaitingPdf = isAwaitingFullTextPdf(record);
  const backToQueueUrl = buildFullTextQueueUrl({ ...queueContext, notice: null });

  const reviewerDecisions = useMemo(() => getReviewerDecisions(record), [record]);
  const resolution = getScreeningResolution(record);
  const exclusionReasonSummary = summarizeExclusionReasons(record);
  const firstTwoConflict =
    reviewerDecisions.length >= 2 &&
    reviewerDecisions[0]?.decision !== reviewerDecisions[1]?.decision;
  const thirdDecision = firstTwoConflict ? reviewerDecisions[2] : undefined;
  const currentReviewerVote = reviewerDecisions
    .slice(0, 2)
    .find((item) => item.reviewerProfileId === currentReviewerId);
  const canChangeReviewerVote = reviewerDecisions.length < 2 || Boolean(currentReviewerVote);
  const canRecordConsensus = firstTwoConflict;
  const activeDecisionAction = canRecordConsensus && (!canChangeReviewerVote || decisionAction === 'consensus_resolution')
    ? 'consensus_resolution'
    : 'reviewer_vote';
  const decisionMode = activeDecisionAction === 'consensus_resolution'
    ? thirdDecision ? 'Update conflict resolution' : 'Resolve conflict'
    : currentReviewerVote ? 'Update your vote' : 'Your vote';
  const canSubmitDecision = !awaitingPdf && (activeDecisionAction === 'consensus_resolution'
    ? canRecordConsensus
    : canChangeReviewerVote);
  const authorLabel = record.leadAuthor && !record.leadAuthor.startsWith('Covidence #') ? record.leadAuthor : null;
  const displayTitle = cleanDisplayTitle(record.title);
  const pdfVersion = record.fileSha256 || String(record.size || '') || 'latest';
  const pdfDirectUrl = `/api/full-text-screening/${record.id}/file?v=${encodeURIComponent(pdfVersion)}`;
  const pdfUrl = `${pdfDirectUrl}#view=FitH`;
  const isMentalHealth = isMentalHealthScreeningRecord(record);
  const [reviewFlagged, setReviewFlagged] = useState(() => getFullTextReviewFlagged(initialRecord));
  const [reviewComment, setReviewComment] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const aiHasDecision = record.aiSuggestedDecision === 'include' || record.aiSuggestedDecision === 'exclude';
  const aiDecisionLabel = record.aiStatus === 'running'
    ? 'Running'
    : record.aiStatus === 'failed'
      ? 'Failed'
      : record.aiSuggestedDecision === 'include'
        ? 'Include'
        : record.aiSuggestedDecision === 'exclude'
          ? 'Exclude'
          : 'Not run';
  /**
   * The AI verdict carries the decision colours: green for include, red for
   * exclude. A failed run is amber, since that is a state of the pipeline rather
   * than a view on the paper, and a run with no verdict is neutral.
   */
  const aiTone: Tone = record.aiStatus === 'failed'
    ? 'attention'
    : record.aiSuggestedDecision === 'include'
      ? 'positive'
      : record.aiSuggestedDecision === 'exclude'
        ? 'negative'
        : 'neutral';

  const totalReviewerVotes = reviewerDecisions.length;
  const includeVotes = reviewerDecisions.filter((d) => d.decision === 'include').length;
  const excludeVotes = reviewerDecisions.filter((d) => d.decision === 'exclude').length;
  const reviewNotes = useMemo(() => getFullTextReviewNotes(record), [record]);
  const editingNote = editingNoteId ? reviewNotes.find((note) => note.id === editingNoteId) ?? null : null;
  const extractionReturnReason = getExtractionReturnReason(record);
  const reviewUpdatedAt = getFullTextReviewUpdatedAt(record);
  const reviewUpdatedByName = getFullTextReviewUpdatedByName(record);
  const hasUnsavedReviewState =
    reviewFlagged !== getFullTextReviewFlagged(record) ||
    (editingNote ? reviewComment.trim() !== editingNote.body.trim() : reviewComment.trim().length > 0);
  // Notes are not a state, so the panel is a plain card. It only takes a colour
  // once the full text has actually been flagged, which is a state.
  const reviewCardClasses = reviewFlagged ? 'border border-negative-line bg-negative-tint' : '';

  const syncRecord = (nextRecord: ScreeningRecord) => {
    setRecord(nextRecord);
    setReviewFlagged(getFullTextReviewFlagged(nextRecord));
    setReviewComment('');
    setEditingNoteId(null);
  };

  const saveDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision) {
      setNotice({ tone: 'negative', message: 'Choose Include or Exclude.' });
      return;
    }
    if (!canSubmitDecision) {
      setNotice({
        tone: 'negative',
        message: activeDecisionAction === 'consensus_resolution'
          ? 'Conflict resolution is only available for conflicting reviewer decisions.'
          : 'This record already has two reviewer votes. Only an original reviewer can change their vote.',
      });
      return;
    }
    if (decision === 'exclude' && !reason) {
      setNotice({ tone: 'negative', message: 'Choose an exclusion reason.' });
      return;
    }
    if (decision === 'exclude' && reason === 'Other' && !otherReason.trim()) {
      setNotice({ tone: 'negative', message: 'Add the other exclusion reason.' });
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/full-text-screening/${record.id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decisionAction: activeDecisionAction,
          reason: decision === 'exclude' ? reason : null,
          otherReason,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        record?: ScreeningRecord;
        error?: string;
        duplicateWarnings?: DuplicateWarning[];
        promotedPaperId?: string;
        promotionError?: string;
      };
      if (!response.ok) {
        setNotice({ tone: 'negative', message: payload.error ?? 'Failed to save decision' });
        return;
      }
      if (!payload.record) {
        setNotice({ tone: 'negative', message: 'Failed to save decision' });
        return;
      }
      syncRecord(payload.record);
      setDecision(null);
      setReason('');
      setOtherReason('');
      const duplicateMessage = formatDuplicateWarningMessage(payload.duplicateWarnings ?? []);
      const promotionMessage = payload.promotionError
        ? ` Vote saved, but automatic promotion failed: ${payload.promotionError}`
        : payload.promotedPaperId
          ? ' Promoted to extraction.'
          : '';
      const savedMessage = duplicateMessage
        ? `${activeDecisionAction === 'consensus_resolution' ? 'Conflict resolution saved.' : 'Reviewer vote saved.'}${promotionMessage} ${duplicateMessage}`
        : activeDecisionAction === 'consensus_resolution'
          ? `Conflict resolution saved.${promotionMessage}`
          : `Reviewer vote saved.${promotionMessage}`;

      const navigationParams = new URLSearchParams({
        navigation: 'next',
        completedRecordId: record.id,
        filter: queueContext.filter,
        page: String(queueContext.page),
        position: String(queuePosition),
      });
      if (queueContext.search) navigationParams.set('search', queueContext.search);

      try {
        const navigationResponse = await fetch(`/api/full-text-screening?${navigationParams.toString()}`, {
          cache: 'no-store',
        });
        const navigationPayload = await navigationResponse.json().catch(() => ({})) as {
          nextRecordId?: string | null;
          error?: string;
        };
        if (!navigationResponse.ok) {
          throw new Error(navigationPayload.error ?? 'Next paper lookup failed');
        }
        if (navigationPayload.nextRecordId) {
          router.push(buildFullTextReaderUrl(navigationPayload.nextRecordId, queueContext, queuePosition));
          return;
        }
        router.push(buildFullTextQueueUrl({ ...queueContext, notice: 'filter_empty' }));
      } catch (error) {
        setNotice({
          tone: 'info',
          message: `${savedMessage} Next paper lookup failed: ${error instanceof Error ? error.message : 'unknown error'}. Use Back to queue.`,
        });
      }
    });
  };

  const attachPdf = (event: ChangeEvent<HTMLInputElement>) => {
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
      const response = await fetch(`/api/full-text-screening/${record.id}/file`, { method: 'POST', body: data });
      const payload = await response.json().catch(() => ({})) as { record?: ScreeningRecord; error?: string };
      event.target.value = '';
      if (!response.ok || !payload.record) {
        setNotice({ tone: 'negative', message: payload.error ?? 'PDF attach failed' });
        return;
      }
      syncRecord(payload.record);
      setNotice({ tone: 'positive', message: `Attached ${file.name} to this full-text record.` });
    });
  };

  const saveReviewState = () => {
    const trimmedComment = reviewComment.trim();
    if (trimmedComment.length > REVIEW_COMMENT_MAX_CHARS) {
      setNotice({ tone: 'negative', message: `Review comment must be ${REVIEW_COMMENT_MAX_CHARS} characters or fewer.` });
      return;
    }
    if (editingNoteId && !trimmedComment) {
      setNotice({ tone: 'negative', message: 'Edited note cannot be empty. Delete it instead.' });
      return;
    }

    startReviewTransition(async () => {
      const response = await fetch(`/api/full-text-screening/${record.id}/review-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagged: reviewFlagged,
          comment: trimmedComment,
          noteAction: editingNoteId ? 'edit' : trimmedComment ? 'add' : 'none',
          noteId: editingNoteId,
          updatedAt: record.updatedAt,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { record?: ScreeningRecord; error?: string };
      if (!response.ok || !payload.record) {
        setNotice({ tone: 'negative', message: payload.error ?? 'Failed to save review flag and comment.' });
        return;
      }
      syncRecord(payload.record);
      setNotice({ tone: 'positive', message: editingNoteId ? 'Note updated.' : trimmedComment ? 'Note saved.' : 'Flag saved.' });
    });
  };

  const editReviewNote = (note: FullTextReviewNote) => {
    setEditingNoteId(note.id);
    setReviewComment(note.body);
  };

  const cancelReviewNoteEdit = () => {
    setEditingNoteId(null);
    setReviewComment('');
  };

  const deleteReviewNote = (note: FullTextReviewNote) => {
    startReviewTransition(async () => {
      const response = await fetch(`/api/full-text-screening/${record.id}/review-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagged: reviewFlagged,
          noteAction: 'delete',
          noteId: note.id,
          updatedAt: record.updatedAt,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { record?: ScreeningRecord; error?: string };
      if (!response.ok || !payload.record) {
        setNotice({ tone: 'negative', message: payload.error ?? 'Failed to delete note.' });
        return;
      }
      syncRecord(payload.record);
      setNotice({ tone: 'positive', message: 'Note deleted.' });
    });
  };


  return (
    <div className={cn('flex w-full flex-col gap-6', isMobile && 'overflow-x-hidden')}>
      <PageHead
        eyebrow="Full-text screening"
        title={displayTitle}
        description={[authorLabel, record.year].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <ReaderNavigationLink href={previousRecordUrl} direction="previous" />
            <ReaderNavigationLink href={nextRecordUrl} direction="next" />
            {record.promotedPaperId ? (
              <ButtonLink
                href={`/paper/${record.promotedPaperId}`}
                icon={<ArrowCircleUpRight weight="fill" />}
              >
                Open extraction
              </ButtonLink>
            ) : null}
            <ButtonLink href={backToQueueUrl} icon={<ArrowLeft weight="bold" />}>
              Back to queue
            </ButtonLink>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag mono>{record.assignedStudyId}</Tag>
            {isMentalHealth ? <Tag category="mental">Mental health</Tag> : null}
            <ResolutionPill resolution={resolution} />
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className={t.label}>Your screening progress</span>
              <span className={`text-xs font-semibold text-ink ${t.num}`}>
                {reviewerProgress.completed}/{reviewerProgress.total} papers · {reviewerProgress.percent}%
              </span>
            </div>
            <Meter
              className="mt-2"
              value={reviewerProgress.percent}
              tone="info"
              label="Your full-text screening progress"
            />
          </div>
        </div>
      </PageHead>

      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

      <Card
        flush
        className={cn(
          'grid min-h-[calc(100vh-260px)] lg:grid-cols-[minmax(0,1fr)_400px]',
          isMobile && 'overflow-x-hidden',
        )}
      >
        <div className="flex min-w-0 flex-col border-b border-line bg-surface-sunk lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
            <div>
              <p className={t.label}>PDF source</p>
              <p className={`mt-0.5 ${t.caption}`}>Evidence workspace</p>
            </div>
            {!awaitingPdf ? (
              <a
                href={pdfDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassesForLink}
              >
                <ArrowSquareOut aria-hidden weight="bold" className="h-4 w-4" />
                Open PDF
              </a>
            ) : null}
          </div>
          <div className={cn('flex min-h-0 flex-1', isMobile ? 'overflow-x-hidden px-0 pb-0' : 'px-3 pb-3')}>
            <div
              className={cn(
                'flex w-full bg-surface',
                isMobile
                  ? 'min-h-[78dvh] overflow-x-hidden'
                  : 'min-h-[calc(100vh-340px)] overflow-hidden rounded-card shadow-e1',
              )}
            >
              {awaitingPdf ? (
                <div className="grid w-full place-items-center p-8 text-center">
                  <div className="max-w-md">
                    <Alert tone="attention" title="Full-text PDF required">
                      This record came through title and abstract screening and is waiting for the full-text
                      PDF before reviewer voting or AI review can begin.
                    </Alert>
                    {isAdmin ? (
                      <div className="mt-4 flex justify-center">
                        <input
                          id="workspace-pdf-upload"
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          disabled={isPending}
                          onChange={attachPdf}
                        />
                        <label
                          htmlFor="workspace-pdf-upload"
                          className={cn(uploadLabelClasses, isPending && 'pointer-events-none opacity-60')}
                        >
                          <FileArrowUp aria-hidden weight="bold" className="h-4 w-4" />
                          {isPending ? 'Uploading…' : 'Upload full-text PDF'}
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : isMobile ? (
                <MobilePdfViewer src={pdfDirectUrl} title={`${record.assignedStudyId} full text PDF`} />
              ) : (
                <iframe
                  src={pdfUrl}
                  className="h-full min-h-[calc(100vh-340px)] w-full flex-1 border-0 bg-surface"
                  title={`${record.assignedStudyId} full text PDF`}
                  allow="fullscreen"
                />
              )}
            </div>
          </div>
        </div>

        {/* The decision rail. It is the only place on this screen that fills with
            a decision colour, so what a reviewer concluded is never competing
            with what the panel around it is made of. */}
        <form onSubmit={saveDecision} className="flex min-w-0 flex-col gap-5 p-5">
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={t.section}>{decisionMode}</h2>
              {currentReviewerVote ? (
                <span className={t.caption}>You voted {currentReviewerVote.decision}</span>
              ) : null}
            </div>

            {firstTwoConflict ? (
              <Segmented
                className="mt-3"
                label="What this decision records"
                value={activeDecisionAction}
                onChange={setDecisionAction}
                items={[
                  { value: 'reviewer_vote', label: 'Change my vote', disabled: isPending || !canChangeReviewerVote },
                  { value: 'consensus_resolution', label: 'Resolve conflict', disabled: isPending },
                ]}
              />
            ) : null}

            <Decide
              className="mt-4 grid w-full grid-cols-2 [&>button]:w-full"
              label={decisionMode}
              value={decision}
              onChange={(kind) => setDecision(kind as ScreeningDecision)}
              options={[
                { kind: 'include', label: 'Include', disabled: isPending },
                { kind: 'exclude', label: 'Exclude', disabled: isPending },
              ]}
            />

            {decision === 'exclude' ? (
              <div className="mt-3 space-y-3">
                <Field label="Exclusion reason">
                  {({ id }) => (
                    <Select
                      id={id}
                      disabled={isPending}
                      value={reason}
                      onChange={(event) => setReason(event.target.value as ExclusionReason)}
                    >
                      <option value="">Select exclusion reason</option>
                      {EXCLUSION_REASONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {reason === 'Other' ? (
                  <Field label="Other exclusion reason">
                    {({ id }) => (
                      <Input
                        id={id}
                        disabled={isPending}
                        value={otherReason}
                        onChange={(event) => setOtherReason(event.target.value)}
                        placeholder="Describe the reason"
                      />
                    )}
                  </Field>
                ) : null}
              </div>
            ) : null}

            {!canSubmitDecision ? (
              <Alert tone="attention" className="mt-3">
                {awaitingPdf
                  ? 'Attach the full-text PDF before reviewer voting.'
                  : 'Two reviewer votes are already recorded. Only an original reviewer can change their vote, unless there is a conflict to resolve.'}
              </Alert>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isPending}
              disabled={isPending || !canSubmitDecision}
              className="mt-4 w-full"
            >
              {activeDecisionAction === 'consensus_resolution' ? 'Save conflict resolution' : 'Save reviewer vote'}
            </Button>

            {activeDecisionAction === 'consensus_resolution' ? (
              <p className={`mt-3 ${t.caption}`}>
                Stored as the final conflict decision. The first two reviewer votes remain unchanged.
              </p>
            ) : null}
          </section>

          <Card className="bg-surface-sunk shadow-e0">
            <div className="flex items-center justify-between gap-3">
              <p className={t.label}>
                <Sparkle aria-hidden weight="fill" className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
                AI suggestion
              </p>
              <Pill
                tone={aiTone}
                dot={!aiHasDecision}
                icon={
                  aiHasDecision
                    ? record.aiSuggestedDecision === 'include'
                      ? <CheckCircle weight="fill" />
                      : <XCircle weight="fill" />
                    : undefined
                }
              >
                {aiDecisionLabel}
              </Pill>
            </div>
            {record.aiReason ? (
              <p className={`mt-3 ${t.body}`}>{record.aiReason}</p>
            ) : (
              <p className={`mt-3 ${t.body} text-ink-soft`}>No AI recommendation has been recorded yet.</p>
            )}
            <p className={`mt-3 ${t.caption}`}>Advisory only. Final eligibility depends on reviewer votes.</p>
          </Card>

          <Card className="shadow-e0 ring-1 ring-line">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={t.label}>Resolution</p>
                <div className="mt-2">
                  <ResolutionPill resolution={resolution} />
                </div>
                {extractionReturnReason ? (
                  <p className={`mt-2 max-w-[18rem] ${t.caption}`}>{extractionReturnReason}</p>
                ) : null}
              </div>
              <div className="min-w-0 text-right">
                <p className={t.label}>Reviewer votes</p>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <VoteSlots decisions={reviewerDecisions} />
                  <span className={`text-[13px] font-semibold text-ink ${t.num}`}>
                    {totalReviewerVotes}
                    <span className="text-ink-soft">/2</span>
                  </span>
                </div>
                {totalReviewerVotes > 0 ? (
                  <p className={`mt-1 ${t.caption}`}>
                    {[
                      includeVotes > 0 ? `${includeVotes} include` : null,
                      excludeVotes > 0 ? `${excludeVotes} exclude` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
            {firstTwoConflict ? (
              <Alert tone="attention" className="mt-4">
                Conflict, awaiting resolution.
              </Alert>
            ) : null}
          </Card>

          {reviewerDecisions.length > 0 || exclusionReasonSummary ? (
            <section>
              <p className={t.label}>Reviewer history</p>
              <ul className="mt-3 space-y-2">
                {reviewerDecisions.map((item, index) => {
                  const isInclude = item.decision === 'include';
                  const initials = (item.reviewerName ?? 'Reviewer')
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('') || 'R';
                  return (
                    <li
                      key={`${item.reviewerProfileId}-${item.decidedAt}`}
                      className="relative flex items-start gap-3 overflow-hidden rounded-card bg-surface py-2.5 pl-[15px] pr-3 shadow-e1"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-y-0 left-0 w-[3px]',
                          isInclude ? 'bg-positive' : 'bg-negative',
                        )}
                      />
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunk text-[11px] font-semibold tracking-wide text-ink-muted"
                      >
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-ink">
                            {item.reviewerName ?? 'Reviewer'}
                          </span>
                          {firstTwoConflict && index === 2 ? <Tag>Final</Tag> : null}
                        </div>
                        {item.reason ? <p className={`mt-1 truncate ${t.caption}`}>{item.reason}</p> : null}
                      </div>
                      <Pill
                        tone={isInclude ? 'positive' : 'negative'}
                        icon={isInclude ? <CheckCircle weight="fill" /> : <XCircle weight="fill" />}
                        className="shrink-0"
                      >
                        {isInclude ? 'Include' : 'Exclude'}
                      </Pill>
                    </li>
                  );
                })}
              </ul>
              {exclusionReasonSummary ? (
                <p className={`mt-3 ${t.caption}`}>Exclusion reasons: {exclusionReasonSummary}</p>
              ) : null}
            </section>
          ) : null}

          <Card className={cn('shadow-e0 ring-1 ring-line', reviewCardClasses)}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={t.label}>
                  <NotePencil aria-hidden weight="fill" className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
                  Notes
                </p>
                <p className={`mt-1.5 ${t.caption}`}>
                  Save follow-up notes as separate entries, or flag this full text when it needs attention.
                </p>
              </div>
              <Button
                variant={reviewFlagged ? 'dangerSoft' : 'secondary'}
                size="sm"
                disabled={isReviewPending}
                aria-pressed={reviewFlagged}
                onClick={() => setReviewFlagged((current) => !current)}
                icon={<Flag weight={reviewFlagged ? 'fill' : 'regular'} />}
                className="shrink-0"
              >
                {reviewFlagged ? 'Flagged' : 'Flag'}
              </Button>
            </div>

            <Field
              className="mt-3"
              label={editingNote ? 'Edit saved note' : 'Add a new note'}
              help={`${reviewComment.trim().length}/${REVIEW_COMMENT_MAX_CHARS}${editingNote ? ' · editing a saved note' : ''}`}
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  value={reviewComment}
                  disabled={isReviewPending}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={2}
                  placeholder={editingNote ? 'Edit saved note' : 'Add a new note'}
                  className="max-h-[180px]"
                />
              )}
            </Field>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {reviewUpdatedAt ? (
                <p className={t.caption}>
                  {reviewUpdatedByName ? `${reviewUpdatedByName} · ` : ''}
                  {new Date(reviewUpdatedAt).toLocaleString()}
                </p>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {editingNote ? (
                  <Button size="sm" disabled={isReviewPending} onClick={cancelReviewNoteEdit}>
                    Cancel
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  size="sm"
                  loading={isReviewPending}
                  disabled={isReviewPending || !hasUnsavedReviewState}
                  onClick={saveReviewState}
                >
                  {editingNote ? 'Update note' : reviewComment.trim() ? 'Save note' : 'Save flag'}
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {reviewNotes.length > 0 ? (
                reviewNotes.map((note) => (
                  <div key={note.id} className="rounded-card bg-surface-sunk p-3 shadow-e0">
                    <p className={`whitespace-pre-wrap ${t.body}`}>{note.body}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className={t.caption}>
                        {note.createdByName ? `${note.createdByName} · ` : ''}
                        {new Date(note.updatedAt ?? note.createdAt).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" disabled={isReviewPending} onClick={() => editReviewNote(note)}>
                          Edit
                        </Button>
                        <Button
                          variant="dangerSoft"
                          size="sm"
                          disabled={isReviewPending}
                          onClick={() => deleteReviewNote(note)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className={`rounded-card border border-dashed border-line px-3 py-3 ${t.caption}`}>
                  No saved notes yet.
                </p>
              )}
            </div>
          </Card>
        </form>
      </Card>
    </div>
  );
}

/**
 * Both of these are anchors styled as buttons, so they keep `buttonClasses`
 * rather than becoming `Button`s with an onClick.
 */
const buttonClassesForLink = buttonClasses('secondary', 'sm', 'no-underline');
const uploadLabelClasses = buttonClasses('primary', 'md', 'cursor-pointer');

function ReaderNavigationLink({ href, direction }: { href: string | null; direction: 'previous' | 'next' }) {
  const isPrevious = direction === 'previous';
  const label = isPrevious ? 'Previous' : 'Next';
  const icon = isPrevious ? <ArrowLeft weight="bold" /> : <ArrowRight weight="bold" />;

  // A missing neighbour is still shown, so the reader can see where they are in
  // the queue, but it is inert and announced as such.
  if (!href) {
    return (
      <span aria-disabled="true" className={buttonClasses('secondary', 'md', 'cursor-not-allowed opacity-45')}>
        {isPrevious ? <span aria-hidden className="inline-flex h-[15px] w-[15px]">{icon}</span> : null}
        {label}
        {isPrevious ? null : <span aria-hidden className="inline-flex h-[15px] w-[15px]">{icon}</span>}
      </span>
    );
  }

  return isPrevious ? (
    <ButtonLink href={href} icon={icon}>
      {label}
    </ButtonLink>
  ) : (
    <ButtonLink href={href}>
      {label}
      <span aria-hidden className="inline-flex h-[15px] w-[15px] items-center justify-center [&>svg]:h-full [&>svg]:w-full">
        {icon}
      </span>
    </ButtonLink>
  );
}

function VoteSlots({ decisions }: { decisions: ReadonlyArray<{ decision: ScreeningDecision }> }) {
  const slots = [decisions[0]?.decision, decisions[1]?.decision];
  return (
    <div className="flex items-center gap-1.5">
      {slots.map((slot, index) => {
        if (slot === 'include') {
          return <CheckCircle key={index} aria-hidden weight="fill" className="h-5 w-5 shrink-0 text-positive" />;
        }
        if (slot === 'exclude') {
          return <XCircle key={index} aria-hidden weight="fill" className="h-5 w-5 shrink-0 text-negative" />;
        }
        return (
          <span
            key={index}
            aria-hidden
            className="h-5 w-5 shrink-0 rounded-full border border-dashed border-line-strong"
          />
        );
      })}
    </div>
  );
}

const RESOLUTION_META = {
  awaiting_pdf: { label: 'Upload full text', tone: 'neutral', icon: FileArrowUp },
  pending: { label: 'Pending', tone: 'neutral', icon: CircleDashed },
  ready_for_extraction: { label: 'Ready for extraction', tone: 'positive', icon: CheckCircle },
  excluded: { label: 'Excluded', tone: 'negative', icon: XCircle },
  conflict: { label: 'Conflict', tone: 'attention', icon: Warning },
  promoted: { label: 'Promoted', tone: 'info', icon: ArrowCircleUpRight },
} as const satisfies Record<string, { label: string; tone: Tone; icon: typeof CheckCircle }>;

function ResolutionPill({ resolution }: { resolution: ReturnType<typeof getScreeningResolution> }) {
  const meta = RESOLUTION_META[resolution];
  const Glyph = meta.icon;
  return (
    <Pill tone={meta.tone} icon={<Glyph weight="fill" />}>
      {meta.label}
    </Pill>
  );
}

function formatDuplicateWarningMessage(warnings: DuplicateWarning[]) {
  const warning = warnings[0];
  if (!warning) {
    return '';
  }
  const study = warning.matchedStudyId ? `${warning.matchedStudyId}: ` : '';
  const extraCount = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : '';
  return `Possible duplicate found in extraction: ${study}${warning.matchedTitle}${extraCount}. Please check before continuing.`;
}
