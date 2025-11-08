'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useTransition } from 'react';
import type { ExtractionTab, ExtractionFieldMetric } from '@/lib/types';

type FieldUpdate = {
  paperId: string;
  tab: ExtractionTab;
  fieldId: string;
  value: string | null;
  metric?: ExtractionFieldMetric | null;
};

type WorkspaceSaveContextType = {
  hasUnsavedChanges: boolean;
  isPending: boolean;
  markAsChanged: () => void;
  markAsSaved: () => void;
  handleSave: (markComplete: boolean, shouldNavigate?: boolean) => void;
  handleDiscard: () => void;
  updateField: (update: FieldUpdate) => void;
  getFieldValue: (tab: ExtractionTab, fieldId: string) => string | null | undefined;
};

export const WorkspaceSaveContext = createContext<WorkspaceSaveContextType>({
  hasUnsavedChanges: false,
  isPending: false,
  markAsChanged: () => {},
  markAsSaved: () => {},
  handleSave: () => {},
  handleDiscard: () => {},
  updateField: () => {},
  getFieldValue: () => undefined,
});

export function useWorkspaceSave() {
  return useContext(WorkspaceSaveContext);
}

type WorkspaceSaveManagerProps = {
  paperId: string;
  currentStatus: string;
  readOnly?: boolean;
  children: React.ReactNode;
};

const MAX_PENDING_UPDATES = 100; // Warn when exceeding this
const AUTO_SAVE_THRESHOLD = 150; // Auto-save when reaching this

export function WorkspaceSaveManager({ paperId, children, readOnly = false }: WorkspaceSaveManagerProps) {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  
  // Store all pending field updates locally (not saved to DB yet)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, FieldUpdate>>(new Map());
  const [shouldAutoSave, setShouldAutoSave] = useState(false);

  // Browser tab/window close warning (native browser dialog)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept all link clicks for navigation blocking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;

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
  }, [hasUnsavedChanges]);

  // Intercept browser back button
  useEffect(() => {
    if (!hasUnsavedChanges) return;

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
  }, [hasUnsavedChanges]);

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
    startTransition(async () => {
      setError(null);
      setMessage(null);

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
                    const trimmed = u.value.trim();
                    return [u.fieldId, trimmed || ''];
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

        // Step 2: Update the paper status to 'extracted' only if marking complete
        if (markComplete) {
          const response = await fetch(`/api/papers/${paperId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'extracted' }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? 'Failed to update status');
          }
        }

        setMessage(markComplete ? 'Saved and marked as complete' : 'Changes saved successfully');
        setHasUnsavedChanges(false);
        
        // Navigate if there was a pending navigation
        if (shouldNavigate && pendingNavigation) {
          const url = new URL(pendingNavigation);
          router.push(url.pathname);
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

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard all unsaved changes? This will reload the page.')) {
      setPendingUpdates(new Map());
      setHasUnsavedChanges(false);
      router.refresh();
    }
  };

  return (
    <WorkspaceSaveContext.Provider value={{ hasUnsavedChanges, isPending, markAsChanged, markAsSaved, handleSave, handleDiscard, updateField, getFieldValue }}>
      {/* Modal when trying to leave with unsaved changes */}
      {showModal && hasUnsavedChanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-2xl ring-1 ring-slate-200/60">
            {/* Decorative gradient background */}
            <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" aria-hidden />
            <div className="absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" aria-hidden />
            
            <div className="relative z-10 p-8">
              {/* Header with icon */}
              <div className="mb-6 flex items-start gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 p-3 shadow-sm ring-1 ring-amber-200/40">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-7 w-7 text-amber-600"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">You Have Unsaved Changes</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Would you like to save your work before leaving?
                  </p>
                </div>
              </div>
              
              {/* Message */}
              <div className="mb-6 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/40">
                <p className="text-sm leading-relaxed text-slate-700">
                  You have <strong>{pendingUpdates.size} unsaved changes</strong>. All progress will be <strong className="text-rose-700">permanently lost</strong> if you discard. We strongly recommend saving your work.
                </p>
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleSave(true, true);
                    setShowModal(false);
                  }}
                  disabled={isPending}
                  className="w-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg ring-1 ring-emerald-600/20 transition hover:from-emerald-500 hover:via-emerald-400 hover:to-green-500 hover:shadow-xl disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save & Mark Complete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSave(false, true);
                    setShowModal(false);
                  }}
                  disabled={isPending}
                  className="w-full rounded-full border border-indigo-200/70 bg-gradient-to-r from-indigo-50 to-sky-50 px-6 py-3.5 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200/40 transition hover:from-indigo-100 hover:to-sky-100 hover:shadow-md disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save & Continue Working'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Double confirmation for destructive action
                    if (confirm(`⚠️ WARNING: You are about to permanently delete ${pendingUpdates.size} unsaved changes.\n\nThis action CANNOT be undone.\n\nAre you absolutely sure you want to discard all your work?`)) {
                      setPendingUpdates(new Map());
                      setHasUnsavedChanges(false);
                      setShowModal(false);
                      if (pendingNavigation) {
                        const url = new URL(pendingNavigation);
                        router.push(url.pathname);
                        setPendingNavigation(null);
                      } else {
                        // Go back if browser back was pressed
                        window.history.back();
                      }
                    }
                  }}
                  disabled={isPending}
                  className="w-full rounded-full border-2 border-rose-300 bg-white px-6 py-3.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 hover:shadow-md disabled:opacity-50"
                >
                  ⚠️ Discard All {pendingUpdates.size} Changes (Cannot Undo)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setPendingNavigation(null);
                  }}
                  disabled={isPending}
                  className="w-full rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Stay on This Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning for too many pending updates */}
      {showWarning && pendingUpdates.size > MAX_PENDING_UPDATES && (
        <div className="fixed bottom-24 right-6 z-50 max-w-md rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-amber-600 mt-0.5"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                You have {pendingUpdates.size} unsaved changes
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Consider saving soon to avoid data loss. Auto-save will trigger at {AUTO_SAVE_THRESHOLD} changes.
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="text-amber-600 hover:text-amber-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Success/Error toasts */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-emerald-900">{message}</p>
        </div>
      )}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-rose-900">{error}</p>
        </div>
      )}
      {children}
    </WorkspaceSaveContext.Provider>
  );
}
