import { Skeleton, SkeletonRows } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero, then the approvals table)
 * so nothing jumps when the pending uploads arrive.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-[128px] rounded-page" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-40 rounded-ctl" />
        <Skeleton className="h-9 w-28 rounded-ctl" />
      </div>
      <SkeletonRows rows={6} />
      <span className="sr-only">Loading upload approvals...</span>
    </div>
  );
}
