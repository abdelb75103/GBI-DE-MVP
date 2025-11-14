import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import './globals.css';
import { ActiveProfileGate } from '@/components/active-profile-gate';
import { ActiveProfileIndicator } from '@/components/header/active-profile-indicator';
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
            <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 shadow-sm backdrop-blur">
              <div className="mx-auto flex w-full max-w-[calc(100vw-3rem)] items-center gap-6 px-6 py-5">
                <div className="flex justify-start">
                  <span className="sr-only">University College Dublin</span>
                  <div className="flex h-14 w-14 items-center justify-center">
                    <Image
                      src="/images/University_College_Dublin_logo.svg.png"
                      alt="UCD logo"
                      width={56}
                      height={56}
                      className="h-full w-auto object-contain"
                      priority
                    />
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-between gap-4">
                  <Link
                    href="/dashboard"
                    className="text-2xl font-semibold text-slate-900 transition hover:text-indigo-700"
                  >
                    FIFA GBI Data Extraction Assistant
                  </Link>
                  <nav className="flex items-center gap-3 text-sm font-medium text-slate-600 data-[theme=dark]:text-slate-300">
                    <PrimaryNavLinks />
                    <ThemeToggleButton />
                    <ActiveProfileIndicator />
                  </nav>
                </div>
                <div className="flex justify-end">
                  <span className="sr-only">Fédération Internationale de Football Association</span>
                  <div className="flex h-14 w-24 items-center justify-center">
                    <Image
                      src="/images/FIFA_logo_without_slogan.svg.png"
                      alt="FIFA logo"
                      width={120}
                      height={44}
                      className="h-full w-auto object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>
            </header>
            <main className="mx-auto flex w-full max-w-[calc(100vw-3rem)] flex-1 flex-col px-6 py-10">
              <ActiveProfileGate>
                {children}
              </ActiveProfileGate>
            </main>
            <footer className="border-t border-white/70 bg-white/60 py-8 text-sm text-slate-600">
              <div className="mx-auto flex w-full max-w-[calc(100vw-3rem)] flex-col items-center gap-6 px-6 text-center">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-slate-800">Disclaimer</h2>
                  <p>
                    This is an internal research tool developed by Abdelrahman Bakier, PhD student, for academic,
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
