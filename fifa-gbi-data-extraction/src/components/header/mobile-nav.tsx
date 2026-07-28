'use client';

import { X } from '@phosphor-icons/react';
import { useState } from 'react';

import { ActiveProfileIndicator } from '@/components/header/active-profile-indicator';
import { AllNavLinks } from '@/components/header/nav-links';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-10 flex shrink-0 lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ctl border border-line-strong bg-surface text-ink-muted hover:border-navy-300 hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
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
        <div className="fixed inset-0 z-50 bg-[rgba(5,24,45,0.55)]" onClick={() => setIsOpen(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-[320px] max-w-full flex-col gap-6 overflow-y-auto border-l border-line bg-surface px-5 py-5 shadow-e2"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-ink-soft">Menu</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-ctl border border-line-strong bg-surface text-ink-muted hover:border-navy-300 hover:text-ink focus-visible:outline-none focus-visible:shadow-focus"
                aria-label="Close navigation"
              >
                <X aria-hidden weight="bold" className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              <AllNavLinks onNavigate={() => setIsOpen(false)} />
            </nav>

            {/* The Theme card is hidden alongside the desktop toggle while the
                migration is verified in light mode only. */}
            <div className="space-y-3">
              <div className="rounded-card bg-surface-sunk p-4 shadow-e0">
                <p className="text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-ink-soft">Profile</p>
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
