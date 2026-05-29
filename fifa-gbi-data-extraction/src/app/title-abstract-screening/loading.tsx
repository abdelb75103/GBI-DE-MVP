export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6" aria-busy="true">
      <div className="h-48 animate-pulse rounded-3xl border border-slate-200/70 bg-white/70 shadow-xl ring-1 ring-slate-200/60" />
      <section className="grid min-h-[calc(100vh-260px)] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 shadow-xl ring-1 ring-slate-200/60 lg:grid-cols-[300px_minmax(0,1fr)_220px]">
        <aside className="flex flex-col gap-3 border-r border-slate-200/70 bg-slate-50/60 p-4">
          <div className="h-9 animate-pulse rounded-full bg-slate-200/70" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </aside>
        <div className="flex flex-col gap-4 p-8">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-slate-200/70" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200/60" />
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-slate-200/50" />
        </div>
        <aside className="hidden flex-col gap-3 border-l border-slate-200/70 bg-slate-50/60 p-4 lg:flex">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-full bg-slate-200/60" />
          ))}
        </aside>
      </section>
      <span className="sr-only">Loading title and abstract screening…</span>
    </div>
  );
}
