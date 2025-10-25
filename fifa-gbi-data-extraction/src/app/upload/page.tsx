import Link from 'next/link';

import { UploadForm } from '@/components/upload-form';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Upload a PDF</h1>
          <p className="text-sm text-slate-600">The file will be staged and appear on the dashboard.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <UploadForm />
      </div>
    </div>
  );
}
