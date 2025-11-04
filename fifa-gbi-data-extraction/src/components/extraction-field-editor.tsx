'use client';

import { useEffect, useState } from 'react';

import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';

const MULTILINE_PLACEHOLDERS: Record<string, string> = {
  ageCategory: 'U19\nU21',
  sex: 'U19 — male\nU21 — female',
  meanAge: 'U19 — 16.8 ± 0.9\nU21 — 20.1 ± 0.3',
  sampleSizePlayers: 'U19 — 62\nU21 — 60',
  numberOfTeams: 'U19 — 4 clubs\nU21 — 5 clubs',
  studyPeriodYears: 'U19 — 4 seasons\nU21 — 3 seasons',
  observationDuration: 'U19 — 4 seasons\nU21 — 3 seasons',
  numberOfSeasons: 'U19 — 4\nU21 — 3',
  seasonLength: 'Tournament A — 4 weeks\nTournament B — 2 weeks',
  matchExposure: 'U19 — 250 h\nU21 — 210 h',
  trainingExposure: 'U19 — 420 h\nU21 — 390 h',
};

type ExtractionFieldEditorProps = {
  definition: ExtractionFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  supportsAi: boolean;
  selected?: boolean;
  onSelectedChange?: (value: boolean) => void;
  disabled?: boolean;
  dirty?: boolean;
};

export function ExtractionFieldEditor({
  definition,
  value,
  onChange,
  supportsAi,
  selected = true,
  onSelectedChange,
  disabled = false,
  dirty = false,
}: ExtractionFieldEditorProps) {
  const [draftValue, setDraftValue] = useState(value ?? '');
  const placeholder = MULTILINE_PLACEHOLDERS[definition.id] ?? '';

  useEffect(() => {
    const next = value ?? '';
    // Sync external updates into the in-progress draft without triggering extra renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftValue((current) => (current === next ? current : next));
  }, [value]);

  const isSelected = supportsAi ? selected : true;
  const isInputDisabled = disabled || (supportsAi && !isSelected);
  const containerRing =
    dirty && !isInputDisabled
      ? 'ring-2 ring-indigo-200/80'
      : supportsAi
        ? ''
        : '';

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-2xl border p-4 text-sm shadow-sm ${containerRing} ${
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
            disabled={disabled}
          />
        ) : null}
        <span>{definition.label}</span>
      </div>
      <textarea
        value={draftValue}
        disabled={isInputDisabled}
        onChange={(event) => {
          if (isInputDisabled) {
            return;
          }
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          onChange(nextValue);
        }}
        onBlur={() => {
          if (isInputDisabled) {
            return;
          }
          onChange(draftValue);
        }}
        rows={3}
        placeholder={placeholder}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          supportsAi
            ? 'border-indigo-200/80 focus:border-indigo-300 focus:ring-indigo-200/70'
            : 'border-emerald-200/80 focus:border-emerald-300 focus:ring-emerald-200/70'
        }`}
      />
      {dirty && !isInputDisabled ? (
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-indigo-400">Pending save</span>
      ) : null}
    </div>
  );
}
