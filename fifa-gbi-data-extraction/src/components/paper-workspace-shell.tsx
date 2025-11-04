'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ExtractionTabsPanel,
  type ExtractionTabsPanelProps,
  type LayoutMode,
} from '@/components/extraction-tabs-panel';
import type { PaperActiveSession } from '@/lib/types';
import { useActiveProfile } from '@/components/providers/active-profile-provider';

export type WorkspaceSessionState =
  | { status: 'initial'; session: PaperActiveSession | null }
  | { status: 'starting'; session: PaperActiveSession | null }
  | { status: 'active'; session: PaperActiveSession }
  | { status: 'conflict'; session: PaperActiveSession }
  | { status: 'error'; message: string };

export type PaperWorkspaceShellProps = {
  paperId: string;
  tabs: ExtractionTabsPanelProps['tabs'];
  viewerUrl: string | null;
  initialActiveSession: PaperActiveSession | null;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
  onSessionChange?: (state: WorkspaceSessionState) => void;
};

export function PaperWorkspaceShell({
  paperId,
  tabs,
  viewerUrl,
  initialActiveSession,
  onUnsavedChange,
  onSessionChange,
}: PaperWorkspaceShellProps) {
  const { profile, isLoaded } = useActiveProfile();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('accordion');
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [sessionState, setSessionState] = useState<WorkspaceSessionState>(() => ({
    status: 'initial',
    session: initialActiveSession,
  }));

  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartedRef = useRef(false);

  const showViewer = layoutMode !== 'full';
  const profileId = profile?.id ?? null;
  const profileName = profile?.fullName ?? '';

  const notifyUnsavedChange = useCallback(
    (value: boolean) => {
      setHasUnsaved(value);
      onUnsavedChange?.(value);
    },
    [onUnsavedChange],
  );

  const notifySessionChange = useCallback(
    (state: WorkspaceSessionState) => {
      setSessionState(state);
      onSessionChange?.(state);
    },
    [onSessionChange],
  );

  const sendSessionMutation = useCallback(
    async (action: 'start' | 'heartbeat' | 'end', useBeacon = false) => {
      const payload = JSON.stringify({ action });
      const url = `/api/papers/${paperId}/session`;

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return { ok: true };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    },
    [paperId],
  );

  useEffect(() => {
    if (!profileId || !isLoaded || sessionStartedRef.current) {
      return;
    }

    let isCancelled = false;
    sessionStartedRef.current = true;

    const cleanUpHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const startSession = async () => {
      notifySessionChange({ status: 'starting', session: initialActiveSession });

      const result = await sendSessionMutation('start');
      if (isCancelled) {
        return;
      }

      if (!result.ok) {
        if (result.status === 409 && result.data?.current) {
          notifySessionChange({ status: 'conflict', session: result.data.current });
        } else {
          notifySessionChange({
            status: 'error',
            message: result.data?.error ?? 'Unable to start workspace session.',
          });
        }
        return;
      }

      const session: PaperActiveSession | undefined = result.data?.session;
      if (!session) {
        notifySessionChange({
          status: 'error',
          message: 'Unable to confirm workspace session.',
        });
        return;
      }

      notifySessionChange({ status: 'active', session });

      heartbeatTimerRef.current = setInterval(async () => {
        const heartbeat = await sendSessionMutation('heartbeat');
        if (!heartbeat.ok) {
          if (heartbeat.status === 409 && heartbeat.data?.current) {
            notifySessionChange({ status: 'conflict', session: heartbeat.data.current });
          }
          cleanUpHeartbeat();
        }
      }, 60_000);
    };

    void startSession();

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        event.preventDefault();
        // Chrome uses returnValue to trigger prompt
        event.returnValue = '';
      }
      void sendSessionMutation('end', true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isCancelled = true;
      cleanUpHeartbeat();
      sessionStartedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void sendSessionMutation('end', true);
    };
  }, [
    initialActiveSession,
    isLoaded,
    notifySessionChange,
    profileId,
    sendSessionMutation,
    hasUnsaved,
  ]);

  useEffect(() => {
    if (!hasUnsaved) {
      return;
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void sendSessionMutation('heartbeat', true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasUnsaved, sendSessionMutation]);

  const isLocked = useMemo(
    () => sessionState.status === 'conflict' || sessionState.status === 'error',
    [sessionState],
  );

  return (
    <div
      className={
        showViewer
          ? 'flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)] xl:items-start xl:auto-rows-fr xl:gap-10'
          : 'flex flex-col gap-8'
      }
    >
      {showViewer ? (
        <section className="flex flex-col rounded-3xl border border-slate-200/70 bg-white/90 shadow-xl ring-1 ring-slate-200/60 backdrop-blur xl:sticky xl:top-24 xl:self-start">
          <div className="border-b border-slate-200/70 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">PDF preview</h2>
            <p className="text-xs text-slate-500">
              Review the paper on the left while validating the extracted fields on the right.
            </p>
          </div>
          <div className="relative h-full min-h-[65vh] w-full overflow-hidden rounded-b-3xl border-t border-slate-200/60 bg-slate-100/80 lg:min-h-[75vh]">
            {viewerUrl ? (
              <object
                data={viewerUrl}
                type="application/pdf"
                className="absolute inset-0 h-full w-full"
                width="100%"
                height="100%"
                aria-label="PDF document preview"
              >
                <iframe
                  title="PDF preview"
                  src={viewerUrl}
                  className="h-full w-full border-0"
                  style={{ minHeight: '100%' }}
                  allow="fullscreen"
                />
                <div className="flex h-full w-full items-center justify-center bg-white p-6 text-center text-sm text-slate-600">
                  Your browser does not support inline PDF preview.{' '}
                  <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    Open the document in a new tab
                  </a>
                  .
                </div>
              </object>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                PDF preview coming soon.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <ExtractionTabsPanel
        paperId={paperId}
        tabs={tabs}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        onUnsavedChange={notifyUnsavedChange}
        isLocked={isLocked}
        profileId={profileId ?? null}
      />
    </div>
  );
}
