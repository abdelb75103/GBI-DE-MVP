'use client';

import { FormEvent, useRef, useState, useTransition } from 'react';

import { Alert, Button, Card, Field, Input, Tag, t } from '@/components/ui';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_COUNT = 700;

type UploadFailure = {
  fileName: string;
  reason: string;
};

type UploadSuccess = {
  id: string;
  title: string;
  fileName: string;
};

export function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    successCount: number;
    failures: UploadFailure[];
    uploads: UploadSuccess[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const fileList = fileInputRef.current?.files;
    const files = fileList ? Array.from(fileList) : [];
    const metadataEntries: Array<[string, string]> = [];

    for (const [key, value] of new FormData(formElement).entries()) {
      if (key === 'file' || key === 'files') {
        continue;
      }
      if (value instanceof File) {
        continue;
      }
      metadataEntries.push([key, value]);
    }

    if (files.length === 0) {
      setError('Select at least one PDF to upload.');
      return;
    }

    if (files.length > MAX_FILE_COUNT) {
      setError(`You can upload up to ${MAX_FILE_COUNT} PDFs at once.`);
      return;
    }

    startTransition(async () => {
      setSummary(null);
      setProgress({ current: 0, total: files.length });
      const failures: UploadFailure[] = [];
      const uploads: UploadSuccess[] = [];

      for (const [index, file] of files.entries()) {
        setProgress({ current: index + 1, total: files.length });

        if (!file.name.toLowerCase().endsWith('.pdf')) {
          failures.push({ fileName: file.name, reason: 'Not a PDF file' });
          continue;
        }

        if (file.size > MAX_FILE_BYTES) {
          failures.push({ fileName: file.name, reason: 'Exceeds 20 MB limit' });
          continue;
        }

        const formData = new FormData();
        for (const [key, value] of metadataEntries) {
          formData.append(key, value);
        }
        formData.append('file', file);

        let response: Response;
        try {
          response = await fetch('/api/uploads', {
            method: 'POST',
            body: formData,
          });
        } catch (fetchError) {
          console.error(fetchError);
          failures.push({ fileName: file.name, reason: 'Network error' });
          continue;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          failures.push({ fileName: file.name, reason: payload.error ?? 'Upload failed' });
          continue;
        }

        const payload = await response.json();
        const uploadId = payload.upload?.id as string | undefined;
        const uploadTitle = (payload.upload?.title as string | undefined) ?? file.name;

        if (uploadId) {
          uploads.push({ id: uploadId, title: uploadTitle, fileName: file.name });
        } else {
          failures.push({ fileName: file.name, reason: 'Upload succeeded without a queue reference' });
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      formElement.reset();

      setProgress(null);
      const summaryPayload = {
        total: files.length,
        successCount: uploads.length,
        failures,
        uploads,
      };
      setSummary(summaryPayload);

      if (uploads.length === 0) {
        setError(
          failures.length === 0
            ? 'Upload failed for an unknown reason.'
            : 'None of the selected files were uploaded.'
        );
        return;
      }

      if (failures.length > 0) {
        setError('Some files failed to upload. See details below.');
      }
      if (failures.length === 0) {
        setError(null);
      }
    });
  };

  const dismissError = () => setError(null);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <Field
        label="PDF files"
        help={
          <>
            Max 20 MB per file. Upload up to {MAX_FILE_COUNT} PDFs per batch. New uploads stay hidden until an admin
            approves them.
          </>
        }
      >
        {({ id, describedBy }) => (
          // The ref reads the FileList and clears the value after submit.
          <Input
            ref={fileInputRef}
            type="file"
            id={id}
            name="files"
            accept="application/pdf"
            multiple
            aria-describedby={describedBy}
            className="cursor-pointer"
            disabled={isPending}
          />
        )}
      </Field>

      {error ? (
        <Alert tone="negative">
          <div className="flex items-start justify-between gap-3">
            <p>{error}</p>
            <Button size="sm" variant="ghost" onClick={dismissError}>
              Dismiss
            </Button>
          </div>
        </Alert>
      ) : null}

      {progress ? (
        <p role="status" className={t.body}>
          Uploading {progress.current} of {progress.total} PDF{progress.total === 1 ? '' : 's'}...
        </p>
      ) : null}

      {summary ? (
        <Card>
          <p className="text-[13px] font-semibold text-ink">
            Staged {summary.successCount} of {summary.total} file{summary.total === 1 ? '' : 's'} for approval.
          </p>
          {summary.uploads.length > 0 ? (
            <div className="mt-2.5 space-y-2">
              <p className={t.label}>Awaiting admin review</p>
              <ul className="space-y-1.5">
                {summary.uploads.slice(0, 5).map((upload) => (
                  <li key={upload.id} className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-body">
                    <Tag mono>{upload.fileName}</Tag>
                    {upload.title && upload.title !== upload.fileName ? <span>{upload.title}</span> : null}
                  </li>
                ))}
                {summary.uploads.length > 5 ? (
                  <li className={t.caption}>And {summary.uploads.length - 5} more.</li>
                ) : null}
              </ul>
              <p className={t.caption}>
                Papers remain hidden until an admin approves them. You&apos;ll see them on the dashboard afterward.
              </p>
            </div>
          ) : null}
          {summary.failures.length > 0 ? (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-[13px] font-semibold text-negative-ink">Failed uploads</p>
              <ul className="space-y-1">
                {summary.failures.slice(0, 10).map((failure, index) => (
                  <li key={`${failure.fileName}-${index}`} className="text-[13px] text-negative-ink">
                    {failure.fileName}: {failure.reason}
                  </li>
                ))}
                {summary.failures.length > 10 ? (
                  <li className={t.caption}>And {summary.failures.length - 10} more.</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" variant="primary" size="lg" loading={isPending}>
          Upload full text
        </Button>
      </div>
    </form>
  );
}
