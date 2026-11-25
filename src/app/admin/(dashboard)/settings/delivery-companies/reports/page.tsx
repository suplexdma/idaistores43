"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DispatchRow = {
  id: string;
  dispatchNumber: string;
  companyId: string;
  companyName: string;
  date: string;
  orderCount: number;
  orderNumbers: string[];
  codAmount: number;
  courierCharges: number;
  netReceivable: number;
  receivedAmount: number;
  balance: number;
  status: "Dispatched" | "Partial" | "Received";
};
type CompanyOption = { _id: string; name: string };

function money(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export default function CourierDispatchReportsPage() {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [chargeDrafts, setChargeDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (companyId) params.set("companyId", companyId);
    if (search.trim()) params.set("search", search.trim());
    const response = await fetch(`/api/admin/courier-dispatches?${params.toString()}`);
    const data = await response.json() as { dispatches?: DispatchRow[]; companies?: CompanyOption[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load courier reports.");
    setRows(data.dispatches ?? []);
    setCompanies(data.companies ?? []);
    setReceivedDrafts(Object.fromEntries((data.dispatches ?? []).map((row) => [row.id, String(row.receivedAmount)])));
    setChargeDrafts(Object.fromEntries((data.dispatches ?? []).map((row) => [row.id, String(row.courierCharges)])));
  }, [companyId, search]);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      void load()
        .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load courier reports."))
        .finally(() => setLoading(false));
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  async function save(row: DispatchRow) {
    setSavingId(row.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/courier-dispatches?id=${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedAmount: Number(receivedDrafts[row.id]),
          courierCharges: Number(chargeDrafts[row.id]),
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save dispatch receipt.");
      await load();
      setNotice(`Dispatch ${row.dispatchNumber} was updated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save dispatch receipt.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/settings/delivery-companies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Delivery Companies</Link>
          <p className="mt-4 text-sm font-medium text-brand-olive">Logistics · Reconciliation</p>
          <h1 className="mt-1 text-3xl font-semibold">Courier Dispatch Reports</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Search dispatches" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dispatch, order, courier" className="h-10 w-56 rounded-md border pl-9 pr-3 text-sm" />
          </label>
          <select aria-label="Filter by delivery company" value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All delivery companies</option>
            {companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
          </select>
        </div>
      </header>

      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <Card>
        <CardHeader><CardTitle>Dispatch history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              <th className="p-3">Date</th><th className="p-3">Dispatch No</th><th className="p-3">Orders</th><th className="p-3 text-right">COD Amount</th><th className="p-3 text-right">Courier Charges</th><th className="p-3 text-right">Net Receivable</th><th className="p-3 text-right">Received Amount</th><th className="p-3 text-right">Balance</th><th className="p-3">Status</th><th className="p-3">Action</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading dispatches…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No dispatch batches found. Shipped orders assigned to a courier are added automatically.</td></tr>
                  : rows.map((row) => (
                    <tr key={row.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap p-3">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="p-3"><strong>{row.dispatchNumber}</strong><p className="mt-1 text-xs text-muted-foreground">{row.companyName}</p></td>
                      <td className="max-w-52 p-3">{row.orderCount}<p className="mt-1 break-words text-xs text-muted-foreground">{row.orderNumbers.join(", ")}</p></td>
                      <td className="p-3 text-right">{money(row.codAmount)}</td>
                      <td className="p-3 text-right"><input aria-label={`Courier charges for ${row.dispatchNumber}`} type="number" min="0" step="0.01" value={chargeDrafts[row.id] ?? ""} onChange={(event) => setChargeDrafts((current) => ({ ...current, [row.id]: event.target.value }))} className="h-9 w-28 rounded-md border px-2 text-right" /></td>
                      <td className="p-3 text-right font-medium">{money(row.codAmount - Number(chargeDrafts[row.id] ?? row.courierCharges))}</td>
                      <td className="p-3 text-right"><input aria-label={`Received amount for ${row.dispatchNumber}`} type="number" min="0" step="0.01" value={receivedDrafts[row.id] ?? ""} onChange={(event) => setReceivedDrafts((current) => ({ ...current, [row.id]: event.target.value }))} className="h-9 w-28 rounded-md border px-2 text-right" /></td>
                      <td className={`p-3 text-right font-semibold ${row.balance < 0 ? "text-destructive" : ""}`}>{money(row.codAmount - Number(chargeDrafts[row.id] ?? row.courierCharges) - Number(receivedDrafts[row.id] ?? row.receivedAmount))}</td>
                      <td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{row.status}</span></td>
                      <td className="p-3"><Button size="sm" variant="outline" disabled={savingId === row.id} onClick={() => void save(row)}>{savingId === row.id ? "Saving…" : "Save"}</Button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
