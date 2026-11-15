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

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { error?: string; message?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to request a password reset.");
        return;
      }
      setMessage(data.message ?? "If an account exists for that email, a reset link has been sent.");
      router.push(`/reset-password?email=${encodeURIComponent(values.email.trim().toLowerCase())}`);
    } catch {
      setError("Unable to reach the password reset service. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Enter the email address associated with your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {message && <p role="status" className="text-sm text-brand-olive">{message}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending..." : "Send reset code"}
            </Button>
          </form>
        </Form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Remembered it? <Link href="/login" className="font-medium text-brand-olive hover:underline">Back to sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
