import { Skeleton, SkeletonRows } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero, scan/refresh controls, then
 * the duplicate comparison rows) so nothing jumps when the scan data arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-[128px] rounded-page" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-36 rounded-ctl" />
        <Skeleton className="h-9 w-28 rounded-ctl" />
      </div>
      <SkeletonRows rows={5} />
      <span className="sr-only">Loading deduplication review...</span>
    </div>
  );
}
