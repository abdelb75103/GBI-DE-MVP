'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ActiveProfileIndicator } from '@/components/header/active-profile-indicator';
import { MobileNav } from '@/components/header/mobile-nav';
import { PrimaryNavLinks } from '@/components/header/nav-links';
import { ThemeToggleButton } from '@/components/header/theme-toggle-button';

const HEADERLESS_PATHS = new Set(['/profiles/select']);

export function AppHeader() {
  const pathname = usePathname();

  if (HEADERLESS_PATHS.has(pathname ?? '')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/65">
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[#0b3a70]/30 to-transparent" aria-hidden />
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 transition-opacity duration-200 ease-out hover:opacity-80">
            <span className="sr-only">University College Dublin</span>
            <span className="flex h-11 w-11 items-center justify-center sm:h-12 sm:w-12">
              <Image
                src="/images/University_College_Dublin_logo.svg.png"
                alt="UCD logo"
                width={52}
                height={52}
                className="h-full w-auto object-contain"
                priority
              />
            </span>
            <span className="border-l border-slate-200/80 pl-3 text-lg font-bold leading-tight tracking-tight text-slate-950 sm:text-xl">
              FIFA GBI
            </span>
          </Link>

          <nav className="hidden min-w-0 items-center justify-center gap-7 lg:flex">
            <PrimaryNavLinks />
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-3">
            <div className="hidden items-center gap-2 lg:flex">
              <ThemeToggleButton />
              <ActiveProfileIndicator />
            </div>

            <div className="hidden h-10 w-24 shrink-0 items-center justify-end lg:flex">
              <span className="sr-only">Fédération Internationale de Football Association</span>
              <Image
                src="/images/FIFA_logo_without_slogan.svg.png"
                alt="FIFA logo"
                width={120}
                height={44}
                className="h-full w-auto object-contain"
                priority
              />
            </div>

            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
