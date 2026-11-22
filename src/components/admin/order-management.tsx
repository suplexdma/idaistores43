"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Package, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"] as const;
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Refunded"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
type OrderItem = { name: string; quantity: number; variantName: string; unitPrice: number; image: string; sku: string; barcode: string };
type StatusEvent = { status: string; timestamp?: string; note: string };
type AdminOrder = {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  city: string;
  customerNotes: string;
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  deliveryCharge: number;
  deliveryCharges: number;
  total: number;
  status: OrderStatus;
  returnedAt: string | null;
  source: string;
  internalNotes: string;
  createdAt: string;
  deliveryCompanyId: string;
  deliveryCompany: string;
  deliveryDate: string | null;
  estimatedArrival: string | null;
  trackingNumber: string;
  paymentStatus: PaymentStatus | "Partially Paid";
  amountReceived: number;
  balanceAmount: number;
  statusHistory: StatusEvent[];
};
type DeliveryCompany = { _id: string; name: string; trackingUrlTemplate: string; active: boolean };

const money = (amount: number) => `PKR ${amount.toLocaleString("en-PK")}`;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" })
    .format(new Date(value));
const dateInputValue = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";

const statusStyle: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-emerald-100 text-emerald-800",
  Shipped: "bg-sky-100 text-sky-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
  Returned: "bg-purple-100 text-purple-800",
};

async function responseError(response: Response, fallback: string) {
  const result = await response.json() as { error?: string | { message?: string }[] };
  if (response.ok) return result;
  const detail = typeof result.error === "string"
    ? result.error
    : result.error?.map((entry) => entry.message).filter(Boolean).join(" ");
  throw new Error(detail || fallback);
}

export function OrderManagement({ canEdit }: { canEdit: boolean }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusDraft, setStatusDraft] = useState<OrderStatus>("Pending");
  const [paymentDraft, setPaymentDraft] = useState<PaymentStatus>("Pending");
  const [amountReceivedDraft, setAmountReceivedDraft] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (sourceFilter) params.set("source", sourceFilter);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const response = await fetch(`/api/admin/orders?${params}`, { signal });
      const result = await responseError(response, "Unable to load orders.") as { orders?: AdminOrder[] };
      const nextOrders = result.orders ?? [];
      setOrders(nextOrders);
      setSelectedId((current) => nextOrders.some((order) => order.id === current) ? current : nextOrders[0]?.id ?? "");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/delivery-companies")
      .then((response) => responseError(response, "Unable to load delivery companies."))
      .then((result) => {
        if (active) setCompanies((result as { companies?: DeliveryCompany[] }).companies ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load delivery companies.");
      });
    return () => { active = false; };
  }, []);

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;
  useEffect(() => {
    if (!selectedOrder) return;
    setStatusDraft(selectedOrder.status);
    setPaymentDraft(selectedOrder.paymentStatus === "Partially Paid" ? "Partial" : selectedOrder.paymentStatus);
    setAmountReceivedDraft(String(selectedOrder.amountReceived));
  }, [selectedOrder]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      [order.orderNumber, order.customer, order.phone, order.email].some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [orders, search]);

  function updateSelected(updates: Partial<AdminOrder>) {
    if (!selectedOrder) return;
    setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, ...updates } : order));
  }

  async function saveTrackingDetails() {
    if (!selectedOrder || !canEdit) return;
    setSaving(true);
    setError("");
    const company = companies.find((entry) => entry._id === selectedOrder.deliveryCompanyId);
    const enteredAmount = Number(amountReceivedDraft);
    const finalPayable = selectedOrder.total + selectedOrder.deliveryCharges;
    const amountReceived = paymentDraft === "Paid" ? finalPayable : paymentDraft === "Pending" || paymentDraft === "Refunded" ? 0 : enteredAmount;
    const payload = {
      deliveryCompanyId: selectedOrder.deliveryCompanyId || null,
      deliveryCompany: company?.name ?? selectedOrder.deliveryCompany,
      trackingNumber: selectedOrder.trackingNumber,
      deliveryDate: selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toISOString() : null,
      estimatedArrival: selectedOrder.estimatedArrival ? new Date(selectedOrder.estimatedArrival).toISOString() : null,
      deliveryCharges: Number(selectedOrder.deliveryCharges),
      paymentStatus: paymentDraft,
      amountReceived,
      internalNotes: selectedOrder.internalNotes,
      shippingAddress: {
        name: selectedOrder.customer,
        phone: selectedOrder.phone,
        address: selectedOrder.address,
        area: selectedOrder.area,
        city: selectedOrder.city,
      },
    };
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(selectedOrder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await responseError(response, "Unable to save tracking details.");
      updateSelected({
        deliveryCompany: payload.deliveryCompany,
        amountReceived,
        balanceAmount: Math.max(0, finalPayable - amountReceived),
        paymentStatus: paymentDraft,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save tracking details.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus() {
    if (!selectedOrder || !canEdit) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(selectedOrder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusDraft }),
      });
      const result = await responseError(response, "Unable to update order status.") as { order?: { returnedAt: string | null } };
      updateSelected({ status: statusDraft, returnedAt: result.order?.returnedAt ?? selectedOrder.returnedAt });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update order status.");
      setStatusDraft(selectedOrder.status);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder() {
    if (!selectedOrder || !canEdit || !window.confirm(`Move order ${selectedOrder.orderNumber} to Trash?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(selectedOrder.id)}`, { method: "DELETE" });
      await responseError(response, "Unable to move order to Trash.");
      const remaining = orders.filter((order) => order.id !== selectedOrder.id);
      setOrders(remaining);
      setSelectedId(remaining[0]?.id ?? "");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to move order to Trash.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-brand-olive">Order operations</p>
        <h1 className="mt-1 text-3xl font-semibold">Manage Orders</h1>
      </header>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="grid min-h-[680px] items-start gap-5 xl:grid-cols-[minmax(290px,0.8fr)_minmax(0,1.8fr)]">
        <aside className="overflow-hidden rounded-xl border bg-card shadow-sm print:hidden">
          <div className="space-y-3 border-b p-4">
            <h2 className="font-semibold">Orders <span className="text-sm font-normal text-muted-foreground">({visibleOrders.length})</span></h2>
            <label className="relative block">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or customer" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="h-9 min-w-0 rounded-md border bg-background px-2 text-xs">
                <option value="">All sources</option><option>Website</option><option>WhatsApp</option><option value="AI Generated">AI Generated</option><option>POS</option>
              </select>
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 min-w-0 rounded-md border bg-background px-2 text-xs">
                <option value="">All statuses</option>{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          </div>
          <div className="max-h-[740px] overflow-y-auto p-2">
            {loading ? <p role="status" className="p-6 text-center text-sm text-muted-foreground">Loading orders…</p>
              : visibleOrders.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No matching orders.</p>
                : visibleOrders.map((order) => (
                  <button type="button" key={order.id} onClick={() => setSelectedId(order.id)} aria-pressed={selectedId === order.id}
                    className={`mb-1 w-full rounded-lg border p-3 text-left transition ${selectedId === order.id ? "border-brand-olive bg-brand-olive/5 ring-1 ring-brand-olive/20" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{order.orderNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle[order.status]}`}>{order.status}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm">{order.customer}</span>
                    <span className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{dateLabel(order.createdAt)}</span><span className="font-medium text-foreground">{money(order.total + order.deliveryCharges)}</span>
                    </span>
                  </button>
                ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border bg-card shadow-sm">
          {!selectedOrder ? <div className="grid min-h-[500px] place-items-center p-8 text-center text-sm text-muted-foreground">Select an order to view details.</div> : (
            <div className="space-y-6 p-4 sm:p-6 print:p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-olive">Order details</p>
                  <h2 className="mt-1 text-2xl font-semibold">#{selectedOrder.orderNumber}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{dateLabel(selectedOrder.createdAt)} · {selectedOrder.source}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusStyle[selectedOrder.status]}`}>{selectedOrder.status}</span>
              </div>

              <section className="grid gap-4 rounded-lg bg-muted/30 p-4 sm:grid-cols-2">
                <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</h3>
                  <p className="font-semibold">{selectedOrder.customer}</p>
                  <a href={`tel:${selectedOrder.phone}`} className="text-sm text-brand-olive hover:underline">{selectedOrder.phone}</a>
                  {selectedOrder.email && <p className="text-sm text-muted-foreground">{selectedOrder.email}</p>}
                </div>
                <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping address</h3>
                  <p className="whitespace-pre-line text-sm">{[selectedOrder.address, selectedOrder.area, selectedOrder.city].filter(Boolean).join(", ")}</p>
                  {selectedOrder.customerNotes && <p className="mt-2 text-xs text-muted-foreground">Customer note: {selectedOrder.customerNotes}</p>}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-semibold">Order summary</h3>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
                  <div className="divide-y rounded-lg border">
                    {selectedOrder.items.map((item, index) => (
                      <div key={`${item.name}-${item.variantName}-${index}`} className="flex justify-between gap-4 p-3 text-sm">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                            {item.image
                              ? <Image src={item.image} alt={item.name} width={48} height={48} unoptimized className="size-full object-cover" />
                              : <Package aria-hidden="true" className="size-5 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{item.name}{item.variantName ? ` · ${item.variantName}` : ""}</p>
                            <p className="text-xs text-muted-foreground">{item.quantity} × {money(item.unitPrice)}</p>
                            <p className="mt-1 break-all text-[10px] leading-4 text-muted-foreground">
                              SKU: {item.sku || "—"} <span className="mx-1">·</span> Barcode: {item.barcode || "—"}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 font-medium">{money(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 rounded-lg border p-4 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(selectedOrder.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discounts</span><span>{money(0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Delivery charges</span><span>{selectedOrder.deliveryCharge + selectedOrder.deliveryCharges ? money(selectedOrder.deliveryCharge + selectedOrder.deliveryCharges) : "Free"}</span></div>
                    <div className="flex justify-between border-t pt-2 font-semibold"><span>Total amount</span><span>{money(selectedOrder.total + selectedOrder.deliveryCharges)}</span></div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border p-4">
                <div><h3 className="font-semibold">Delivery & tracking</h3><p className="mt-1 text-xs text-muted-foreground">Save courier, tracking and delivery payment details.</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium">Delivery company
                    <select disabled={!canEdit} value={selectedOrder.deliveryCompanyId} onChange={(event) => {
                      const company = companies.find((entry) => entry._id === event.target.value);
                      updateSelected({ deliveryCompanyId: event.target.value, deliveryCompany: company?.name ?? "" });
                    }} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal">
                      <option value="">Select a company</option>
                      {selectedOrder.deliveryCompany && !companies.some((company) => company._id === selectedOrder.deliveryCompanyId) && <option value={selectedOrder.deliveryCompanyId}>{selectedOrder.deliveryCompany} (legacy)</option>}
                      {companies.filter((company) => company.active).map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium">Tracking number
                    <input disabled={!canEdit} value={selectedOrder.trackingNumber} onChange={(event) => updateSelected({ trackingNumber: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" placeholder="Enter tracking number" />
                  </label>
                  <label className="space-y-1 text-xs font-medium">Delivery date
                    <input disabled={!canEdit} type="datetime-local" value={dateInputValue(selectedOrder.deliveryDate)} onChange={(event) => updateSelected({ deliveryDate: event.target.value ? new Date(event.target.value).toISOString() : null })} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" />
                  </label>
                  <label className="space-y-1 text-xs font-medium">Estimated arrival
                    <input disabled={!canEdit} type="datetime-local" value={dateInputValue(selectedOrder.estimatedArrival)} onChange={(event) => updateSelected({ estimatedArrival: event.target.value ? new Date(event.target.value).toISOString() : null })} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" />
                  </label>
                  <label className="space-y-1 text-xs font-medium">Additional delivery charges
                    <input disabled={!canEdit} type="number" min="0" step="0.01" value={selectedOrder.deliveryCharges} onChange={(event) => updateSelected({ deliveryCharges: Number(event.target.value) })} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" />
                  </label>
                  <label className="space-y-1 text-xs font-medium">Payment status
                    <select disabled={!canEdit} value={paymentDraft} onChange={(event) => setPaymentDraft(event.target.value as PaymentStatus)} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal">
                      {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status === "Pending" ? "COD Pending" : status}</option>)}
                    </select>
                  </label>
                  {paymentDraft === "Partial" && <label className="space-y-1 text-xs font-medium sm:col-span-2">Amount received
                    <input disabled={!canEdit} type="number" min="0" max={selectedOrder.total + selectedOrder.deliveryCharges} step="0.01" value={amountReceivedDraft} onChange={(event) => setAmountReceivedDraft(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" />
                  </label>}
                  <label className="space-y-1 text-xs font-medium sm:col-span-2">Internal notes
                    <textarea disabled={!canEdit} rows={3} maxLength={2000} value={selectedOrder.internalNotes} onChange={(event) => updateSelected({ internalNotes: event.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm font-normal" placeholder="Private staff notes" />
                  </label>
                </div>
                {canEdit && <Button onClick={() => void saveTrackingDetails()} disabled={saving}>{saving ? "Saving…" : "Save Tracking Details"}</Button>}
              </section>

              <section className="rounded-lg border border-brand-olive/30 bg-brand-olive/5 p-4">
                <h3 className="text-sm font-semibold">Final payable amount</h3>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{money(selectedOrder.total)} Order Total + {money(selectedOrder.deliveryCharges)} Delivery Charges</span>
                  <strong className="text-xl">{money(selectedOrder.total + selectedOrder.deliveryCharges)}</strong>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Received {money(selectedOrder.amountReceived)} · Balance {money(Math.max(0, selectedOrder.total + selectedOrder.deliveryCharges - selectedOrder.amountReceived))}</p>
              </section>

              {selectedOrder.statusHistory.length > 0 && <section>
                <h3 className="mb-2 text-sm font-semibold">Status history</h3>
                <ol className="space-y-2 border-l pl-4 text-xs text-muted-foreground">
                  {selectedOrder.statusHistory.map((event, index) => <li key={`${event.timestamp ?? event.status}-${index}`}><span className="font-medium text-foreground">{event.status}</span>{event.timestamp ? ` · ${dateLabel(event.timestamp)}` : ""}{event.note ? ` · ${event.note}` : ""}</li>)}
                </ol>
              </section>}

              <footer className="flex flex-wrap items-center gap-2 border-t pt-4 print:hidden">
                <select aria-label="New order status" disabled={!canEdit} value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as OrderStatus)} className="h-10 rounded-md border bg-background px-3 text-sm">
                  {ORDER_STATUSES.map((status) => <option key={status} value={status} disabled={status === "Returned" && !["Confirmed", "Shipped", "Delivered", "Returned"].includes(selectedOrder.status)}>{status}</option>)}
                </select>
                {canEdit && <Button onClick={() => void updateStatus()} disabled={saving || statusDraft === selectedOrder.status}>Update Status</Button>}
                <Button variant="outline" onClick={() => window.print()}><Printer aria-hidden="true" className="mr-2 size-4" />Print Invoice</Button>
                {canEdit && <Button variant="outline" className="ml-auto text-destructive" onClick={() => void deleteOrder()} disabled={saving}><Trash2 aria-hidden="true" className="mr-2 size-4" />Delete Order</Button>}
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
