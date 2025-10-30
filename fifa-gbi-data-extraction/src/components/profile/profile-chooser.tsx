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

const GRADIENTS = [
  'from-indigo-600/25 via-sky-500/20 to-indigo-400/25',
  'from-emerald-500/25 via-teal-400/20 to-lime-400/20',
  'from-rose-500/25 via-orange-400/20 to-amber-400/20',
  'from-sky-500/25 via-cyan-400/20 to-violet-400/20',
  'from-fuchsia-500/25 via-purple-400/20 to-pink-400/20',
  'from-amber-500/25 via-orange-400/20 to-rose-400/20',
];

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
      {sortedProfiles.map((profile, index) => {
        const gradient = GRADIENTS[index % GRADIENTS.length];

        return (
          <button
            key={profile.id}
            type="button"
            onClick={() => handleSelect(profile)}
            className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-5 text-left shadow-md ring-1 ring-slate-200/60 backdrop-blur transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white"
          >
            <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${gradient} opacity-80 transition-opacity group-hover:opacity-100`} aria-hidden />
            <span className="relative z-10 text-lg font-semibold text-slate-900 transition group-hover:text-indigo-700">
              {profile.fullName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
