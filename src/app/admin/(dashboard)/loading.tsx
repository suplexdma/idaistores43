export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading admin page" className="mx-auto max-w-[1400px] animate-pulse space-y-6">
      <div className="space-y-3"><div className="h-3 w-24 rounded bg-muted" /><div className="h-9 w-56 rounded bg-muted" /><div className="h-4 w-80 max-w-full rounded bg-muted" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 rounded-2xl border bg-white p-5"><div className="h-4 w-28 rounded bg-muted" /><div className="mt-7 h-8 w-40 rounded bg-muted" /></div>)}</div>
      <div className="h-72 rounded-2xl border bg-white" />
    </div>
  );
}
