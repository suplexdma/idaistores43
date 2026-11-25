"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Summary = {
  totalInvoices: number; grossSales: number; discounts: number; deliveryCharges: number;
  refunds: number; netSales: number; productCost: number; netProductProfit: number;
  amountReceived: number; pendingPayments: number;
};
type Row = { invoiceNo: string; date: string; customer: string; type: string; paymentMode: string; paymentStatus: string; total: number; received: number; balance: number; status: string };
type Invoice = {
  orderNumber: string;
  createdAt: string;
  customerDetails: { name: string; phone: string; address: string; area?: string; city: string; email?: string };
  items: { name: string; sku?: string; barcode?: string; variantName?: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  deliveryCharge: number;
  deliveryCharges?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  amountReceived?: number;
  balanceAmount?: number;
  status: string;
};

export default function SalesReportPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (customer) params.set("customer", customer);
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/reports/sales?${params}`);
    if (response.ok) {
      const data = await response.json() as { summary: Summary; transactions: Row[] };
      setSummary(data.summary); setRows(data.transactions);
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // Loading on mount only; filter changes are applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = (value: number) => `PKR ${value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
  async function viewInvoice(invoiceNo: string) {
    setInvoiceOpen(true);
    setInvoice(null);
    setInvoiceError("");
    setInvoiceLoading(true);
    try {
      const response = await fetch(`/api/admin/reports/sales/invoice?orderNumber=${encodeURIComponent(invoiceNo)}`);
      const data = await response.json() as { invoice?: Invoice; error?: string };
      if (!response.ok || !data.invoice) throw new Error(data.error ?? "Unable to load invoice.");
      setInvoice(data.invoice);
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "Unable to load invoice.");
    } finally {
      setInvoiceLoading(false);
    }
  }
  function exportReport(format: "csv"|"xlsx"|"pdf") {
    const params = new URLSearchParams({ format });
    if (start) params.set("start", start); if (end) params.set("end", end);
    if (customer) params.set("customer", customer); if (status) params.set("status", status);
    window.location.assign(`/api/admin/reports/sales?${params}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-brand-olive">Reports</p><h1 className="mt-1 text-3xl font-semibold">Sales Report</h1></div>
        <div className="flex gap-2">
          {(["csv","xlsx","pdf"] as const).map((format) => <button key={format} onClick={() => exportReport(format)} className="rounded-lg border px-3 py-2 text-xs font-semibold uppercase hover:bg-muted">{format}</button>)}
        </div>
      </div>
      <Card><CardContent className="flex flex-wrap gap-3 pt-6">
        <input type="date" aria-label="Start date" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-md border px-3 text-sm" />
        <input type="date" aria-label="End date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 rounded-md border px-3 text-sm" />
        <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="h-10 rounded-md border px-3 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border px-3 text-sm"><option value="">All statuses</option>{["Pending","Confirmed","Shipped","Delivered","Cancelled","Returned"].map((item) => <option key={item}>{item}</option>)}</select>
        <button onClick={() => void load()} className="h-10 rounded-md bg-brand-olive px-4 text-sm font-semibold text-white">Apply</button>
      </CardContent></Card>
      {summary && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {([
          ["Total Invoices", summary.totalInvoices], ["Gross Sales", money(summary.grossSales)], ["Discounts", money(summary.discounts)],
          ["Delivery Charges", money(summary.deliveryCharges)], ["Refunds", money(summary.refunds)], ["Net Sales", money(summary.netSales)],
          ["Product Cost", money(summary.productCost)], ["Net Product Profit", money(summary.netProductProfit)],
          ["Amount Received", money(summary.amountReceived)], ["Pending Payments", money(summary.pendingPayments)],
        ] as [string, string|number][]).map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{value}</CardContent></Card>)}
      </div>}
      <Card><CardHeader><CardTitle>Transactions</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p> : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No transactions match the selected filters.</p> : (
          <table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b"><tr>{["Invoice","Date","Customer","Type","Payment","Total","Received","Balance","Status","Invoice details"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.invoiceNo} className="border-b"><td className="p-3 font-medium">{row.invoiceNo}</td><td className="p-3">{new Date(row.date).toLocaleDateString("en-PK")}</td><td className="p-3">{row.customer}</td><td className="p-3">{row.type}</td><td className="p-3">{row.paymentMode}</td><td className="p-3">{money(row.total)}</td><td className="p-3">{money(row.received)}</td><td className="p-3">{money(row.balance)}</td><td className="p-3">{row.status}</td><td className="p-3"><button type="button" onClick={() => void viewInvoice(row.invoiceNo)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"><Eye aria-hidden="true" className="size-3.5" /> View invoice</button></td></tr>)}</tbody></table>
        )}
      </CardContent></Card>
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{invoice ? `Invoice ${invoice.orderNumber}` : "Sales invoice"}</DialogTitle>
            <DialogDescription>Complete item and payment details for this sale.</DialogDescription>
          </DialogHeader>
          {invoiceLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading invoice…</p>
            : invoiceError ? <p role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{invoiceError}</p>
              : invoice && (
                <div className="space-y-6">
                  <div className="flex flex-wrap justify-between gap-4 border-b pb-4 text-sm">
                    <div><p className="font-semibold">{invoice.customerDetails.name}</p><p className="text-muted-foreground">{invoice.customerDetails.phone}</p><p className="text-muted-foreground">{invoice.customerDetails.address}{invoice.customerDetails.area ? `, ${invoice.customerDetails.area}` : ""}, {invoice.customerDetails.city}</p>{invoice.customerDetails.email && <p className="text-muted-foreground">{invoice.customerDetails.email}</p>}</div>
                    <div className="text-right"><p>{new Date(invoice.createdAt).toLocaleString("en-PK")}</p><p className="mt-1">Status: <strong>{invoice.status}</strong></p><p>Payment: {invoice.paymentMethod} · {invoice.paymentStatus}</p></div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b bg-muted/50"><tr><th className="p-3">Product</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Total</th></tr></thead>
                      <tbody>{invoice.items.map((item, index) => <tr key={`${item.name}-${index}`} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{item.name}</p>{item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}{(item.sku || item.barcode) && <p className="text-xs text-muted-foreground">{[item.sku && `SKU ${item.sku}`, item.barcode && `Barcode ${item.barcode}`].filter(Boolean).join(" · ")}</p>}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{money(item.unitPrice)}</td><td className="p-3 text-right font-medium">{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className="ml-auto w-full max-w-sm space-y-2 border-t pt-4 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
                    {invoice.deliveryCharge > 0 && <div className="flex justify-between"><span>Delivery charge</span><span>{money(invoice.deliveryCharge)}</span></div>}
                    {(invoice.deliveryCharges ?? 0) > 0 && <div className="flex justify-between"><span>Additional delivery charges</span><span>{money(invoice.deliveryCharges ?? 0)}</span></div>}
                    <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Grand total</span><span>{money(invoice.total + (invoice.deliveryCharges ?? 0))}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Received</span><span>{money(invoice.amountReceived ?? 0)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Balance</span><span>{money(Math.max(0, invoice.total + (invoice.deliveryCharges ?? 0) - (invoice.amountReceived ?? 0)))}</span></div>
                  </div>
                </div>
              )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
