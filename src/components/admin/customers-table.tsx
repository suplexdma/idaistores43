"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
  lastLoginAt: string | null;
  offlineMilliseconds: number;
  orderCount: number;
  totalSpent: number;
};
type Segment = "all" | "new" | "old" | "regular";

function formatDuration(milliseconds: number) {
  const days = Math.floor(milliseconds / 86_400_000);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(milliseconds / 3_600_000);
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.floor(milliseconds / 60_000)} minutes`;
}

function formatPKT(value: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(value)) + " PKT";
}

export function CustomersTable({ canEdit = true }: { canEdit?: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [segment, setSegment] = useState<Segment>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [editValues, setEditValues] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const loadCustomers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/customers?segment=${segment}`, { signal });
      const data = (await response.json()) as { customers?: Customer[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load customers.");
      setCustomers(data.customers ?? []);
      setSelectedIds([]);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load customers.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [segment]);

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter((selectedId) => selectedId !== id));
  }

  function openEditor(customer: Customer) {
    setEditing(customer);
    setEditValues({ name: customer.name, email: customer.email, phone: customer.phone });
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...editValues }),
      });
      const data = await response.json() as { error?: string; customer?: Pick<Customer, "id" | "name" | "email" | "phone"> };
      if (!response.ok || !data.customer) throw new Error(data.error ?? "Unable to update customer.");
      setCustomers((current) => current.map((customer) =>
        customer.id === editing.id ? { ...customer, ...data.customer } : customer,
      ));
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update customer.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomers(ids: string[]) {
    if (busy || ids.length === 0) return;
    const message = ids.length === 1
      ? "Delete this customer account? Accounts with order history cannot be deleted."
      : `Delete ${ids.length} selected customer accounts? Accounts with order history cannot be deleted.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json() as { error?: string; deletedCount?: number };
      if (!response.ok) throw new Error(data.error ?? "Unable to delete customers.");
      setSelectedIds([]);
      await loadCustomers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete customers.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadCustomers(controller.signal);
    return () => controller.abort();
  }, [loadCustomers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-brand-olive">Store management</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-2 text-muted-foreground">Registered accounts, activity and order history.</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Filter customers by activity</span>
          <select value={segment} onChange={(event) => setSegment(event.target.value as Segment)} className="h-10 rounded-md border border-input bg-background px-3">
            <option value="all">All customers</option>
            <option value="new">New · registered in last 30 days</option>
            <option value="regular">Regular · recently active</option>
            <option value="old">Old · inactive over 30 days</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {canEdit && selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-white p-3">
          <span className="text-sm">{selectedIds.length} customer{selectedIds.length === 1 ? "" : "s"} selected</span>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void deleteCustomers(selectedIds)}>
            <Trash2 aria-hidden="true" className="mr-2 size-4" /> Delete selected
          </Button>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>{customers.length} customer{customers.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading customers...</p> : customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No customers match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  {canEdit && <th className="px-3 py-3">
                    <Checkbox
                      aria-label="Select all visible customers"
                      checked={customers.length > 0 && customers.every((customer) => selectedIds.includes(customer.id))}
                      onCheckedChange={(checked) => setSelectedIds(checked === true ? customers.map((customer) => customer.id) : [])}
                    />
                  </th>}
                  <th className="px-3 py-3">Customer</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Registered</th><th className="px-3 py-3">Last login / offline</th><th className="px-3 py-3">Orders</th><th className="px-3 py-3">Total spent</th>
                  {canEdit && <th className="px-3 py-3">Actions</th>}
                </tr></thead>
                <tbody className="divide-y">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      {canEdit && <td className="px-3 py-4">
                        <Checkbox
                          aria-label={`Select ${customer.name}`}
                          checked={selectedIds.includes(customer.id)}
                          onCheckedChange={(checked) => toggleSelected(customer.id, checked === true)}
                        />
                      </td>}
                      <td className="px-3 py-4"><p className="font-medium">{customer.name}</p><a className="text-xs text-muted-foreground hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a></td>
                      <td className="px-3 py-4">{customer.phone}</td>
                      <td className="px-3 py-4">{formatPKT(customer.registeredAt)}</td>
                      <td className="px-3 py-4">{customer.lastLoginAt ? <><p>{formatPKT(customer.lastLoginAt)}</p><p className="mt-1 text-xs text-muted-foreground">Offline for {formatDuration(customer.offlineMilliseconds)}</p></> : <><p>Never logged in</p><p className="mt-1 text-xs text-muted-foreground">Registered {formatDuration(customer.offlineMilliseconds)} ago</p></>}</td>
                      <td className="px-3 py-4">{customer.orderCount.toLocaleString("en-PK")}</td>
                      <td className="px-3 py-4 font-medium">PKR {customer.totalSpent.toLocaleString("en-PK")}</td>
                      {canEdit && <td className="px-3 py-4">
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${customer.name}`} disabled={busy} onClick={() => openEditor(customer)}>
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${customer.name}`} disabled={busy} onClick={() => void deleteCustomers([customer.id])}>
                            <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {canEdit && <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !busy) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Update the customer account name, email and phone.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveCustomer(event)} className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              Name
              <Input required minLength={2} maxLength={100} value={editValues.name} onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Email
              <Input required type="email" maxLength={254} value={editValues.email} onChange={(event) => setEditValues((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Phone
              <Input required minLength={7} maxLength={20} value={editValues.phone} onChange={(event) => setEditValues((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save customer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
