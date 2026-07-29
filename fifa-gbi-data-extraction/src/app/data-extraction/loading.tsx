import { Skeleton, SkeletonRows } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero, four tiles, progress card, table)
 * so nothing jumps when the data arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-[216px] rounded-page" />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[132px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[220px] rounded-card" />
      <div className="space-y-6">
        <SkeletonRows rows={8} />
        <div className="grid items-start gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Skeleton className="h-[140px] rounded-card" />
          <Skeleton className="h-[240px] rounded-card" />
        </div>
      </div>
      <span className="sr-only">Loading data extraction…</span>
    </div>
  );
}
