"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PaymentSettings = {
  jazzCashNumber: string;
  easyPaisaNumber: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
};
type PaymentRecord = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  privateMessage: string;
  screenshotUrl: string;
  screenshotFormat: string;
  createdAt: string;
};
const emptySettings: PaymentSettings = {
  jazzCashNumber: "",
  easyPaisaNumber: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  iban: "",
};

export default function OnlinePaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings>(emptySettings);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [settingsResponse, paymentsResponse] = await Promise.all([
      fetch("/api/payment-settings"),
      fetch("/api/admin/online-payments"),
    ]);
    const [settingsData, paymentsData] = await Promise.all([
      settingsResponse.json() as Promise<{ settings?: PaymentSettings; error?: string }>,
      paymentsResponse.json() as Promise<{ payments?: PaymentRecord[]; error?: string }>,
    ]);
    if (!settingsResponse.ok) throw new Error(settingsData.error ?? "Unable to load payment settings.");
    if (!paymentsResponse.ok) throw new Error(paymentsData.error ?? "Unable to load payment records.");
    setSettings({ ...emptySettings, ...settingsData.settings });
    setPayments(paymentsData.payments ?? []);
  }

  useEffect(() => {
    void load()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load online payments."))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/online-payments/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json() as { settings?: PaymentSettings; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save bank details.");
      if (data.settings) setSettings({ ...emptySettings, ...data.settings });
      setNotice("Payment instructions were saved and are now visible at checkout.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save bank details.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function deletePayment(payment: PaymentRecord) {
    if (!window.confirm(`Delete the payment record for ${payment.orderNumber}? Its stored screenshot will also be deleted.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/online-payments?id=${payment.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to delete payment record.");
      setPayments((current) => current.filter((entry) => entry.id !== payment.id));
      setNotice(`Payment record ${payment.orderNumber} was deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete payment record.");
    }
  }

  function updateSetting(field: keyof PaymentSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand-olive">Payments · Administration</p>
        <h1 className="mt-1 text-3xl font-semibold">Online Payments</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage customer-facing account details and review submitted payment screenshots.</p>
      </header>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5 text-brand-olive" /> Checkout bank details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(event) => void saveSettings(event)} className="grid gap-4 sm:grid-cols-2">
            {([
              ["jazzCashNumber", "JazzCash number"],
              ["easyPaisaNumber", "Easypaisa number"],
              ["bankName", "Bank name"],
              ["accountTitle", "Account title"],
              ["accountNumber", "Account number"],
              ["iban", "IBAN"],
            ] as const).map(([field, label]) => (
              <label key={field} className="space-y-1 text-sm font-medium">{label}<input maxLength={field === "iban" || field === "accountNumber" ? 60 : 120} value={settings[field]} onChange={(event) => updateSetting(field, event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
            ))}
            <Button type="submit" disabled={savingSettings} className="sm:col-span-2">{savingSettings ? "Saving…" : "Save payment details"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Online payment log <span className="ml-2 text-sm font-normal text-muted-foreground">({payments.length})</span></CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-3">Date &amp; time</th><th className="p-3">Customer</th><th className="p-3">Order ID</th><th className="p-3">Private message</th><th className="p-3">Screenshot</th><th className="p-3">Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading payment log…</td></tr>
                : payments.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No online payment submissions yet.</td></tr>
                  : payments.map((payment) => (
                    <tr key={payment.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap p-3">{new Date(payment.createdAt).toLocaleString()}</td>
                      <td className="p-3"><strong>{payment.customerName}</strong><p className="mt-1 text-xs text-muted-foreground">{payment.phone}</p></td>
                      <td className="p-3 font-medium">{payment.orderNumber}</td>
                      <td className="max-w-72 whitespace-pre-wrap p-3 text-muted-foreground">{payment.privateMessage || "—"}</td>
                      <td className="p-3"><a href={payment.screenshotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-olive underline underline-offset-2"><ExternalLink className="size-3.5" /> View {payment.screenshotFormat.toUpperCase()}</a></td>
                      <td className="p-3"><Button type="button" variant="outline" size="icon" aria-label={`Delete ${payment.orderNumber} payment log`} onClick={() => void deletePayment(payment)}><Trash2 className="size-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
