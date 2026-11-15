"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
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
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/, "Enter a valid phone number."),
  password: z.string().min(12, "Use at least 12 characters.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
});
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setServerError("");
    try {
      const response = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setServerError(data.error ?? "Unable to create your account.");
        return;
      }

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!result || result.error) {
        router.replace("/login?registered=true");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setServerError("Unable to create your account right now. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Save your details and keep your orders together.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Full name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone number</FormLabel><FormControl><Input type="tel" autoComplete="tel" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Password</FormLabel><FormControl><PasswordInput toggleLabel="password" autoComplete="new-password" {...field} /></FormControl><FormMessage /><p className="text-xs text-muted-foreground">At least 12 characters, with uppercase, lowercase, and a number.</p></FormItem>
            )} />
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-medium text-brand-olive hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
