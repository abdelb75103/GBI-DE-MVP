'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useActiveProfile } from '@/components/providers/active-profile-provider';

export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useActiveProfile();
  const pathname = usePathname();
  const isAdmin = profile?.role === 'admin';

  const isExtractionArea =
    pathname?.startsWith('/data-extraction') ||
    pathname?.startsWith('/paper') ||
    pathname?.startsWith('/upload') ||
    pathname?.startsWith('/extraction-instructions') ||
    pathname?.startsWith('/dashboard/ai-review-metrics') ||
    pathname?.startsWith('/dashboard/dedupe') ||
    pathname?.startsWith('/dashboard/upload-approvals');

  const isLinkActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/data-extraction') {
      return pathname.startsWith('/data-extraction') || pathname.startsWith('/paper');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const baseLinks =
    pathname === '/dashboard'
      ? [
          { href: '/title-abstract-screening', label: 'Title & Abstract' },
          { href: '/full-text-screening', label: 'Full Text' },
          { href: '/data-extraction', label: 'Extraction' },
          { href: '/overview', label: 'Project Overview' },
        ]
      : isExtractionArea
        ? [
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/data-extraction', label: 'Extraction' },
            { href: '/extraction-instructions', label: 'Instructions' },
            { href: '/overview', label: 'Project Overview' },
          ]
        : [
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/title-abstract-screening', label: 'Title & Abstract' },
            { href: '/full-text-screening', label: 'Full Text' },
            { href: '/data-extraction', label: 'Extraction' },
            { href: '/overview', label: 'Project Overview' },
          ];

  const links = [...baseLinks];
  if (isAdmin && isExtractionArea) {
    links.push({ href: '/dashboard/ai-review-metrics', label: 'AI Metrics' });
    links.push({ href: '/upload', label: 'Upload' });
  }

  const baseClass =
    "group relative inline-flex whitespace-nowrap items-center px-1 py-1.5 text-[13px] font-semibold tracking-tight transition-colors duration-200 ease-out";
  const idleColor = "text-slate-600 hover:text-[#0b3a70]";
  const activeColor = "text-[#0b3a70]";

  return (
    <>
      {links.map((link) => {
        const active = isLinkActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`${baseClass} ${active ? activeColor : idleColor}`}
            onClick={onNavigate}
          >
            <span className="relative">
              {link.label}
              <span
                aria-hidden
                className={`pointer-events-none absolute -bottom-1 left-0 right-0 h-[2px] origin-center rounded-full bg-[#0b3a70] transition-transform duration-300 ease-out ${
                  active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </span>
          </Link>
        );
      })}
    </>
  );
}
