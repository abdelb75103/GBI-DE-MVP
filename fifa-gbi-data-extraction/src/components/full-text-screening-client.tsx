'use client';

import { FormEvent, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  getDecisionProgressLabel,
  getReviewerDecisions,
  getScreeningResolution,
  summarizeExclusionReasons,
} from '@/lib/screening/reviewer-decisions';
import type { ScreeningRecord } from '@/lib/types';

type Props = {
  initialRecords: ScreeningRecord[];
  profileRole: 'admin' | 'extractor' | 'observer';
  loadError: string | null;
};

type Filter = 'all' | 'ready_for_extraction' | 'excluded' | 'conflict' | 'promoted';
type Notice = { tone: 'success' | 'error' | 'neutral'; message: string } | null;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function FullTextScreeningClient({ initialRecords, profileRole, loadError }: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = profileRole === 'admin';

  const counts = useMemo(() => {
    return {
      all: records.length,
      included: records.filter((record) => getScreeningResolution(record) === 'ready_for_extraction').length,
      excluded: records.filter((record) => getScreeningResolution(record) === 'excluded').length,
      conflicts: records.filter((record) => getScreeningResolution(record) === 'conflict').length,
      promoted: records.filter((record) => record.promotedPaperId).length,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const resolution = getScreeningResolution(record);
      if (filter !== 'all' && resolution !== filter) return false;
      if (!query) return true;
      return [
        record.assignedStudyId,
        record.title,
        record.leadAuthor,
        record.year,
        record.journal,
        record.doi,
        record.originalFileName,
        record.aiReason,
        summarizeExclusionReasons(record),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [records, filter, search]);

  const refreshRecords = async () => {
    const response = await fetch('/api/full-text-screening', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to refresh screening records');
    }
    const payload = (await response.json()) as { records: ScreeningRecord[] };
    setRecords(payload.records ?? []);
  };

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const files = fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : [];
    if (files.length === 0) {
      setNotice({ tone: 'error', message: 'Select at least one PDF.' });
      return;
    }

    startTransition(async () => {
      const failures = [];
      let successCount = 0;
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          failures.push(`${file.name}: not a PDF`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          failures.push(`${file.name}: exceeds 20 MB`);
          continue;
        }

        const data = new FormData();
        data.set('file', file);
        const response = await fetch('/api/full-text-screening/uploads', { method: 'POST', body: data });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          failures.push(`${file.name}: ${payload.error ?? 'upload failed'}`);
          continue;
        }
        successCount += 1;
      }

      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshRecords();
      setNotice({
        tone: failures.length > 0 ? 'error' : 'success',
        message: failures.length > 0
          ? `Uploaded ${successCount}; ${failures.length} failed. ${failures.slice(0, 2).join(' | ')}`
          : `Uploaded ${successCount} PDF${successCount === 1 ? '' : 's'} to screening.`,
      });
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Full-text screening</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Review queue</h1>
          </div>
          {isAdmin ? (
            <form onSubmit={handleUpload} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                name="files"
                type="file"
                accept="application/pdf"
                multiple
                className="w-full min-w-0 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm text-indigo-700 sm:w-80"
              />
              <button
                disabled={isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              >
                Upload
              </button>
            </form>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="All" value={counts.all} tone="slate" />
          <Metric label="Include" value={counts.included} tone="green" />
          <Metric label="Exclude" value={counts.excluded} tone="red" />
          <Metric label="Conflict" value={counts.conflicts} tone="amber" />
          <Metric label="Promoted to extraction" value={counts.promoted} tone="blue" />
        </div>
      </section>

      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterButton label="All" active={filter === 'all'} tone="slate" onClick={() => setFilter('all')} />
              <FilterButton label="Included" active={filter === 'ready_for_extraction'} tone="green" onClick={() => setFilter('ready_for_extraction')} />
              <FilterButton label="Excluded" active={filter === 'excluded'} tone="red" onClick={() => setFilter('excluded')} />
              <FilterButton label="Conflict" active={filter === 'conflict'} tone="amber" onClick={() => setFilter('conflict')} />
              <FilterButton label="Promoted to extraction" active={filter === 'promoted'} tone="blue" onClick={() => setFilter('promoted')} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, study ID, author, DOI..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-80"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Study</th>
                <th className="px-4 py-3">AI suggestion</th>
                <th className="px-4 py-3">Reviewers</th>
                <th className="px-4 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <ScreeningRow
                  key={record.id}
                  record={record}
                />
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No records match this view.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ScreeningRow({ record }: { record: ScreeningRecord }) {
  const resolution = getScreeningResolution(record);
  const reviewerDecisions = getReviewerDecisions(record);

  return (
    <tr className="bg-white hover:bg-slate-50">
      <td className="max-w-[420px] px-4 py-4 align-top">
        <Link href={`/full-text-screening/${record.id}`} className="group">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{record.assignedStudyId}</span>
            <span className="text-xs text-slate-500">{record.leadAuthor ?? 'Author pending'}</span>
          </div>
          <p className="mt-2 font-semibold text-slate-950 group-hover:text-indigo-700">{record.title}</p>
        </Link>
      </td>
      <td className="px-4 py-4 align-top">
        <AiBadge record={record} />
      </td>
      <td className="px-4 py-4 align-top">
        <p className="font-semibold text-slate-900">{getDecisionProgressLabel(record)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {reviewerDecisions.length > 0
            ? reviewerDecisions.map((decision) => decision.decision).join(' + ')
            : 'No reviewer decision'}
        </p>
      </td>
      <td className="px-4 py-4 align-top">
        <ResolutionBadge resolution={resolution} />
      </td>
    </tr>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    blue: 'border-sky-200 bg-sky-50 text-sky-900',
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 ${classes}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function FilterButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'slate' | 'green' | 'red' | 'amber' | 'blue';
  onClick: () => void;
}) {
  const tones = {
    slate: active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700',
    green: active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: active ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-200 bg-rose-50 text-rose-800',
    amber: active ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-200 bg-amber-50 text-amber-800',
    blue: active ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </button>
  );
}

function AiBadge({ record }: { record: ScreeningRecord }) {
  if (record.aiStatus === 'running') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">AI running</span>;
  }
  if (record.aiStatus === 'failed') {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">AI failed</span>;
  }
  if (record.aiSuggestedDecision === 'include') {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">AI include</span>;
  }
  if (record.aiSuggestedDecision === 'exclude') {
    return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">AI exclude</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Not run</span>;
}

function ResolutionBadge({ resolution }: { resolution: ReturnType<typeof getScreeningResolution> }) {
  const labels = {
    pending: 'Pending',
    ready_for_extraction: 'Ready for extraction',
    excluded: 'Excluded',
    conflict: 'Conflict',
    promoted: 'Promoted',
  };
  const classes = {
    pending: 'bg-slate-100 text-slate-700',
    ready_for_extraction: 'bg-emerald-100 text-emerald-800',
    excluded: 'bg-rose-100 text-rose-800',
    conflict: 'bg-amber-100 text-amber-800',
    promoted: 'bg-sky-100 text-sky-800',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes[resolution]}`}>{labels[resolution]}</span>;
}

function Notice({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const classes = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{message}</div>;
}
