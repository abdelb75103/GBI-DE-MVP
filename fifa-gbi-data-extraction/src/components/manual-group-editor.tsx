'use client';

import { useContext, useEffect, useState } from 'react';

import { extractionMetrics } from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import { Field, Input, t } from '@/components/ui';
import { WorkspaceSaveContext } from '@/components/workspace-save-manager';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';

type ManualGroupEditorProps = {
  paperId: string;
  tab: ExtractionTab;
  groupLabel: string;
  groupDescription?: string;
  fields: ExtractionFieldDefinition[];
  results: Map<string, ExtractionFieldResult>;
};

export function ManualGroupEditor({ paperId, tab, groupLabel, groupDescription, fields, results }: ManualGroupEditorProps) {
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Sync drafts from server/local data (intentional state update in effect)
  /* eslint-disable react-hooks/set-state-in-effect -- Effect hydrates local draft cache from server snapshots */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (field: ExtractionFieldDefinition, value: string) => {
    // Update local state immediately for UI
    setDrafts((prev) => ({ ...prev, [field.id]: value }));

    // Update the context (marks as changed and stores locally)
    updateField({
      paperId,
      tab,
      fieldId: field.id,
      value: value || null,
      metric: field.metric,
    });
  };

  const fieldsByMetric = new Map(fields.map((field) => [field.metric, field]));

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-e1">
      <div className="border-b border-line bg-surface-sunk px-4 py-3">
        <div className="space-y-0.5">
          <div className={t.section}>{groupLabel}</div>
          {groupDescription ? <div className={t.caption}>{groupDescription}</div> : null}
        </div>
      </div>
      <div className="grid gap-4 px-4 py-5 md:grid-cols-5">
        {extractionMetrics.map(({ metric, label }) => {
          const field = fieldsByMetric.get(metric);
          if (!field) {
            return null;
          }
          const draftValue = drafts[field.id] ?? '';
          return (
            <Field key={field.id} label={label}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={draftValue}
                  onChange={(event) => {
                    handleChange(field, event.target.value);
                  }}
                />
              )}
            </Field>
          );
        })}
      </div>
    </div>
  );
}
