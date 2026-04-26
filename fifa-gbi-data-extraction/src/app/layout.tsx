import type { Metadata } from 'next';

import './globals.css';
import { ActiveProfileGate } from '@/components/active-profile-gate';
import { AppHeader } from '@/components/header/app-header';
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
            <AppHeader />
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
