'use client';

import type { PaperStatus } from '@/lib/types';

const statusStyles: Record<PaperStatus, string> = {
  uploaded: 'bg-sky-100 text-sky-700 border-sky-200',
  processing: 'bg-amber-100 text-amber-700 border-amber-200',
  extracted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  flagged: 'bg-rose-100 text-rose-700 border-rose-200',
};

const statusLabels: Record<PaperStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  extracted: 'Extracted',
  flagged: 'Flagged',
};

type StatusPillProps = {
  status: PaperStatus;
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
