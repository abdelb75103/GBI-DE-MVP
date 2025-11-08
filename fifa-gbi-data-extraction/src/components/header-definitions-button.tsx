'use client';

import { DefinitionsDrawer } from '@/components/definitions-drawer';
import { definitionCategories } from '@/lib/definitions';

export function HeaderDefinitionsButton() {
  return (
    <DefinitionsDrawer
      categories={definitionCategories}
      triggerClassName="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-md transition hover:from-indigo-500 hover:via-sky-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60 focus:ring-offset-1 cursor-pointer"
    />
  );
}
