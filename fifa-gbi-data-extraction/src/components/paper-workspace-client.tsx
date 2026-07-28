'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { PaperWorkspaceShell, type WorkspaceSessionState } from '@/components/paper-workspace-shell';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { formatDateTimeUTC } from '@/lib/format';
import type { Paper, PaperNote, StoredFile } from '@/lib/types';
import type { ExtractionTabsPanelProps } from '@/components/extraction-tabs-panel';
import { Alert, Button, Card, Modal, PageHead, PanelHead, t } from '@/components/ui';

type PaperWorkspaceClientProps = {
  paper: Paper;
  file: StoredFile | null;
  notes: PaperNote[];
  tabs: ExtractionTabsPanelProps['tabs'];
  viewerUrl: string | null;
};

export function PaperWorkspaceClient({ paper, file, notes, tabs, viewerUrl }: PaperWorkspaceClientProps) {
  const router = useRouter();
  const hasUnsavedChanges = false;
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const sessionStatus = useMemo<WorkspaceSessionState>(() => {
    if (paper.activeSession) {
      return {
        status: 'active',
        session: paper.activeSession,
      };
    }
    return { status: 'initial', session: null };
  }, [paper.activeSession]);

  const handleBackToDashboard = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
      return;
    }
    router.push('/data-extraction');
  }, [hasUnsavedChanges, router]);

  const sessionBanner = useMemo(() => {
    if (sessionStatus.status === 'conflict') {
      const session = sessionStatus.session;
      return {
        tone: 'attention' as const,
        title: 'Workspace locked',
        message: `${session.fullName || 'Another teammate'} started editing at ${formatDateTimeUTC(session.startedAt)}. You can view the paper but not overwrite their draft.`,
      };
    }

    if (sessionStatus.status === 'error') {
      return {
        tone: 'negative' as const,
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
      <PageHead
        eyebrow="Paper workspace"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-tag border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-normal text-white">
              {paper.assignedStudyId}
            </span>
            {paper.title}
            <StatusPill status={paper.status} />
          </span>
        }
        description={`${paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}${paper.year ?? 'Year N/A'}`}
        actions={
          <Button variant="secondary" onClick={handleBackToDashboard} icon={<ArrowLeft />}>
            Back to data extraction
          </Button>
        }
      >
        {sessionBanner ? (
          <Alert tone={sessionBanner.tone} title={sessionBanner.title}>
            {sessionBanner.message}
          </Alert>
        ) : null}
      </PageHead>

      <div className="flex flex-col gap-8">
        <PaperWorkspaceShell
          paperId={paper.id}
          assignedStudyId={paper.assignedStudyId}
          tabs={tabs}
          viewerUrl={viewerUrl}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <div className="space-y-5">
              <StatusSelect paperId={paper.id} status={paper.status} />
              <div>
                <p className={t.label}>File details</p>
                {file ? (
                  <ul className={`mt-3 space-y-2 ${t.body}`}>
                    <li>
                      <span className="font-medium text-ink">Name:</span> {file.name}
                    </li>
                    <li>
                      <span className="font-medium text-ink">Size:</span> {formatBytes(file.size)}
                    </li>
                    <li>
                      <span className="font-medium text-ink">Uploaded:</span>{' '}
                      <time dateTime={file.uploadedAt}>{formatDateTimeUTC(file.uploadedAt)}</time>
                    </li>
                  </ul>
                ) : (
                  <p className={`mt-3 ${t.caption}`}>File metadata will be available after upload.</p>
                )}
              </div>
              <div>
                <p className={t.label}>Flags</p>
                <p className={`mt-1 ${t.caption}`}>
                  Use flags to mark issues that need reviewer attention.
                </p>
                <div className="mt-4">
                  <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <PanelHead
              title="Notes"
              description="Capture extraction decisions, definitions, or follow-up questions."
            />
            <div className="space-y-5">
              <NoteComposer paperId={paper.id} />
              <NoteList initialNotes={notes} paperId={paper.id} />
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="You have unsaved changes"
        description="Save your work before leaving this paper?"
        dismissible={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLeaveConfirm(false)}>
              Keep editing
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowLeaveConfirm(false);
                router.push('/data-extraction');
              }}
            >
              Leave without saving
            </Button>
          </>
        }
      />
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
