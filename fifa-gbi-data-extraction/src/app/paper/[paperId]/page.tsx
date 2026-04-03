import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { extractionFieldDefinitions, extractionTabMeta, extractionTabs } from '@/lib/extraction/schema';
import { definitionCategories } from '@/lib/definitions';
import { normalizeGlobalFieldValue } from '@/lib/extraction/normalize';
import { mockDb, PaperSessionConflictError } from '@/lib/mock-db';
import { DefinitionsDrawer } from '@/components/definitions-drawer';
import { formatDateTimeUTC } from '@/lib/format';
import { PaperWorkspaceShell } from '@/components/paper-workspace-shell';
import { readActiveProfileSession } from '@/lib/session';
import { WorkspaceSaveManager } from '@/components/workspace-save-manager';
import { WorkspaceSaveButton } from '@/components/workspace-save-button';
import { PaperActionButtons } from '@/components/paper-action-buttons';
import { MobileWorkspaceBlocker } from '@/components/mobile-workspace-blocker';

export const dynamic = 'force-dynamic';

export default async function PaperWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ paperId: string }>;
  searchParams: Promise<{ conflict?: string }>;
}) {
  const { paperId } = await params;
  const { conflict } = await searchParams;
  
  const profile = await readActiveProfileSession();
  if (!profile) {
    redirect('/profiles/select?returnTo=' + encodeURIComponent(`/paper/${paperId}`));
  }

  const paper = await mockDb.getPaper(paperId);

  if (!paper) {
    notFound();
  }

  const isAdmin = profile.role === 'admin';
  const isAssignedToOther = Boolean(paper.assignedTo && paper.assignedTo !== profile.id);
  const isReadOnly = isAdmin && isAssignedToOther;

  // If redirected here due to a conflict, show error page immediately
  // This prevents infinite redirect loops and unnecessary re-checks
  // But allow admins to proceed even with conflict
  if (conflict === 'true' && !isAdmin) {
    const assigneeName = paper.assigneeName || 'another user';
    return (
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-rose-50/80 p-8 shadow-xl ring-1 ring-rose-200/60">
          <div className="relative z-10 flex flex-col gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full bg-rose-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
                Paper Unavailable
              </span>
              <h1 className="text-3xl font-semibold text-slate-900">Access Restricted</h1>
              <div className="space-y-4 text-slate-700">
                <p className="text-lg">
                  This paper is currently assigned to <strong>{assigneeName}</strong>.
                </p>
                <p className="text-sm">
                  To prevent conflicts and data loss, only one person can work on a paper at a time. 
                  Please choose a different paper from the dashboard or wait until this paper becomes available.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Check if paper is assigned to someone else before attempting to start session
  // Admins can proceed in read-only mode
  if (isAssignedToOther && !isAdmin) {
    // Paper is already assigned to someone else
    const assigneeName = paper.assigneeName || 'another user';
    return (
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-rose-50/80 p-8 shadow-xl ring-1 ring-rose-200/60">
          <div className="relative z-10 flex flex-col gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full bg-rose-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
                Paper Unavailable
              </span>
              <h1 className="text-3xl font-semibold text-slate-900">Access Restricted</h1>
              <div className="space-y-4 text-slate-700">
                <p className="text-lg">
                  This paper is currently assigned to <strong>{assigneeName}</strong>.
                </p>
                <p className="text-sm">
                  To prevent conflicts and data loss, only one person can work on a paper at a time. 
                  Please choose a different paper from the dashboard or wait until this paper becomes available.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Try to start the session (this will auto-assign the paper, or allow admin read-only access)
  try {
    await mockDb.startPaperSession(paperId, {
      profileId: profile.id,
      fullName: profile.fullName,
      isAdmin,
    });
  } catch (error) {
    if (error instanceof PaperSessionConflictError && !isAdmin) {
      // If we get a conflict, redirect with error message
      // On reload, the conflict parameter will be checked first to show error immediately
      redirect(`/paper/${paperId}?conflict=true`);
    }
    // For other errors, log and continue (the UI will handle it)
    console.error('[PaperWorkspace] Failed to start session:', error);
  }

  const file = paper.primaryFileId ? await mockDb.getFile(paper.primaryFileId) : undefined;
  const notes = await mockDb.listNotes(paper.id);
  const extractions = await mockDb.listExtractions(paper.id);
  const extractionMap = new Map(extractions.map((extraction) => [extraction.tab, extraction] as const));
  const tabPayload = extractionTabs.map((tab) => {
    const extraction = extractionMap.get(tab);
    return {
      tab,
      label: extractionTabMeta[tab].title,
      fields: extractionFieldDefinitions.filter((field) => field.tab === tab),
      results:
        extraction?.fields.map((field) => ({
          ...field,
          value: normalizeGlobalFieldValue(field.fieldId, field.value),
        })) ?? [],
      extractionModel: extraction?.model ?? 'human-input',
    };
  });
  // Priority 1: Use API endpoint for secure file serving (works for both storage and base64 files)
  // Priority 2: Use publicUrl if available (for external URLs)
  // Priority 3: Fallback to data URL for legacy files (temporary backward compatibility)
  const viewerUrl = file
    ? file.publicUrl && !file.publicUrl.startsWith('data:')
      ? file.publicUrl
      : `/api/files/${file.id}`
    : null;

  return (
    <MobileWorkspaceBlocker>
      <WorkspaceSaveManager paperId={paper.id} currentStatus={paper.status} readOnly={isReadOnly}>
        <div className="space-y-10">
          {isReadOnly && (
            <section className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-amber-50/80 p-6 shadow-xl ring-1 ring-amber-200/60">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Read-Only Mode
                </span>
                <p className="text-sm font-medium text-amber-900">
                  Viewing{' '}
                  <strong>
                    {(paper.assigneeName || 'another user')}&rsquo;s
                  </strong>{' '}
                  paper in read-only mode. You cannot edit or save changes.
                </p>
              </div>
            </section>
          )}
          <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8">
            <div className="absolute -top-12 left-0 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
            <div className="absolute -bottom-16 right-0 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full bg-indigo-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">
                  Paper workspace
                </span>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {paper.assignedStudyId}
                    </span>
                    <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{paper.title}</h1>
                    <StatusPill status={paper.status} />
                  </div>
                  {paper.leadAuthor ? (
                    <p className="text-sm text-slate-600">{paper.leadAuthor}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  Back to dashboard
                </Link>
                {!isReadOnly && <WorkspaceSaveButton />}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-8">
            <PaperWorkspaceShell
              paperId={paper.id}
              assignedStudyId={paper.assignedStudyId}
              tabs={tabPayload}
              viewerUrl={viewerUrl}
              readOnly={isReadOnly}
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
                <div className="space-y-5">
                  {!isReadOnly && (
                    <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 to-slate-100/60 p-4 shadow-sm ring-1 ring-slate-200/40 transition hover:shadow-md">
                      <StatusSelect paperId={paper.id} status={paper.status} />
                    </div>
                  )}
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
                    {!isReadOnly && (
                      <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-50/80 to-slate-100/60 p-4 shadow-sm ring-1 ring-slate-200/40 transition hover:shadow-md">
                        <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                      </div>
                    )}
                    {isReadOnly && (
                      <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-50/80 to-slate-100/60 p-4 shadow-sm ring-1 ring-slate-200/40">
                        <p className="text-xs text-slate-500">
                          {paper.flagReason ? `Flagged: ${paper.flagReason}` : 'Not flagged'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Capture extraction decisions, definitions, or follow-up questions.
                </p>
                <div className="mt-5 space-y-5">
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-50/60 to-slate-50/80 p-4 shadow-sm ring-1 ring-indigo-200/30 transition hover:shadow-md">
                    <NoteComposer paperId={paper.id} />
                  </div>
                  <NoteList initialNotes={notes} paperId={paper.id} />
                </div>
              </div>
            </div>

            <PaperActionButtons readOnly={isReadOnly} />
          </div>
        </div>

        <DefinitionsDrawer categories={definitionCategories} />
      </WorkspaceSaveManager>
    </MobileWorkspaceBlocker>
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
