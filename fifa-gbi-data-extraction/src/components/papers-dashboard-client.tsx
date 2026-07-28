'use client';

import { ArrowCounterClockwise, CaretDown } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { PapersTable } from '@/components/papers-table';
import { statusLabel } from '@/components/status-pill';
import { Button, Chip, cn, Field, Input, Select } from '@/components/ui';
import { useActiveProfileState } from '@/hooks/use-active-profile';
import type { DataExtractionPaperSummary } from '@/lib/data-extraction-batch-filter';
import type { PaperStatus } from '@/lib/types';

type PapersDashboardClientProps = {
  papers: DataExtractionPaperSummary[];
  canBulkExport?: boolean;
  isAdmin?: boolean;
};

type AssignmentFilter = 'all' | 'available' | 'mine';

const isUnavailableForAssignment = (status: PaperStatus) =>
  status === 'archived' || status === 'uefa_master_extraction';

const PAPER_STATUSES: PaperStatus[] = [
  'uploaded',
  'processing',
  'extracted',
  'flagged',
  'qa_review',
  'archived',
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

/** Archived is admin-only, so it is appended separately. */
const SELECTABLE_STATUSES = PAPER_STATUSES.filter((status) => status !== 'archived');

const parsePaperStatus = (value: string | null) =>
  value && PAPER_STATUSES.includes(value as PaperStatus) ? (value as PaperStatus) : 'all';

type DashboardFilterParams = {
  assignment: AssignmentFilter;
  status: PaperStatus | 'all';
  assignee: string;
  flagged: boolean | 'all';
  notes: boolean | 'all';
  q: string;
};

export function PapersDashboardClient({ papers, canBulkExport = true, isAdmin = false }: PapersDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useActiveProfileState();
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(
    searchParams.get('assignment') === 'available' || searchParams.get('assignment') === 'mine'
      ? (searchParams.get('assignment') as AssignmentFilter)
      : 'all',
  );
  const [statusFilter, setStatusFilter] = useState<PaperStatus | 'all'>(parsePaperStatus(searchParams.get('status')));
  const [userFilter, setUserFilter] = useState<string>(searchParams.get('assignee') || 'all');
  const [flaggedFilter, setFlaggedFilter] = useState<boolean | 'all'>(
    searchParams.get('flagged') === 'yes' ? true : searchParams.get('flagged') === 'no' ? false : 'all',
  );
  const [notesFilter, setNotesFilter] = useState<boolean | 'all'>(
    searchParams.get('notes') === 'yes' ? true : searchParams.get('notes') === 'no' ? false : 'all',
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const replaceFilterParams = (overrides: Partial<DashboardFilterParams>) => {
    const values: DashboardFilterParams = {
      assignment: assignmentFilter,
      status: statusFilter,
      assignee: userFilter,
      flagged: flaggedFilter,
      notes: notesFilter,
      q: searchQuery,
      ...overrides,
    };
    const next = new URLSearchParams(searchParams.toString());

    if (values.assignment === 'all') next.delete('assignment');
    else next.set('assignment', values.assignment);

    if (values.status === 'all') next.delete('status');
    else next.set('status', values.status);

    if (values.assignee === 'all') next.delete('assignee');
    else next.set('assignee', values.assignee);

    if (values.flagged === 'all') next.delete('flagged');
    else next.set('flagged', values.flagged ? 'yes' : 'no');

    if (values.notes === 'all') next.delete('notes');
    else next.set('notes', values.notes ? 'yes' : 'no');

    const queryText = values.q.trim();
    if (queryText) next.set('q', queryText);
    else next.delete('q');

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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
        result = result.filter((paper) => !paper.assignedTo && !isUnavailableForAssignment(paper.status));
      } else if (assignmentFilter === 'mine') {
        // Show all papers assigned to user, including completed ones
        result = result.filter((paper) => paper.assignedTo === profile.id);
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((paper) => paper.status === statusFilter);
    }

    // User filter
    if (userFilter !== 'all') {
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
  }, [papers, profile, assignmentFilter, statusFilter, userFilter, flaggedFilter, notesFilter, searchQuery]);

  const counts = useMemo(() => {
    if (!profile) {
      return { all: papers.length, available: 0, mine: 0 };
    }

    return {
      all: papers.length,
      available: papers.filter((paper) => !paper.assignedTo && !isUnavailableForAssignment(paper.status)).length,
      mine: papers.filter((paper) => paper.assignedTo === profile.id).length, // Include all assigned papers, including completed
    };
  }, [papers, profile]);

  const assignmentFilterOptions: Array<{ value: AssignmentFilter; label: string; count: number }> = [
    { value: 'all', label: 'All papers', count: counts.all },
    { value: 'available', label: 'Available', count: counts.available },
    { value: 'mine', label: 'My papers', count: counts.mine },
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
    replaceFilterParams({
      assignment: 'all',
      status: 'all',
      assignee: 'all',
      flagged: 'all',
      notes: 'all',
      q: '',
    });
  };

  const renderSearchControl = (className?: string) => (
    <Field label="Search" className={className}>
      {({ id, describedBy }) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          type="search"
          placeholder="Title, author, ID, DOI…"
          value={searchQuery}
          onChange={(event) => {
            const value = event.target.value;
            setSearchQuery(value);
            replaceFilterParams({ q: value });
          }}
        />
      )}
    </Field>
  );

  const filterFields = (
    <>
      <Field label="Status">
        {({ id }) => (
          <Select
            id={id}
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value as PaperStatus | 'all';
              setStatusFilter(value);
              replaceFilterParams({ status: value });
            }}
          >
            <option value="all">All statuses</option>
            {SELECTABLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
            {isAdmin ? <option value="archived">{statusLabel('archived')}</option> : null}
          </Select>
        )}
      </Field>

      <Field label="Assigned user">
        {({ id }) => (
          <Select
            id={id}
            value={userFilter}
            onChange={(event) => {
              const value = event.target.value;
              setUserFilter(value);
              replaceFilterParams({ assignee: value });
            }}
          >
            <option value="all">All users</option>
            {uniqueAssignees.map(({ id: assigneeId, name }) => (
              <option key={assigneeId} value={assigneeId}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Flagged">
        {({ id }) => (
          <Select
            id={id}
            value={flaggedFilter === 'all' ? 'all' : flaggedFilter ? 'yes' : 'no'}
            onChange={(event) => {
              const value = event.target.value;
              const nextValue = value === 'all' ? 'all' : value === 'yes';
              setFlaggedFilter(nextValue);
              replaceFilterParams({ flagged: nextValue });
            }}
          >
            <option value="all">All</option>
            <option value="yes">Flagged only</option>
            <option value="no">Not flagged</option>
          </Select>
        )}
      </Field>

      <Field label="Notes">
        {({ id }) => (
          <Select
            id={id}
            value={notesFilter === 'all' ? 'all' : notesFilter ? 'yes' : 'no'}
            onChange={(event) => {
              const value = event.target.value;
              const nextValue = value === 'all' ? 'all' : value === 'yes';
              setNotesFilter(nextValue);
              replaceFilterParams({ notes: nextValue });
            }}
          >
            <option value="all">All</option>
            <option value="yes">Has notes</option>
            <option value="no">No notes</option>
          </Select>
        )}
      </Field>
    </>
  );

  const filterSummary = hasActiveFilters ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-info-line bg-info-tint px-3.5 py-2.5">
      <p className="text-xs text-info-ink">
        <span className="font-semibold [font-variant-numeric:tabular-nums]">{filteredPapers.length}</span> of{' '}
        <span className="font-semibold [font-variant-numeric:tabular-nums]">{papers.length}</span> papers match your
        filters
      </p>
      <Button size="sm" onClick={resetFilters} icon={<ArrowCounterClockwise />}>
        Reset filters
      </Button>
    </div>
  ) : null;

  return (
    <div>
      {/* Assignment tabs. These are buttons; the batch filters on the page header
          are links. Same visual, different semantics, deliberately. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
        {assignmentFilterOptions.map((option) => (
          <Chip
            key={option.value}
            active={assignmentFilter === option.value}
            count={option.count}
            onClick={() => {
              setAssignmentFilter(option.value);
              replaceFilterParams({ assignment: option.value });
            }}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      {/* The filter bar is a distinct toolbar zone: a sunk band so the controls,
          which stay on `surface`, read as raised against it rather than floating
          in undifferentiated white. */}
      <div className="space-y-3 border-b border-line bg-surface-sunk px-4 py-4 md:hidden">
        {renderSearchControl()}
        <button
          type="button"
          aria-expanded={showMobileFilters}
          onClick={() => setShowMobileFilters((open) => !open)}
          className="inline-flex min-h-11 w-full items-center justify-between rounded-ctl border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink transition-[border-color] duration-[160ms] ease-gbi hover:border-navy-300 focus-visible:outline-none focus-visible:shadow-focus"
        >
          <span>Advanced filters</span>
          <CaretDown
            aria-hidden
            weight="bold"
            className={cn('h-4 w-4 transition-transform duration-[160ms] ease-gbi', showMobileFilters && 'rotate-180')}
          />
        </button>
        {showMobileFilters ? <div className="grid gap-3 sm:grid-cols-2">{filterFields}</div> : null}
        {filterSummary}
      </div>

      {/* Desktop filters */}
      <div className="hidden space-y-3.5 border-b border-line bg-surface-sunk px-5 py-4 md:block">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {renderSearchControl('xl:col-span-2')}
          {filterFields}
        </div>
        {filterSummary}
      </div>

      {/* Papers Table */}
      <PapersTable papers={filteredPapers} canBulkExport={canBulkExport} isAdmin={isAdmin} />
    </div>
  );
}
