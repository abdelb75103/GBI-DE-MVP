'use client';

import Link from 'next/link';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function PrimaryNavLinks() {
  const { profile } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <Link
        href="/dashboard"
        className="px-3 py-1.5 transition hover:text-slate-900"
      >
        Dashboard
      </Link>
      <Link
        href="/overview"
        className="px-3 py-1.5 transition hover:text-slate-900"
      >
        Project Overview
      </Link>
      <Link
        href="/extraction-instructions"
        className="px-3 py-1.5 transition hover:text-slate-900"
      >
        Extraction Instructions
      </Link>
      {isAdmin ? (
        <Link
          href="/upload"
          className="px-3 py-1.5 text-indigo-600 transition hover:text-indigo-700"
        >
          Upload PDF
        </Link>
      ) : null}
    </>
  );
}
