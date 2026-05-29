export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6" aria-busy="true">
      <div className="h-40 animate-pulse rounded-3xl border border-slate-200/70 bg-white/70 shadow-xl ring-1 ring-slate-200/60" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200/70 bg-white/70" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-3xl border border-slate-200/70 bg-white/70 shadow-xl ring-1 ring-slate-200/60" />
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
