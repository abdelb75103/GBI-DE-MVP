'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useGeminiApiKey } from '@/hooks/use-gemini-api-key';

export function ApiSettingsForm() {
  const { apiKey, setApiKey, clearApiKey, isLoaded } = useGeminiApiKey();
  const [draft, setDraft] = useState(apiKey ?? '');
  const [saved, setSaved] = useState<string | null>(null);

  if (!isLoaded) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm ring-1 ring-slate-200/60">
        <p className="text-sm text-slate-500">Loading API settings…</p>
      </div>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = (draft || '').trim();
    if (!value) {
      setSaved('Enter a valid API key before saving.');
      return;
    }
    setApiKey(value);
    setDraft(value);
    setSaved('API key saved. You can now run AI extraction.');
  };

  const handleClear = () => {
    clearApiKey();
    setDraft('');
    setSaved('API key removed. Enter a new key to re-enable extraction.');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-8 shadow-xl ring-1 ring-slate-200/60">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Google Gemini API</h1>
            <p className="mt-1 text-sm text-slate-600">
              Enter your Google Gemini API key to enable AI-powered data extraction. You can generate a key in
              {' '}
              <Link href="https://aistudio.google.com/app/apikey" className="text-indigo-600 underline" target="_blank">
                Google AI Studio
              </Link>
              .
            </p>
          </div>
          {apiKey ? <span className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Active</span> : null}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="gemini-api-key" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              API key
            </label>
            <input
              id="gemini-api-key"
              type="password"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste your API key"
              className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
            >
              Save and continue
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              Clear key
            </button>
            {saved ? <span className="text-xs text-slate-500">{saved}</span> : null}
          </div>
        </form>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-900">Google Gemini API notes</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>
            The free tier of the Google Gemini API has rate limits. You can review current limits in the{' '}
            <Link href="https://ai.google.dev/pricing" target="_blank" className="text-indigo-600 underline">
              pricing guide
            </Link>
            .
          </li>
          <li>
            This app sends the PDF text to a Gemini Flash model for fast extraction. If Flash is unavailable, you may try other
            Flash variants, but latency will vary.
          </li>
          <li>
            Verify that the key is entered exactly without leading or trailing spaces. Most extraction failures are caused by typos
            or expired keys.
          </li>
        </ol>
      </div>
    </div>
  );
}
