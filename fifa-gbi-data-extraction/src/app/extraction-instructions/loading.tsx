import { Skeleton, SkeletonCard } from '@/components/ui';

/**
 * The footprint mirrors the loaded page (hero with segmented switcher, then a
 * stack of document sections) so nothing jumps when the content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-[168px] rounded-page" />
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} lines={4} />
        ))}
      </div>
      <span className="sr-only">Loading extraction instructions…</span>
    </div>
  );
}
