import Link from 'next/link';

import { ProfileChooser } from '@/components/profile/profile-chooser';
import { getAdminServiceClient } from '@/lib/supabase';

export const metadata = {
  title: 'Select your profile · FIFA GBI Data Extraction',
};

export const dynamic = 'force-dynamic';

export default async function ProfileSelectPage() {
  const supabase = getAdminServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error) {
    throw error;
  }

  const profiles = data?.map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
  })) ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <span className="inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
          Welcome back
        </span>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Choose your workspace profile
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Select your name to load your personalised dashboard and permissions. You can switch users at any time from the top navigation bar.
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-3xl border border-amber-200/80 bg-amber-50/80 p-6 text-sm text-amber-700">
          No profiles found. Create users in Supabase before proceeding.{' '}
          <Link href="https://app.supabase.com/" className="font-semibold underline" target="_blank">
            Open Supabase
          </Link>
        </div>
      ) : (
        <ProfileChooser profiles={profiles} />
      )}
    </div>
  );
}
