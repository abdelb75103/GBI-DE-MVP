'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';

import { ExtractionFieldEditor } from '@/components/extraction-field-editor';
import { ManualGroupEditor } from '@/components/manual-group-editor';
import { ManualGroupTableEditor } from '@/components/manual-group-table-editor';
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

export type ExtractionTabsPanelProps = {
  paperId: string;
  tabs: TabPayload[];
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (layout: LayoutMode) => void;
  readOnly?: boolean;
};

type FeedbackTone = 'info' | 'success' | 'error';

type FeedbackState = {
  message: string;
  tone: FeedbackTone;
  tab?: ExtractionTab;
};

export type LayoutMode = 'accordion' | 'tabbed' | 'full';

const metricOrder = extractionMetrics.map((item) => item.metric);

export function ExtractionTabsPanel({
  paperId,
  tabs,
  layoutMode,
  onLayoutModeChange,
  readOnly = false,
}: ExtractionTabsPanelProps) {
  const router = useRouter();
  const { isConfigured, isLoaded } = useGeminiApiKey();
  const aiTabs = tabs.filter((tab) => aiExtractionTabs.has(tab.tab));
  const manualTabs = tabs.filter((tab) => humanExtractionTabs.includes(tab.tab));

  const [openAiTab, setOpenAiTab] = useState<ExtractionTab | null>(null);
  const [openManualTab, setOpenManualTab] = useState<ExtractionTab | null>(null);
  const [internalLayout, setInternalLayout] = useState<LayoutMode>('accordion');
  const layout = layoutMode ?? internalLayout;
  const orderedTabs = useMemo(() => [...aiTabs, ...manualTabs], [aiTabs, manualTabs]);
  const [activeTab, setActiveTab] = useState<ExtractionTab | null>(orderedTabs[0]?.tab ?? null);
  const autoExtractableIds = (fields: ExtractionFieldDefinition[]) =>
    fields.filter((field) => field.id !== 'studyId').map((field) => field.id);

  const [selectedMap, setSelectedMap] = useState<Map<ExtractionTab, Set<string>>>(
    () =>
      new Map(
        aiTabs.map((item) => [item.tab, new Set(autoExtractableIds(item.fields))]) as [
          ExtractionTab,
          Set<string>,
        ][],
      ),
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();
  const aiAccordionRefs = useRef(new Map<ExtractionTab, HTMLDivElement>());
  const manualAccordionRefs = useRef(new Map<ExtractionTab, HTMLDivElement>());

  const layoutOptions: { id: LayoutMode; label: string; helper: string }[] = useMemo(
    () => [
      { id: 'accordion', label: 'Accordion', helper: 'Expand sections while keeping everything visible.' },
      { id: 'tabbed', label: 'Focus', helper: 'Work one tab at a time without visual clutter.' },
      { id: 'full', label: 'Full screen', helper: 'Hide the PDF preview and maximize the data workspace.' },
    ],
    [],
  );

  const getLayoutHelper = () => layoutOptions.find((option) => option.id === layout)?.helper ?? '';

useEffect(() => {
  if (layoutMode && layoutMode !== internalLayout) {
    setInternalLayout(layoutMode);
  }
}, [layoutMode, internalLayout]);

  useEffect(() => {
    setSelectedMap((prev) => {
      let changed = false;
      const next = new Map<ExtractionTab, Set<string>>();

      const allowedByTab = new Map(
        aiTabs.map((item) => [item.tab, new Set(autoExtractableIds(item.fields))] as const),
      );

      // Remove tabs that no longer exist
      prev.forEach((value, tab) => {
        if (!allowedByTab.has(tab)) {
          changed = true;
        }
      });

      allowedByTab.forEach((allowedSet, tab) => {
        const current = prev.get(tab);
        if (!current) {
          changed = true;
          next.set(tab, new Set(allowedSet));
          return;
        }

        const filtered = new Set<string>();
        current.forEach((id) => {
          if (allowedSet.has(id)) {
            filtered.add(id);
          } else {
            changed = true;
          }
        });

        // Ensure we never include studyId even if it slipped in
        if (filtered.delete('studyId')) {
          changed = true;
        }

        const identical = filtered.size === current.size && [...current].every((id) => filtered.has(id));
        next.set(tab, identical ? current : filtered);
        if (!identical) {
          changed = true;
        }
      });

      if (!changed && prev.size === next.size) {
        return prev;
      }

      return next;
    });
  }, [aiTabs]);

  const handleLayoutChange = (next: LayoutMode) => {
    if (!layoutMode) {
      setInternalLayout(next);
    }
    onLayoutModeChange?.(next);
  };

  const scrollToAccordion = useCallback(
    (tab: ExtractionTab | null, refs: MutableRefObject<Map<ExtractionTab, HTMLDivElement>>) => {
      if (layout !== 'accordion' || !tab) {
        return;
      }

      requestAnimationFrame(() => {
        const element = refs.current.get(tab);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    },
    [layout],
  );

useEffect(() => {
  if (!feedback || feedback.tone !== 'success') {
    return;
  }

  const timer = setTimeout(() => setFeedback(null), 2000);
  return () => clearTimeout(timer);
}, [feedback]);

  useEffect(() => {
    if (!orderedTabs.length) {
      setActiveTab(null);
      return;
    }

    if (!activeTab || !orderedTabs.some((item) => item.tab === activeTab)) {
      setActiveTab(orderedTabs[0].tab);
    }
  }, [orderedTabs, activeTab]);

  useEffect(() => {
    if ((layout === 'tabbed' || layout === 'full') && !activeTab && orderedTabs.length) {
      setActiveTab(orderedTabs[0].tab);
    }
  }, [layout, orderedTabs, activeTab]);

  useEffect(() => {
    scrollToAccordion(openAiTab, aiAccordionRefs);
  }, [openAiTab, scrollToAccordion]);

  useEffect(() => {
    scrollToAccordion(openManualTab, manualAccordionRefs);
  }, [openManualTab, scrollToAccordion]);

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
      setFeedback({ message: 'AI extraction is only available for the first four tabs.', tone: 'error', tab });
      return;
    }

    if (!isLoaded) {
      setFeedback({ message: 'Checking API settings. Please wait a moment and try again.', tone: 'error', tab });
      return;
    }

    if (!isConfigured) {
      setFeedback({
        message: 'Connect your Gemini API key in Settings > API before running extraction.',
        tone: 'error',
        tab,
      });
      return;
    }

    const selected = Array.from(selectedMap.get(tab) ?? []);
    if (!selected.length) {
      setFeedback({ message: 'Select at least one data point before running extraction.', tone: 'error', tab });
      return;
    }

    setFeedback({ message: 'Running extraction…', tone: 'info', tab });
    startTransition(async () => {
      try {
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId, tab, fields: selected }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Extraction failed');
        }

        setFeedback({ message: 'Extraction complete.', tone: 'success', tab });
        // AI extraction saves directly to DB, no need to mark as changed
        router.refresh();
      } catch (error) {
        setFeedback({
          message: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tone: 'error',
          tab,
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

  const renderFeedbackToast = () => {
    if (!feedback) {
      return null;
    }

    const toneStyles: Record<FeedbackTone, { container: string; accent: string; text: string }> = {
      info: {
        container: 'border-indigo-200/80 bg-indigo-50/90 shadow-indigo-200/70',
        accent: 'bg-indigo-500',
        text: 'text-indigo-800',
      },
      success: {
        container: 'border-emerald-200/80 bg-emerald-50/90 shadow-emerald-200/70',
        accent: 'bg-emerald-500',
        text: 'text-emerald-800',
      },
      error: {
        container: 'border-rose-200/80 bg-rose-50/90 shadow-rose-200/70',
        accent: 'bg-rose-500',
        text: 'text-rose-800',
      },
    };

    const styles = toneStyles[feedback.tone];
    const tabLabel = feedback.tab ? extractionTabMeta[feedback.tab].title : null;

    return (
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-sm justify-end">
        <div
          className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${styles.container} ${styles.text}`}
        >
          <span className={`mt-1 inline-flex h-2 w-2 flex-none rounded-full ${styles.accent}`} aria-hidden />
          <div className="flex-1 space-y-1">
            {tabLabel ? <p className="text-xs font-semibold uppercase tracking-[0.22em]">{tabLabel}</p> : null}
            <p className="text-sm leading-5">{feedback.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  const renderAiCard = (item: TabPayload, currentLayout: LayoutMode, showTitle = true) => {
    const selectedSet = selectedMap.get(item.tab) ?? new Set<string>();
    const resultMap = new Map(item.results.map((field) => [field.fieldId, field]));
    const gridClassName =
      currentLayout === 'tabbed'
        ? 'grid gap-4 sm:grid-cols-2'
        : currentLayout === 'full'
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid gap-4 md:grid-cols-2';

    return (
      <div className="space-y-4">
        {showTitle ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
            <p className="text-xs text-slate-500">{extractionTabMeta[item.tab].description}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">{extractionTabMeta[item.tab].description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExtraction(item.tab)}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-full border border-indigo-200/70 bg-indigo-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
          >
            {isPending ? 'Extracting…' : 'Auto-extract selected data'}
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-400">Gemini assist</span>
        </div>
        <div className={gridClassName}>
          {item.fields.map((field) => {
            const isAutoExtractable = field.id !== 'studyId';
            return (
              <ExtractionFieldEditor
                key={field.id}
                paperId={paperId}
                tab={item.tab}
                definition={field}
                result={resultMap.get(field.id)}
                supportsAi={isAutoExtractable}
                selected={selectedSet.has(field.id)}
                onSelectedChange={(checked) =>
                  setSelectedMap((prev) => {
                    if (!isAutoExtractable) {
                      return prev;
                    }
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
                readOnly={readOnly}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderManualCard = (item: TabPayload, currentLayout: LayoutMode, showTitle = true) => {
    const resultMap = new Map(item.results.map((field) => [field.fieldId, field]));
    const groups = groupFieldsById(item.fields);
    const hasGroups = groups.size > 0;
    const gridClassName =
      currentLayout === 'tabbed'
        ? 'grid gap-4 sm:grid-cols-2'
        : currentLayout === 'full'
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid gap-4 md:grid-cols-2';

    return (
      <div className="space-y-4">
        {showTitle ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
            <p className="text-xs text-slate-500">{extractionTabMeta[item.tab].description}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">{extractionTabMeta[item.tab].description}</p>
        )}
        {hasGroups ? (
          <div className="space-y-5">
            {Array.from(groups.values()).map((group) => {
              const sortedFields = group.fields.sort((a, b) => {
                const orderA = a.metric ? metricOrder.indexOf(a.metric) : Number.MAX_SAFE_INTEGER;
                const orderB = b.metric ? metricOrder.indexOf(b.metric) : Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
              });
              
              // Use table editor for the 4 metric-based tabs
              const useTableEditor = ['injuryTissueType', 'injuryLocation', 'illnessRegion', 'illnessEtiology'].includes(item.tab);
              
              return useTableEditor ? (
                <ManualGroupTableEditor
                  key={group.label}
                  paperId={paperId}
                  tab={item.tab}
                  groupLabel={group.label}
                  fields={sortedFields}
                  results={resultMap}
                />
              ) : (
                <ManualGroupEditor
                  key={group.label}
                  paperId={paperId}
                  tab={item.tab}
                  groupLabel={group.label}
                  fields={sortedFields}
                  results={resultMap}
                />
              );
            })}
          </div>
        ) : (
          <div className={gridClassName}>
            {item.fields.map((field) => (
              <ExtractionFieldEditor
                key={field.id}
                paperId={paperId}
                tab={item.tab}
                definition={field}
                result={resultMap.get(field.id)}
                supportsAi={false}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAccordion = () => (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">AI extraction</h2>
          <p className="text-xs text-slate-500">Let Gemini draft the first four tabs for you.</p>
        </div>
        <div className="space-y-3">
          {aiTabs.map((item) => {
            const isOpen = openAiTab === item.tab;
            return (
              <div
                key={item.tab}
                ref={(element) => {
                  if (element) {
                    aiAccordionRefs.current.set(item.tab, element);
                  } else {
                    aiAccordionRefs.current.delete(item.tab);
                  }
                }}
                className="scroll-mt-32 rounded-3xl border border-slate-200/70 bg-white/90 shadow-sm"
              >
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
                    {renderAiCard(item, 'accordion', false)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Manual entry</h2>
          <p className="text-xs text-slate-500">Complete the remaining tabs after reviewing the AI draft.</p>
        </div>
        <div className="space-y-3">
          {manualTabs.map((item) => {
            const isOpen = openManualTab === item.tab;

            return (
              <div
                key={item.tab}
                ref={(element) => {
                  if (element) {
                    manualAccordionRefs.current.set(item.tab, element);
                  } else {
                    manualAccordionRefs.current.delete(item.tab);
                  }
                }}
                className="scroll-mt-32 rounded-3xl border border-slate-200/70 bg-white/90 shadow-sm"
              >
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
                    {renderManualCard(item, 'accordion', false)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTabbed = (mode: LayoutMode) => {
    const active = orderedTabs.find((item) => item.tab === activeTab) ?? orderedTabs[0];
    const isActiveAi = active ? aiExtractionTabs.has(active.tab) : false;
    const isFull = mode === 'full';

    return (
      <div className="space-y-4">
        <div
          className={`rounded-3xl border ${
            isFull
              ? 'border-slate-200/80 bg-white/95 shadow-xl ring-1 ring-slate-200/70'
              : 'border-slate-200/70 bg-white/90 shadow-sm'
          }`}
        >
          <div
            className={
              isFull
                ? 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]'
                : 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]'
            }
          >
            <nav
              className={`flex gap-2 overflow-x-auto border-b border-slate-200/60 px-4 py-3 text-sm text-slate-600 ${
                isFull
                  ? 'lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-6'
                  : 'lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6'
              }`}
            >
              {orderedTabs.map((item) => {
                const isActive = item.tab === active?.tab;
                const tabLabel = extractionTabMeta[item.tab].title;
                return (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => setActiveTab(item.tab)}
                    className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition lg:flex-none lg:whitespace-normal lg:text-left lg:rounded-xl lg:px-4 lg:py-2 ${
                      isActive ? 'bg-indigo-100/70 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tabLabel}
                  </button>
                );
              })}
            </nav>
            <div className={`space-y-4 px-4 py-5 ${isFull ? 'lg:px-8 lg:py-7' : 'lg:px-6 lg:py-6'}`}>
              {active ? (
                isActiveAi ? renderAiCard(active, mode) : renderManualCard(active, mode)
              ) : (
                <p className="text-sm text-slate-500">No extraction tabs available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderFeedbackToast()}
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Extraction workspace</h2>
              <p className="text-xs text-slate-500">{getLayoutHelper()}</p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-full bg-slate-100/60 p-1 text-xs font-semibold text-slate-600 shadow-inner">
                {layoutOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleLayoutChange(option.id)}
                    className={`rounded-full px-3 py-1.5 transition ${
                      layout === option.id
                        ? 'bg-white text-slate-900 shadow'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Link
                href="/settings/api"
                className="text-xs font-semibold uppercase tracking-wide text-indigo-600 underline"
              >
                API settings
              </Link>
            </div>
          </div>
          {layout === 'accordion' ? renderAccordion() : null}
          {layout === 'tabbed' ? renderTabbed('tabbed') : null}
          {layout === 'full' ? renderTabbed('full') : null}
        </section>
      </div>
    </>
  );
}
