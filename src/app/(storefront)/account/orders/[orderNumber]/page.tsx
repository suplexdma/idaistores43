import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR } from "@/components/storefront/cart-drawer";
import { authOptions } from "@/lib/auth-options";
import { connectToDatabase } from "@/lib/db";
import Order, { type Order as OrderSchema } from "@/models/Order";
import DeliveryCompany from "@/models/DeliveryCompany";
import { Types } from "mongoose";

export const metadata: Metadata = { title: "Order details | IDAI STORES 43" };
export const dynamic = "force-dynamic";

type Props = { params: { orderNumber: string } };

export default async function CustomerOrderDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !Types.ObjectId.isValid(session.user.id)) redirect("/login");
  if (!/^IDAI-\d{6}$/.test(params.orderNumber)) notFound();

  await connectToDatabase();
  const order = await Order.findOne({
    orderNumber: params.orderNumber,
    userId: new Types.ObjectId(session.user.id),
    deletedAt: null,
  }).lean();
  if (!order) notFound();
  const deliveryCompany = order.deliveryCompanyId
    ? await DeliveryCompany.findById(order.deliveryCompanyId).select("trackingUrlTemplate").lean()
    : null;
  const trackingUrl = createTrackingUrl(deliveryCompany?.trackingUrlTemplate, order.trackingNumber);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-olive">
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to my orders
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Order placed</p>
          <h1 className="mt-2 text-3xl font-semibold">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{order.createdAt.toLocaleDateString()}</p>
        </div>
        <span className="rounded-full bg-brand-olive/10 px-3 py-1.5 text-sm font-medium text-brand-olive">{order.status}</span>
      </div>
      <Card className="mt-7">
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {order.items.map((item: OrderSchema["items"][number], index: number) => (
              <li key={`${item.productId.toString()}-${item.variantName ?? ""}-${index}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.image && <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Qty {item.quantity} × {formatPKR(item.unitPrice)}</p>
                </div>
                <p className="shrink-0 font-medium">{formatPKR(item.quantity * item.unitPrice)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery details</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.shippingAddress?.name ?? order.customerDetails.name}</p>
            <p className="text-muted-foreground">{order.shippingAddress?.phone ?? order.customerDetails.phone}</p>
            <p className="text-muted-foreground">{order.shippingAddress?.address ?? order.customerDetails.address}</p>
            <p className="text-muted-foreground">{order.shippingAddress?.area ?? order.customerDetails.area}, {order.shippingAddress?.city ?? order.customerDetails.city}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payment summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPKR(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{order.deliveryCharge === 0 ? "Free" : formatPKR(order.deliveryCharge)}</span></div>
            {(order.deliveryCharges ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Additional delivery charges</span><span>{formatPKR(order.deliveryCharges ?? 0)}</span></div>}
            <div className="flex justify-between border-t pt-3 font-semibold"><span>Total · {order.paymentMethod}</span><span>{formatPKR(order.total + (order.deliveryCharges ?? 0))}</span></div>
          </CardContent>
        </Card>
      </div>
      {(order.deliveryCompany || order.trackingNumber || order.deliveryDate || order.estimatedArrival) && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Delivery status</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Delivery company</p><p className="mt-1 font-medium">{order.deliveryCompany || "To be assigned"}</p></div>
            <div><p className="text-xs text-muted-foreground">Tracking number</p>
              {order.trackingNumber ? trackingUrl
                ? <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-brand-olive underline">{order.trackingNumber}</a>
                : <p className="mt-1 font-medium">{order.trackingNumber}</p>
                : <p className="mt-1 text-muted-foreground">Not available yet</p>}
            </div>
            {order.deliveryDate && <div><p className="text-xs text-muted-foreground">Dispatched</p><p className="mt-1">{new Date(order.deliveryDate).toLocaleDateString("en-PK")}</p></div>}
            {order.estimatedArrival && <div><p className="text-xs text-muted-foreground">Estimated arrival</p><p className="mt-1">{new Date(order.estimatedArrival).toLocaleDateString("en-PK")}</p></div>}
          </CardContent>
        </Card>
      )}
      <Button asChild variant="outline" className="mt-6"><Link href="/shop">Continue shopping</Link></Button>
    </main>
  );
}

function createTrackingUrl(template: string | undefined, trackingNumber: string | undefined) {
  if (!template || !trackingNumber || !template.includes("{trackingNumber}")) return null;
  try {
    const url = new URL(template.replaceAll("{trackingNumber}", encodeURIComponent(trackingNumber)));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
