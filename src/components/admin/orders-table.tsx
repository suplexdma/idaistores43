"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RETURN_DELIVERY_LOSS_PKR } from "@/lib/order-return";

const ORDER_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];
type OrderSource = "Website" | "WhatsApp" | "AI" | "AI Generated" | "POS";
type AdminOrder = {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  email: string;
  customerNotes: string;
  items: Array<{ name: string; quantity: number; variantName: string }>;
  itemCount: number;
  total: number;
  status: OrderStatus;
  returnedAt: string | null;
  source: OrderSource;
  internalNotes: string;
  createdAt: string;
};

const statusClassNames: Record<OrderStatus, string> = {
  Pending: "border-amber-200 bg-amber-100 text-amber-800",
  Confirmed: "border-green-200 bg-green-100 text-green-800",
  Shipped: "border-sky-200 bg-sky-100 text-sky-800",
  Delivered: "border-green-200 bg-green-100 text-green-800",
  Cancelled: "border-red-200 bg-red-100 text-red-800",
  Returned: "border-purple-200 bg-purple-100 text-purple-800",
};
const statusRowClassNames: Record<OrderStatus, string> = {
  Pending: "bg-amber-50/30",
  Confirmed: "bg-green-50/30",
  Shipped: "bg-sky-50/30",
  Delivered: "bg-green-50/30",
  Cancelled: "bg-red-50/40",
  Returned: "bg-purple-50/50",
};

const orderDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(new Date(value));

export function OrdersTable({ canEdit }: { canEdit: boolean }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [editingId, setEditingId] = useState("");

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (status) params.set("status", status);
    try {
      const response = await fetch(`/api/admin/orders?${params.toString()}`, { signal });
      const result = (await response.json()) as { orders?: AdminOrder[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load orders.");
      setOrders(result.orders ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [source, status]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders]);

  function updateOrder(id: string, updates: Partial<Pick<AdminOrder, "status" | "internalNotes" | "returnedAt">>) {
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, ...updates } : order)),
    );
  }

  async function updateOrderStatus(order: AdminOrder, nextStatus: OrderStatus) {
    if (nextStatus === order.status) return;
    setSavingId(order.id);
    setError("");
    updateOrder(order.id, { status: nextStatus });
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json() as {
        order?: { status: OrderStatus; returnedAt: string | null };
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error ?? "Unable to update order status.");
      }
      updateOrder(order.id, result.order);
    } catch (statusError) {
      updateOrder(order.id, { status: order.status, returnedAt: order.returnedAt });
      setError(statusError instanceof Error ? statusError.message : "Unable to update order status.");
    } finally {
      setSavingId("");
    }
  }

  async function saveOrder(order: AdminOrder) {
    setSavingId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: order.status, internalNotes: order.internalNotes }),
      });
      const result = (await response.json()) as {
        order?: { status: OrderStatus; internalNotes: string; returnedAt: string | null };
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error ?? "Unable to save this order.");
      }
      updateOrder(order.id, result.order);
      setEditingId("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this order.");
    } finally {
      setSavingId("");
    }
  }

  async function deleteOrder(order: AdminOrder) {
    if (!window.confirm(`Move order ${order.orderNumber} to Trash?`)) return;
    setSavingId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(order.id)}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to move order to Trash.");
      setOrders((current) => current.filter((entry) => entry.id !== order.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to move order to Trash.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Orders</CardTitle>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="sr-only">Filter by source</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="">All sources</option>
              <option value="Website">Website</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="AI Generated">AI Generated</option>
              <option value="POS">POS</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <div role="status" aria-label="Loading orders" className="space-y-3 py-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid gap-3 rounded-md border p-4 sm:grid-cols-5">
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order / Customer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Products / Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer message</TableHead>
                <TableHead>Internal notes</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className={`align-top ${statusRowClassNames[order.status]}`}
                >
                  <TableCell className="min-w-52">
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="mt-1">{order.customer}</p>
                    <a className="text-xs text-muted-foreground hover:underline" href={`tel:${order.phone}`}>{order.phone}</a>
                    <p className="mt-2 text-xs text-muted-foreground">Ordered: {orderDateTime(order.createdAt)}</p>
                    {order.status === "Returned" && order.returnedAt && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-purple-800">Returned: {orderDateTime(order.returnedAt)}</p>
                        <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                          -PKR {RETURN_DELIVERY_LOSS_PKR.toLocaleString("en-PK")} delivery loss
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{order.source === "AI" || order.source === "AI Generated" ? "AI Generated" : order.source}</TableCell>
                  <TableCell className="min-w-52">
                    <ul className="space-y-1.5">
                      {order.items.map((item, index) => (
                        <li key={`${item.name}-${item.variantName}-${index}`} className="text-sm">
                          <span className="font-medium">{item.name}</span>
                          {item.variantName && <span className="text-muted-foreground"> · {item.variantName}</span>}
                          <span className="ml-1 text-muted-foreground">× {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 font-semibold">PKR {order.total.toLocaleString("en-PK")}</p>
                  </TableCell>
                  <TableCell>
                    <label className="sr-only" htmlFor={`status-${order.id}`}>Status for {order.orderNumber}</label>
                    <select
                      id={`status-${order.id}`}
                      value={order.status}
                      onChange={(event) => void updateOrderStatus(order, event.target.value as OrderStatus)}
                      className={`h-9 rounded-md border px-2 text-sm font-medium ${statusClassNames[order.status]}`}
                      disabled={!canEdit || editingId !== order.id || savingId === order.id}
                    >
                      {ORDER_STATUSES.map((value) => (
                        <option
                          key={value}
                          value={value}
                          disabled={
                            value === "Returned" &&
                            !["Confirmed", "Shipped", "Delivered", "Returned"].includes(order.status)
                          }
                        >
                          {value}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="min-w-52">
                    {order.customerNotes ? (
                      <p className="max-w-64 whitespace-pre-wrap break-words text-sm text-brand-charcoal">{order.customerNotes}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground">No message</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-52">
                    <label className="sr-only" htmlFor={`notes-${order.id}`}>Internal notes for {order.orderNumber}</label>
                    <textarea
                      id={`notes-${order.id}`}
                      value={order.internalNotes}
                      maxLength={2000}
                      rows={2}
                      onChange={(event) => updateOrder(order.id, { internalNotes: event.target.value })}
                      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Private staff notes"
                      disabled={!canEdit || editingId !== order.id}
                    />
                  </TableCell>
                  <TableCell className="space-y-2">
                    {!canEdit ? null : editingId === order.id ? (
                      <>
                        <Button size="sm" onClick={() => void saveOrder(order)} disabled={savingId === order.id}>
                          {savingId === order.id ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingId("");
                          void loadOrders();
                        }} disabled={savingId === order.id}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(order.id)}>
                          Edit Order
                        </Button>
                        <Button size="sm" variant="ghost" disabled={savingId === order.id} onClick={() => void deleteOrder(order)}>
                          <Trash2 aria-hidden="true" className="mr-2 size-4 text-destructive" />Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
