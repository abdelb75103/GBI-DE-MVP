'use client';

import { DotsThree } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useActiveProfile } from '@/components/providers/active-profile-provider';
import { cn } from '@/components/ui/cn';

/**
 * One nav link set on every page. The app previously swapped between three
 * different sets depending on the route, so the same product appeared to have
 * three different information architectures.
 *
 * The five pipeline destinations stay in the bar. Everything else lives in the
 * overflow menu, which keeps the bar the same width whatever the role.
 */

type NavLink = { href: string; label: string };

const PRIMARY_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/title-abstract-screening', label: 'Title & Abstract' },
  { href: '/full-text-screening', label: 'Full Text' },
  { href: '/data-extraction', label: 'Extraction' },
  { href: '/overview', label: 'Project Overview' },
];

const SECONDARY_LINKS: NavLink[] = [{ href: '/extraction-instructions', label: 'Instructions' }];

const ADMIN_LINKS: NavLink[] = [
  { href: '/dashboard/ai-review-metrics', label: 'AI Metrics' },
  { href: '/upload', label: 'Upload' },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/data-extraction') {
    return pathname.startsWith('/data-extraction') || pathname.startsWith('/paper');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINK_BASE =
  'inline-flex h-[34px] items-center whitespace-nowrap rounded-ctl px-[11px] text-[13px] font-medium ' +
  'transition-[background-color,color] duration-[160ms] ease-gbi focus-visible:outline-none focus-visible:shadow-focus';
const LINK_IDLE = 'text-ink-muted hover:bg-surface-sunk hover:text-ink';
const LINK_ACTIVE = 'bg-navy-50 font-semibold text-navy-600 dark:bg-[#14263f] dark:text-[#8ab6e8]';

export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useActiveProfile();
  const pathname = usePathname();
  const overflow = [...SECONDARY_LINKS, ...(profile?.role === 'admin' ? ADMIN_LINKS : [])];

  return (
    <>
      {PRIMARY_LINKS.map((link) => (
        <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} onNavigate={onNavigate} />
      ))}
      <OverflowMenu links={overflow} pathname={pathname} onNavigate={onNavigate} />
    </>
  );
}

/** The mobile drawer has room for everything, so it renders one flat list. */
export function AllNavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useActiveProfile();
  const pathname = usePathname();
  const links = [...PRIMARY_LINKS, ...SECONDARY_LINKS, ...(profile?.role === 'admin' ? ADMIN_LINKS : [])];

  return (
    <>
      {links.map((link) => (
        <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} onNavigate={onNavigate} />
      ))}
    </>
  );
}

function NavItem({ link, active, onNavigate }: { link: NavLink; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={cn(LINK_BASE, active ? LINK_ACTIVE : LINK_IDLE)}
      onClick={onNavigate}
    >
      {link.label}
    </Link>
  );
}

function OverflowMenu({
  links,
  pathname,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (links.length === 0) return null;

  const containsActive = links.some((link) => isActive(pathname, link.href));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More sections"
        onClick={() => setOpen((value) => !value)}
        className={cn(LINK_BASE, 'gap-1.5', containsActive || open ? LINK_ACTIVE : LINK_IDLE)}
      >
        More
        <DotsThree aria-hidden weight="bold" className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          // Scales in from the trigger, not from its own centre.
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[190px] origin-top-right animate-[gbi-pop_120ms_var(--ease)] rounded-card bg-surface p-1 shadow-e2"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              role="menuitem"
              href={link.href}
              aria-current={isActive(pathname, link.href) ? 'page' : undefined}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className={cn(
                'flex min-h-9 items-center rounded-ctl px-2.5 text-[13px] font-medium',
                'focus-visible:outline-none focus-visible:shadow-focus',
                isActive(pathname, link.href) ? LINK_ACTIVE : LINK_IDLE,
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
