'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function PrimaryNavLinks() {
  const pathname = usePathname();
  const { profile } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  const dashboardActive = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const uploadActive = pathname === '/upload';

  return (
    <>
      <Link
        href="/dashboard"
        aria-current={dashboardActive ? 'page' : undefined}
        className={`px-3 py-1.5 transition ${dashboardActive ? 'text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
      >
        Dashboard
      </Link>
      {isAdmin ? (
        <Link
          href="/upload"
          aria-current={uploadActive ? 'page' : undefined}
          className={`px-3 py-1.5 transition ${
            uploadActive ? 'text-indigo-700 font-semibold' : 'text-indigo-600 hover:text-indigo-700'
          }`}
        >
          Upload PDF
        </Link>
      ) : null}
    </>
  );
}
