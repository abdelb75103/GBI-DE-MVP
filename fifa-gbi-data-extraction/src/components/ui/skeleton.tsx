import { cn } from '@/components/ui/cn';

/**
 * Loading placeholder. Eleven of fifteen routes had no loading state at all
 * before the migration; every route gets one built from these.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-[gbi-pulse_1.4s_var(--ease)_infinite] rounded-tag bg-n-200 dark:bg-[#22304a]', className)}
    />
  );
}

/** A skeleton card matching the `Card` footprint. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('rounded-card bg-surface p-5 shadow-e1', className)}>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

/** Rows for a table placeholder. */
export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-line rounded-card bg-surface shadow-e1', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-3.5 py-3">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
