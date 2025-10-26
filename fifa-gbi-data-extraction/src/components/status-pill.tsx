'use client';

import type { PaperStatus } from '@/lib/types';

const statusStyles: Record<PaperStatus, string> = {
  uploaded: 'border-slate-200/80 bg-slate-100/80 text-slate-700',
  processing: 'border-amber-200/80 bg-amber-100/80 text-amber-700',
  extracted: 'border-emerald-200/80 bg-emerald-100/80 text-emerald-700',
  flagged: 'border-rose-200/80 bg-rose-100/80 text-rose-700 shadow-sm',
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
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
