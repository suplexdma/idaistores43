"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  totalInvoices: number; grossSales: number; discounts: number; deliveryCharges: number;
  refunds: number; netSales: number; productCost: number; netProductProfit: number;
  amountReceived: number; pendingPayments: number;
};
type Row = { invoiceNo: string; date: string; customer: string; type: string; paymentMode: string; paymentStatus: string; total: number; received: number; balance: number; status: string };

export default function SalesReportPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

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
          <table className="w-full text-left text-sm"><thead className="border-b"><tr>{["Invoice","Date","Customer","Type","Payment","Total","Received","Balance","Status"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.invoiceNo} className="border-b"><td className="p-3 font-medium">{row.invoiceNo}</td><td className="p-3">{new Date(row.date).toLocaleDateString("en-PK")}</td><td className="p-3">{row.customer}</td><td className="p-3">{row.type}</td><td className="p-3">{row.paymentMode}</td><td className="p-3">{money(row.total)}</td><td className="p-3">{money(row.received)}</td><td className="p-3">{money(row.balance)}</td><td className="p-3">{row.status}</td></tr>)}</tbody></table>
        )}
      </CardContent></Card>
    </div>
  );
}
