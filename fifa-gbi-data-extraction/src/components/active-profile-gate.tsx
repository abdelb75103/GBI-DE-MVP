'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

const PUBLIC_PATHS = new Set(['/profiles/select']);

export function ActiveProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, isLoaded } = useActiveProfile();

  const isPublicRoute = useMemo(() => PUBLIC_PATHS.has(pathname ?? ''), [pathname]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!profile && !isPublicRoute) {
      router.replace('/profiles/select');
    }
  }, [profile, isLoaded, isPublicRoute, router]);

  if (!isLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Loading workspace profile…
      </div>
    );
  }

  if (!profile && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
