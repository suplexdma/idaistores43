"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCartStore } from "@/lib/cart-store";

export function CheckoutSuccess({ orderNumber }: { orderNumber: string }) {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-2xl flex-col justify-center px-5 py-12">
      <Card className="overflow-hidden">
        <div className="h-2 bg-brand-olive" />
        <CardContent className="px-6 py-10 text-center sm:px-10 sm:py-12">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-olive/10 text-brand-olive">
            <CheckCircle2 aria-hidden="true" className="size-9" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Order confirmed</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thank you for choosing IDAI</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Your order is in. We’ll be in touch to confirm the delivery details and collect payment on arrival.
          </p>
          <div className="mx-auto mt-7 max-w-sm rounded-lg bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your order number</p>
            <p className="mt-1 text-xl font-semibold text-brand-charcoal">{orderNumber}</p>
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/account/orders"><PackageCheck aria-hidden="true" className="size-4" /> Track my orders</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/shop">Continue shopping</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Sign in or create an account to see this order in your order history.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
