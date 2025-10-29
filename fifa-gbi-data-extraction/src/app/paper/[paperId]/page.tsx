import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { ExtractionTabsPanel } from '@/components/extraction-tabs-panel';
import { extractionFieldDefinitions, extractionTabMeta, extractionTabs } from '@/lib/extraction/schema';
import { mockDb, seedIfEmpty } from '@/lib/mock-db';
import { formatDateTimeUTC } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PaperWorkspace({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  seedIfEmpty();

  const { paperId } = await params;
  const paper = mockDb.getPaper(paperId);

  if (!paper) {
    notFound();
  }

  const file = paper.fileId ? mockDb.getFile(paper.fileId) : undefined;
  const notes = mockDb.listNotes(paper.id);
  const extractions = mockDb.listExtractions(paper.id);
  const extractionMap = new Map(extractions.map((extraction) => [extraction.tab, extraction] as const));
  const tabPayload = extractionTabs.map((tab) => ({
    tab,
    label: extractionTabMeta[tab].title,
    fields: extractionFieldDefinitions.filter((field) => field.tab === tab),
    results: extractionMap.get(tab)?.fields ?? [],
  }));
  const viewerUrl = file?.publicPath
    ? file.publicPath
    : file?.dataBase64
      ? `data:${file.mimeType};base64,${file.dataBase64}`
      : null;

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
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Back to dashboard
            </Link>
            {viewerUrl ? (
              <a
                href={viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500"
              >
                Open PDF
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)] xl:items-start xl:auto-rows-fr">
          <section className="flex flex-col rounded-3xl border border-slate-200/70 bg-white/90 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
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

          <ExtractionTabsPanel paperId={paper.id} tabs={tabPayload} />
        </div>

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
                  <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagId)} />
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
