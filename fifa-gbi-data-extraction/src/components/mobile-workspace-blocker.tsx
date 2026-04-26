'use client';

import Link from 'next/link';

import { useIsMobile } from '@/hooks/use-is-mobile';

type MobileWorkspaceBlockerProps = {
  children: React.ReactNode;
  breakpoint?: number;
};

/**
 * Prevents editing-heavy workspace views from loading on small screens.
 * Displays a friendly message instead of rendering the workspace.
 */
export function MobileWorkspaceBlocker({ children, breakpoint = 1024 }: MobileWorkspaceBlockerProps) {
  const isMobile = useIsMobile(breakpoint);

  if (isMobile) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-amber-200/70 bg-amber-50/90 p-8 text-center shadow-xl ring-1 ring-amber-200/60">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Workspace unavailable</p>
          <h1 className="text-2xl font-semibold text-slate-900">Desktop only experience</h1>
          <p className="text-sm text-slate-700">
            The workspace isn&apos;t available on mobile. Please switch to a desktop or laptop to continue editing.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/data-extraction"
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            ← Back to data extraction
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
