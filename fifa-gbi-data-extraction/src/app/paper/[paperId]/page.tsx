import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { mockDb, seedIfEmpty } from '@/lib/mock-db';

export const dynamic = 'force-dynamic';

const studyDetailPlaceholders = [
  'Study ID',
  'Lead Author',
  'Title',
  'Year of Publication',
  'Journal',
  'DOI',
  'Study Design',
];

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
  const viewerDataUrl = file?.dataBase64 ? `data:${file.mimeType};base64,${file.dataBase64}` : null;

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
            {viewerDataUrl ? (
              <a
                href={viewerDataUrl}
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

      <div className="grid gap-8 lg:grid-cols-[1.85fr,1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="border-b border-slate-200/70 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">PDF preview</h2>
              <p className="text-xs text-slate-500">
                We&apos;ll add pagination, search, and text selection in the next iteration.
              </p>
            </div>
            <div className="h-[600px] w-full overflow-hidden rounded-b-3xl border-t border-slate-200/60 bg-slate-100/80">
              {viewerDataUrl ? (
                <iframe title="PDF preview" src={viewerDataUrl} className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                  PDF preview coming soon.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Study details</h2>
                <p className="text-xs text-slate-500">
                  Auto-extracted values will appear here once the AI pipeline is connected.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Placeholder
              </span>
            </div>
            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              {studyDetailPlaceholders.map((field) => (
                <div
                  key={field}
                  className="rounded-2xl border border-dashed border-slate-200/80 bg-white/60 p-4 text-sm text-slate-600"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{field}</p>
                  <p className="mt-2 text-sm text-slate-600">Pending AI extraction</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
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
                      <time dateTime={file.uploadedAt}>
                        {new Date(file.uploadedAt).toLocaleString()}
                      </time>
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
        </aside>
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
