export default function StorefrontLoading() {
  return (
    <main role="status" aria-label="Loading store" className="mx-auto max-w-7xl animate-pulse px-4 py-10 sm:px-7 lg:px-10">
      <div className="mb-8 space-y-3 border-b pb-7"><div className="h-3 w-24 rounded bg-muted" /><div className="h-9 w-56 rounded bg-muted" /><div className="h-4 w-80 max-w-full rounded bg-muted" /></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index}><div className="aspect-[4/5] rounded-xl bg-muted" /><div className="mt-3 h-4 w-2/3 rounded bg-muted" /><div className="mt-2 h-4 w-1/3 rounded bg-muted" /></div>)}</div>
    </main>
  );
}
