import Link from 'next/link';

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
    <section className="relative isolate overflow-hidden rounded-[2.25rem] border border-indigo-100/80 bg-white/90 shadow-2xl ring-1 ring-slate-200/60">
      <div className="relative z-10 grid gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:px-14">
        <div className="flex min-h-[20rem] flex-col justify-between gap-8 lg:min-h-[26rem]">
          <div className="flex flex-1 flex-col justify-start gap-4 pt-2 sm:pt-4">
            <span className="inline-flex w-fit items-center rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Welcome back
            </span>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
              The FIFA Global Burden of Injury and Illness in Football Project
            </h1>
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-slate-400">
              FIFA GBI data extraction workspace
            </p>
          </div>
        </div>

        <div className="space-y-6 lg:-ml-6 lg:pl-2">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-5 shadow-xl ring-1 ring-slate-200/70 backdrop-blur sm:p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Choose your account</h2>
              <p className="text-sm text-slate-600">Pick your profile to enter the workspace.</p>
            </div>
            <div className="mt-6 space-y-4">
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
        </div>
      </div>
    </section>
  );
}
