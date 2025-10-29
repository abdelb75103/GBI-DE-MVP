'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { extractionMetrics } from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';

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
          return (
            <label key={field.id} className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {label}
              <input
                value={draftValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDrafts((prev) => ({ ...prev, [field.id]: nextValue }));
                  schedulePersist(field, nextValue);
                }}
                onBlur={(event) => handleBlur(field, event.target.value)}
                placeholder="Not reported"
                className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
          );
        })}
      </div>
      {isPending ? <p className="px-4 pb-3 text-xs text-slate-500">Saving…</p> : null}
    </div>
  );
}
