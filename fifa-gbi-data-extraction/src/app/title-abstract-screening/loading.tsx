import { Skeleton } from '@/components/ui';

/**
 * The footprint mirrors the loaded page: hero, four tiles and a progress card on
 * desktop only, then the three-pane workspace, so nothing jumps when the data
 * arrives.
 */
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-6" aria-busy="true">
      <div className="hidden flex-col gap-6 md:flex">
        <Skeleton className="h-[172px] rounded-page" />
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[108px] rounded-card" />
          ))}
        </div>
        <Skeleton className="h-[118px] rounded-card" />
      </div>

      <section className="grid min-h-[calc(100vh-260px)] overflow-hidden rounded-card bg-surface shadow-e1 lg:grid-cols-[300px_minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-3 border-r border-line bg-surface-sunk p-4">
          <Skeleton className="h-9 rounded-ctl" />
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-card" />
          ))}
        </div>
        <div className="flex flex-col gap-4 p-8">
          <Skeleton className="h-7 w-2/3 rounded-ctl" />
          <Skeleton className="h-[68px] rounded-card" />
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-[160px] rounded-card" />
        </div>
        <div className="hidden flex-col gap-2 border-l border-line bg-surface-sunk p-3 lg:flex">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-9 rounded-ctl" />
          ))}
        </div>
      </section>
      <span className="sr-only">Loading title and abstract screening…</span>
    </div>
  );
}
