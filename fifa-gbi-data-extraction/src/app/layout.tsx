import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import './globals.css';
import { ActiveProfileGate } from '@/components/active-profile-gate';
import { ActiveProfileIndicator } from '@/components/header/active-profile-indicator';
import { MobileNav } from '@/components/header/mobile-nav';
import { PrimaryNavLinks } from '@/components/header/nav-links';
import { ThemeToggleButton } from '@/components/header/theme-toggle-button';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'FIFA GBI Data Extraction Assistant',
  description:
    'Internal tooling for the FIFA Global Burden of Injury & Illness data extraction workflow.',
  icons: {
    icon: '/images/gbi-logo.png',
    shortcut: '/images/gbi-logo.png',
    apple: '/images/gbi-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitializer = `
    (function () {
      try {
        const storageKey = 'gbi-theme-preference';
        const root = document.documentElement;
        const stored = window.localStorage.getItem(storageKey);
        const theme = stored === 'light' || stored === 'dark' ? stored : 'light';
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
      } catch (error) {
        console.warn('Theme init failed', error);
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="min-h-screen bg-[var(--page-bg)] text-[var(--page-text)] antialiased transition-colors duration-300">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur">
              <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <Link href="/dashboard" className="flex min-w-0 items-center gap-3 transition hover:opacity-85">
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
                      <span className="border-l border-slate-200 pl-3 text-lg font-bold leading-tight tracking-tight text-slate-950 sm:text-xl">
                        FIFA GBI
                      </span>
                    </Link>

                  <nav className="hidden min-w-0 items-center justify-center gap-8 text-[13px] font-semibold text-slate-600 lg:flex data-[theme=dark]:text-slate-300">
                    <PrimaryNavLinks />
                  </nav>

                  <div className="flex min-w-0 items-center justify-end gap-3">
                    <div className="hidden items-center gap-2 lg:flex">
                      <ThemeToggleButton />
                      <ActiveProfileIndicator />
                    </div>

                    <div className="hidden h-10 w-20 items-center justify-end sm:flex lg:w-24">
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
            <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
              <ActiveProfileGate>
                {children}
              </ActiveProfileGate>
            </main>
            <footer className="border-t border-white/70 bg-white/60 py-8 text-sm text-slate-600">
              <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-6 px-4 text-center sm:px-6">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-slate-800">Disclaimer</h2>
                  <p>
                    This is an internal research tool developed by AbdelRahman Babiker, PhD student, for academic,
                    non-commercial use only. Its purpose is to aid in the FIFA GBI project. This tool is not for
                    public distribution or commercial use.
                  </p>
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-slate-800">Attribution</h2>
                  <p>
                    The design and workflow was inspired by the AIDE (AI-Assisted Data Extraction) tool for
                    systematic review and meta-analysis, developed by Noah Schroeder, et al. Reference: Schroeder,
                    N., et al. (2024). AI-Assisted Data Extraction with Large Language Models for Systematic Review
                    and Meta-Analysis. arXiv preprint arXiv:2401.01840.
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
