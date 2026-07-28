import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * A filter chip. Toggles a facet on or off, so it is always a `button` with
 * `aria-pressed`. The batch filters that render as links today should keep
 * their link semantics but use `ChipLink` so the two look identical.
 */

const BASE =
  'inline-flex min-h-[30px] items-center gap-2 rounded-ctl border px-2.5 text-[13px] font-medium ' +
  'transition-[border-color,background-color,color] duration-[160ms] ease-gbi ' +
  'focus-visible:outline-none focus-visible:shadow-focus';

const IDLE = 'border-line bg-surface text-ink-muted hover:border-navy-300 hover:text-ink';
const ACTIVE = 'border-navy-600 bg-navy-600 text-white';


export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  active?: boolean;
  count?: number;
  children: ReactNode;
};

export function Chip({ active = false, count, className, children, ...rest }: ChipProps) {
  return (
    <button type="button" aria-pressed={active} className={cn(BASE, active ? ACTIVE : IDLE, className)} {...rest}>
      {children}
      {typeof count === 'number' ? <ChipCount active={active}>{count}</ChipCount> : null}
    </button>
  );
}

export function ChipLink({
  active = false,
  count,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  active?: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={cn(BASE, active ? ACTIVE : IDLE, 'no-underline', className)}
      {...rest}
    >
      {children}
      {typeof count === 'number' ? <ChipCount active={active}>{count}</ChipCount> : null}
    </a>
  );
}

function ChipCount({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'text-[11px] font-semibold [font-variant-numeric:tabular-nums]',
        active ? 'text-white/75' : 'text-ink-soft',
      )}
    >
      {children}
    </span>
  );
}
