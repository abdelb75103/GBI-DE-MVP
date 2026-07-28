import { Skeleton, SkeletonCard } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero, then the upload form card)
 * so nothing jumps when the profile check resolves.
 */
export default function Loading() {
  return (
    <div className="space-y-10" aria-busy="true">
      <Skeleton className="h-[168px] rounded-page" />
      <SkeletonCard lines={4} />
      <span className="sr-only">Loading upload form...</span>
    </div>
  );
}
