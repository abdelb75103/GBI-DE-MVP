import type { HTMLAttributes } from 'react';

import { cn } from '@/components/ui/cn';
import type { Tone } from '@/components/ui/tone';

/**
 * A record row: one paper, one screening decision, one queue entry. The state
 * rail on the left edge is the shared signal across every workflow, so the same
 * colour means the same thing in extraction, full text and title/abstract.
 */

const RAIL: Record<Tone, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  attention: 'bg-attention',
  neutral: 'bg-n-300',
  info: 'bg-navy-600',
};

export type RecordRowProps = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  selected?: boolean;
};

export function RecordRow({ tone = 'neutral', selected = false, className, children, ...rest }: RecordRowProps) {
  return (
    <div
      className={cn(
        'relative flex items-start gap-3.5 overflow-hidden rounded-card bg-surface py-3.5 pl-[18px] pr-4 shadow-e1',
        'transition-[box-shadow,transform] duration-[160ms] ease-gbi hover:shadow-e2',
        selected && 'shadow-[0_0_0_1px_var(--navy-600),0_0_0_3px_var(--navy-100)] dark:shadow-[0_0_0_1px_var(--navy-600),0_0_0_3px_#1c3352]',
        'max-sm:flex-col max-sm:gap-2.5',
        className,
      )}
      {...rest}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', RAIL[tone])} />
      {children}
    </div>
  );
}
