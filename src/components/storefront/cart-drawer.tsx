"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCartItemKey, useCartStore } from "@/lib/cart-store";
import { optimizedImageUrl } from "@/lib/cloudinary-url";

export const FREE_DELIVERY_THRESHOLD = 2000;
export const STANDARD_DELIVERY_CHARGE = 300;

export function formatPKR(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function getDeliveryCharge(subtotal: number) {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_CHARGE;
}

export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isCartOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? closeCart() : undefined)}>
      <SheetContent className="flex w-[min(100vw,440px)] flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag aria-hidden="true" className="size-5 text-brand-olive" />
            Your bag ({items.reduce((count, item) => count + item.quantity, 0)})
          </SheetTitle>
          <SheetDescription>Thoughtful finds, almost yours.</SheetDescription>
        </SheetHeader>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <ShoppingBag aria-hidden="true" className="size-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">Your bag is waiting</p>
            <p className="mt-1 text-sm text-muted-foreground">Add something you love to get started.</p>
            <Button asChild className="mt-5" onClick={closeCart}>
              <Link href="/shop">Explore the shop</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {items.map((item) => {
                const itemKey = getCartItemKey(item);
                return (
                  <li key={itemKey} className="flex gap-4">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={closeCart}
                      className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted"
                    >
                      {item.image && (
                        <Image
                          src={optimizedImageUrl(item.image)}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/product/${item.slug}`} onClick={closeCart} className="line-clamp-2 text-sm font-medium hover:text-brand-olive">
                            {item.name}
                          </Link>
                          {item.variantName && <p className="mt-1 text-xs text-muted-foreground">{item.variantName}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => removeFromCart(itemKey)}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{formatPKR(item.unitPrice)}</p>
                      <div className="mt-2 inline-flex items-center rounded-md border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-r-none"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                        >
                          <Minus aria-hidden="true" className="size-3.5" />
                        </Button>
                        <span className="min-w-8 text-center text-sm" aria-live="polite">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-l-none"
                          aria-label={`Increase quantity of ${item.name}`}
                          disabled={item.quantity >= item.stock}
                          onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                        >
                          <Plus aria-hidden="true" className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-3 border-t px-5 py-5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-medium">
                  {getDeliveryCharge(subtotal) === 0 ? "Free" : formatPKR(STANDARD_DELIVERY_CHARGE)}
                </span>
              </div>
              <Button asChild className="w-full" size="lg" onClick={closeCart}>
                <Link href="/cart">View bag & continue</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {subtotal >= FREE_DELIVERY_THRESHOLD
                  ? "Your order qualifies for free delivery."
                  : `Add ${formatPKR(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery.`}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
