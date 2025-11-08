'use client';

import { useCallback, useEffect, useState } from 'react';

type GeminiKeyState = {
  isLoaded: boolean;
  isConfigured: boolean;
};

export function useGeminiApiKey() {
  const [state, setState] = useState<GeminiKeyState>({ isLoaded: false, isConfigured: false });
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/gemini', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load API settings');
      }
      const payload = (await response.json()) as { configured: boolean };
      setState({ isLoaded: true, isConfigured: Boolean(payload?.configured) });
      setLastError(null);
    } catch (error) {
      console.error('[useGeminiApiKey] Failed to load settings', error);
      setState((prev) => ({ ...prev, isLoaded: true }));
      setLastError(error instanceof Error ? error.message : 'Unable to load API settings');
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      // Error already logged inside refresh; swallow here to avoid unhandled rejections.
    });
  }, [refresh]);

  const saveKey = useCallback(
    async (apiKey: string) => {
      const value = apiKey.trim();
      if (!value) {
        throw new Error('API key is required');
      }
      const response = await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to save API key');
      }
      setState({ isLoaded: true, isConfigured: true });
      setLastError(null);
    },
    [],
  );

  const clearKey = useCallback(async () => {
    const response = await fetch('/api/settings/gemini', { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? 'Failed to clear API key');
    }
    setState({ isLoaded: true, isConfigured: false });
    setLastError(null);
  }, []);

  return {
    isLoaded: state.isLoaded,
    isConfigured: state.isConfigured,
    lastError,
    refresh,
    saveKey,
    clearKey,
  };
}
