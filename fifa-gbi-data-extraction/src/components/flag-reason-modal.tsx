'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type FlagReasonModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  initialReason?: string;
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export function FlagReasonModal({
  isOpen,
  title = 'Flag paper',
  description = 'Give a quick reason why this paper is being flagged.',
  initialReason = '',
  isPending = false,
  onCancel,
  onSubmit,
}: FlagReasonModalProps) {
  if (!isOpen) return null;

  return (
    <FlagReasonDialog
      key={initialReason}
      title={title}
      description={description}
      initialReason={initialReason}
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

type FlagReasonDialogProps = {
  title: string;
  description: string;
  initialReason: string;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

function FlagReasonDialog({
  title,
  description,
  initialReason,
  isPending,
  onCancel,
  onSubmit,
}: FlagReasonDialogProps) {
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Add a short reason before flagging.');
      return;
    }
    onSubmit(trimmedReason);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="presentation">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flag-reason-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="flag-reason-title" className="text-base font-semibold text-slate-950">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close flag reason dialog"
          >
            Close
          </button>
        </div>

        <label htmlFor="flag-reason" className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Reason
        </label>
        <textarea
          ref={textareaRef}
          id="flag-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError(null);
          }}
          rows={4}
          disabled={isPending}
          className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:opacity-70"
          placeholder="Briefly describe what needs reviewer attention."
        />
        {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/20 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Flagging...' : 'Flag paper'}
          </button>
        </div>
      </form>
    </div>
  );
}
