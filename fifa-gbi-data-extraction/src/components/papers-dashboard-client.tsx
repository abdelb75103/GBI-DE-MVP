'use client';

import { useMemo, useState } from 'react';

import { PapersTable } from '@/components/papers-table';
import { useActiveProfileState } from '@/hooks/use-active-profile';
import type { Paper, PaperStatus } from '@/lib/types';

type PapersDashboardClientProps = {
  papers: Paper[];
  canBulkExport?: boolean;
  isAdmin?: boolean;
};

type AssignmentFilter = 'all' | 'available' | 'mine';

export function PapersDashboardClient({ papers, canBulkExport = true, isAdmin = false }: PapersDashboardClientProps) {
  const { profile } = useActiveProfileState();
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PaperStatus | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [flaggedFilter, setFlaggedFilter] = useState<boolean | 'all'>('all');
  const [notesFilter, setNotesFilter] = useState<boolean | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique assignees for user filter dropdown
  const uniqueAssignees = useMemo(() => {
    const assignees = new Map<string, string>();
    papers.forEach((paper) => {
      if (paper.assignedTo && paper.assigneeName) {
        assignees.set(paper.assignedTo, paper.assigneeName);
      }
    });
    return Array.from(assignees.entries()).map(([id, name]) => ({ id, name }));
  }, [papers]);

  const filteredPapers = useMemo(() => {
    let result = papers;

    // Assignment filter
    if (profile && assignmentFilter !== 'all') {
      if (assignmentFilter === 'available') {
        result = result.filter((paper) => !paper.assignedTo);
      } else if (assignmentFilter === 'mine') {
        // Show all papers assigned to user, including completed ones
        result = result.filter((paper) => paper.assignedTo === profile.id);
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((paper) => paper.status === statusFilter);
    }

    // User filter (admin only)
    if (isAdmin && userFilter !== 'all') {
      result = result.filter((paper) => paper.assignedTo === userFilter);
    }

    // Flagged filter
    if (flaggedFilter !== 'all') {
      result = result.filter((paper) => Boolean(paper.flagReason) === flaggedFilter);
    }

    // Notes filter
    if (notesFilter !== 'all') {
      result = result.filter((paper) => (paper.noteCount > 0) === notesFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (paper) =>
          paper.title.toLowerCase().includes(query) ||
          paper.assignedStudyId.toLowerCase().includes(query) ||
          paper.leadAuthor?.toLowerCase()?.includes(query) ||
          paper.journal?.toLowerCase()?.includes(query) ||
          paper.year?.toLowerCase()?.includes(query) ||
          paper.doi?.toLowerCase()?.includes(query)
      );
    }

    return result;
  }, [papers, profile, assignmentFilter, statusFilter, userFilter, flaggedFilter, notesFilter, searchQuery, isAdmin]);

  const counts = useMemo(() => {
    if (!profile) {
      return { all: papers.length, available: 0, mine: 0 };
    }

    return {
      all: papers.length,
      available: papers.filter((paper) => !paper.assignedTo).length,
      mine: papers.filter((paper) => paper.assignedTo === profile.id).length, // Include all assigned papers, including completed
    };
  }, [papers, profile]);

  const assignmentFilterOptions: Array<{ value: AssignmentFilter; label: string; count: number }> = [
    { value: 'all', label: 'All Papers', count: counts.all },
    { value: 'available', label: 'Available', count: counts.available },
    { value: 'mine', label: 'My Papers', count: counts.mine },
  ];

  const hasActiveFilters =
    assignmentFilter !== 'all' ||
    statusFilter !== 'all' ||
    userFilter !== 'all' ||
    flaggedFilter !== 'all' ||
    notesFilter !== 'all' ||
    searchQuery.trim() !== '';

  const resetFilters = () => {
    setAssignmentFilter('all');
    setStatusFilter('all');
    setUserFilter('all');
    setFlaggedFilter('all');
    setNotesFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Assignment Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/70 px-6 pb-4">
        {assignmentFilterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setAssignmentFilter(option.value)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              assignmentFilter === option.value
                ? 'bg-indigo-600 text-white border-2 border-indigo-500'
                : 'bg-slate-700/50 text-slate-300 border-2 border-transparent hover:bg-slate-600/50 hover:text-slate-200'
            }`}
          >
            {option.label}
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                assignmentFilter === option.value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-600/50 text-slate-300'
              }`}
            >
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      <div className="px-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Search */}
          <div className="xl:col-span-2">
            <label htmlFor="search" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Title, author, ID, DOI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaperStatus | 'all')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="extracted">Extracted</option>
              <option value="flagged">Flagged</option>
              <option value="qa_review">QA Review</option>
              <option value="archived">Archived</option>
              <option value="mental_health">Mental Health</option>
              <option value="uefa">UEFA</option>
              <option value="american_data">American Data</option>
              <option value="systematic_review">Systematic Review</option>
            </select>
          </div>

          {/* User Filter (Admin Only) */}
          {isAdmin && (
            <div>
              <label htmlFor="user-filter" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Assigned User
              </label>
              <select
                id="user-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Users</option>
                {uniqueAssignees.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Flagged Filter */}
          <div>
            <label htmlFor="flagged-filter" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Flagged
            </label>
            <select
              id="flagged-filter"
              value={flaggedFilter === 'all' ? 'all' : flaggedFilter ? 'yes' : 'no'}
              onChange={(e) =>
                setFlaggedFilter(e.target.value === 'all' ? 'all' : e.target.value === 'yes')
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="yes">Flagged Only</option>
              <option value="no">Not Flagged</option>
            </select>
          </div>

          {/* Notes Filter */}
          <div>
            <label htmlFor="notes-filter" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Notes
            </label>
            <select
              id="notes-filter"
              value={notesFilter === 'all' ? 'all' : notesFilter ? 'yes' : 'no'}
              onChange={(e) =>
                setNotesFilter(e.target.value === 'all' ? 'all' : e.target.value === 'yes')
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="yes">Has Notes</option>
              <option value="no">No Notes</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-2.5">
            <p className="text-xs text-indigo-700">
              <span className="font-semibold">{filteredPapers.length}</span> of{' '}
              <span className="font-semibold">{papers.length}</span> papers match your filters
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                  clipRule="evenodd"
                />
              </svg>
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Papers Table */}
      <PapersTable papers={filteredPapers} canBulkExport={canBulkExport} isAdmin={isAdmin} />
    </div>
  );
}
