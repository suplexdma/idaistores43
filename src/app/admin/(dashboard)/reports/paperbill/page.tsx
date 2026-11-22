"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RecordRow = { _id: string; startDate: string; endDate: string; status: string; sourceFileName: string; differences: unknown[] };

export default function PaperBillReconciliationPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File|null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/reconciliation");
    if (response.ok) { const data = await response.json() as { records: RecordRow[] }; setRecords(data.records); }
  }
  useEffect(() => { void load(); }, []);

  async function importData() {
    if (!startDate || !endDate) { setMessage("Select the reconciliation period."); return; }
    setBusy(true); setMessage("");
    const form = new FormData(); form.set("startDate", startDate); form.set("endDate", endDate);
    if (file) form.set("file", file);
    const response = await fetch("/api/admin/reconciliation", { method: "POST", body: form });
    const data = await response.json();
    setMessage(response.ok ? `Comparison created with ${(data.record?.differences?.length ?? 0)} differences.` : (data.error ?? "Unable to import."));
    if (response.ok) await load();
    setBusy(false);
  }

  async function action(id: string, action: "approve"|"finalize") {
    setBusy(true);
    const response = await fetch(`/api/admin/reconciliation?id=${id}&action=${action}`, { method: "PATCH" });
    const data = await response.json();
    setMessage(response.ok ? `Reconciliation ${action}d successfully.` : (data.error ?? "Unable to update reconciliation."));
    await load(); setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-brand-olive">Reports</p><h1 className="mt-1 text-3xl font-semibold">PaperBill Reconciliation</h1></div>
      <Card><CardHeader><CardTitle>Import & Compare</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3"><input type="date" aria-label="Start date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-md border px-3 text-sm" /><input type="date" aria-label="End date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-md border px-3 text-sm" /><input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-10 text-sm" /></div>
        <button disabled={busy} onClick={() => void importData()} className="rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Processing..." : "Import & Compare"}</button>
        {message && <p className="rounded-md bg-muted p-3 text-sm">{message}</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Reconciliation Records</CardTitle></CardHeader><CardContent className="space-y-3">
        {records.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No reconciliation records yet.</p> : records.map((record) => <div key={record._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{record.sourceFileName || "Website comparison"}</p><p className="text-xs text-muted-foreground">{new Date(record.startDate).toLocaleDateString("en-PK")} – {new Date(record.endDate).toLocaleDateString("en-PK")} · {record.differences.length} differences</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{record.status}</span>{record.status === "Draft" && <button disabled={busy} onClick={() => void action(record._id,"approve")} className="rounded-md border px-3 py-2 text-xs">Approve adjustments</button>}{record.status === "Approved" && <button disabled={busy} onClick={() => void action(record._id,"finalize")} className="rounded-md bg-brand-gold px-3 py-2 text-xs font-semibold">Finalize</button>}</div></div>)}
      </CardContent></Card>
    </div>
  );
}
