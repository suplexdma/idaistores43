"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Company = { _id: string; name: string; contactNumber: string; trackingUrlTemplate: string; notes: string; active: boolean };

export default function DeliveryCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [trackingUrlTemplate, setTrackingUrlTemplate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/delivery-companies");
    const data = await response.json() as { companies?: Company[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load delivery companies.");
    setCompanies(data.companies ?? []);
  }

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load delivery companies."));
  }, []);

  async function add() {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/delivery-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactNumber, trackingUrlTemplate, notes, active: true }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to add this delivery company.");
      setName("");
      setContactNumber("");
      setTrackingUrlTemplate("");
      setNotes("");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add this delivery company.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(company: Company) {
    if (!confirm(`Delete ${company.name}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/delivery-companies?id=${company._id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete this delivery company.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this delivery company.");
    }
  }

  async function toggle(company: Company) {
    setError("");
    try {
      const response = await fetch(`/api/admin/delivery-companies?id=${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !company.active }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update this delivery company.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this delivery company.");
    }
  }

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-brand-olive">Settings</p><h1 className="mt-1 text-3xl font-semibold">Delivery Companies</h1></div>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Add company</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <input required placeholder="Company name" value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-md border px-3 text-sm" />
          <input placeholder="Contact number" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} className="h-10 rounded-md border px-3 text-sm" />
          <input placeholder="Tracking URL template (use {trackingNumber})" value={trackingUrlTemplate} onChange={(event) => setTrackingUrlTemplate(event.target.value)} className="h-10 rounded-md border px-3 text-sm" />
          <input placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="h-10 rounded-md border px-3 text-sm" />
          <button onClick={() => void add()} disabled={saving || name.trim().length < 2} className="h-10 rounded-md bg-brand-olive px-4 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{saving ? "Saving…" : "Add company"}</button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Companies</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {companies.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No delivery companies configured.</p> : companies.map((company) => (
            <div key={company._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0"><p className="font-medium">{company.name}</p><p className="text-xs text-muted-foreground">{company.contactNumber || "No contact"} · {company.active ? "Active" : "Inactive"}</p>{company.trackingUrlTemplate && <p className="mt-1 break-all text-xs text-muted-foreground">{company.trackingUrlTemplate}</p>}</div>
              <div className="flex gap-2"><button onClick={() => void toggle(company)} className="rounded-md border px-3 py-2 text-xs">{company.active ? "Disable" : "Enable"}</button><button onClick={() => void remove(company)} className="rounded-md border border-red-200 px-3 py-2 text-xs text-red-700">Delete</button></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
