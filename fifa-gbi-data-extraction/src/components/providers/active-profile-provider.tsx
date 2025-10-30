'use client';

import { createContext, useContext } from 'react';

import type { ActiveProfileValue } from '@/hooks/use-active-profile';
import { useActiveProfileState } from '@/hooks/use-active-profile';

const ActiveProfileContext = createContext<ActiveProfileValue | null>(null);

export function ActiveProfileProvider({ children }: { children: React.ReactNode }) {
  const value = useActiveProfileState();

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const value = useContext(ActiveProfileContext);
  if (!value) {
    throw new Error('useActiveProfile must be used within an ActiveProfileProvider');
  }
  return value;
}
