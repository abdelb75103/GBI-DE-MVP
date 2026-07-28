'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { statusLabel } from '@/components/status-pill';
import { Field, Select } from '@/components/ui';
import { useWorkspaceSave } from '@/components/workspace-save-manager';
import type { PaperStatus } from '@/lib/types';

// Option values must stay byte-identical: this select drives real status
// writes. Only the displayed label is free to change, and it is sourced from
// `statusLabel` so it can never drift from the pill shown elsewhere.
const STATUS_VALUES: PaperStatus[] = [
  'processing',
  'extracted',
  'flagged',
  'mental_health',
  'uefa',
  'no_exposure',
  'fifa_data',
  'aspetar_asprev',
  'american_data',
  'systematic_review',
  'referee',
  'retrospective_substudy_analysis',
  'uefa_master_extraction',
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
    <Field label="Status">
      {({ id }) => (
        <>
          <Select
            id={id}
            value={value}
            disabled={isPending}
            onChange={(event) => handleChange(event.target.value as PaperStatus)}
          >
            {STATUS_VALUES.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </Select>
          {error ? (
            <p role="alert" className="text-xs font-medium text-negative-ink">
              {error}
            </p>
          ) : null}
        </>
      )}
    </Field>
  );
}
