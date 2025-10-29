'use client';

import { useMemo, useState } from 'react';

import type { DefinitionCategory } from '@/lib/definitions';

type DefinitionsDrawerProps = {
  categories: DefinitionCategory[];
};

export function DefinitionsDrawer({ categories }: DefinitionsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return categories;
    }

    return categories
      .map((category) => {
        const matchedEntries = category.entries.filter(
          (entry) =>
            entry.label.toLowerCase().includes(query) || entry.summary.toLowerCase().includes(query),
        );
        if (
          category.title.toLowerCase().includes(query) ||
          category.description.toLowerCase().includes(query)
        ) {
          return category;
        }
        return matchedEntries.length
          ? {
              ...category,
              entries: matchedEntries,
            }
          : null;
      })
      .filter((cat): cat is DefinitionCategory => Boolean(cat));
  }, [categories, filter]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Definitions
      </button>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Reference</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">IOC / OSIICS Definitions</h2>
            <p className="mt-1 text-xs text-slate-500">
              Quick reference for injury &amp; illness terminology. Filter to find relevant terms while reviewing a paper.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            aria-label="Close definitions panel"
          >
            Close
          </button>
        </header>

        <div className="border-b border-slate-200 px-6 py-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Filter
            <input
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search terms…"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>

        <div className="h-full overflow-y-auto px-6 py-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No definitions match your search.</p>
          ) : (
            <div className="space-y-6">
              {filtered.map((category) => (
                <section key={category.id} className="space-y-3">
                  <header>
                    <h3 className="text-sm font-semibold text-slate-900">{category.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{category.description}</p>
                  </header>
                  <ul className="space-y-3">
                    {category.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-700 shadow-sm"
                      >
                        <p className="font-semibold text-slate-900">{entry.label}</p>
                        <p className="mt-1 text-xs text-slate-600">{entry.summary}</p>
                        {entry.source ? (
                          <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                            Source: {entry.source}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

