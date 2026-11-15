"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit reset code."),
  password: z.string().min(12, "Use at least 12 characters.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});
type Values = z.infer<typeof schema>;

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email, code: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    setError("");
    try {
      const response = await fetch("/api/auth/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, code: values.code, password: values.password }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to reset your password.");
        return;
      }
      setSuccess(true);
      window.setTimeout(() => router.replace("/login"), 1500);
    } catch {
      setError("Unable to reset your password right now. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Your reset link can only be used once and expires after 30 minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        {!email ? (
          <div className="space-y-4 text-sm">
            <p role="alert" className="text-destructive">Enter your email to request a reset code.</p>
            <Link href="/forgot-password" className="font-medium text-brand-olive hover:underline">Request a new link</Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>6-digit reset code</FormLabel><FormControl><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>New password</FormLabel><FormControl><PasswordInput toggleLabel="new password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem><FormLabel>Confirm new password</FormLabel><FormControl><PasswordInput toggleLabel="confirmation password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {success && <p role="status" className="text-sm text-brand-olive">Password updated. Redirecting to sign in...</p>}
              <Button className="w-full" type="submit" disabled={form.formState.isSubmitting || success}>
                {form.formState.isSubmitting ? "Updating..." : "Update password"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
