'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { UserRole } from '@/lib/supabase';

const STORAGE_KEY = 'gbi.activeProfile';

export type ActiveProfile = {
  id: string;
  fullName: string;
  role: UserRole;
};

type StoredProfile = ActiveProfile & {
  storedAt: string;
};

let cachedProfile: ActiveProfile | null = null;
let isLoadedSnapshot = false;
const listeners = new Set<() => void>();
let storageEventBound = false;

function areProfilesEqual(a: ActiveProfile | null, b: ActiveProfile | null): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.id === b.id && a.fullName === b.fullName && a.role === b.role;
}

function parseProfile(raw: string | null): ActiveProfile | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredProfile;
    if (!parsed?.id || !parsed?.fullName || !parsed?.role) {
      return null;
    }
    return {
      id: parsed.id,
      fullName: parsed.fullName,
      role: parsed.role,
    } satisfies ActiveProfile;
  } catch {
    return null;
  }
}

function loadProfileFromStorage(): ActiveProfile | null {
  if (typeof window === 'undefined') {
    return cachedProfile;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return parseProfile(raw);
}

function syncCacheFromStorage(): ActiveProfile | null {
  const next = loadProfileFromStorage();
  if (!areProfilesEqual(next, cachedProfile)) {
    cachedProfile = next ? { ...next } : null;
  }
  if (typeof window !== 'undefined') {
    isLoadedSnapshot = true;
  }
  return cachedProfile;
}

function readProfileSnapshot(): ActiveProfile | null {
  if (typeof window === 'undefined') {
    return cachedProfile;
  }
  return syncCacheFromStorage();
}

function getProfileServerSnapshot(): ActiveProfile | null {
  return cachedProfile;
}

function readLoadedSnapshot(): boolean {
  if (typeof window === 'undefined') {
    return isLoadedSnapshot;
  }
  syncCacheFromStorage();
  return isLoadedSnapshot;
}

function getLoadedServerSnapshot(): boolean {
  return isLoadedSnapshot;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key && event.key !== STORAGE_KEY) {
    return;
  }
  const previous = cachedProfile;
  const next = syncCacheFromStorage();
  if (!areProfilesEqual(previous, next)) {
    notifyListeners();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (typeof window !== 'undefined' && !storageEventBound) {
    window.addEventListener('storage', handleStorageEvent);
    storageEventBound = true;
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined' && storageEventBound && listeners.size === 0) {
      window.removeEventListener('storage', handleStorageEvent);
      storageEventBound = false;
    }
  };
}

export function useActiveProfileState() {
  const profile = useSyncExternalStore(subscribe, readProfileSnapshot, getProfileServerSnapshot);
  const isLoaded = useSyncExternalStore(subscribe, readLoadedSnapshot, getLoadedServerSnapshot);

  const setProfile = useCallback(async (next: ActiveProfile | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!next) {
      window.localStorage.removeItem(STORAGE_KEY);
      cachedProfile = null;
    } else {
      const payload: StoredProfile = {
        ...next,
        storedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      cachedProfile = { ...next };
    }

    isLoadedSnapshot = true;

    try {
      await fetch('/api/session/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: next ? next.id : null }),
      });
    } catch {
      // Ignore cookie persistence errors; local state is still updated
    }

    notifyListeners();
  }, []);

  const clearProfile = useCallback(async () => {
    await setProfile(null);
  }, [setProfile]);

  const value = useMemo(
    () => ({
      profile,
      isLoaded,
      setProfile,
      clearProfile,
    }),
    [profile, isLoaded, setProfile, clearProfile],
  );

  return value;
}
