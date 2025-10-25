'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useRef, useState, useTransition } from 'react';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const file = formData.get('file');

    if (!(file instanceof File)) {
      setError('Select a PDF to upload.');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError('PDF must be 20 MB or smaller.');
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? 'Upload failed');
        return;
      }

      const payload = await response.json();
      const redirectId = payload.paper?.id as string | undefined;

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      formElement.reset();

      router.push(redirectId ? `/paper/${redirectId}` : '/dashboard');
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div>
        <label
          htmlFor="file"
          className="block text-sm font-semibold uppercase tracking-wide text-slate-600"
        >
          PDF file
        </label>
        <input
          ref={fileInputRef}
          type="file"
          id="file"
          name="file"
          accept="application/pdf"
          className="mt-2 block w-full cursor-pointer rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          disabled={isPending}
        />
        <p className="mt-2 text-xs text-slate-500">Max 20 MB. Duplicates will be handled manually later.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" name="title" placeholder="Study title" disabled={isPending} />
        <Field label="Lead Author" name="leadAuthor" placeholder="Last name, Initial" disabled={isPending} />
        <Field label="Year" name="year" placeholder="2024" disabled={isPending} />
        <Field label="Journal" name="journal" placeholder="Journal name" disabled={isPending} />
        <Field label="DOI" name="doi" placeholder="10.1234/example" disabled={isPending} className="md:col-span-2" />
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          disabled={isPending}
        >
          Upload PDF
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function Field({ label, name, placeholder, className, disabled }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
    </div>
  );
}
