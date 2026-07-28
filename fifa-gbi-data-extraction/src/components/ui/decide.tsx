'use client';

import { CheckCircle, Flag, XCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * The include / exclude / flag control. One implementation for title-abstract
 * screening, full-text screening and extraction QA, so the same decision looks
 * the same everywhere. Pressed state is the only place these colours fill.
 */

export type DecisionKind = 'include' | 'exclude' | 'flag';

const PRESSED: Record<DecisionKind, string> = {
  include: 'border-positive bg-positive text-white',
  exclude: 'border-negative bg-negative text-white',
  flag: 'border-attention bg-attention text-[#24190a]',
};

const ICON = {
  include: CheckCircle,
  exclude: XCircle,
  flag: Flag,
};

export type DecideOption = {
  kind: DecisionKind;
  label: ReactNode;
  disabled?: boolean;
};

export function Decide({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: DecideOption[];
  value: DecisionKind | null;
  onChange: (kind: DecisionKind) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex gap-2', className)}>
      {options.map((option) => {
        const Icon = ICON[option.kind];
        const pressed = value === option.kind;
        return (
          <button
            key={option.kind}
            type="button"
            data-kind={option.kind}
            aria-pressed={pressed}
            disabled={option.disabled}
            onClick={() => onChange(option.kind)}
            className={cn(
              'inline-flex min-h-9 items-center gap-[7px] rounded-ctl border px-3.5 text-[13px] font-semibold',
              'transition-[background-color,border-color,color] duration-[160ms] ease-gbi',
              'focus-visible:outline-none focus-visible:shadow-focus',
              'disabled:cursor-not-allowed disabled:opacity-45',
              pressed
                ? PRESSED[option.kind]
                : 'border-line-strong bg-surface text-ink-muted hover:enabled:border-navy-300 hover:enabled:text-ink',
            )}
          >
            <Icon aria-hidden weight={pressed ? 'fill' : 'regular'} className="h-[15px] w-[15px] shrink-0" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
