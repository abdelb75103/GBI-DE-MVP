'use client';

import { useState } from 'react';

const STORAGE_KEY = 'gbi.geminiApiKey';

const isBrowser = typeof window !== 'undefined';

function readKey() {
  if (!isBrowser) {
    return null;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && stored.length > 0 ? stored : null;
}

export function useGeminiApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(readKey);

  const setApiKey = (value: string) => {
    if (!isBrowser) {
      return;
    }
    const trimmed = value.trim();
    window.localStorage.setItem(STORAGE_KEY, trimmed);
    setApiKeyState(trimmed);
  };

  const clearApiKey = () => {
    if (!isBrowser) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
  };

  return {
    apiKey,
    isLoaded: isBrowser,
    setApiKey,
    clearApiKey,
  };
}
