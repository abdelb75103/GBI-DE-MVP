'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  extractor: 'Extractor',
  observer: 'Observer',
};

export function ActiveProfileIndicator() {
  const router = useRouter();
  const { profile, isLoaded, clearProfile } = useActiveProfile();

  const label = useMemo(() => {
    if (!profile) {
      return null;
    }
    return ROLE_LABEL[profile.role] ?? profile.role;
  }, [profile]);

  if (!isLoaded) {
    return <span className="text-xs text-slate-400">Loading…</span>;
  }

  if (!profile) {
    return (
      <Link
        href="/profiles/select"
        className="rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:border-indigo-200 hover:text-indigo-700"
      >
        Choose profile
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/70 px-3 py-1 text-xs shadow-sm">
      <span className="font-semibold text-slate-700">{profile.fullName}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <button
        type="button"
        onClick={async () => {
          await clearProfile();
          router.push('/profiles/select');
          router.refresh();
        }}
        className="font-semibold text-indigo-600 transition hover:text-indigo-700"
      >
        Switch
      </button>
    </div>
  );
}
