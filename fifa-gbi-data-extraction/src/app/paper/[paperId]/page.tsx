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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{paper.title}</h1>
            <StatusPill status={paper.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}
            {paper.year ?? 'Year N/A'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
          {viewerDataUrl ? (
            <a
              href={viewerDataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open PDF
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">PDF preview</h2>
              <p className="text-sm text-slate-500">
                We&apos;ll add pagination, search, and text selection in the next iteration.
              </p>
            </div>
            <div className="h-[600px] w-full overflow-hidden rounded-b-xl border-t border-slate-200 bg-slate-100">
              {viewerDataUrl ? (
                <iframe title="PDF preview" src={viewerDataUrl} className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                  PDF preview coming soon.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Study details</h2>
              <p className="text-sm text-slate-500">
                Auto-extracted values will appear here once the AI pipeline is connected.
              </p>
            </div>
            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              {studyDetailPlaceholders.map((field) => (
                <div key={field} className="rounded-lg border border-dashed border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">Pending AI extraction</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <StatusSelect paperId={paper.id} status={paper.status} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  File details
                </p>
                {file ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    <li>
                      <span className="font-medium text-slate-700">Name:</span> {file.name}
                    </li>
                    <li>
                      <span className="font-medium text-slate-700">Size:</span>{' '}
                      {formatBytes(file.size)}
                    </li>
                    <li>
                      <span className="font-medium text-slate-700">Uploaded:</span>{' '}
                      <time dateTime={file.uploadedAt}>
                        {new Date(file.uploadedAt).toLocaleString()}
                      </time>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    File metadata will be available after upload.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Flags
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Use flags to mark issues that need reviewer attention.
                </p>
                <div className="mt-3">
                  <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagId)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Notes</h2>
            <p className="mt-1 text-xs text-slate-500">
              Capture extraction decisions, definitions, or follow-up questions.
            </p>
            <div className="mt-4 space-y-4">
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
