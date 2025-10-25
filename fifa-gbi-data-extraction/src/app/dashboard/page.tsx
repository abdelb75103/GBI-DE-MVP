import Link from 'next/link';

import { ExportControls } from '@/components/export-controls';
import { FlagToggleButton } from '@/components/flag-toggle-button';
import { StatusPill } from '@/components/status-pill';
import { mockDb, seedIfEmpty } from '@/lib/mock-db';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  seedIfEmpty();

  const papers = mockDb.listPapers();
  const exportJobs = mockDb.listExports();
  const activePaperIds = papers.map((paper) => paper.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Track uploaded PDFs, manage flags, and kick off exports.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Upload PDF
        </Link>
      </div>

      <ExportControls paperIds={activePaperIds} />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Uploaded PDFs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 font-semibold uppercase tracking-wide text-slate-500">Title</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wide text-slate-500">
                  Uploaded
                </th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wide text-slate-500">
                  Flag
                </th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {papers.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-center text-slate-500" colSpan={6}>
                    No uploads yet. Start by adding a PDF.
                  </td>
                </tr>
              ) : (
                papers.map((paper) => (
                  <tr key={paper.id}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900">{paper.title}</span>
                        <span className="text-xs text-slate-500">
                          {paper.leadAuthor ? `${paper.leadAuthor} · ` : ''}
                          {paper.year ?? 'Year N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={paper.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <time dateTime={paper.createdAt}>
                        {new Date(paper.createdAt).toLocaleString()}
                      </time>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{paper.noteIds.length}</td>
                    <td className="px-6 py-4">
                      <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagId)} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/paper/${paper.id}`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Open workspace
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent exports</h2>
        </div>
        <div className="px-6 py-4">
          {exportJobs.length === 0 ? (
            <p className="text-sm text-slate-500">Exports will appear here once generated.</p>
          ) : (
            <ul className="space-y-3">
              {exportJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      {job.kind.toUpperCase()} · {job.paperIds.length} papers
                    </span>
                    <span className="text-xs uppercase tracking-wide text-emerald-600">
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <time dateTime={job.createdAt}>
                      {new Date(job.createdAt).toLocaleString()}
                    </time>
                    {job.downloadUrl ? (
                      <span className="font-mono text-slate-400">checksum {job.checksumSha256}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
