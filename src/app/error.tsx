"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application rendering failed:", error);
  }, [error]);

  return (
    <main className="flex min-h-[65vh] items-center justify-center px-5 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-olive">IDAI STORES 43</p>
        <h1 className="mt-4 text-3xl font-semibold">We couldn’t load this page</h1>
        <p className="mt-3 text-muted-foreground">Please try again, or return to the shop.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline"><Link href="/shop">Visit the shop</Link></Button>
        </div>
      </div>
    </main>
  );
}
