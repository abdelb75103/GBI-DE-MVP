'use client';

import { useMemo, useState } from 'react';

import { PapersTable } from '@/components/papers-table';
import { useActiveProfileState } from '@/hooks/use-active-profile';
import type { Paper } from '@/lib/types';

type PapersDashboardClientProps = {
  papers: Paper[];
  canBulkExport?: boolean;
};

type FilterOption = 'all' | 'available' | 'mine' | 'assigned';

export function PapersDashboardClient({ papers, canBulkExport = true }: PapersDashboardClientProps) {
  const { profile } = useActiveProfileState();
  const [filter, setFilter] = useState<FilterOption>('all');

  const filteredPapers = useMemo(() => {
    if (!profile) return papers;

    switch (filter) {
      case 'available':
        return papers.filter((paper) => !paper.assignedTo);
      case 'mine':
        return papers.filter((paper) => paper.assignedTo === profile.id);
      case 'assigned':
        return papers.filter((paper) => paper.assignedTo && paper.assignedTo !== profile.id);
      case 'all':
      default:
        return papers;
    }
  }, [papers, filter, profile]);

  const counts = useMemo(() => {
    if (!profile) {
      return { all: papers.length, available: 0, mine: 0, assigned: 0 };
    }

    return {
      all: papers.length,
      available: papers.filter((paper) => !paper.assignedTo).length,
      mine: papers.filter((paper) => paper.assignedTo === profile.id).length,
      assigned: papers.filter((paper) => paper.assignedTo && paper.assignedTo !== profile.id).length,
    };
  }, [papers, profile]);

  const filterOptions: Array<{ value: FilterOption; label: string; count: number }> = [
    { value: 'all', label: 'All Papers', count: counts.all },
    { value: 'available', label: 'Available', count: counts.available },
    { value: 'mine', label: 'My Papers', count: counts.mine },
    { value: 'assigned', label: 'Assigned to Others', count: counts.assigned },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/70 px-6 pb-4">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              filter === option.value
                ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200 hover:text-slate-800'
            }`}
          >
            {option.label}
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                filter === option.value
                  ? 'bg-indigo-200 text-indigo-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {/* Papers Table */}
      <PapersTable papers={filteredPapers} canBulkExport={canBulkExport} />
    </div>
  );
}

