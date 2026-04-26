'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';
import { PasswordPrompt } from '@/components/profile/password-prompt';
import type { UserRole } from '@/lib/supabase';

type ProfileOption = {
  id: string;
  fullName: string;
  role: UserRole;
  displayRole?: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  extractor: 'Data Extractor',
  observer: 'Observer',
};

const PROFILE_ACCENTS = [
  {
    bar: 'bg-[#b91c1c]',
    tint: 'bg-[#fef2f2]',
    text: 'text-[#b91c1c]',
    ring: 'group-hover:border-[#fecaca]',
  },
  {
    bar: 'bg-[#1479d6]',
    tint: 'bg-[#eef7ff]',
    text: 'text-[#1068b8]',
    ring: 'group-hover:border-[#93c5fd]',
  },
  {
    bar: 'bg-[#0f766e]',
    tint: 'bg-[#ecfdf7]',
    text: 'text-[#0f766e]',
    ring: 'group-hover:border-[#99f6e4]',
  },
  {
    bar: 'bg-[#7c2d12]',
    tint: 'bg-[#fff7ed]',
    text: 'text-[#9a3412]',
    ring: 'group-hover:border-[#fed7aa]',
  },
];

export function ProfileChooser({ profiles }: { profiles: ProfileOption[] }) {
  const router = useRouter();
  const { setProfile } = useActiveProfile();
  const [selectedProfile, setSelectedProfile] = useState<ProfileOption | null>(null);
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);

  const sortedProfiles = useMemo(
    () => profiles.toSorted((a, b) => a.fullName.localeCompare(b.fullName)),
    [profiles],
  );

  const handleSelect = (profile: ProfileOption) => {
    // Show password prompt instead of immediately setting profile
    setSelectedProfile(profile);
    setIsPasswordPromptOpen(true);
  };

  const handlePasswordSuccess = async () => {
    if (!selectedProfile) {
      return;
    }

    // Password verified, now set the profile
    await setProfile(selectedProfile);
    setIsPasswordPromptOpen(false);
    setSelectedProfile(null);
    router.replace('/dashboard');
  };

  const handlePasswordCancel = () => {
    setIsPasswordPromptOpen(false);
    setSelectedProfile(null);
  };

  return (
    <>
      <div className="space-y-3">
        {sortedProfiles.map((profile, index) => {
          const accent = PROFILE_ACCENTS[index % PROFILE_ACCENTS.length];

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelect(profile)}
              aria-label={`Continue as ${profile.fullName}`}
              className={`group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-[#ffffff] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1479d6]/30 sm:p-5 ${accent.ring}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${accent.bar}`} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold tracking-tight text-slate-950 transition group-hover:text-[#0b3a70] sm:text-xl">
                  {profile.fullName}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${accent.tint} ${accent.text}`}
                  >
                    {profile.displayRole ?? ROLE_LABELS[profile.role]}
                  </span>
                </span>
              </span>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 ${accent.tint} ${accent.text} shadow-sm transition group-hover:translate-x-1`}
                aria-hidden
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.75 8H12.25M8.75 4.5L12.25 8L8.75 11.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      {selectedProfile && (
        <PasswordPrompt
          profileName={selectedProfile.fullName}
          profileId={selectedProfile.id}
          isOpen={isPasswordPromptOpen}
          onClose={handlePasswordCancel}
          onSuccess={handlePasswordSuccess}
        />
      )}
    </>
  );
}
