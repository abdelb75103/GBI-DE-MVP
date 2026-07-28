'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'gbi-theme-preference';
const TRANSITION_CLASS = 'theme-transition';

/**
 * Dark mode is built but not exposed while the design-system migration is
 * verified in light only. This is the single switch: flipping it back to `true`
 * restores reading the stored preference here, and `ThemeToggleButton` can be
 * rendered again in `app-header.tsx` and `mobile-nav.tsx`.
 *
 * While it is `false` the stored preference is neither read nor written, so a
 * user who chose dark before it was hidden is not stranded in an unverified
 * theme with no way back, and their preference survives for when it returns.
 */
export const THEME_SWITCHING_ENABLED = false;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function scheduleTransition() {
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  window.setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
  }, 450);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  // With switching disabled there is no stored preference to wait for, so the
  // provider is ready immediately and no state has to be set from an effect.
  const [isReady, setIsReady] = useState(!THEME_SWITCHING_ENABLED);

  useEffect(() => {
    if (!THEME_SWITCHING_ENABLED) {
      applyTheme('light');
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      const next = stored === 'light' || stored === 'dark' ? stored : 'light';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialising theme from persisted preference
      setThemeState(next);
      applyTheme(next);
    } catch {
      applyTheme('light');
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !THEME_SWITCHING_ENABLED) {
      return;
    }
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors (e.g., privacy mode)
    }
  }, [theme, isReady]);

  const setTheme = useCallback((next: Theme) => {
    scheduleTransition();
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    scheduleTransition();
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isReady,
    }),
    [theme, setTheme, toggleTheme, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
