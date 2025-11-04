'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useRef, useState } from 'react';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_COUNT = 700;

type UploadFailure = {
  fileName: string;
  reason: string;
};

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    successCount: number;
    failures: UploadFailure[];
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

    void (async () => {
      setIsUploading(true);
      setSummary(null);
      setProgress({ current: 0, total: files.length });
      const failures: UploadFailure[] = [];
      const successfulPaperIds: string[] = [];

      try {
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
          const paperId = payload.paper?.id as string | undefined;

          if (paperId) {
            successfulPaperIds.push(paperId);
          } else {
            failures.push({ fileName: file.name, reason: 'Upload succeeded without an ID' });
          }
        }
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        formElement.reset();

        setProgress(null);
        const summaryPayload = {
          total: files.length,
          successCount: successfulPaperIds.length,
          failures,
        };
        setSummary(summaryPayload);

        if (successfulPaperIds.length === 0) {
          setError(
            failures.length === 0
              ? 'Upload failed for an unknown reason.'
              : 'None of the selected files were uploaded.'
          );
          setIsUploading(false);
          return;
        }

        if (failures.length > 0) {
          setError('Some files failed to upload. See details below.');
        } else {
          setError(null);
        }

        if (successfulPaperIds.length === 1 && failures.length === 0) {
          router.push(`/paper/${successfulPaperIds[0]}`);
        } else {
          router.push('/dashboard');
        }

        router.refresh();
        setIsUploading(false);
      }
    })().catch((unhandledError) => {
      console.error(unhandledError);
      setIsUploading(false);
      setError('Upload failed unexpectedly. Please try again.');
    });
  };

  const dismissError = () => setError(null);

  return (
    <form onSubmit={handleSubmit} className="space-y-8" encType="multipart/form-data">
      <div>
        <label
          htmlFor="file"
          className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
        >
          PDF files
        </label>
        <input
          ref={fileInputRef}
          type="file"
          id="file"
          name="files"
          accept="application/pdf"
          multiple
          className="mt-3 block w-full cursor-pointer rounded-2xl border border-dashed border-indigo-200/70 bg-indigo-50/40 p-5 text-sm text-indigo-700 shadow-inner focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          disabled={isUploading}
        />
        <p className="mt-2 text-xs text-slate-500">
          Max 20 MB per file. Upload up to {MAX_FILE_COUNT} PDFs per batch. Duplicates will be handled manually later.
        </p>
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/90 p-4 text-sm text-rose-700 shadow-inner">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={dismissError}
            className="rounded-full border border-rose-200 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-white/90"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {progress ? (
        <p className="text-sm text-slate-600">
          Uploading {progress.current} of {progress.total} PDF{progress.total === 1 ? '' : 's'}...
        </p>
      ) : null}

      {summary ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-inner">
          <p className="text-sm font-semibold text-slate-700">
            Uploaded {summary.successCount} of {summary.total} file{summary.total === 1 ? '' : 's'}.
          </p>
          {summary.failures.length > 0 ? (
            <div className="mt-2 text-sm text-rose-600">
              <p className="font-medium">Failed uploads:</p>
              <ul className="mt-1 space-y-1">
                {summary.failures.slice(0, 10).map((failure, index) => (
                  <li key={`${failure.fileName}-${index}`}>
                    {failure.fileName}: {failure.reason}
                  </li>
                ))}
                {summary.failures.length > 10 ? <li>And {summary.failures.length - 10} more.</li> : null}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-emerald-600">
              All uploads completed successfully. Redirecting you now.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500 disabled:opacity-60"
          disabled={isUploading}
        >
          Upload PDFs
        </button>
      </div>
    </form>
  );
}
