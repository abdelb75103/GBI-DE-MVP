'use client';

import Link from 'next/link';

import { UploadForm } from '@/components/upload-form';
import { useActiveProfile } from '@/components/providers/active-profile-provider';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  const { profile, isLoaded } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Checking permissions…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-amber-200/70 bg-amber-50/80 p-8 text-sm text-amber-700 shadow-xl ring-1 ring-amber-200/60">
        <h1 className="text-2xl font-semibold text-amber-800">Admin access required</h1>
        <p>
          Only administrators can upload new PDFs. If you believe this is a mistake, please contact AbdelRahman.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-white/80 px-5 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:border-amber-300 hover:text-amber-900"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -top-12 right-0 h-40 w-40 rounded-full bg-sky-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Upload
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900">Stage a new study PDF</h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Drop in the source document—title, DOI, and other metadata will be auto-extracted once processing kicks
                off.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            Back to dashboard
          </Link>
        </div>
      </section>

      <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <UploadForm />
      </div>
    </div>
  );
}
