'use client';

import Link from 'next/link';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  const linkClasses = "px-3 py-1.5 transition hover:text-slate-900";

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
      {isAdmin ? (
        <>
          <Link href="/dashboard/ai-review-metrics" className={linkClasses} onClick={onNavigate}>
            AI Metrics
          </Link>
          <Link
            href="/upload"
            className="px-3 py-1.5 text-indigo-600 transition hover:text-indigo-700"
            onClick={onNavigate}
          >
            Upload PDF
          </Link>
        </>
      ) : null}
    </>
  );
}
