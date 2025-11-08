'use client';

type AssignmentStatus = 'available' | 'mine' | 'assigned';

type AssignmentBadgeProps = {
  status: AssignmentStatus;
  assigneeName?: string;
};

export function AssignmentBadge({ status, assigneeName }: AssignmentBadgeProps) {
  if (status === 'available') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        Available
      </span>
    );
  }

  if (status === 'mine') {
    return (
      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
        You&apos;re working on this
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
      Assigned to {assigneeName || 'another user'}
    </span>
  );
}

