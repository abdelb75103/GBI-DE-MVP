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
  let profiles: { id: string; fullName: string; role: UserRole }[] = [];
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
        }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load profiles.';
    loadError = message;
  }

  return (
    <section className="relative isolate overflow-hidden rounded-[2.75rem] border border-indigo-100/80 bg-white/90 shadow-2xl ring-1 ring-slate-200/60">
      <div
        className="pointer-events-none absolute -top-1/2 right-0 h-[140%] w-[55%] translate-x-1/3 rounded-full bg-gradient-to-br from-indigo-200/70 via-sky-100/60 to-transparent blur-3xl"
        aria-hidden
      />
      <div className="relative z-10 grid gap-12 px-8 py-12 sm:px-12 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:px-16">
        <div className="flex flex-col justify-between gap-12">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Welcome back
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Sign in with your workspace profile
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                Choose the profile assigned to you to unlock dashboards, tools, and permissions tailored to your role in the FIFA GBI extraction workflow. Switching between users is always available from the top navigation bar.
              </p>
            </div>
          </div>
          <dl className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-inner">
              <dt className="font-semibold text-slate-900">Stay focused</dt>
              <dd className="mt-1 leading-relaxed">
                Each profile surfaces only the projects, notes, and exports that belong to you.
              </dd>
            </div>
            <div className="rounded-2xl border border-indigo-100/80 bg-indigo-50/70 p-5 shadow-inner">
              <dt className="font-semibold text-slate-900">Secure access</dt>
              <dd className="mt-1 leading-relaxed">
                Role-based permissions keep sensitive information visible only to the right teammates.
              </dd>
            </div>
          </dl>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-slate-400">
            FIFA GBI data extraction workspace
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/70 backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Choose your account</h2>
              <p className="text-sm text-slate-600">
                Select a profile to continue. You&rsquo;ll land on the workspace home for that role.
              </p>
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
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-500">
            Having trouble finding your name? Contact the operations team to request access or to update your permissions.
          </div>
        </div>
      </div>
    </section>
  );
}
