'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { extractionMetrics } from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type {
  ExtractionFieldMetric,
  ExtractionFieldResult,
  ExtractionTab,
} from '@/lib/types';

type ManualGroupEditorProps = {
  paperId: string;
  tab: ExtractionTab;
  groupLabel: string;
  fields: ExtractionFieldDefinition[];
  results: Map<string, ExtractionFieldResult>;
};

export function ManualGroupEditor({ paperId, tab, groupLabel, fields, results }: ManualGroupEditorProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const existing = results.get(field.id);
      next[field.id] = existing?.value ?? '';
    }
    setDrafts(next);
  }, [fields, results]);

  const persist = (field: ExtractionFieldDefinition, value: string) => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/extract/field', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId,
            tab,
            fieldId: field.id,
            value: value.trim(),
            metric: field.metric,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Failed to update field');
        }

        router.refresh();
      } catch (error) {
        console.error('Failed to update field', error);
      }
    });
  };

  const schedulePersist = (field: ExtractionFieldDefinition, value: string) => {
    const timers = timersRef.current;
    if (timers[field.id]) {
      clearTimeout(timers[field.id]);
    }
    timers[field.id] = setTimeout(() => {
      persist(field, value);
      delete timers[field.id];
    }, 400);
  };

  const handleBlur = (field: ExtractionFieldDefinition, value: string) => {
    const timers = timersRef.current;
    if (timers[field.id]) {
      clearTimeout(timers[field.id]);
      delete timers[field.id];
    }
    persist(field, value);
  };

  const fieldsByMetric = new Map(fields.map((field) => [field.metric, field]));

  const metricStyles: Record<
    ExtractionFieldMetric,
    { wrapper: string; label: string; input: string; ring: string }
  > = {
    prevalence: {
      wrapper: 'border-sky-200/80 bg-sky-50/70',
      label: 'text-sky-700',
      input: 'border-sky-200/70 focus:border-sky-300 focus:ring-sky-200/70',
      ring: 'ring-sky-100/80',
    },
    incidence: {
      wrapper: 'border-indigo-200/80 bg-indigo-50/70',
      label: 'text-indigo-700',
      input: 'border-indigo-200/70 focus:border-indigo-300 focus:ring-indigo-200/70',
      ring: 'ring-indigo-100/80',
    },
    burden: {
      wrapper: 'border-emerald-200/80 bg-emerald-50/70',
      label: 'text-emerald-700',
      input: 'border-emerald-200/70 focus:border-emerald-300 focus:ring-emerald-200/70',
      ring: 'ring-emerald-100/80',
    },
    severityMeanDays: {
      wrapper: 'border-amber-200/80 bg-amber-50/70',
      label: 'text-amber-700',
      input: 'border-amber-200/70 focus:border-amber-300 focus:ring-amber-200/70',
      ring: 'ring-amber-100/80',
    },
    severityTotalDays: {
      wrapper: 'border-rose-200/80 bg-rose-50/70',
      label: 'text-rose-700',
      input: 'border-rose-200/70 focus:border-rose-300 focus:ring-rose-200/70',
      ring: 'ring-rose-100/80',
    },
  };

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-sm ring-1 ring-slate-200/60">
      <div className="border-b border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-700">
        {groupLabel}
      </div>
      <div className="grid gap-4 px-4 py-5 md:grid-cols-5">
        {extractionMetrics.map(({ metric, label }) => {
          const field = fieldsByMetric.get(metric);
          if (!field) {
            return null;
          }
          const draftValue = drafts[field.id] ?? '';
          const styles = metricStyles[metric];
          return (
            <label
              key={field.id}
              className={`flex flex-col gap-2 rounded-2xl border bg-white/80 p-4 text-xs font-semibold uppercase tracking-[0.22em] shadow-sm ring-1 ${styles.wrapper} ${styles.ring}`}
            >
              <span className={`text-[11px] ${styles.label}`}>{label}</span>
              <input
                value={draftValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDrafts((prev) => ({ ...prev, [field.id]: nextValue }));
                  schedulePersist(field, nextValue);
                }}
                onBlur={(event) => handleBlur(field, event.target.value)}
                placeholder=""
                className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${styles.input}`}
              />
            </label>
          );
        })}
      </div>
      {isPending ? <p className="px-4 pb-3 text-xs text-slate-500">Saving…</p> : null}
    </div>
  );
}
