import Link from 'next/link';

import { ApiSettingsForm } from '@/components/api-settings-form';

export const metadata = {
  title: 'API Settings · FIFA GBI Data Extraction',
};

export default function ApiSettingsPage() {
  return (
    <div className="space-y-8 px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm font-semibold text-indigo-600 underline transition hover:text-indigo-700"
      >
        ← Back to dashboard
      </Link>
      <ApiSettingsForm />
    </div>
  );
}
