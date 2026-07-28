import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import { ActiveProfileGate } from '@/components/active-profile-gate';
import { AppHeader } from '@/components/header/app-header';
import { Providers } from '@/components/providers';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

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
        const root = document.documentElement;
        // The theme toggle is hidden while the design-system migration is
        // verified in light mode, so a previously stored 'dark' preference must
        // not strand anyone in an unverified theme. Restore the stored-preference
        // read here when the toggle comes back.
        const theme = 'light';
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
      } catch (error) {
        console.warn('Theme init failed', error);
      }
    })();
  `;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="min-h-screen bg-page font-ui text-ink-body antialiased [font-variant-numeric:tabular-nums]">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
              <ActiveProfileGate>
                {children}
              </ActiveProfileGate>
            </main>
            <footer className="border-t border-line bg-surface py-8 text-[13px] text-ink-muted">
              <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-6 px-4 text-center sm:px-6">
                <div className="space-y-2">
                  <h2 className="text-[15px] font-semibold text-ink">Disclaimer</h2>
                  <p>
                    This is an internal research tool developed by AbdelRahman Babiker, PhD student, for academic,
                    non-commercial use only. Its purpose is to aid in the FIFA GBI project. This tool is not for
                    public distribution or commercial use.
                  </p>
                </div>
                <div className="space-y-2">
                  <h2 className="text-[15px] font-semibold text-ink">Attribution</h2>
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
