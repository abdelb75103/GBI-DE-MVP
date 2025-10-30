'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';
import type { UserRole } from '@/lib/supabase';

type ProfileOption = {
  id: string;
  fullName: string;
  role: UserRole;
};

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  admin: 'Uploads PDFs, oversees assignments, runs bulk exports.',
  extractor: 'Claims papers, extracts data, exports individual papers.',
  observer: 'Monitors progress and can trigger exports.',
};

export function ProfileChooser({ profiles }: { profiles: ProfileOption[] }) {
  const router = useRouter();
  const { setProfile } = useActiveProfile();

  const sortedProfiles = useMemo(
    () => profiles.toSorted((a, b) => a.fullName.localeCompare(b.fullName)),
    [profiles],
  );

  const handleSelect = (profile: ProfileOption) => {
    setProfile(profile);
    router.replace('/dashboard');
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sortedProfiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          onClick={() => handleSelect(profile)}
          className="group flex flex-col rounded-3xl border border-slate-200/70 bg-white/80 p-5 text-left shadow-md transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
        >
          <span className="text-lg font-semibold text-slate-900 group-hover:text-indigo-700">
            {profile.fullName}
          </span>
          <span className="mt-2 inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {profile.role}
          </span>
          <span className="mt-3 text-sm text-slate-600">
            {ROLE_DESCRIPTION[profile.role]}
          </span>
        </button>
      ))}
    </div>
  );
}
