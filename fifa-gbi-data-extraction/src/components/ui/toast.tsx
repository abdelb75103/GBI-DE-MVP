'use client';

import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import type { Tone } from '@/components/ui/tone';

const TONE: Record<Exclude<Tone, 'neutral'>, string> = {
  positive: 'border-positive-line bg-positive-tint text-positive-ink',
  negative: 'border-negative-line bg-negative-tint text-negative-ink',
  attention: 'border-attention-line bg-attention-tint text-attention-ink',
  info: 'border-info-line bg-info-tint text-info-ink',
};

const ICON = {
  positive: CheckCircle,
  negative: WarningCircle,
  attention: Warning,
  info: Info,
};

/** Fixed bottom-right stack. Render one per screen and feed it `Toast`s. */
export function ToastViewport({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-[360px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Toast({
  tone = 'info',
  children,
  onDismiss,
}: {
  tone?: Exclude<Tone, 'neutral'>;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = ICON[tone];
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full items-start gap-2.5 rounded-card border px-3.5 py-3 text-[13px] shadow-e2',
        'animate-[gbi-toast-in_200ms_var(--ease)]',
        TONE[tone],
      )}
    >
      <Icon aria-hidden weight="fill" className="mt-px h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-my-1 -mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-tag opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:shadow-focus"
        >
          <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
