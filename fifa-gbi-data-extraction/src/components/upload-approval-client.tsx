'use client';

import { Tray } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, Checkbox, EmptyState, Table, Td, Th, Tr, t } from '@/components/ui';
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

  const actionStateClass =
    actionState?.tone === 'error'
      ? 'text-negative-ink'
      : actionState?.tone === 'success'
        ? 'text-positive-ink'
        : 'text-ink-muted';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={finalizeUploads} disabled={uploads.length === 0} loading={busy}>
          {busy ? 'Processing' : `Approve ${totalSelected} upload${totalSelected === 1 ? '' : 's'}`}
        </Button>
        <Button variant="secondary" size="sm" onClick={refreshUploads} disabled={busy}>
          Refresh list
        </Button>
        {actionState ? (
          <span role={actionState.tone === 'error' ? 'alert' : 'status'} className={`text-xs font-semibold ${actionStateClass}`}>
            {actionState.message}
          </span>
        ) : null}
      </div>
      <p className={t.caption}>
        All uploads start checked. Uncheck any PDFs you want to block: unchecked files will be rejected when you approve.
      </p>

      {uploads.length === 0 ? (
        <EmptyState
          icon={<Tray />}
          title="No pending uploads"
          description="When new PDFs arrive, they will show up here for approval."
        />
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-e1">
          <Table>
            <thead>
              <tr>
                <Th>Approve</Th>
                <Th>Paper</Th>
                <Th>Uploader</Th>
                <Th>Uploaded</Th>
                <Th>File</Th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <Tr key={upload.id}>
                  <Td>
                    <Checkbox
                      label={`Approve ${upload.title}`}
                      hideLabel
                      checked={selected[upload.id] ?? true}
                      onChange={() => toggleSelection(upload.id)}
                    />
                  </Td>
                  <Td>
                    <div className="text-[13px] font-semibold text-ink">{upload.title}</div>
                    <div className={t.caption}>
                      {upload.leadAuthor ? `${upload.leadAuthor}${upload.year ? ` (${upload.year})` : ''}` : upload.year ?? 'Year N/A'}
                    </div>
                    {upload.doi ? <div className={t.caption}>DOI: {upload.doi}</div> : null}
                  </Td>
                  <Td>
                    <div className="text-[13px] font-medium text-ink-body">{upload.createdByName ?? 'Unknown'}</div>
                    <div className={t.caption}>{upload.createdBy ?? 'Unknown'}</div>
                  </Td>
                  <Td>
                    <div className={t.caption}>{formatDateTimeUTC(upload.createdAt)}</div>
                  </Td>
                  <Td>
                    <div className={t.mono}>{upload.originalFileName ?? upload.fileName}</div>
                    <div className={t.caption}>{(upload.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
