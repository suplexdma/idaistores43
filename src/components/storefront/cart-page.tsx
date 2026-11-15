"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPKR,
  getDeliveryCharge,
  STANDARD_DELIVERY_CHARGE,
} from "@/components/storefront/cart-drawer";
import { getCartItemKey, useCartStore } from "@/lib/cart-store";

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const delivery = getDeliveryCharge(subtotal);

  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-olive">
        <ArrowLeft aria-hidden="true" className="size-4" /> Continue shopping
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Your selection</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your bag</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {items.reduce((count, item) => count + item.quantity, 0)} items
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <ShoppingBag aria-hidden="true" className="mx-auto size-10 text-brand-olive/70" />
          <h2 className="mt-4 text-xl font-semibold">Your bag is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">Find something thoughtful for your everyday.</p>
          <Button asChild className="mt-6"><Link href="/shop">Explore the shop</Link></Button>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardContent className="divide-y p-0">
              {items.map((item) => {
                const itemKey = getCartItemKey(item);
                return (
                  <article key={itemKey} className="flex gap-4 p-4 sm:gap-5 sm:p-6">
                    <Link href={`/product/${item.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-32">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="128px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <Link href={`/product/${item.slug}`} className="font-medium hover:text-brand-olive">
                          {item.name}
                        </Link>
                        {item.variantName && <p className="mt-1 text-sm text-muted-foreground">{item.variantName}</p>}
                        <p className="mt-2 text-sm font-semibold">{formatPKR(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="inline-flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-r-none"
                            aria-label={`Decrease ${item.name} quantity`}
                            onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                          >
                            <Minus aria-hidden="true" className="size-4" />
                          </Button>
                          <span className="min-w-9 text-center text-sm" aria-live="polite">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-l-none"
                            aria-label={`Increase ${item.name} quantity`}
                            disabled={item.quantity >= item.stock}
                            onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                          >
                            <Plus aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => removeFromCart(itemKey)}
                        >
                          <Trash2 aria-hidden="true" className="size-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-44">
            <CardHeader><CardTitle>Order summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span>{delivery === 0 ? "Free" : formatPKR(STANDARD_DELIVERY_CHARGE)}</span>
              </div>
              <div className="flex justify-between border-t pt-4 font-semibold">
                <span>Total</span>
                <span>{formatPKR(subtotal + delivery)}</span>
              </div>
              <div className="rounded-md bg-brand-olive/10 p-3 text-xs leading-5 text-brand-charcoal">
                {delivery === 0
                  ? "Your order qualifies for free delivery."
                  : `Add ${formatPKR(2000 - subtotal)} more for free delivery.`}
              </div>
              <Button asChild className="w-full" size="lg">
                <Link href="/checkout">Continue to Checkout</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">Cash on Delivery available at checkout.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
