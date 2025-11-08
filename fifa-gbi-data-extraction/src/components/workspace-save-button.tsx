'use client';

import { useWorkspaceSave } from '@/components/workspace-save-manager';

export function WorkspaceSaveButton() {
  const { hasUnsavedChanges, isPending, handleSave } = useWorkspaceSave();

  if (!hasUnsavedChanges) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleSave(false)}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-5 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100/80 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Saving...
          </>
        ) : (
          'Save & Continue'
        )}
      </button>
      <button
        type="button"
        onClick={() => handleSave(true)}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-500 hover:via-green-500 hover:to-teal-500 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Saving...
          </>
        ) : (
          'Save & Complete'
        )}
      </button>
    </>
  );
}

