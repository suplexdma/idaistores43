"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR } from "@/components/storefront/cart-drawer";

type AccountProfile = {
  name: string;
  email: string;
  phone: string;
  addresses: {
    id: string;
    label?: string;
    name: string;
    phone: string;
    address: string;
    area?: string;
    city: string;
    isDefault: boolean;
  }[];
};

type CustomerOrder = {
  orderNumber: string;
  createdAt: string;
  status: string;
  total: number;
  itemCount: number;
};

type Props = {
  profile: AccountProfile;
  initialTab?: "profile" | "orders" | "addresses";
};

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "orders", label: "My orders" },
  { id: "addresses", label: "Addresses" },
] as const;

export function AccountDashboard({ profile, initialTab = "profile" }: Props) {
  const [activeTab, setActiveTab] = useState<Props["initialTab"]>(initialTab);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    if (activeTab !== "orders") return;
    const controller = new AbortController();
    setOrdersLoading(true);
    setOrdersError("");
    void fetch("/api/orders/user", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { orders?: CustomerOrder[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load orders.");
        setOrders(data.orders ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOrdersError(error instanceof Error ? error.message : "Unable to load orders.");
      })
      .finally(() => setOrdersLoading(false));
    return () => controller.abort();
  }, [activeTab]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Your IDAI account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome, {profile.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your details and orders, all in one place.</p>
        </div>
        <Button variant="outline" onClick={() => void signOut({ callbackUrl: "/" })}>Sign out</Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Account sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`shrink-0 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${activeTab === tab.id ? "bg-brand-olive text-white" : "bg-white text-muted-foreground hover:bg-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === "profile" && (
            <Card>
              <CardHeader><CardTitle>Profile details</CardTitle></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <ProfileField label="Full name" value={profile.name} />
                <ProfileField label="Email" value={profile.email} />
                <ProfileField label="Phone number" value={profile.phone} />
              </CardContent>
            </Card>
          )}

          {activeTab === "addresses" && (
            <Card>
              <CardHeader><CardTitle>Saved addresses</CardTitle></CardHeader>
              <CardContent>
                {profile.addresses.length ? (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {profile.addresses.map((address) => (
                      <li key={address.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{address.label || address.name}</p>
                          {address.isDefault && <span className="rounded-full bg-brand-olive/10 px-2 py-1 text-[10px] font-medium text-brand-olive">Default</span>}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{address.address}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[address.area, address.city].filter(Boolean).join(", ")}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">{address.phone}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">Addresses from your orders will be saved here.</p>
                    <Button asChild variant="outline" className="mt-4"><Link href="/shop">Explore the shop</Link></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "orders" && (
            <Card>
              <CardHeader><CardTitle>My orders</CardTitle></CardHeader>
              <CardContent>
                <OrderList orders={orders} loading={ordersLoading} error={ordersError} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

export function OrderList({
  orders,
  loading,
  error,
}: {
  orders: CustomerOrder[];
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading your orders" className="space-y-4 py-2">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border-b py-4">
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return <p role="alert" className="py-6 text-sm text-destructive">{error}</p>;
  }
  if (orders.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">You have not placed an order yet.</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/shop">Find something thoughtful</Link></Button>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {orders.map((order) => (
          <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div>
              <Link href={`/account/orders/${order.orderNumber}`} className="font-semibold text-brand-olive hover:underline">
                {order.orderNumber}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-medium">{formatPKR(order.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{order.status}</p>
            </div>
          </li>
        ))}
      </ul>
      {orders.length >= 50 && (
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          Showing the latest 50 orders.
        </p>
      )}
    </>
  );
}
