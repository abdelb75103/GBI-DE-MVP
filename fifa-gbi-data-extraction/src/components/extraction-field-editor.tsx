'use client';

import { useContext } from 'react';

import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';
import { WorkspaceSaveContext } from '@/components/workspace-save-manager';

const MULTILINE_PLACEHOLDERS: Record<string, string> = {
  // Population-defining fields (use identifiers)
  ageCategory: '',
  sex: '',
  // All other fields (values only, no labels)
  meanAge: '',
  sampleSizePlayers: '',
  numberOfTeams: '',
  studyPeriodYears: '',
  observationDuration: '',
  // Exposure (values only)
  seasonLength: '',
  numberOfSeasons: '',
  matchExposure: '',
  trainingExposure: '',
  // Injury Outcome (values only)
  injuryTotalCount: '',
  injuryIncidenceOverall: '',
  injuryIncidenceMatch: '',
  // Illness Outcome (values only)
  illnessTotalCount: '',
  illnessIncidenceOverall: '',
};

type ExtractionFieldEditorProps = {
  paperId: string;
  tab: ExtractionTab;
  definition: ExtractionFieldDefinition;
  result?: ExtractionFieldResult;
  supportsAi: boolean;
  selected?: boolean;
  onSelectedChange?: (value: boolean) => void;
  readOnly?: boolean;
};

export function ExtractionFieldEditor({
  paperId,
  tab,
  definition,
  result,
  supportsAi,
  selected = true,
  onSelectedChange,
  readOnly = false,
}: ExtractionFieldEditorProps) {
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const placeholder = MULTILINE_PLACEHOLDERS[definition.id] ?? '';
  
  // Get local value if it exists, otherwise use server value
  const localValue = getFieldValue(tab, definition.id);
  const currentValue = localValue !== undefined ? localValue ?? '' : result?.value ?? '';

  const isSelected = supportsAi ? selected : true;

  const handleChange = (value: string) => {
    updateField({
      paperId,
      tab,
      fieldId: definition.id,
      value,
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
        className={`flex items-center justify-between gap-2 text-sm font-semibold ${
          supportsAi ? 'text-indigo-900' : 'text-emerald-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {supportsAi && onSelectedChange ? (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={isSelected}
              onChange={(event) => onSelectedChange(event.target.checked)}
              disabled={readOnly}
            />
          ) : null}
          <span>{definition.label}</span>
        </div>
        {placeholder && (
          <span className="text-[10px] font-normal text-slate-500" title={placeholder}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        )}
      </div>
      <textarea
        value={currentValue}
        disabled={readOnly || (supportsAi ? !isSelected : false)}
        onChange={(event) => {
          if (readOnly || (supportsAi && !isSelected)) {
            return;
          }
          handleChange(event.target.value);
        }}
        rows={3}
        placeholder={placeholder}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          readOnly
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-75'
            : supportsAi
              ? 'border-indigo-200/80 focus:border-indigo-300 focus:ring-indigo-200/70'
              : 'border-emerald-200/80 focus:border-emerald-300 focus:ring-emerald-200/70'
        }`}
      />
    </div>
  );
}
