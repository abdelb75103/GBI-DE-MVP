import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import type { Tone } from '@/components/ui/tone';

/**
 * A state pill. Reserved for what a reviewer or the pipeline decided, and it
 * means the same thing on every screen. Source families use `Tag`, not this.
 *
 * Every pill carries an icon or a dot as well as a word, so colour is never
 * the only signal.
 */

const TONE: Record<Tone | 'solid', string> = {
  positive: 'border-positive-line bg-positive-tint text-positive-ink',
  negative: 'border-negative-line bg-negative-tint text-negative-ink',
  attention: 'border-attention-line bg-attention-tint text-attention-ink',
  neutral: 'border-neutral-line bg-neutral-tint text-neutral-ink',
  info: 'border-info-line bg-info-tint text-info-ink',
  solid: 'border-transparent bg-navy-600 text-white',
};

export type PillProps = {
  tone?: Tone | 'solid';
  icon?: ReactNode;
  /** Show a plain dot when there is no meaningful icon. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Pill({ tone = 'neutral', icon, dot = false, children, className, title }: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full border pl-[7px] pr-[9px] text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="inline-flex h-3 w-3 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
          {icon}
        </span>
      ) : dot ? (
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}
