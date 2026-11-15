"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ContactForm() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    setStatus("");
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          email: values.get("email"),
          message: values.get("message"),
          website: values.get("website"),
        }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to send your message.");
      form.reset();
      setStatus(result.message ?? "Thank you. Your message has been sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium">Your name</label>
        <Input id="contact-name" name="name" autoComplete="name" minLength={2} maxLength={100} required />
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium">Email address</label>
        <Input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium">How can we help?</label>
        <textarea id="contact-message" name="message" rows={5} minLength={10} maxLength={3000} required className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-olive" />
      </div>
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {status && <p role="status" className="text-sm text-brand-olive">{status}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full rounded-full bg-brand-olive text-white hover:bg-brand-olive/90">{sending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
