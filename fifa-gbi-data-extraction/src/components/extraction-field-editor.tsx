'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';

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
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200/80 bg-white/60 p-4 text-sm text-slate-600">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
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
        placeholder="Not reported"
        className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      {isPending ? <p className="text-[11px] text-slate-500">Saving…</p> : null}
    </div>
  );
}
