import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: 'FIFA GBI Data Extraction Assistant',
  description:
    'Internal tooling for the FIFA Global Burden of Injury & Illness data extraction workflow.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
                <span className="rounded bg-slate-900 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  MVP
                </span>
                <span>FIFA GBI Data Extraction Assistant</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
                <Link href="/dashboard" className="transition hover:text-slate-900">
                  Dashboard
                </Link>
                <Link href="/upload" className="transition hover:text-slate-900">
                  Upload PDF
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
