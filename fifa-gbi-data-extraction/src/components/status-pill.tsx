'use client';

import type { PaperStatus } from '@/lib/types';

const statusStyles: Record<PaperStatus, string> = {
  uploaded: 'border-slate-200/80 bg-slate-100/80 text-slate-700',
  processing: 'border-amber-200/80 bg-amber-100/80 text-amber-700',
  extracted: 'border-emerald-600 bg-emerald-700 text-white',
  flagged: 'border-rose-200/80 bg-rose-100/80 text-rose-700 shadow-sm',
  qa_review: 'border-sky-200/80 bg-sky-100/80 text-sky-700',
  archived: 'border-slate-200/70 bg-slate-100/70 text-slate-500',
  mental_health: 'border-purple-200/80 bg-purple-100/80 text-purple-700',
  uefa: 'border-blue-200/80 bg-blue-100/80 text-blue-700',
  no_exposure: 'border-orange-200/80 bg-orange-100/80 text-orange-700',
  fifa_data: 'border-indigo-200/80 bg-indigo-100/80 text-indigo-700',
  aspetar_asprev: 'border-blue-200/80 bg-blue-100/80 text-blue-700',
  american_data: 'border-cyan-200/80 bg-cyan-100/80 text-cyan-700',
  systematic_review: 'border-fuchsia-200/80 bg-fuchsia-100/80 text-fuchsia-700',
  referee: 'border-amber-200/80 bg-amber-100/80 text-amber-700',
};

const statusLabels: Record<PaperStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  extracted: 'Extracted',
  flagged: 'Flagged',
  qa_review: 'QA Review',
  archived: 'Archived',
  mental_health: 'Mental Health',
  uefa: 'UEFA',
  no_exposure: 'No Exposure',
  fifa_data: 'FIFA Data',
  aspetar_asprev: 'Aspetar ASPREV',
  american_data: 'American Data',
  systematic_review: 'Systematic Review',
  referee: 'Referee',
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
