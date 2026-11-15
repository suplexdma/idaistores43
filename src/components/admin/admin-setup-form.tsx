"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type SetupValues = {
  name: string;
  email: string;
  password: string;
  bootstrapSecret: string;
};

const initialValues: SetupValues = {
  name: "",
  email: "",
  password: "",
  bootstrapSecret: "",
};

export function AdminSetupForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof SetupValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setServerError(result.error ?? "Unable to create the administrator account.");
        return;
      }

      router.replace("/admin/login?setup=complete");
      router.refresh();
    } catch {
      setServerError("Unable to reach the setup service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-lg">
      <CardHeader>
        <CardTitle>First administrator</CardTitle>
        <CardDescription>
          Use a unique password of at least 12 characters. The setup secret is read from `.env`.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block space-y-2 text-sm font-medium">
            Admin name
            <Input
              autoComplete="name"
              name="name"
              required
              maxLength={120}
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Admin email
            <Input
              autoComplete="email"
              name="email"
              type="email"
              required
              maxLength={254}
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Admin password
            <PasswordInput
              autoComplete="new-password"
              name="password"
              toggleLabel="admin password"
              required
              minLength={12}
              maxLength={128}
              value={values.password}
              onChange={(event) => updateField("password", event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            One-time setup secret
            <PasswordInput
              autoComplete="off"
              name="bootstrapSecret"
              toggleLabel="setup secret"
              required
              value={values.bootstrapSecret}
              onChange={(event) => updateField("bootstrapSecret", event.target.value)}
            />
          </label>
          {serverError && (
            <p role="alert" className="text-sm text-destructive">{serverError}</p>
          )}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create admin account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already set up? <Link href="/admin/login" className="text-brand-olive hover:underline">Go to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
