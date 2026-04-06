'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useWorkspaceSave } from '@/components/workspace-save-manager';
import type { PaperStatus } from '@/lib/types';

const options: { value: PaperStatus; label: string }[] = [
  { value: 'processing', label: 'Processing' },
  { value: 'extracted', label: 'Extracted' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'uefa', label: 'UEFA' },
  { value: 'fifa_data', label: 'FIFA Data' },
  { value: 'aspetar_asprev', label: 'Aspetar ASPREV' },
  { value: 'american_data', label: 'American Data' },
  { value: 'systematic_review', label: 'Systematic Review' },
  { value: 'referee', label: 'Referee' },
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
  const { setCurrentStatus } = useWorkspaceSave();

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
        let payload: { error?: string } | null = null;
        try {
          payload = (await response.json()) as { error?: string } | null;
        } catch (error) {
          console.warn('Failed to parse status update error payload', error);
        }
        setError(payload?.error ?? 'Unable to update status');
        return;
      }

      setCurrentStatus(next);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        Status
      </label>
      <select
        className="w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
      {error ? <p className="text-xs font-medium text-rose-500">{error}</p> : null}
    </div>
  );
}
