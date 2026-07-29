import { Skeleton, SkeletonRows } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero, six queue tiles, progress card,
 * queue table) so nothing jumps when the data arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-[216px] rounded-page" />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[116px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[150px] rounded-card" />
      <SkeletonRows rows={10} />
      <span className="sr-only">Loading the full-text queue…</span>
    </div>
  );
}
