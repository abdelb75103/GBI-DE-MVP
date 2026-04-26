import Link from 'next/link';
import Image from 'next/image';

import { ProfileChooser } from '@/components/profile/profile-chooser';
import { canAccessWorkspace, getDisplayRole } from '@/lib/profile-access';
import { getAdminServiceClient } from '@/lib/supabase';
import type { UserRole } from '@/lib/supabase';

export const metadata = {
  title: 'Select your profile · FIFA GBI Data Extraction',
};

export const dynamic = 'force-dynamic';

const isUserRole = (role: string | null): role is UserRole =>
  role === 'admin' || role === 'extractor' || role === 'observer';

export default async function ProfileSelectPage() {
  let profiles: { id: string; fullName: string; role: UserRole; displayRole?: string }[] = [];
  let loadError: string | null = null;

  try {
    const supabase = getAdminServiceClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true });

    if (error) {
      throw error;
    }

    profiles =
      (data ?? [])
        .filter((profile): profile is { id: string; full_name: string; role: UserRole } => isUserRole(profile.role))
        .map((profile) => ({
          id: profile.id,
          fullName: profile.full_name,
          role: profile.role,
        }))
        .filter((profile) => profile.role !== 'observer');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load profiles.';
    loadError = message;
  }

  const finalProfiles = profiles
    .filter((profile) => canAccessWorkspace(profile))
    .map((profile) => ({
      ...profile,
      displayRole: getDisplayRole(profile),
    }));

  return (
    <section className="relative grid min-h-[calc(100svh-12rem)] min-w-0 overflow-hidden rounded-[2.5rem] bg-[#ffffff] shadow-2xl ring-1 ring-slate-200/70 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1fr)]">
      <Image
        src="/images/profile-global-football-network.png"
        alt=""
        fill
        sizes="100vw"
        className="pointer-events-none absolute inset-0 z-0 object-cover object-center opacity-100"
        priority
      />
      <div className="relative z-10 flex min-w-0 flex-col justify-center gap-8 overflow-hidden px-7 py-8 text-left sm:px-10 sm:py-12 lg:min-h-[30rem] lg:px-14">
        <div className="max-w-xl space-y-5 lg:-translate-y-24">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1479d6]">Welcome back</p>
          <h1 className="max-w-full break-words text-2xl font-semibold leading-[1.06] tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            The FIFA Global Burden of Injury and Illness in Football Project
          </h1>
          <p className="max-w-full break-words text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:max-w-md sm:text-sm sm:tracking-[0.28em]">
            FIFA GBI workspace
          </p>
        </div>

      </div>

      <div className="relative z-10 flex min-h-[32rem] min-w-0 items-center justify-center overflow-hidden px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[34rem] lg:px-14">
        <div className="relative w-full max-w-xl rounded-3xl border border-white/70 bg-white/78 p-5 shadow-2xl shadow-[#0b3a70]/18 ring-1 ring-white/90 backdrop-blur-md sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Select profile</h2>
            </div>
            {!loadError && finalProfiles.length > 0 ? (
              <p className="rounded-full bg-[#edf5ff] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0b3a70]">
                {finalProfiles.length} {finalProfiles.length === 1 ? 'profile' : 'profiles'}
              </p>
            ) : null}
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-5 text-sm text-rose-700">
              {loadError}
            </div>
          ) : finalProfiles.length === 0 ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 text-sm text-amber-700">
              No profiles found. Create users in Supabase before proceeding.{' '}
              <Link href="https://app.supabase.com/" className="font-semibold underline" target="_blank">
                Open Supabase
              </Link>
            </div>
          ) : (
            <ProfileChooser profiles={finalProfiles} />
          )}
        </div>
      </div>
    </section>
  );
}
