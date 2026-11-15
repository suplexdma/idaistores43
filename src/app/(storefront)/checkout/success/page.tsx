import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutSuccess } from "@/components/storefront/checkout-success";

export const metadata: Metadata = { title: "Order confirmed | IDAI STORES 43" };
export const dynamic = "force-dynamic";

type Props = { searchParams: { order?: string } };

export default function CheckoutSuccessPage({ searchParams }: Props) {
  const orderNumber = searchParams.order ?? "";
  if (!/^IDAI-\d{6}$/.test(orderNumber)) notFound();
  return <CheckoutSuccess orderNumber={orderNumber} />;
}
