import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-9 text-center', className)}>
      {icon ? (
        <div
          aria-hidden
          className="mx-auto mb-3 grid h-11 w-11 place-content-center rounded-card bg-surface-sunk text-ink-soft shadow-e0 [&>svg]:h-[22px] [&>svg]:w-[22px]"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1.5 max-w-[52ch] text-[13px] text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
