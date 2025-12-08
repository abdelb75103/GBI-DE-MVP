'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { UploadQueueItem } from '@/lib/types';
import { formatDateTimeUTC } from '@/lib/format';

type Props = {
  initialUploads: UploadQueueItem[];
};

type ActionState = { tone: 'neutral' | 'error' | 'success'; message: string } | null;

export function UploadApprovalClient({ initialUploads }: Props) {
  const [uploads, setUploads] = useState<UploadQueueItem[]>(initialUploads);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(initialUploads.map((upload) => [upload.id, true]))
  ));

  useEffect(() => {
    setUploads(initialUploads);
    setSelected(Object.fromEntries(initialUploads.map((upload) => [upload.id, true])));
  }, [initialUploads]);

  const totalSelected = useMemo(
    () => uploads.filter((upload) => selected[upload.id] ?? true).length,
    [uploads, selected],
  );

  const toggleSelection = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const refreshUploads = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/uploads/queue', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { uploads: UploadQueueItem[] };
      setUploads(data.uploads ?? []);
      setSelected(Object.fromEntries((data.uploads ?? []).map((upload) => [upload.id, true])));
      setActionState({ tone: 'success', message: 'Refreshed pending uploads' });
    } catch (error) {
      console.error('Failed to refresh uploads', error);
      setActionState({ tone: 'error', message: 'Failed to refresh uploads' });
    } finally {
      setBusy(false);
    }
  }, []);

  const finalizeUploads = async () => {
    if (uploads.length === 0) {
      return;
    }
    setBusy(true);
    setActionState(null);
    const approveIds = uploads.filter((upload) => selected[upload.id] ?? true).map((upload) => upload.id);
    const rejectIds = uploads.filter((upload) => !(selected[upload.id] ?? true)).map((upload) => upload.id);

    try {
      const res = await fetch('/api/admin/uploads/queue/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approveIds, rejectIds }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as {
        approved: Array<{ uploadId: string; paperId: string }>;
        rejected: string[];
        errors: Array<{ uploadId: string; message: string }>;
      };

      if (data.errors.length > 0) {
        setActionState({ tone: 'error', message: `${data.errors.length} upload${data.errors.length === 1 ? '' : 's'} failed` });
      } else if (data.approved.length > 0 || data.rejected.length > 0) {
        setActionState({ tone: 'success', message: `Approved ${data.approved.length} • Rejected ${data.rejected.length}` });
      } else {
        setActionState({ tone: 'neutral', message: 'No uploads were processed' });
      }
      await refreshUploads();
    } catch (error) {
      console.error('Failed to finalize uploads', error);
      setActionState({ tone: 'error', message: 'Failed to finalize uploads' });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={finalizeUploads}
          disabled={busy || uploads.length === 0}
          className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow ${
            busy ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {busy ? 'Processing…' : `Approve ${totalSelected} upload${totalSelected === 1 ? '' : 's'}`}
        </button>
        <button
          type="button"
          onClick={refreshUploads}
          disabled={busy}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Refresh list
        </button>
        {actionState ? (
          <span
            className={`text-xs font-semibold ${
              actionState.tone === 'error'
                ? 'text-rose-600'
                : actionState.tone === 'success'
                  ? 'text-emerald-700'
                  : 'text-slate-600'
            }`}
          >
            {actionState.message}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        All uploads start checked. Uncheck any PDFs you want to block — unchecked files will be rejected when you approve.
      </p>

      {uploads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
          No pending uploads. When new PDFs arrive, they will show up here for approval.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/80">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Approve</th>
                <th scope="col" className="px-4 py-3 text-left">Paper</th>
                <th scope="col" className="px-4 py-3 text-left">Uploader</th>
                <th scope="col" className="px-4 py-3 text-left">Uploaded</th>
                <th scope="col" className="px-4 py-3 text-left">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/70">
              {uploads.map((upload) => (
                <tr key={upload.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected[upload.id] ?? true}
                      onChange={() => toggleSelection(upload.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{upload.title}</div>
                    <div className="text-xs text-slate-500">
                      {upload.leadAuthor ? `${upload.leadAuthor}${upload.year ? ` (${upload.year})` : ''}` : upload.year ?? 'Year N/A'}
                    </div>
                    {upload.doi ? (
                      <div className="text-[11px] text-slate-400">DOI: {upload.doi}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-700">{upload.createdByName ?? 'Unknown'}</div>
                    <div className="text-[11px] text-slate-500">{upload.createdBy ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>{formatDateTimeUTC(upload.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="font-mono text-[11px] text-slate-500">{upload.originalFileName ?? upload.fileName}</div>
                    <div>{(upload.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
