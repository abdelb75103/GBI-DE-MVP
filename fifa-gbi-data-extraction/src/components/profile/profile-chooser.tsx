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

const GRADIENTS = [
  'from-indigo-500/25 via-sky-400/20 to-indigo-400/20',
  'from-emerald-500/25 via-teal-400/20 to-lime-400/20',
  'from-rose-500/25 via-orange-400/20 to-amber-400/20',
  'from-sky-500/25 via-cyan-400/20 to-violet-400/20',
  'from-fuchsia-500/25 via-purple-400/20 to-pink-400/20',
  'from-amber-500/25 via-orange-400/20 to-rose-400/20',
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  extractor: 'Data Extractor',
  observer: 'Observer',
};

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
    router.refresh();
  };

  const handlePasswordCancel = () => {
    setIsPasswordPromptOpen(false);
    setSelectedProfile(null);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sortedProfiles.map((profile, index) => {
          const gradient = GRADIENTS[index % GRADIENTS.length];

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelect(profile)}
              aria-label={`Continue as ${profile.fullName}`}
              className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-left shadow-sm ring-1 ring-slate-200/60 backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <div
                className={`absolute inset-0 -z-10 bg-gradient-to-br ${gradient} opacity-80 transition-opacity group-hover:opacity-100`}
                aria-hidden
              />
              <div className="relative z-10 flex h-full flex-col gap-4">
                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm transition group-hover:border-indigo-200 group-hover:text-indigo-700">
                  {profile.displayRole ?? ROLE_LABELS[profile.role]}
                </span>
                <span className="text-xl font-semibold text-slate-900 transition group-hover:text-indigo-700">
                  {profile.fullName}
                </span>
                <span className="flex items-center gap-2 text-sm font-medium text-indigo-600 transition group-hover:translate-x-1">
                  Continue to workspace
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M4.75 12L11 5.75M11 5.75H5.5M11 5.75V11.25"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
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
