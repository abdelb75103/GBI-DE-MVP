'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useTransition } from 'react';
import type { ExtractionTab, ExtractionFieldMetric, PaperStatus } from '@/lib/types';
import { isTaggedAutoCompleteStatus } from '@/lib/status-groups';
import { Button, Modal, Toast, ToastViewport } from '@/components/ui';

type FieldUpdate = {
  paperId: string;
  tab: ExtractionTab;
  fieldId: string;
  value: string | null;
  metric?: ExtractionFieldMetric | null;
};

type WorkspaceSaveContextType = {
  hasUnsavedChanges: boolean;
  hasPendingAiDecisions: boolean;
  isPending: boolean;
  markAsChanged: () => void;
  markAsSaved: () => void;
  handleSave: (markComplete: boolean, shouldNavigate?: boolean) => void;
  handleDiscard: () => void;
  updateField: (update: FieldUpdate) => void;
  getFieldValue: (tab: ExtractionTab, fieldId: string) => string | null | undefined;
  currentStatus: PaperStatus;
  setCurrentStatus: (status: PaperStatus) => void;
  setPendingAiDecisions: (count: number) => void;
};

export const WorkspaceSaveContext = createContext<WorkspaceSaveContextType>({
  hasUnsavedChanges: false,
  hasPendingAiDecisions: false,
  isPending: false,
  markAsChanged: () => {},
  markAsSaved: () => {},
  handleSave: () => {},
  handleDiscard: () => {},
  updateField: () => {},
  getFieldValue: () => undefined,
  currentStatus: 'uploaded',
  setCurrentStatus: () => {},
  setPendingAiDecisions: () => {},
});

export function useWorkspaceSave() {
  return useContext(WorkspaceSaveContext);
}

type WorkspaceSaveManagerProps = {
  paperId: string;
  currentStatus: PaperStatus;
  readOnly?: boolean;
  children: React.ReactNode;
};

const MAX_PENDING_UPDATES = 100; // Warn when exceeding this
const AUTO_SAVE_THRESHOLD = 150; // Auto-save when reaching this
export function WorkspaceSaveManager({ paperId, currentStatus, children, readOnly = false }: WorkspaceSaveManagerProps) {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [paperStatus, setPaperStatus] = useState<PaperStatus>(currentStatus);

  // Store all pending field updates locally (not saved to DB yet)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, FieldUpdate>>(new Map());
  const [shouldAutoSave, setShouldAutoSave] = useState(false);
  const [pendingAiDecisions, setPendingAiDecisionsState] = useState(0);
  const hasPendingAiDecisions = pendingAiDecisions > 0;
  const shouldBlockNavigation = hasUnsavedChanges || hasPendingAiDecisions;

  // Discard is a destructive action, so it always asks a second time before it
  // runs. `discardIntent` records why the confirmation was opened: from the
  // standalone `handleDiscard` context method, or from the "Discard all
  // changes" action inside the navigation-blocked modal below.
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discardIntent, setDiscardIntent] = useState<'standalone' | 'navigation' | null>(null);
  const [aiDecisionsBlockOpen, setAiDecisionsBlockOpen] = useState(false);

  useEffect(() => {
    setPaperStatus(currentStatus);
  }, [currentStatus]);

  // Browser tab/window close warning (native browser dialog)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldBlockNavigation) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldBlockNavigation]);

  // Intercept all link clicks for navigation blocking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldBlockNavigation) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement | null;

      if (link && link.href) {
        // Check if it's an internal navigation
        const url = new URL(link.href);
        if (url.origin === window.location.origin) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(link.href);
          setShowModal(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [shouldBlockNavigation]);

  // Intercept browser back button
  useEffect(() => {
    if (!shouldBlockNavigation) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Push the current state back to prevent navigation
      window.history.pushState(null, '', window.location.href);
      setShowModal(true);
    };

    // Add a history entry when there are unsaved changes
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldBlockNavigation]);

  const markAsChanged = () => {
    setHasUnsavedChanges(true);
    setMessage(null);
    setError(null);
  };

  const markAsSaved = () => {
    setHasUnsavedChanges(false);
  };

  // Watch for auto-save threshold - use effect to avoid stale closure
  useEffect(() => {
    if (pendingUpdates.size >= AUTO_SAVE_THRESHOLD && hasUnsavedChanges && !isPending) {
      console.warn(`Auto-saving due to ${pendingUpdates.size} pending updates`);
      setShouldAutoSave(true);
    }
  }, [pendingUpdates.size, hasUnsavedChanges, isPending]);

  // Perform auto-save when triggered
  useEffect(() => {
    if (shouldAutoSave) {
      handleSave(false);
      setShouldAutoSave(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoSave]);

  // Show warning when exceeding threshold
  useEffect(() => {
    if (pendingUpdates.size > MAX_PENDING_UPDATES && pendingUpdates.size < AUTO_SAVE_THRESHOLD) {
      setShowWarning(true);
    } else if (pendingUpdates.size <= MAX_PENDING_UPDATES) {
      setShowWarning(false);
    }
  }, [pendingUpdates.size]);

  // Update a field locally (not saved to DB yet)
  const updateField = (update: FieldUpdate) => {
    if (readOnly) {
      return; // Don't allow updates in read-only mode
    }
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.set(`${update.tab}:${update.fieldId}`, update);
      return next;
    });
    markAsChanged();
  };

  // Get the current value of a field (from pending updates or undefined if not changed)
  const getFieldValue = (tab: ExtractionTab, fieldId: string): string | null | undefined => {
    const key = `${tab}:${fieldId}`;
    const update = pendingUpdates.get(key);
    return update?.value;
  };

  const handleSave = async (markComplete: boolean, shouldNavigate = false) => {
    if (hasPendingAiDecisions) {
      setError('Resolve all AI extracted fields by approving or declining them before saving.');
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const shouldPromoteToExtracted = markComplete && !isTaggedAutoCompleteStatus(paperStatus);

      try {
        // Step 1: Save all pending field updates
        if (pendingUpdates.size > 0) {
          const updatesByTab = new Map<ExtractionTab, Map<string, FieldUpdate>>();

          for (const update of pendingUpdates.values()) {
            if (!updatesByTab.has(update.tab)) {
              updatesByTab.set(update.tab, new Map());
            }
            updatesByTab.get(update.tab)!.set(update.fieldId, update);
          }

          const batchedUpdates = Array.from(updatesByTab.entries())
            .map(([tab, updates]) => {
              if (!updates.size) {
                return null;
              }
              const fields = Object.fromEntries(
                Array.from(updates.values()).map((u) => {
                  if (typeof u.value === 'string') {
                    return [u.fieldId, u.value];
                  }
                  return [u.fieldId, u.value ?? ''];
                }),
              );
              return { tab, fields };
            })
            .filter((entry): entry is { tab: ExtractionTab; fields: Record<string, string> } => Boolean(entry));

          if (batchedUpdates.length) {
            const response = await fetch('/api/extract/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paperId, updates: batchedUpdates }),
            });

            if (!response.ok) {
              const payload = (await response.json().catch(() => ({}))) as { error?: string };
              throw new Error(payload.error ?? 'Failed to save field updates');
            }

            setPendingUpdates(new Map());
          }
        }

        // Step 2: Update the paper status to 'extracted' only if allowed
        if (shouldPromoteToExtracted) {
          const response = await fetch(`/api/papers/${paperId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'extracted' }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? 'Failed to update status');
          }

          setPaperStatus('extracted');
        }

        setMessage(markComplete ? 'Saved and marked as complete' : 'Changes saved successfully');
        setHasUnsavedChanges(false);

        // Navigate if there was a pending navigation
        if (shouldNavigate && pendingNavigation) {
          const url = new URL(pendingNavigation);
          router.push(`${url.pathname}${url.search}`, { scroll: true });
          setPendingNavigation(null);
        } else {
          router.refresh();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';
        setError(errorMessage);
      }
    });
  };

  // Entry point for a standalone discard (no pending navigation attached).
  // Currently unused by the shipped UI, but kept on the context for future
  // callers, so it must obey the same no-native-dialog rule as the modal below.
  const handleDiscard = () => {
    if (hasPendingAiDecisions) {
      setAiDecisionsBlockOpen(true);
      return;
    }
    setDiscardIntent('standalone');
    setDiscardConfirmOpen(true);
  };

  const openDiscardConfirm = () => {
    setDiscardIntent('navigation');
    setDiscardConfirmOpen(true);
  };

  const confirmDiscard = () => {
    setPendingUpdates(new Map());
    setHasUnsavedChanges(false);
    setDiscardConfirmOpen(false);
    setShowModal(false);

    if (discardIntent === 'navigation') {
      if (pendingNavigation) {
        const url = new URL(pendingNavigation);
        router.push(`${url.pathname}${url.search}`, { scroll: true });
        setPendingNavigation(null);
      } else {
        // Go back if browser back was pressed
        window.history.back();
      }
    } else {
      router.refresh();
    }
    setDiscardIntent(null);
  };

  return (
    <WorkspaceSaveContext.Provider
      value={{
        hasUnsavedChanges,
        hasPendingAiDecisions,
        isPending,
        markAsChanged,
        markAsSaved,
        handleSave,
        handleDiscard,
        updateField,
        getFieldValue,
        currentStatus: paperStatus,
        setCurrentStatus: setPaperStatus,
        setPendingAiDecisions: setPendingAiDecisionsState,
      }}
    >
      {/* Modal when trying to leave with unsaved changes. This must be answered:
          "Stay on this page" is always available, but Escape and the backdrop
          do not silently discard the warning. */}
      <Modal
        open={showModal && shouldBlockNavigation}
        onClose={() => {
          setShowModal(false);
          setPendingNavigation(null);
        }}
        title="You have unsaved changes"
        description="Would you like to save your work before leaving?"
        dismissible={false}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowModal(false);
                setPendingNavigation(null);
              }}
              disabled={isPending}
            >
              Stay on this page
            </Button>
            <Button variant="danger" onClick={openDiscardConfirm} disabled={isPending}>
              Discard all {pendingUpdates.size} changes
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                handleSave(false, true);
                setShowModal(false);
              }}
              loading={isPending}
            >
              Save &amp; continue working
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                handleSave(true, true);
                setShowModal(false);
              }}
              loading={isPending}
            >
              Save &amp; mark complete
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {hasUnsavedChanges ? (
            <p>
              You have <strong>{pendingUpdates.size} unsaved changes</strong>. All progress will be{' '}
              <strong className="text-negative-ink">permanently lost</strong> if you discard. We strongly recommend
              saving your work.
            </p>
          ) : null}
          {hasPendingAiDecisions ? (
            <p className="text-attention-ink">
              Approve or decline <strong>{pendingAiDecisions}</strong> AI extracted fields before leaving this paper.
            </p>
          ) : null}
        </div>
      </Modal>

      {/* Second, explicit confirmation before an irreversible discard runs. */}
      <Modal
        open={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        title="Discard all unsaved changes?"
        description="This will reload the page and cannot be undone."
        dismissible={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscardConfirmOpen(false)}>
              Keep my changes
            </Button>
            <Button variant="danger" onClick={confirmDiscard}>
              Discard permanently
            </Button>
          </>
        }
      >
        <p>
          You are about to permanently delete <strong>{pendingUpdates.size} unsaved changes</strong>. This action
          cannot be undone.
        </p>
      </Modal>

      {/* Informational stop when AI decisions must be resolved before discarding. */}
      <Modal
        open={aiDecisionsBlockOpen}
        onClose={() => setAiDecisionsBlockOpen(false)}
        title="Resolve AI extracted fields first"
        description="Approve or decline all AI extracted fields before leaving this paper."
        footer={
          <Button variant="secondary" onClick={() => setAiDecisionsBlockOpen(false)}>
            Ok
          </Button>
        }
      />

      <ToastViewport>
        {showWarning && pendingUpdates.size > MAX_PENDING_UPDATES ? (
          <Toast tone="attention" onDismiss={() => setShowWarning(false)}>
            <p className="font-semibold">You have {pendingUpdates.size} unsaved changes</p>
            <p className="mt-1 text-ink-soft">
              Consider saving soon to avoid data loss. Auto-save will trigger at {AUTO_SAVE_THRESHOLD} changes.
            </p>
          </Toast>
        ) : null}
        {message ? <Toast tone="positive">{message}</Toast> : null}
        {error ? <Toast tone="negative">{error}</Toast> : null}
      </ToastViewport>

      {children}
    </WorkspaceSaveContext.Provider>
  );
}
