'use client';

import { ActiveProfileProvider } from '@/components/providers/active-profile-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ActiveProfileProvider>
      {children}
    </ActiveProfileProvider>
  );
}
