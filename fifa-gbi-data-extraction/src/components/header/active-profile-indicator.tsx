'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function ActiveProfileIndicator() {
  const router = useRouter();
  const { profile, isLoaded, clearProfile } = useActiveProfile();

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
      <button
        type="button"
        aria-label="Switch Profile"
        onClick={() => {
          router.replace('/profiles/select');
          void clearProfile().catch((error) => {
            console.error('[ActiveProfileIndicator] Failed to clear profile session:', error);
          });
        }}
        className="font-semibold text-indigo-600 transition hover:text-indigo-700"
      >
        Switch Profile
      </button>
    </div>
  );
}
