'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useActiveProfile();
  const pathname = usePathname();
  const isAdmin = profile?.role === 'admin';

  const linkClasses =
    "whitespace-nowrap border-b-2 border-transparent py-1.5 font-semibold text-slate-700 transition hover:border-[#0b3a70] hover:text-[#0b3a70]";
  const adminLinkClasses =
    "whitespace-nowrap border-b-2 border-transparent py-1.5 font-semibold text-[#0b3a70] transition hover:border-[#0b3a70] hover:text-[#082f5d]";

  const isExtractionArea =
    pathname?.startsWith('/data-extraction') ||
    pathname?.startsWith('/paper') ||
    pathname?.startsWith('/upload') ||
    pathname?.startsWith('/extraction-instructions') ||
    pathname?.startsWith('/dashboard/ai-review-metrics') ||
    pathname?.startsWith('/dashboard/dedupe') ||
    pathname?.startsWith('/dashboard/upload-approvals');

  const links = pathname === '/dashboard'
    ? [
        { href: '/title-abstract-screening', label: 'Title & Abstract' },
        { href: '/full-text-screening', label: 'Full Text' },
        { href: '/data-extraction', label: 'Extraction' },
        { href: '/overview', label: 'Preview' },
      ]
    : isExtractionArea
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/data-extraction', label: 'Extraction' },
          { href: '/extraction-instructions', label: 'Instructions' },
          { href: '/overview', label: 'Preview' },
        ]
      : [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/title-abstract-screening', label: 'Title & Abstract' },
          { href: '/full-text-screening', label: 'Full Text' },
          { href: '/data-extraction', label: 'Extraction' },
          { href: '/overview', label: 'Preview' },
        ];

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={linkClasses}
          onClick={onNavigate}
        >
          {link.label}
        </Link>
      ))}
      {isAdmin && isExtractionArea ? (
        <>
          <Link href="/dashboard/ai-review-metrics" className={linkClasses} onClick={onNavigate}>
            AI Metrics
          </Link>
          <Link
            href="/upload"
            className={adminLinkClasses}
            onClick={onNavigate}
          >
            Upload
          </Link>
        </>
      ) : null}
    </>
  );
}
