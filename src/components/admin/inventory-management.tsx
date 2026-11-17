"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, Save, ShoppingCart } from "lucide-react";

type Supplier = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
};
type Product = {
  _id: string;
  name: string;
  sku?: string;
  price: number;
  salePrice?: number;
  compareAtPrice?: number;
  stock: number;
  variants: Array<{ name: string; stock: number; price?: number; salePrice?: number }>;
};
type LedgerEntry = {
  _id: string;
  movementDate?: string;
  productId: Product | null;
  quantityChanged: number;
  remainingStock?: number;
  variantName?: string;
  reason: string;
  source: string;
  createdAt: string;
};
type Invoice = {
  _id: string;
  supplierName: string;
  productName: string;
  variantName?: string;
  invoiceNumber: string;
  purchaseDate: string;
  quantity: number;
  purchasePrice: number;
  totalCost: number;
};

const fieldClass = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-olive/15";
const labelClass = "mb-1.5 block text-xs font-medium text-muted-foreground";
const cardClass = "rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm sm:p-6";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-olive px-4 text-sm font-semibold text-white transition hover:bg-brand-olive/90 disabled:cursor-not-allowed disabled:opacity-60";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string | Array<{ message?: string }> };
  if (!response.ok) {
    const message = Array.isArray(data.error)
      ? data.error.map((issue) => issue.message).filter(Boolean).join(" ")
      : data.error;
    throw new Error(message || "The request could not be completed.");
  }
  return data;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-olive">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-charcoal">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (success) return <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>;
  return null;
}

export function PurchaseInvoicesManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantName, setVariantName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const [supplierData, productData, invoiceData] = await Promise.all([
        requestJson<{ suppliers: Supplier[] }>("/api/admin/suppliers"),
        requestJson<{ products?: Product[]; pagination?: { pages: number } }>("/api/products?limit=100"),
        requestJson<{ invoices: Invoice[] }>("/api/admin/purchase-invoices"),
      ]);
      setSuppliers(supplierData.suppliers.filter((supplier) => supplier.active));
      setProducts(productData.products ?? []);
      setInvoices(invoiceData.invoices);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory data.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selectedProduct = products.find((product) => product._id === productId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await requestJson("/api/admin/purchase-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          productId,
          ...(variantName ? { variantName } : {}),
          purchaseDate,
          invoiceNumber,
          quantity: Number(quantity),
          purchasePrice: Number(purchasePrice),
        }),
      });
      setSuccess("Purchase invoice saved. Stock and cost price have been updated.");
      setInvoiceNumber("");
      setQuantity("1");
      setPurchasePrice("");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeading eyebrow="Inventory" title="Purchase invoices" description="Record supplier invoices and update on-hand stock and product cost in one step." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={(event) => void submit(event)} className={`${cardClass} space-y-4`}>
          <h2 className="text-lg font-semibold">New invoice</h2>
          <Feedback error={error} success={success} />
          <label><span className={labelClass}>Supplier</span><select className={fieldClass} required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Select a supplier</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Purchase date</span><input className={fieldClass} type="date" required value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
            <label><span className={labelClass}>Invoice number</span><input className={fieldClass} required maxLength={80} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="e.g. INV-1042" /></label>
          </div>
          <label><span className={labelClass}>Product</span><select className={fieldClass} required value={productId} onChange={(event) => { setProductId(event.target.value); setVariantName(""); }}><option value="">Select a product</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select></label>
          {selectedProduct?.variants.length ? <label><span className={labelClass}>Product option</span><select className={fieldClass} required value={variantName} onChange={(event) => setVariantName(event.target.value)}><option value="">Select an option</option>{selectedProduct.variants.map((variant) => <option key={variant.name} value={variant.name}>{variant.name} · {variant.stock} in stock</option>)}</select></label> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Quantity</span><input className={fieldClass} type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label><span className={labelClass}>Unit purchase price (PKR)</span><input className={fieldClass} type="number" min="0" step="0.01" required value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} /></label>
          </div>
          <button className={buttonClass} type="submit" disabled={busy || !suppliers.length || !products.length}><Save className="size-4" />{busy ? "Saving invoice…" : "Save invoice & receive stock"}</button>
          {!suppliers.length && <p className="text-xs text-amber-700">Add a supplier before creating an invoice.</p>}
        </form>

        <section className={`${cardClass} min-w-0`}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Recent purchases</h2><p className="mt-1 text-xs text-muted-foreground">Latest 250 recorded invoices</p></div><span className="rounded-xl bg-brand-olive/10 p-2.5 text-brand-olive"><ShoppingCart className="size-5" /></span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4">Invoice</th><th className="py-3 pr-4">Product</th><th className="py-3 pr-4">Supplier</th><th className="py-3 pr-4">Qty</th><th className="py-3 pr-4">Total</th><th className="py-3">Date</th></tr></thead>
              <tbody className="divide-y divide-border">{invoices.map((invoice) => <tr key={invoice._id}><td className="py-3 pr-4 font-medium">{invoice.invoiceNumber}</td><td className="py-3 pr-4">{invoice.productName}{invoice.variantName ? ` · ${invoice.variantName}` : ""}</td><td className="py-3 pr-4">{invoice.supplierName}</td><td className="py-3 pr-4">{invoice.quantity}</td><td className="py-3 pr-4">PKR {invoice.totalCost.toLocaleString("en-PK")}</td><td className="py-3">{new Date(invoice.purchaseDate).toLocaleDateString("en-PK")}</td></tr>)}</tbody>
            </table>
            {!invoices.length && <p className="py-10 text-center text-sm text-muted-foreground">No purchase invoices recorded yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ suppliers: Supplier[] }>("/api/admin/suppliers");
      setSuppliers(data.suppliers);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load suppliers."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      await requestJson(editingId ? `/api/admin/suppliers/${editingId}` : "/api/admin/suppliers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess(editingId ? "Supplier updated." : "Supplier added.");
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
      setEditingId("");
      await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to save supplier."); }
    finally { setBusy(false); }
  }

  function edit(supplier: Supplier) {
    setEditingId(supplier._id);
    setForm({ name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address, notes: supplier.notes });
    setSuccess(""); setError("");
  }

  async function toggleActive(supplier: Supplier) {
    setError(""); setSuccess("");
    try {
      await requestJson(`/api/admin/suppliers/${supplier._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...supplier, active: !supplier.active }),
      });
      setSuccess(supplier.active ? "Supplier deactivated." : "Supplier reactivated.");
      await load();
    } catch (toggleError) { setError(toggleError instanceof Error ? toggleError.message : "Unable to update supplier."); }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeading eyebrow="Inventory" title="Supplier management" description="Keep supplier contacts current and ready for your next purchase." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={(event) => void submit(event)} className={`${cardClass} space-y-4`}>
          <h2 className="text-lg font-semibold">{editingId ? "Edit supplier" : "Add supplier"}</h2><Feedback error={error} success={success} />
          {(["name", "phone", "email", "address", "notes"] as const).map((field) => <label key={field}><span className={labelClass}>{field === "name" ? "Supplier name" : field[0].toUpperCase() + field.slice(1)}</span><input className={fieldClass} required={field === "name"} type={field === "email" ? "email" : "text"} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
          <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} type="submit"><Save className="size-4" />{busy ? "Saving…" : editingId ? "Save changes" : "Add supplier"}</button>{editingId && <button className="h-11 rounded-xl border px-4 text-sm" type="button" onClick={() => { setEditingId(""); setForm({ name: "", phone: "", email: "", address: "", notes: "" }); }}>Cancel</button>}</div>
        </form>
        <section className={`${cardClass} min-w-0`}>
          <h2 className="mb-4 text-lg font-semibold">Suppliers <span className="ml-1 text-sm font-normal text-muted-foreground">{suppliers.length}</span></h2>
          <div className="space-y-3">{suppliers.map((supplier) => <article key={supplier._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{supplier.name}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{[supplier.phone, supplier.email].filter(Boolean).join(" · ") || "No contact details"}</p><p className={`mt-1 text-[11px] ${supplier.active ? "text-emerald-700" : "text-muted-foreground"}`}>{supplier.active ? "Active" : "Inactive"}</p></div><button type="button" className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted" onClick={() => edit(supplier)}>Edit</button><button type="button" className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted" onClick={() => void toggleActive(supplier)}>{supplier.active ? "Deactivate" : "Reactivate"}</button></article>)}{!suppliers.length && <p className="py-12 text-center text-sm text-muted-foreground">No suppliers yet. Add your first supplier to get started.</p>}</div>
        </section>
      </div>
    </div>
  );
}

export function StockLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    void requestJson<{ entries: LedgerEntry[]; pagination: { pages: number; total: number } }>(`/api/admin/stock-ledger?page=${page}&limit=50`)
      .then((data) => { setEntries(data.entries); setPages(data.pagination.pages); setTotal(data.pagination.total); })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load stock ledger."));
  }, [page]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeading eyebrow="Inventory" title="Stock ledger" description="Auditable stock-in and stock-out history across purchase invoices, website orders, AI orders, and POS." />
      <section className={`${cardClass} min-w-0`}><Feedback error={error} success="" /><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Product / option</th><th className="py-3 pr-4">Movement</th><th className="py-3 pr-4">Remaining</th><th className="py-3 pr-4">Source</th><th className="py-3">Reference</th></tr></thead><tbody className="divide-y divide-border">{entries.map((entry) => <tr key={entry._id}><td className="whitespace-nowrap py-3 pr-4">{new Date(entry.movementDate ?? entry.createdAt).toLocaleString("en-PK")}</td><td className="py-3 pr-4 font-medium">{entry.productId?.name ?? "Deleted product"}{entry.variantName ? <span className="font-normal text-muted-foreground"> · {entry.variantName}</span> : null}</td><td className={`py-3 pr-4 font-semibold ${entry.quantityChanged > 0 ? "text-emerald-700" : "text-red-700"}`}>{entry.quantityChanged > 0 ? "Stock in" : "Stock out"} · {entry.quantityChanged > 0 ? "+" : ""}{entry.quantityChanged}</td><td className="py-3 pr-4">{entry.remainingStock ?? "—"}</td><td className="py-3 pr-4">{entry.source}</td><td className="max-w-[240px] truncate py-3" title={entry.reason}>{entry.reason}</td></tr>)}</tbody></table>{!entries.length && !error && <p className="py-12 text-center text-sm text-muted-foreground">No inventory movements recorded yet.</p>}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{total.toLocaleString("en-PK")} total movements · all pages available</span>{pages > 1 && <div className="flex items-center gap-3"><button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}</div></section>
    </div>
  );
}

export function PointOfSale() {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Array<{ productId: string; variantName: string; quantity: string }>>([{ productId: "", variantName: "", quantity: "1" }]);
  const [customer, setCustomer] = useState({ name: "Walk-in customer", phone: "0000000000", notes: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void requestJson<{ products?: Product[] }>("/api/products?limit=100")
      .then((data) => setProducts(data.products ?? []))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load products."));
  }, []);

  const total = items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate._id === item.productId);
    if (!product) return sum;
    const variant = product.variants.find((candidate) => candidate.name === item.variantName);
    const basePrice = product.compareAtPrice != null && product.compareAtPrice > product.price
      ? product.price
      : product.salePrice != null && product.salePrice < product.price ? product.salePrice : product.price;
    const regular = variant?.price ?? basePrice;
    const price = variant?.salePrice != null && variant.salePrice < regular ? variant.salePrice : regular;
    return sum + price * Math.max(0, Number(item.quantity) || 0);
  }, 0);

  function updateItem(index: number, patch: Partial<(typeof items)[number]>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const result = await requestJson<{ orderNumber: string; total: number }>("/api/admin/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, items: items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), ...(item.variantName ? { variantName: item.variantName } : {}) })) }),
      });
      setSuccess(`Sale ${result.orderNumber} recorded · PKR ${result.total.toLocaleString("en-PK")}. Stock has been updated.`);
      setItems([{ productId: "", variantName: "", quantity: "1" }]);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to complete POS sale."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeading eyebrow="Inventory · Shared stock" title="Point of sale" description="Record an in-store sale. Every sale reduces the same stock used by the website." />
      <form onSubmit={(event) => void submit(event)} className={`${cardClass} space-y-5`}>
        <Feedback error={error} success={success} />
        <div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Customer name</span><input className={fieldClass} required minLength={2} value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} /></label><label><span className={labelClass}>Phone</span><input className={fieldClass} required value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} /></label></div>
        <label><span className={labelClass}>Customer message / order note (optional)</span><textarea className={`${fieldClass} h-24 resize-y py-3`} maxLength={1000} value={customer.notes} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} placeholder="Any message from the customer" /></label>
        <div className="space-y-3">{items.map((item, index) => {
          const product = products.find((candidate) => candidate._id === item.productId);
          return <div key={index} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_120px_auto]">
            <label><span className={labelClass}>Product</span><select className={fieldClass} required value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value, variantName: "" })}><option value="">Select product</option>{products.map((option) => <option key={option._id} value={option._id}>{option.name} · {option.variants.length ? option.variants.reduce((sum, variant) => sum + variant.stock, 0) : option.stock} available</option>)}</select></label>
            {product?.variants.length ? <label><span className={labelClass}>Option</span><select className={fieldClass} required value={item.variantName} onChange={(event) => updateItem(index, { variantName: event.target.value })}><option value="">Choose option</option>{product.variants.map((variant) => <option key={variant.name} value={variant.name}>{variant.name} · {variant.stock} available</option>)}</select></label> : <div className="hidden sm:block" />}
            <label><span className={labelClass}>Quantity</span><input className={fieldClass} type="number" min="1" max="100" step="1" required value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></label>
            {items.length > 1 ? <button className="self-end rounded-xl border px-3 py-2 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button> : <div />}
          </div>;
        })}</div>
        <button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted" type="button" onClick={() => setItems((current) => [...current, { productId: "", variantName: "", quantity: "1" }])}><Plus className="size-4" />Add item</button>
        <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-muted-foreground">Total · no delivery charge</p><p className="mt-1 text-2xl font-semibold">PKR {total.toLocaleString("en-PK")}</p></div><button className={buttonClass} type="submit" disabled={busy || !products.length}><ShoppingCart className="size-4" />{busy ? "Recording sale…" : "Complete sale"}</button></div>
      </form>
    </div>
  );
}
