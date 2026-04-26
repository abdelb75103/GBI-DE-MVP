'use client';

import { useTheme } from '@/components/providers/theme-provider';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18 18l1.78 1.78M2 12h2.5M19.5 12H22M4.22 19.78 6 18M18 6l1.78-1.78" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M21 12.79A8.5 8.5 0 0 1 11.21 3 6.5 6.5 0 1 0 21 12.79Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggleButton() {
  const { theme, toggleTheme, isReady } = useTheme();
  const isDark = theme === 'dark';

  if (!isReady) {
    return (
      <span className="inline-flex h-9 w-16 animate-pulse rounded-full border border-slate-200/70 bg-white/70" aria-hidden />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative inline-flex h-9 w-12 items-center rounded-full border border-slate-200/70 bg-white/80 px-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200/80 data-[state=dark]:border-indigo-300 data-[state=dark]:text-indigo-200"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-state={isDark ? 'dark' : 'light'}
    >
      <span
        className={`absolute inset-y-1 flex w-6 items-center justify-center rounded-full bg-[#0b3a70] text-white shadow transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-4' : 'translate-x-0'
        }`}
      >
        {isDark ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
      </span>
      <span className="sr-only">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
