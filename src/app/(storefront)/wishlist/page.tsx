"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { useWishlistStore } from "@/lib/wishlist-store";

export default function WishlistPage() {
  const items = useWishlistStore((state) => state.items);
  const hydrated = useWishlistStore((state) => state.hydrated);

  useEffect(() => {
    void useWishlistStore.persist.rehydrate();
  }, []);

  return (
    <div className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10 sm:px-7 sm:py-14 lg:px-10">
      <div className="mb-8 border-b border-border/70 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Your saved collection</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Wishlist</h1>
        <p className="mt-2 text-sm text-muted-foreground">Keep the thoughtful finds you love close at hand.</p>
      </div>
      {!hydrated ? (
        <div role="status" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
          {items.map((product) => <ProductCard key={product._id} product={product} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-olive/10 text-brand-olive"><Heart aria-hidden="true" className="size-6" /></span>
          <h2 className="mt-4 font-serif text-xl font-semibold">Your wishlist is waiting for a favorite</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Save products by tapping the heart on any item, then find them here whenever you are ready.</p>
          <Button asChild className="mt-6 rounded-full bg-brand-olive px-6 text-white hover:bg-brand-olive/90">
            <Link href="/shop"><ShoppingBag aria-hidden="true" className="me-2 size-4" />Explore the shop</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
