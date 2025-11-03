'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';

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
  const router = useRouter();
  const [draftValue, setDraftValue] = useState(result?.value ?? '');
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const placeholder = MULTILINE_PLACEHOLDERS[definition.id] ?? '';

  useEffect(() => {
    setDraftValue(result?.value ?? '');
  }, [result?.value]);

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const isSelected = supportsAi ? selected : true;

  const persist = (nextValue: string) => {
    if (supportsAi && !isSelected) {
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch('/api/extract/field', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId,
            tab,
            fieldId: definition.id,
            value: nextValue.trim(),
            metric: definition.metric,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Failed to update field");
        }

        router.refresh();
      } catch (error) {
        console.error('Failed to update field', error);
      }
    });
  };

  const schedulePersist = (nextValue: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => persist(nextValue), 400);
  };

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (supportsAi && !isSelected) {
      return;
    }
    persist(draftValue);
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
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          schedulePersist(nextValue);
        }}
        onBlur={handleBlur}
        rows={3}
        placeholder={placeholder}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          supportsAi
            ? 'border-indigo-200/80 focus:border-indigo-300 focus:ring-indigo-200/70'
            : 'border-emerald-200/80 focus:border-emerald-300 focus:ring-emerald-200/70'
        }`}
      />
      {isPending ? <p className="text-[11px] text-slate-500">Saving…</p> : null}
    </div>
  );
}
