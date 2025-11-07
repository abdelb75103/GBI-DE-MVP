'use client';

import { useContext, useEffect, useState } from 'react';

import { extractionMetrics } from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import { WorkspaceSaveContext } from '@/components/workspace-save-manager';
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
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Sync drafts from server/local data (intentional state update in effect)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDrafts((prevDrafts) => {
      const next: Record<string, string> = {};
      let hasChanges = false;
      
      for (const field of fields) {
        // Check for local value first, then server value
        const localValue = getFieldValue(tab, field.id);
        const currentValue = localValue !== undefined ? localValue : (results.get(field.id)?.value ?? '');
        next[field.id] = currentValue ?? '';
        
        // Check if value changed
        if (prevDrafts[field.id] !== next[field.id]) {
          hasChanges = true;
        }
      }
      
      // Only update if there are actual changes to avoid cascading renders
      return hasChanges ? next : prevDrafts;
    });
  }, [fields, results, getFieldValue, tab]);

  const handleChange = (field: ExtractionFieldDefinition, value: string) => {
    // Update local state immediately for UI
    setDrafts((prev) => ({ ...prev, [field.id]: value }));
    
    // Update the context (marks as changed and stores locally)
    updateField({
      paperId,
      tab,
      fieldId: field.id,
      value: value.trim() || null,
      metric: field.metric,
    });
  };

  const fieldsByMetric = new Map(fields.map((field) => [field.metric, field]));

  const metricStyles: Record<
    ExtractionFieldMetric,
    { wrapper: string; label: string; input: string; ring: string }
  > = {
    prevalence: {
      wrapper: 'border-slate-300/60 bg-slate-50',
      label: 'text-slate-700',
      input: 'border-slate-300/60 focus:border-slate-400 focus:ring-slate-300/40',
      ring: 'ring-slate-200/50',
    },
    incidence: {
      wrapper: 'border-blue-300/50 bg-blue-50/40',
      label: 'text-blue-800',
      input: 'border-blue-300/50 focus:border-blue-400 focus:ring-blue-300/40',
      ring: 'ring-blue-200/40',
    },
    burden: {
      wrapper: 'border-teal-300/50 bg-teal-50/40',
      label: 'text-teal-800',
      input: 'border-teal-300/50 focus:border-teal-400 focus:ring-teal-300/40',
      ring: 'ring-teal-200/40',
    },
    severityMeanDays: {
      wrapper: 'border-orange-300/50 bg-orange-50/40',
      label: 'text-orange-800',
      input: 'border-orange-300/50 focus:border-orange-400 focus:ring-orange-300/40',
      ring: 'ring-orange-200/40',
    },
    severityTotalDays: {
      wrapper: 'border-red-300/50 bg-red-50/40',
      label: 'text-red-800',
      input: 'border-red-300/50 focus:border-red-400 focus:ring-red-300/40',
      ring: 'ring-red-200/40',
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
                  handleChange(field, event.target.value);
                }}
                placeholder=""
                className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${styles.input}`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
