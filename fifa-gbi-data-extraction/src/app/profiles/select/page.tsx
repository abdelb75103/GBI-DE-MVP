import Link from 'next/link';

import { ProfileChooser } from '@/components/profile/profile-chooser';
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

  const projectLeadProfiles: { id: string; fullName: string; role: UserRole; displayRole: string }[] = [
    {
      id: 'project-lead-ben-clarsen',
      fullName: 'Dr. Ben Clarsen',
      role: 'admin',
      displayRole: 'Project Lead',
    },
    {
      id: 'project-lead-nicol-van-dyk',
      fullName: 'Dr. Nicol van Dyk',
      role: 'admin',
      displayRole: 'Project Lead',
    },
    {
      id: 'project-lead-eamonn-delahunt',
      fullName: 'Professor Eamonn Delahunt',
      role: 'admin',
      displayRole: 'Project Lead',
    },
  ];

  const existingIds = new Set(profiles.map((profile) => profile.id));
  projectLeadProfiles.forEach((lead) => {
    if (!existingIds.has(lead.id)) {
      profiles.push(lead);
    }
  });

  return (
    <section className="relative isolate overflow-hidden rounded-[2.75rem] border border-indigo-100/80 bg-white/90 shadow-2xl ring-1 ring-slate-200/60">
      <div className="relative z-10 grid gap-10 px-8 py-12 sm:px-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:px-16">
        <div className="flex min-h-[28rem] flex-col justify-between">
          <div className="flex flex-1 flex-col justify-start gap-6 pt-6">
            <span className="inline-flex w-fit items-center rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Welcome back
            </span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              The FIFA Global Burden of Injury and Illness in Football Project
            </h1>
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-slate-400">
              FIFA GBI data extraction workspace
            </p>
          </div>
        </div>

        <div className="space-y-6 lg:-ml-8 lg:pl-2">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/70 backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Choose your account</h2>
            </div>
            <div className="mt-6 space-y-4">
              {loadError ? (
                <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-5 text-sm text-rose-700">
                  {loadError}
                </div>
              ) : profiles.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 text-sm text-amber-700">
                  No profiles found. Create users in Supabase before proceeding.{' '}
                  <Link href="https://app.supabase.com/" className="font-semibold underline" target="_blank">
                    Open Supabase
                  </Link>
                </div>
              ) : (
                <ProfileChooser profiles={profiles} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
