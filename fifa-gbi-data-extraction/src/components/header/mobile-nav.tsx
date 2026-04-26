'use client';

import { useState } from 'react';

import { ActiveProfileIndicator } from '@/components/header/active-profile-indicator';
import { PrimaryNavLinks } from '@/components/header/nav-links';
import { ThemeToggleButton } from '@/components/header/theme-toggle-button';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-10 flex shrink-0 lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
        aria-label="Open navigation"
      >
        <span className="sr-only">Open navigation</span>
        <div className="space-y-1.5">
          <span className="block h-[2px] w-6 rounded-full bg-current" />
          <span className="block h-[2px] w-6 rounded-full bg-current" />
          <span className="block h-[2px] w-6 rounded-full bg-current" />
        </div>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-[320px] max-w-full flex-col gap-6 overflow-y-auto border-l border-slate-200/70 bg-white/95 px-6 py-6 shadow-2xl ring-1 ring-slate-200/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Menu</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
                aria-label="Close navigation"
              >
                <span className="sr-only">Close navigation</span>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-1 text-base font-semibold text-slate-800">
              <PrimaryNavLinks onNavigate={() => setIsOpen(false)} />
            </nav>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Theme</p>
                <div className="mt-3">
                  <ThemeToggleButton />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/60">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Profile</p>
                <div className="mt-3">
                  <ActiveProfileIndicator />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
