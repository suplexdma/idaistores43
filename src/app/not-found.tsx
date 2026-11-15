import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[65vh] items-center justify-center px-5 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-olive">IDAI STORES 43</p>
        <h1 className="mt-4 text-4xl font-semibold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">That page may have moved or is no longer available.</p>
        <Button asChild className="mt-7"><Link href="/">Back to home</Link></Button>
      </div>
    </main>
  );
}
