'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function ActiveProfileIndicator() {
  const router = useRouter();
  const { profile, isLoaded, clearProfile } = useActiveProfile();

  if (!isLoaded) {
    return <span className="text-xs text-ink-soft">Loading…</span>;
  }

  if (!profile) {
    return (
      <Link
        href="/profiles/select"
        className="inline-flex min-h-9 items-center rounded-ctl border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink hover:border-navy-300 focus-visible:outline-none focus-visible:shadow-focus"
      >
        Choose profile
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        router.replace('/profiles/select');
        void clearProfile().catch((error) => {
          console.error('[ActiveProfileIndicator] Failed to clear profile session:', error);
        });
      }}
      className="inline-flex min-h-9 items-center rounded-ctl border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink hover:border-navy-300 focus-visible:outline-none focus-visible:shadow-focus"
    >
      Switch Profile
    </button>
  );
}
