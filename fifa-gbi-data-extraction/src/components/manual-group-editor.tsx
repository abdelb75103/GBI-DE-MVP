'use client';

import { extractionMetrics } from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldMetric } from '@/lib/types';

type ManualGroupEditorProps = {
  groupLabel: string;
  fields: ExtractionFieldDefinition[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  dirtyFields: Set<string>;
  disabled?: boolean;
};

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

export function ManualGroupEditor({
  groupLabel,
  fields,
  values,
  onChange,
  dirtyFields,
  disabled = false,
}: ManualGroupEditorProps) {
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
          const draftValue = values[field.id] ?? '';
          const styles = metricStyles[metric];
          const isDirty = dirtyFields.has(field.id);
          return (
            <label
              key={field.id}
              className={`flex flex-col gap-2 rounded-2xl border bg-white/80 p-4 text-xs font-semibold uppercase tracking-[0.22em] shadow-sm ring-1 ${
                styles.wrapper
              } ${styles.ring} ${isDirty && !disabled ? 'ring-2 ring-indigo-200/80' : ''}`}
            >
              <span className={`text-[11px] ${styles.label}`}>{label}</span>
              <input
                value={draftValue}
                onChange={(event) => {
                  if (disabled) {
                    return;
                  }
                  onChange(field.id, event.target.value);
                }}
                placeholder=""
                disabled={disabled}
                className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${styles.input}`}
              />
              {isDirty && !disabled ? (
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-400">
                  Pending save
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
