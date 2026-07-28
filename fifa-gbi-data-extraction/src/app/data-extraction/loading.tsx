import { Skeleton, SkeletonRows } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero, four tiles, progress card, table)
 * so nothing jumps when the data arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-[184px] rounded-page" />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[132px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[220px] rounded-card" />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,2.6fr)_minmax(300px,1fr)]">
        <SkeletonRows rows={8} />
        <div className="space-y-6">
          <Skeleton className="h-[140px] rounded-card" />
          <Skeleton className="h-[240px] rounded-card" />
        </div>
      </div>
      <span className="sr-only">Loading data extraction…</span>
    </div>
  );
}
