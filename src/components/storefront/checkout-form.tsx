"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, MapPin, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/lib/cart-store";
import { cloudinaryImageLoader } from "@/lib/cloudinary-url";
import { useLanguage } from "@/lib/language";
import {
  formatPKR,
  getDeliveryCharge,
  STANDARD_DELIVERY_CHARGE,
} from "@/components/storefront/cart-drawer";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/, "Enter a valid phone number."),
  email: z.union([z.string().trim().email("Enter a valid email address."), z.literal("")]),
  city: z.string().trim().min(2, "Enter your city.").max(100),
  address: z.string().trim().min(5, "Enter your complete address.").max(500),
  notes: z.string().max(1000),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;
export type CheckoutPrefill = Partial<CheckoutValues>;
type OrderSource = "Website" | "WhatsApp";

type CheckoutResponse = {
  orderNumber?: string;
  whatsappUrl?: string;
  error?: string | { message?: string }[];
};

export function CheckoutForm({ prefill }: { prefill: CheckoutPrefill }) {
  const router = useRouter();
  const { t } = useLanguage();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const clearCart = useCartStore((state) => state.clearCart);
  const [serverError, setServerError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryCharge = getDeliveryCharge(subtotal);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: prefill.name ?? "",
      phone: prefill.phone ?? "",
      email: prefill.email ?? "",
      city: prefill.city ?? "",
      address: prefill.address ?? "",
      notes: "",
    },
  });

  async function submitOrder(values: CheckoutValues, source: OrderSource) {
    if (!hasHydrated || items.length === 0) {
      setServerError("Your bag is empty. Add products before checking out.");
      return;
    }

    setServerError("");
    setPlacingOrder(true);
    const whatsappWindow = source === "WhatsApp" ? window.open("about:blank", "_blank") : null;

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: values,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            ...(item.variantName ? { variantName: item.variantName } : {}),
          })),
          source,
          paymentMethod: "COD",
        }),
      });
      const result = (await response.json()) as CheckoutResponse;
      if (!response.ok || !result.orderNumber) {
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
        const message =
          typeof result.error === "string" ? result.error : "Unable to place your order.";
        setServerError(message);
        return;
      }

      clearCart();
      if (source === "WhatsApp") {
        if (!result.whatsappUrl) {
          if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
          setServerError("Your order was saved but the WhatsApp link was not returned. Contact support with the order number.");
          return;
        }
        if (whatsappWindow && !whatsappWindow.closed) {
          whatsappWindow.opener = null;
          whatsappWindow.location.href = result.whatsappUrl;
        } else {
          window.location.assign(result.whatsappUrl);
        }
        return;
      }

      router.replace(`/checkout/success?order=${encodeURIComponent(result.orderNumber)}`);
      router.refresh();
    } catch {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      setServerError("Unable to reach the order service. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  }

  if (!hasHydrated) {
    return <main className="mx-auto max-w-7xl animate-pulse px-5 py-12"><div className="h-8 w-64 rounded bg-muted" /><div className="mt-8 h-96 rounded-xl bg-muted" /></main>;
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-3xl font-semibold">{t("bagEmpty")}</h1>
        <p className="mt-3 text-muted-foreground">{t("emptyBagDescription")}</p>
        <Button asChild className="mt-6"><Link href="/shop">{t("exploreShop")}</Link></Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">{t("almostYours")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t("checkout")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("deliveryOneStep")}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-9">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin aria-hidden="true" className="size-5 text-brand-olive" /> {t("deliveryInformation")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit((values) => submitOrder(values, "Website"))}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>{t("fullName")} *</FormLabel><FormControl><Input autoComplete="name" dir="auto" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>{t("phone")} *</FormLabel><FormControl><Input type="tel" autoComplete="tel" placeholder="03XX XXXXXXX" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>{t("emailOptional")}</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>{t("city")} *</FormLabel><FormControl><Input autoComplete="address-level2" dir="auto" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="sm:col-span-2"><FormLabel>{t("completeAddress")} *</FormLabel><FormControl><textarea {...field} autoComplete="street-address" dir="auto" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem className="sm:col-span-2"><FormLabel>{t("orderNotes")}</FormLabel><FormControl><textarea {...field} dir="auto" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <section aria-labelledby="payment-title" className="border-t pt-5">
                  <h2 id="payment-title" className="flex items-center gap-2 font-semibold">
                    <CreditCard aria-hidden="true" className="size-5 text-brand-olive" /> {t("paymentMethod")}
                  </h2>
                  <div className="mt-3 flex items-start gap-3 rounded-lg border border-brand-olive bg-brand-olive/5 p-4">
                    <input type="radio" checked readOnly aria-label="Cash on Delivery selected" className="mt-1 accent-brand-olive" />
                    <div>
                      <p className="text-sm font-medium">{t("cod")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("payOnDelivery")}</p>
                    </div>
                  </div>
                </section>

                {serverError && <p role="alert" className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p>}
                <div className="space-y-3">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={placingOrder}
                  >
                    {placingOrder ? "Placing your order..." : t("placeOrder")}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full border-brand-olive text-brand-olive hover:bg-brand-olive hover:text-white"
                    disabled={placingOrder}
                    onClick={() => void form.handleSubmit((values) => submitOrder(values, "WhatsApp"))()}
                  >
                    {placingOrder ? "Saving order..." : t("placeOrderWhatsApp")}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {t("orderSavedBeforeWhatsApp")}
                  </p>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-40">
          <CardHeader><CardTitle className="text-lg">{t("yourOrder")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="max-h-80 space-y-4 overflow-y-auto">
              {items.map((item) => (
                <li key={`${item.productId}:${item.variantName ?? ""}`} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image && <Image src={item.image} loader={cloudinaryImageLoader} alt={item.name} fill sizes="64px" className="object-cover" />}
                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-brand-charcoal text-[10px] text-white">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                    {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-medium">{formatPKR(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-3 border-t pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span>{formatPKR(subtotal)}</span></div>
              <div className="flex justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Truck aria-hidden="true" className="size-4" />{t("delivery")}</span><span>{deliveryCharge === 0 ? t("free") : formatPKR(STANDARD_DELIVERY_CHARGE)}</span></div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>{t("total")}</span><span>{formatPKR(subtotal + deliveryCharge)}</span></div>
            </div>
            {subtotal < 2000 && (
              <p className="mt-4 rounded-md bg-brand-olive/10 p-3 text-xs leading-5 text-brand-charcoal">
                {t("moreForFreeDelivery").replace("{amount}", formatPKR(2000 - subtotal))}
              </p>
            )}
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-4 text-brand-olive" /> Your order and details are protected.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
