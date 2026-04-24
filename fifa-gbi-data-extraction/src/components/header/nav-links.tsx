'use client';

import Link from 'next/link';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  const linkClasses =
    "rounded-full px-2.5 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";

  return (
    <>
      <Link
        href="/dashboard"
        className={linkClasses}
        onClick={onNavigate}
      >
        Dashboard
      </Link>
      <Link
        href="/overview"
        className={linkClasses}
        onClick={onNavigate}
      >
        Project Overview
      </Link>
      <Link
        href="/extraction-instructions"
        className={linkClasses}
        onClick={onNavigate}
      >
        Extraction Instructions
      </Link>
      <Link
        href="/full-text-screening"
        className={linkClasses}
        onClick={onNavigate}
      >
        Full Text
      </Link>
      {isAdmin ? (
        <>
          <Link href="/dashboard/ai-review-metrics" className={linkClasses} onClick={onNavigate}>
            AI Metrics
          </Link>
          <Link
            href="/upload"
            className="rounded-full px-2.5 py-1.5 font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
            onClick={onNavigate}
          >
            Upload PDF
          </Link>
        </>
      ) : null}
    </>
  );
}
