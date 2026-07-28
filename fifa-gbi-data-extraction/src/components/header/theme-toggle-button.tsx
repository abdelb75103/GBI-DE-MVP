'use client';

import { Moon, Sun } from '@phosphor-icons/react';

import { useTheme } from '@/components/providers/theme-provider';

export function ThemeToggleButton() {
  const { theme, toggleTheme, isReady } = useTheme();
  const isDark = theme === 'dark';

  if (!isReady) {
    return (
      <span className="inline-flex h-9 w-12 animate-[gbi-pulse_1.4s_var(--ease)_infinite] rounded-full bg-n-200 dark:bg-[#22304a]" aria-hidden />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      className="relative inline-flex h-9 w-12 items-center rounded-full border border-line-strong bg-surface px-1.5 focus-visible:outline-none focus-visible:shadow-focus"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className={`absolute inset-y-1 flex w-6 items-center justify-center rounded-full bg-navy-600 text-white transition-transform duration-[160ms] ease-gbi ${
          isDark ? 'translate-x-4' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon aria-hidden weight="fill" className="h-4 w-4" /> : <Sun aria-hidden weight="fill" className="h-4 w-4" />}
      </span>
    </button>
  );
}
