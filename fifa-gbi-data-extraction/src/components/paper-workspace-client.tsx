'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { DefinitionsDrawer } from '@/components/definitions-drawer';
import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { PaperWorkspaceShell, type WorkspaceSessionState } from '@/components/paper-workspace-shell';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { definitionCategories } from '@/lib/definitions';
import { formatDateTimeUTC } from '@/lib/format';
import type { Paper, PaperNote, StoredFile } from '@/lib/types';
import type { ExtractionTabsPanelProps } from '@/components/extraction-tabs-panel';

type PaperWorkspaceClientProps = {
  paper: Paper;
  file: StoredFile | null;
  notes: PaperNote[];
  tabs: ExtractionTabsPanelProps['tabs'];
  viewerUrl: string | null;
};

export function PaperWorkspaceClient({ paper, file, notes, tabs, viewerUrl }: PaperWorkspaceClientProps) {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<WorkspaceSessionState>(() => ({
    status: 'initial',
    session: paper.activeSession ?? null,
  }));

  const handleBackToDashboard = useCallback(() => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Save them before leaving?')) {
      return;
    }
    router.push('/dashboard');
  }, [hasUnsavedChanges, router]);

  const sessionBanner = useMemo(() => {
    if (sessionStatus.status === 'conflict') {
      const session = sessionStatus.session;
      return {
        tone: 'warning' as const,
        title: 'Workspace locked',
        message: `${session.fullName || 'Another teammate'} started editing at ${formatDateTimeUTC(session.startedAt)}. You can view the paper but not overwrite their draft.`,
      };
    }

    if (sessionStatus.status === 'error') {
      return {
        tone: 'error' as const,
        title: 'Workspace unavailable',
        message: sessionStatus.message,
      };
    }

    if (sessionStatus.status === 'active') {
      const session = sessionStatus.session;
      return {
        tone: 'info' as const,
        title: 'You are editing',
        message: `Session started at ${formatDateTimeUTC(session.startedAt)}.`,
      };
    }

    return null;
  }, [sessionStatus]);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -top-12 left-0 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 right-0 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Paper workspace
            </span>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {paper.assignedStudyId}
                </span>
                <h1 className="text-3xl font-semibold text-slate-900">{paper.title}</h1>
                <StatusPill status={paper.status} />
              </div>
              <p className="text-sm text-slate-600">
                {paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}
                {paper.year ?? 'Year N/A'}
              </p>
              {sessionBanner ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-xs ${
                    sessionBanner.tone === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : sessionBanner.tone === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  }`}
                >
                  <p className="font-semibold uppercase tracking-[0.22em]">{sessionBanner.title}</p>
                  <p className="mt-1 text-[13px] leading-5">{sessionBanner.message}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-8">
        <PaperWorkspaceShell
          paperId={paper.id}
          tabs={tabs}
          viewerUrl={viewerUrl}
          initialActiveSession={paper.activeSession ?? null}
          onUnsavedChange={setHasUnsavedChanges}
          onSessionChange={setSessionStatus}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="space-y-5">
              <StatusSelect paperId={paper.id} status={paper.status} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">File details</p>
                {file ? (
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>
                      <span className="font-medium text-slate-700">Name:</span> {file.name}
                    </li>
                    <li>
                      <span className="font-medium text-slate-700">Size:</span> {formatBytes(file.size)}
                    </li>
                    <li>
                      <span className="font-medium text-slate-700">Uploaded:</span>{' '}
                      <time dateTime={file.uploadedAt}>{formatDateTimeUTC(file.uploadedAt)}</time>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">File metadata will be available after upload.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Flags</p>
                <p className="mt-1 text-xs text-slate-500">
                  Use flags to mark issues that need reviewer attention.
                </p>
                <div className="mt-4">
                  <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
              <span className="rounded-full bg-indigo-100/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                Collaboration
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Capture extraction decisions, definitions, or follow-up questions.
            </p>
            <div className="mt-5 space-y-5">
              <NoteComposer paperId={paper.id} />
              <NoteList initialNotes={notes} />
            </div>
          </div>
        </div>
      </div>

      <DefinitionsDrawer categories={definitionCategories} />
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
