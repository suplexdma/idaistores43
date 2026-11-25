"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ServiceRate = { minWeight: number; maxWeight: number; charge: number };
type CustomAttribute = { name: string; value: string };
type Company = {
  _id: string;
  name: string;
  contactPersonName: string;
  contactNumber: string;
  officeLocation: string;
  paymentMethod: "Cash" | "Bank Transfer";
  paymentDelayDays: number;
  trackingUrlTemplate: string;
  serviceRates: ServiceRate[];
  customAttributes: CustomAttribute[];
  notes: string;
  active: boolean;
};
type CompanyDraft = Omit<Company, "_id">;
type DispatchReport = {
  id: string;
  dispatchNumber: string;
  companyId: string;
  date: string;
  orderCount: number;
  codAmount: number;
  courierCharges: number;
  netReceivable: number;
  receivedAmount: number;
  balance: number;
  status: string;
};

function formatMoney(value: number) {
  return `PKR ${value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

const blankDraft = (): CompanyDraft => ({
  name: "",
  contactPersonName: "",
  contactNumber: "",
  officeLocation: "",
  paymentMethod: "Cash",
  paymentDelayDays: 0,
  trackingUrlTemplate: "",
  serviceRates: [],
  customAttributes: [],
  notes: "",
  active: true,
});

export default function DeliveryCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dispatchReports, setDispatchReports] = useState<DispatchReport[]>([]);
  const [draft, setDraft] = useState<CompanyDraft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadCompanies() {
    const [companyResponse, reportsResponse] = await Promise.all([
      fetch("/api/admin/delivery-companies"),
      fetch("/api/admin/courier-dispatches"),
    ]);
    const companyData = await companyResponse.json() as { companies?: Company[]; error?: string };
    const reportsData = await reportsResponse.json() as { dispatches?: DispatchReport[]; error?: string };
    if (!companyResponse.ok) throw new Error(companyData.error ?? "Unable to load delivery companies.");
    if (!reportsResponse.ok) throw new Error(reportsData.error ?? "Unable to load courier reports.");
    setCompanies(companyData.companies ?? []);
    setDispatchReports(reportsData.dispatches ?? []);
  }

  useEffect(() => {
    void loadCompanies()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load delivery companies."))
      .finally(() => setLoading(false));
  }, []);

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return companies.filter((company) =>
      !query || [company.name, company.contactPersonName, company.contactNumber, company.officeLocation]
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [companies, search]);
  const reportsByCompany = useMemo(() => {
    const grouped = new Map<string, DispatchReport[]>();
    for (const report of dispatchReports) {
      const reports = grouped.get(report.companyId) ?? [];
      reports.push(report);
      grouped.set(report.companyId, reports);
    }
    return grouped;
  }, [dispatchReports]);

  function openCreate() {
    setEditingId(null);
    setDraft(blankDraft());
    setError("");
    setDialogOpen(true);
  }

  function openEdit(company: Company) {
    const { _id, ...companyDraft } = company;
    setEditingId(_id);
    setDraft({
      ...blankDraft(),
      ...companyDraft,
      serviceRates: companyDraft.serviceRates ?? [],
      customAttributes: companyDraft.customAttributes ?? [],
    });
    setError("");
    setDialogOpen(true);
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/delivery-companies?id=${editingId}` : "/api/admin/delivery-companies",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const result = await response.json() as { error?: string | { message?: string }[] };
      if (!response.ok) {
        const message = Array.isArray(result.error)
          ? result.error.map((issue) => issue.message).filter(Boolean).join(" ")
          : result.error;
        throw new Error(message ?? "Unable to save delivery company.");
      }
      await loadCompanies();
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save delivery company.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCompany(company: Company) {
    if (!window.confirm(`Delete ${company.name}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/delivery-companies?id=${company._id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete delivery company.");
      setCompanies((current) => current.filter((item) => item._id !== company._id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete delivery company.");
    }
  }

  function updateRate(index: number, field: keyof ServiceRate, value: string) {
    setDraft((current) => ({
      ...current,
      serviceRates: current.serviceRates.map((rate, rateIndex) =>
        rateIndex === index ? { ...rate, [field]: Number(value) } : rate,
      ),
    }));
  }

  function updateAttribute(index: number, field: keyof CustomAttribute, value: string) {
    setDraft((current) => ({
      ...current,
      customAttributes: current.customAttributes.map((attribute, attributeIndex) =>
        attributeIndex === index ? { ...attribute, [field]: value } : attribute,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-olive">Settings · Logistics</p>
          <h1 className="mt-1 text-3xl font-semibold">Delivery Companies</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage courier contacts, payment terms, tracking and weight-based rates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/settings/delivery-companies/reports">Courier reports</Link></Button>
          <Button onClick={openCreate}><Plus aria-hidden="true" className="mr-2 size-4" /> Add company</Button>
        </div>
      </header>

      {error && !dialogOpen && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Courier directory</CardTitle>
          <label className="relative w-full max-w-xs">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Search delivery companies" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
          </label>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading delivery companies…</p>
            : filteredCompanies.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No delivery companies found.</p>
              : filteredCompanies.map((company) => {
                const reports = reportsByCompany.get(company._id) ?? [];
                return (
                  <article key={company._id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-olive/10 text-brand-olive"><Truck aria-hidden="true" className="size-5" /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{company.name}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${company.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{company.active ? "Active" : "Inactive"}</span></div>
                        <p className="mt-1 text-sm text-muted-foreground">{company.contactPersonName || "No contact person"} · {company.contactNumber || "No contact number"}</p>
                        <p className="text-sm text-muted-foreground">{company.officeLocation || "Office location not set"} · {company.paymentMethod} · {company.paymentDelayDays} day(s)</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(company)}><Pencil aria-hidden="true" className="mr-2 size-3.5" /> Edit / view</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => void removeCompany(company)} aria-label={`Delete ${company.name}`}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                  {company.serviceRates?.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Rates: {company.serviceRates.map((rate) => `${rate.minWeight}–${rate.maxWeight} kg · PKR ${rate.charge.toLocaleString("en-PK")}`).join(" | ")}</p>}
                  {company.trackingUrlTemplate && <p className="mt-1 break-all text-xs text-muted-foreground">Tracking: {company.trackingUrlTemplate}</p>}
                  <section className="mt-4 border-t pt-4">
                    <h3 className="text-sm font-semibold">Recent courier reports</h3>
                    {reports.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No dispatch reports for this company yet.</p> : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full min-w-[900px] text-left text-xs">
                            <thead><tr className="border-b text-muted-foreground"><th className="p-2">Date / Dispatch</th><th className="p-2 text-right">Orders</th><th className="p-2 text-right">COD</th><th className="p-2 text-right">Charges</th><th className="p-2 text-right">Net receivable</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Balance</th><th className="p-2">Status</th></tr></thead>
                            <tbody>{reports.slice(0, 5).map((report) => <tr key={report.id} className="border-b last:border-0"><td className="p-2"><p className="font-medium">{report.dispatchNumber}</p><p className="text-muted-foreground">{new Date(report.date).toLocaleDateString("en-PK")}</p></td><td className="p-2 text-right">{report.orderCount}</td><td className="p-2 text-right">{formatMoney(report.codAmount)}</td><td className="p-2 text-right">{formatMoney(report.courierCharges)}</td><td className="p-2 text-right">{formatMoney(report.netReceivable)}</td><td className="p-2 text-right">{formatMoney(report.receivedAmount)}</td><td className="p-2 text-right font-medium">{formatMoney(report.balance)}</td><td className="p-2">{report.status}</td></tr>)}</tbody>
                          </table>
                        </div>
                    )}
                  </section>
                  </article>
                );
              })}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit delivery company" : "Add delivery company"}</DialogTitle>
            <DialogDescription>Configure courier contacts, settlement terms, tracking and rate bands.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveCompany(event)} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">Company name *
                <input required minLength={2} maxLength={120} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-md border px-3 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">Contact person
                <input maxLength={120} value={draft.contactPersonName} onChange={(event) => setDraft((current) => ({ ...current, contactPersonName: event.target.value }))} className="h-10 w-full rounded-md border px-3 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">Contact number
                <input maxLength={30} value={draft.contactNumber} onChange={(event) => setDraft((current) => ({ ...current, contactNumber: event.target.value }))} className="h-10 w-full rounded-md border px-3 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">Office location
                <input maxLength={300} value={draft.officeLocation} onChange={(event) => setDraft((current) => ({ ...current, officeLocation: event.target.value }))} className="h-10 w-full rounded-md border px-3 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">Payment method
                <select value={draft.paymentMethod} onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value as CompanyDraft["paymentMethod"] }))} className="h-10 w-full rounded-md border bg-background px-3 font-normal"><option>Cash</option><option>Bank Transfer</option></select>
              </label>
              <label className="space-y-1 text-sm font-medium">Payment delay (days)
                <input type="number" min="0" max="365" value={draft.paymentDelayDays} onChange={(event) => setDraft((current) => ({ ...current, paymentDelayDays: Number(event.target.value) }))} className="h-10 w-full rounded-md border px-3 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">Tracking URL template
                <input maxLength={500} value={draft.trackingUrlTemplate} onChange={(event) => setDraft((current) => ({ ...current, trackingUrlTemplate: event.target.value }))} placeholder="https://courier.example/track?id={trackingNumber}" className="h-10 w-full rounded-md border px-3 font-normal" />
              </label>
            </div>

            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Weight-based service rates</h3><p className="text-xs text-muted-foreground">Used to estimate courier charges for dispatch batches.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setDraft((current) => ({ ...current, serviceRates: [...current.serviceRates, { minWeight: 0, maxWeight: 1, charge: 0 }] }))}><Plus className="mr-1 size-4" /> Add rate</Button></div>
              {draft.serviceRates.map((rate, index) => <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <label className="text-xs font-medium">From kg<input type="number" min="0" step="0.01" value={rate.minWeight} onChange={(event) => updateRate(index, "minWeight", event.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm" /></label>
                <label className="text-xs font-medium">To kg<input type="number" min="0" step="0.01" value={rate.maxWeight} onChange={(event) => updateRate(index, "maxWeight", event.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm" /></label>
                <label className="text-xs font-medium">Charge PKR<input type="number" min="0" step="0.01" value={rate.charge} onChange={(event) => updateRate(index, "charge", event.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm" /></label>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove rate ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, serviceRates: current.serviceRates.filter((_, rateIndex) => rateIndex !== index) }))}><Trash2 className="size-4 text-destructive" /></Button>
              </div>)}
            </section>

            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Custom attributes</h3><p className="text-xs text-muted-foreground">Add company-specific fields such as account or service type.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setDraft((current) => ({ ...current, customAttributes: [...current.customAttributes, { name: "", value: "" }] }))}><Plus className="mr-1 size-4" /> Add field</Button></div>
              {draft.customAttributes.map((attribute, index) => <div key={index} className="grid grid-cols-2 gap-2">
                <input aria-label={`Attribute ${index + 1} name`} maxLength={80} value={attribute.name} onChange={(event) => updateAttribute(index, "name", event.target.value)} placeholder="Attribute name" className="h-9 rounded-md border px-2 text-sm" />
                <div className="flex gap-2"><input aria-label={`Attribute ${index + 1} value`} maxLength={300} value={attribute.value} onChange={(event) => updateAttribute(index, "value", event.target.value)} placeholder="Value" className="h-9 min-w-0 flex-1 rounded-md border px-2 text-sm" /><Button type="button" variant="ghost" size="icon" aria-label={`Remove custom field ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, customAttributes: current.customAttributes.filter((_, attributeIndex) => attributeIndex !== index) }))}><Trash2 className="size-4 text-destructive" /></Button></div>
              </div>)}
            </section>

            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /> Company is active</label>
            {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add company"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
