'use client';

import { ActiveProfileProvider } from '@/components/providers/active-profile-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ActiveProfileProvider>
        {children}
      </ActiveProfileProvider>
    </ThemeProvider>
  );
}
