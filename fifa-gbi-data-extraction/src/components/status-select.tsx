'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { PaperStatus } from '@/lib/types';

const options: { value: PaperStatus; label: string }[] = [
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'processing', label: 'Processing' },
  { value: 'extracted', label: 'Extracted' },
  { value: 'flagged', label: 'Flagged' },
];

type StatusSelectProps = {
  paperId: string;
  status: PaperStatus;
};

export function StatusSelect({ paperId, status }: StatusSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = (next: PaperStatus) => {
    setValue(next);
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/papers/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? 'Unable to update status');
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
        Status
      </label>
      <select
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        value={value}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as PaperStatus)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
