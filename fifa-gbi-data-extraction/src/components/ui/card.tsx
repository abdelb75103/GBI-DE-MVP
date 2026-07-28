import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Remove padding and clip children, for tables and lists that go edge to edge. */
  flush?: boolean;
};

export function Card({ flush = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-card bg-surface shadow-e1', flush ? 'overflow-hidden' : 'p-5', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink">{title}</h2>
        {description ? <p className="mt-1 text-xs text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
