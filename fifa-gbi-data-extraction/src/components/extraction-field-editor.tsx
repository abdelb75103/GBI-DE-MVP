'use client';

import { useContext, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';
import { WorkspaceSaveContext } from '@/components/workspace-save-manager';

const MULTILINE_PLACEHOLDERS: Record<string, string> = {};

type ExtractionFieldEditorProps = {
  paperId: string;
  tab: ExtractionTab;
  definition: ExtractionFieldDefinition;
  result?: ExtractionFieldResult;
  supportsAi: boolean;
  selected?: boolean;
  onSelectedChange?: (value: boolean) => void;
};

export function ExtractionFieldEditor({
  paperId,
  tab,
  definition,
  result,
  supportsAi,
  selected = true,
  onSelectedChange,
}: ExtractionFieldEditorProps) {
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const placeholder = MULTILINE_PLACEHOLDERS[definition.id] ?? '';
  
  // Get local value if it exists, otherwise use server value
  const localValue = getFieldValue(tab, definition.id);
  const currentValue = localValue !== undefined ? localValue : (result?.value ?? '');
  const [draftValue, setDraftValue] = useState(currentValue);

  useEffect(() => {
    setDraftValue(currentValue);
  }, [currentValue]);

  const isSelected = supportsAi ? selected : true;

  const handleChange = (value: string) => {
    // Update local state immediately for UI
    setDraftValue(value);
    
    // Update the context (marks as changed and stores locally)
    updateField({
      paperId,
      tab,
      fieldId: definition.id,
      value: value.trim() || null,
      metric: definition.metric,
    });
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 text-sm shadow-sm ${
        supportsAi
          ? isSelected
            ? 'border-indigo-200/80 bg-indigo-50/70 text-indigo-800'
            : 'border-slate-200/70 bg-slate-50/60 text-slate-500'
          : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
      }`}
    >
      <div
        className={`flex items-center gap-2 text-sm font-semibold ${
          supportsAi ? 'text-indigo-900' : 'text-emerald-900'
        }`}
      >
        {supportsAi && onSelectedChange ? (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={isSelected}
            onChange={(event) => onSelectedChange(event.target.checked)}
          />
        ) : null}
        <span>{definition.label}</span>
      </div>
      <textarea
        value={draftValue}
        disabled={supportsAi ? !isSelected : false}
        onChange={(event) => {
          if (supportsAi && !isSelected) {
            return;
          }
          handleChange(event.target.value);
        }}
        rows={3}
        placeholder={placeholder}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          supportsAi
            ? 'border-indigo-200/80 focus:border-indigo-300 focus:ring-indigo-200/70'
            : 'border-emerald-200/80 focus:border-emerald-300 focus:ring-emerald-200/70'
        }`}
      />
    </div>
  );
}
