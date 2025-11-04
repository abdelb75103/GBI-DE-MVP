'use client';

import { useState } from 'react';

import { ExtractionTabsPanel, type ExtractionTabsPanelProps, type LayoutMode } from '@/components/extraction-tabs-panel';

export type PaperWorkspaceShellProps = {
  paperId: string;
  tabs: ExtractionTabsPanelProps['tabs'];
  viewerUrl: string | null;
};

export function PaperWorkspaceShell({ paperId, tabs, viewerUrl }: PaperWorkspaceShellProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('accordion');

  const showViewer = layoutMode !== 'full';

  return (
    <div
      className={
        showViewer
          ? 'flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)] xl:items-start xl:auto-rows-fr xl:gap-10'
          : 'flex flex-col gap-8'
      }
    >
      {showViewer ? (
        <section className="flex flex-col rounded-3xl border border-slate-200/70 bg-white/90 shadow-xl ring-1 ring-slate-200/60 backdrop-blur xl:sticky xl:top-24 xl:self-start">
          <div className="border-b border-slate-200/70 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">PDF preview</h2>
            <p className="text-xs text-slate-500">
              Review the paper on the left while validating the extracted fields on the right.
            </p>
          </div>
          <div className="relative h-full min-h-[65vh] w-full overflow-hidden rounded-b-3xl border-t border-slate-200/60 bg-slate-100/80 lg:min-h-[75vh]">
            {viewerUrl ? (
              <object
                data={viewerUrl}
                type="application/pdf"
                className="absolute inset-0 h-full w-full"
                width="100%"
                height="100%"
                aria-label="PDF document preview"
              >
                <iframe
                  title="PDF preview"
                  src={viewerUrl}
                  className="h-full w-full border-0"
                  style={{ minHeight: '100%' }}
                  allow="fullscreen"
                />
                <div className="flex h-full w-full items-center justify-center bg-white p-6 text-center text-sm text-slate-600">
                  Your browser does not support inline PDF preview.{' '}
                  <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    Open the document in a new tab
                  </a>
                  .
                </div>
              </object>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">PDF preview coming soon.</div>
            )}
          </div>
        </section>
      ) : null}

      <ExtractionTabsPanel
        paperId={paperId}
        tabs={tabs}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
      />
    </div>
  );
}
