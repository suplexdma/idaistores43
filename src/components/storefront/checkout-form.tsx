"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, MapPin, ShieldCheck, Truck } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
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
type CheckoutPaymentMethod = "COD" | "Online";
type PaymentSettings = {
  jazzCashNumber: string;
  easyPaisaNumber: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
};

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
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("COD");
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentSettingsError, setPaymentSettingsError] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState("");
  const [paymentScreenshotName, setPaymentScreenshotName] = useState("");
  const [paymentScreenshotError, setPaymentScreenshotError] = useState("");
  const [privateMessage, setPrivateMessage] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryCharge = getDeliveryCharge();

  useEffect(() => {
    let active = true;
    void fetch("/api/payment-settings")
      .then(async (response) => {
        const data = await response.json() as { settings?: PaymentSettings; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load payment account details.");
        if (active) setPaymentSettings(data.settings ?? null);
      })
      .catch((loadError: unknown) => {
        if (active) setPaymentSettingsError(loadError instanceof Error ? loadError.message : "Unable to load payment account details.");
      });
    return () => { active = false; };
  }, []);

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

  async function submitOrder(values: CheckoutValues, source: OrderSource, method: CheckoutPaymentMethod = "COD") {
    if (!hasHydrated || items.length === 0) {
      setServerError("Your bag is empty. Add products before checking out.");
      return;
    }
    if (method === "Online" && !paymentScreenshot) {
      setPaymentScreenshotError("Payment screenshot is required for online payment.");
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
          paymentMethod: method,
          ...(method === "Online" ? { paymentScreenshot, privateMessage } : {}),
        }),
      });
      const result = (await response.json()) as CheckoutResponse;
      if (!response.ok || !result.orderNumber) {
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error?.map((issue) => issue.message).filter(Boolean).join(" ") ||
              "Unable to place your order.";
        setServerError(message);
        return;
      }

      clearCart();
      if (method === "Online") {
        if (!result.whatsappUrl) {
          setServerError(`Your order ${result.orderNumber} was saved, but WhatsApp could not be opened. Please contact support and attach your payment screenshot.`);
          return;
        }
        window.location.assign(result.whatsappUrl);
        return;
      }
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

  function choosePaymentScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPaymentScreenshot("");
      setPaymentScreenshotName("");
      setPaymentScreenshotError("Choose a JPEG, PNG, or WebP payment screenshot.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPaymentScreenshot("");
      setPaymentScreenshotName("");
      setPaymentScreenshotError("Payment screenshot must be 5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setPaymentScreenshotError("Unable to read the payment screenshot. Try another image.");
        return;
      }
      setPaymentScreenshot(reader.result);
      setPaymentScreenshotName(file.name);
      setPaymentScreenshotError("");
    };
    reader.onerror = () => setPaymentScreenshotError("Unable to read the payment screenshot. Try another image.");
    reader.readAsDataURL(file);
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
                onSubmit={form.handleSubmit((values) => submitOrder(values, "Website", paymentMethod))}
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
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${paymentMethod === "COD" ? "border-brand-olive bg-brand-olive/5" : ""}`}>
                      <input type="radio" name="payment-method" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} className="mt-1 accent-brand-olive" />
                      <span><span className="block text-sm font-medium">{t("cod")}</span><span className="mt-1 block text-xs text-muted-foreground">{t("payOnDelivery")}</span></span>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${paymentMethod === "Online" ? "border-brand-olive bg-brand-olive/5" : ""}`}>
                      <input type="radio" name="payment-method" checked={paymentMethod === "Online"} onChange={() => setPaymentMethod("Online")} className="mt-1 accent-brand-olive" />
                      <span><span className="block text-sm font-medium">Online Payment</span><span className="mt-1 block text-xs text-muted-foreground">Pay by JazzCash, Easypaisa, or bank transfer.</span></span>
                    </label>
                  </div>
                  {paymentMethod === "Online" && (
                    <div className="mt-4 space-y-4 rounded-lg border bg-muted/20 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">IDAI payment details</h3>
                        {paymentSettingsError ? <p role="alert" className="mt-2 text-sm text-destructive">{paymentSettingsError}</p>
                          : paymentSettings ? <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                            {paymentSettings.jazzCashNumber && <div><dt className="text-xs text-muted-foreground">JazzCash</dt><dd className="font-medium">{paymentSettings.jazzCashNumber}</dd></div>}
                            {paymentSettings.easyPaisaNumber && <div><dt className="text-xs text-muted-foreground">Easypaisa</dt><dd className="font-medium">{paymentSettings.easyPaisaNumber}</dd></div>}
                            {paymentSettings.bankName && <div><dt className="text-xs text-muted-foreground">Bank</dt><dd className="font-medium">{paymentSettings.bankName}</dd></div>}
                            {paymentSettings.accountTitle && <div><dt className="text-xs text-muted-foreground">Account title</dt><dd className="font-medium">{paymentSettings.accountTitle}</dd></div>}
                            {paymentSettings.accountNumber && <div><dt className="text-xs text-muted-foreground">Account number</dt><dd className="font-medium">{paymentSettings.accountNumber}</dd></div>}
                            {paymentSettings.iban && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">IBAN</dt><dd className="break-all font-medium">{paymentSettings.iban}</dd></div>}
                            {!Object.values(paymentSettings).some(Boolean) && <p className="text-xs text-muted-foreground">Payment account details are not available right now. Contact support before transferring.</p>}
                          </dl> : <p className="mt-2 text-xs text-muted-foreground">Loading payment instructions…</p>}
                      </div>
                      <label className="block space-y-2 text-sm font-medium">
                        Payment screenshot <span className="text-destructive">*</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePaymentScreenshot} className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-olive/10 file:px-3 file:py-1.5 file:text-xs file:font-medium" />
                        <span className="block text-xs font-normal text-muted-foreground">{paymentScreenshotName ? `Selected: ${paymentScreenshotName}` : "JPEG, PNG or WebP · maximum 5 MB"}</span>
                      </label>
                      {paymentScreenshotError && <p role="alert" className="text-sm text-destructive">{paymentScreenshotError}</p>}
                      <label className="block space-y-2 text-sm font-medium">
                        Private message <span className="font-normal text-muted-foreground">· optional</span>
                        <textarea value={privateMessage} onChange={(event) => setPrivateMessage(event.target.value)} maxLength={1000} rows={3} placeholder="Add a note for the store team" className="w-full rounded-md border bg-background px-3 py-2 text-sm font-normal" />
                      </label>
                      <p className="text-xs leading-5 text-muted-foreground">After submission you’ll continue to WhatsApp. The screenshot is stored privately; please attach it in WhatsApp too so our team can confirm your payment.</p>
                    </div>
                  )}
                </section>

                {serverError && <p role="alert" className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p>}
                <div className="space-y-3">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={placingOrder}
                  >
                    {placingOrder ? "Submitting your order..." : paymentMethod === "Online" ? "Submit online payment" : t("placeOrder")}
                  </Button>
                  {paymentMethod === "COD" && <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full border-brand-olive text-brand-olive hover:bg-brand-olive hover:text-white"
                    disabled={placingOrder}
                    onClick={() => void form.handleSubmit((values) => submitOrder(values, "WhatsApp", "COD"))()}
                  >
                    {placingOrder ? "Saving order..." : t("placeOrderWhatsApp")}
                  </Button>}
                  {paymentMethod === "COD" && <p className="text-center text-xs text-muted-foreground">{t("orderSavedBeforeWhatsApp")}</p>}
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
              <div className="flex justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Truck aria-hidden="true" className="size-4" />Delivery estimate</span><span>{formatPKR(deliveryCharge)}</span></div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>{t("total")}</span><span>{formatPKR(subtotal + deliveryCharge)}</span></div>
            </div>
            <p className="mt-4 rounded-md bg-brand-olive/10 p-3 text-xs leading-5 text-brand-charcoal">
              Delivery charges vary based on weight, dimensions, and location.
            </p>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-4 text-brand-olive" /> Your order and details are protected.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
