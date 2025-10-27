import type { Metadata } from 'next';
import Image from 'next/image';
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
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-100 text-slate-900 antialiased">
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
              <div className="relative flex flex-1 items-center justify-center">
                <Link
                  href="/dashboard"
                  className="text-2xl font-semibold text-slate-900 transition hover:text-indigo-700"
                >
                  FIFA GBI Data Extraction Assistant
                </Link>
                <nav className="absolute right-0 flex items-center gap-3 text-sm font-medium text-slate-600">
                  <Link
                    href="/dashboard"
                    className="px-3 py-1.5 transition hover:text-slate-900"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/upload"
                    className="px-3 py-1.5 text-indigo-600 transition hover:text-indigo-700"
                  >
                    Upload PDF
                  </Link>
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
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
