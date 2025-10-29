'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { ExtractionFieldEditor } from '@/components/extraction-field-editor';
import { ManualGroupEditor } from '@/components/manual-group-editor';
import { useGeminiApiKey } from '@/hooks/use-gemini-api-key';
import {
  aiExtractionTabs,
  humanExtractionTabs,
  extractionTabMeta,
  extractionMetrics,
} from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';

type TabPayload = {
  tab: ExtractionTab;
  label: string;
  fields: ExtractionFieldDefinition[];
  results: ExtractionFieldResult[];
};

type ExtractionTabsPanelProps = {
  paperId: string;
  tabs: TabPayload[];
};

type FeedbackTone = 'info' | 'success' | 'error';

type FeedbackState = {
  message: string;
  tone: FeedbackTone;
};

const metricOrder = extractionMetrics.map((item) => item.metric);

export function ExtractionTabsPanel({ paperId, tabs }: ExtractionTabsPanelProps) {
  const router = useRouter();
  const { apiKey, isLoaded } = useGeminiApiKey();

  const aiTabs = tabs.filter((tab) => aiExtractionTabs.has(tab.tab));
  const manualTabs = tabs.filter((tab) => humanExtractionTabs.includes(tab.tab));

  const [openAiTab, setOpenAiTab] = useState<ExtractionTab | null>(aiTabs[0]?.tab ?? null);
  const [openManualTab, setOpenManualTab] = useState<ExtractionTab | null>(manualTabs[0]?.tab ?? null);
  const [selectedMap, setSelectedMap] = useState<Map<ExtractionTab, Set<string>>>(
    () =>
      new Map(
        aiTabs.map((item) => [item.tab, new Set(item.fields.map((field) => field.id))]) as [ExtractionTab, Set<string>][],
      ),
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupFieldsById = (fields: ExtractionFieldDefinition[]) => {
    const groups = new Map<string, { label: string; fields: ExtractionFieldDefinition[] }>();
    fields.forEach((field) => {
      if (!field.groupId) {
        return;
      }
      if (!groups.has(field.groupId)) {
        groups.set(field.groupId, { label: field.groupLabel ?? field.groupId, fields: [] });
      }
      groups.get(field.groupId)!.fields.push(field);
    });
    return groups;
  };

  const handleExtraction = (tab: ExtractionTab) => {
    if (!aiExtractionTabs.has(tab)) {
      setFeedback({ message: 'AI extraction is only available for the first four tabs.', tone: 'error' });
      return;
    }

    if (!isLoaded || !apiKey) {
      setFeedback({ message: 'Enter your Gemini API key in API settings before running extraction.', tone: 'error' });
      return;
    }

    const selected = Array.from(selectedMap.get(tab) ?? []);
    if (!selected.length) {
      setFeedback({ message: 'Select at least one data point before running extraction.', tone: 'error' });
      return;
    }

    setFeedback({ message: 'Running extraction…', tone: 'info' });
    startTransition(async () => {
      try {
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId, tab, fields: selected, apiKey }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Extraction failed');
        }

        setFeedback({ message: 'Extraction complete.', tone: 'success' });
        router.refresh();
      } catch (error) {
        setFeedback({
          message: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tone: 'error',
        });
      }
    });
  };

  const toggleAiTab = (tab: ExtractionTab) => {
    setOpenAiTab((current) => (current === tab ? null : tab));
  };

  const toggleManualTab = (tab: ExtractionTab) => {
    setOpenManualTab((current) => (current === tab ? null : tab));
  };

  const renderHeader = (title: string, description: string, actions?: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {actions}
      </div>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );

  const renderFeedback = () =>
    feedback ? (
      <p
        className={`text-xs ${
          feedback.tone === 'error'
            ? 'text-rose-600'
            : feedback.tone === 'success'
            ? 'text-emerald-600'
            : 'text-slate-500'
        }`}
      >
        {feedback.message}
      </p>
    ) : null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        {renderHeader('AI extraction', 'Let Gemini draft the first four tabs for you.', (
          <Link
            href="/settings/api"
            className="text-xs font-semibold uppercase tracking-wide text-indigo-600 underline"
          >
            API settings
          </Link>
        ))}

        <div className="space-y-3">
          {aiTabs.map((item) => {
            const isOpen = openAiTab === item.tab;
            const selectedSet = selectedMap.get(item.tab) ?? new Set<string>();
            const resultMap = new Map(item.results.map((field) => [field.fieldId, field]));
            return (
              <div key={item.tab} className="rounded-3xl border border-slate-200/70 bg-white/90 shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleAiTab(item.tab)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="text-xs text-slate-500">{isOpen ? 'Hide details' : 'Show details'}</span>
                </button>
                {isOpen ? (
                  <div className="space-y-4 border-t border-slate-200/60 px-6 py-5">
                    <p className="text-xs text-slate-500">{extractionTabMeta[item.tab].description}</p>
                    <button
                      type="button"
                      onClick={() => handleExtraction(item.tab)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center rounded-full border border-indigo-200/70 bg-indigo-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
                    >
                      {isPending ? 'Extracting…' : 'Auto-extract selected data'}
                    </button>
                    <div className="grid gap-4 md:grid-cols-2">
                      {item.fields.map((field) => (
                        <ExtractionFieldEditor
                          key={field.id}
                          paperId={paperId}
                          tab={item.tab}
                          definition={field}
                          result={resultMap.get(field.id)}
                          supportsAi
                          selected={selectedSet.has(field.id)}
                          onSelectedChange={(checked) =>
                            setSelectedMap((prev) => {
                              const next = new Map(prev);
                              const current = new Set(next.get(item.tab) ?? []);
                              if (checked) {
                                current.add(field.id);
                              } else {
                                current.delete(field.id);
                              }
                              next.set(item.tab, current);
                              return next;
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {renderFeedback()}
      </section>

      <section className="space-y-4">
        {renderHeader('Manual entry', 'Complete the remaining tabs after reviewing the AI draft.')}
        <div className="space-y-3">
          {manualTabs.map((item) => {
            const isOpen = openManualTab === item.tab;
            const resultMap = new Map(item.results.map((field) => [field.fieldId, field]));
            const groups = groupFieldsById(item.fields);
            const hasGroups = groups.size > 0;

            return (
              <div key={item.tab} className="rounded-3xl border border-slate-200/70 bg-white/90 shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleManualTab(item.tab)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="text-xs text-slate-500">{isOpen ? 'Hide details' : 'Show details'}</span>
                </button>
                {isOpen ? (
                  <div className="space-y-4 border-t border-slate-200/60 px-6 py-5">
                    <p className="text-xs text-slate-500">{extractionTabMeta[item.tab].description}</p>
                    {hasGroups ? (
                      Array.from(groups.values()).map((group) => (
                        <ManualGroupEditor
                          key={group.label}
                          paperId={paperId}
                          tab={item.tab}
                          groupLabel={group.label}
                          fields={group.fields.sort((a, b) => {
                            const orderA = a.metric ? metricOrder.indexOf(a.metric) : Number.MAX_SAFE_INTEGER;
                            const orderB = b.metric ? metricOrder.indexOf(b.metric) : Number.MAX_SAFE_INTEGER;
                            return orderA - orderB;
                          })}
                          results={resultMap}
                        />
                      ))
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {item.fields.map((field) => (
                          <ExtractionFieldEditor
                            key={field.id}
                            paperId={paperId}
                            tab={item.tab}
                            definition={field}
                            result={resultMap.get(field.id)}
                            supportsAi={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
