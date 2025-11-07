import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { extractionFieldDefinitions, extractionTabMeta, extractionTabs } from '@/lib/extraction/schema';
import { definitionCategories } from '@/lib/definitions';
import { mockDb, PaperSessionConflictError } from '@/lib/mock-db';
import { DefinitionsDrawer } from '@/components/definitions-drawer';
import { formatDateTimeUTC } from '@/lib/format';
import { PaperWorkspaceShell } from '@/components/paper-workspace-shell';
import { readActiveProfileSession } from '@/lib/session';
import { WorkspaceSaveManager } from '@/components/workspace-save-manager';
import { WorkspaceSaveButton } from '@/components/workspace-save-button';

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

  // If redirected here due to a conflict, show error page immediately
  // This prevents infinite redirect loops and unnecessary re-checks
  if (conflict === 'true') {
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
  if (paper.assignedTo && paper.assignedTo !== profile.id) {
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

  // Try to start the session (this will auto-assign the paper)
  try {
    await mockDb.startPaperSession(paperId, {
      profileId: profile.id,
      fullName: profile.fullName,
    });
  } catch (error) {
    if (error instanceof PaperSessionConflictError) {
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
  const tabPayload = extractionTabs.map((tab) => ({
    tab,
    label: extractionTabMeta[tab].title,
    fields: extractionFieldDefinitions.filter((field) => field.tab === tab),
    results: extractionMap.get(tab)?.fields ?? [],
  }));
  const viewerUrl = file?.publicUrl
    ? file.publicUrl
    : file?.dataBase64
      ? `data:${file.mimeType};base64,${file.dataBase64}`
      : null;

  return (
    <WorkspaceSaveManager paperId={paper.id} currentStatus={paper.status}>
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
              <WorkspaceSaveButton />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <PaperWorkspaceShell paperId={paper.id} tabs={tabPayload} viewerUrl={viewerUrl} />

          <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="space-y-5">
              <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 to-slate-100/60 p-4 shadow-sm ring-1 ring-slate-200/40 transition hover:shadow-md">
                <StatusSelect paperId={paper.id} status={paper.status} />
              </div>
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
                <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-50/80 to-slate-100/60 p-4 shadow-sm ring-1 ring-slate-200/40 transition hover:shadow-md">
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
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50/60 to-slate-50/80 p-4 shadow-sm ring-1 ring-indigo-200/30 transition hover:shadow-md">
                <NoteComposer paperId={paper.id} />
              </div>
              <NoteList initialNotes={notes} />
            </div>
          </div>
        </div>
      </div>

        <DefinitionsDrawer categories={definitionCategories} />
      </div>
    </WorkspaceSaveManager>
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
