"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setServerError("");
    try {
      const accountResponse = await fetch("/api/auth/customer/account-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      if (!accountResponse.ok) {
        throw new Error("Unable to verify your account right now. Please try again.");
      }
      const account = (await accountResponse.json()) as { exists?: boolean };
      if (!account.exists) {
        setServerError("Account not found. Please sign up first.");
        return;
      }
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!result || result.error) {
        setServerError("The email or password you entered is incorrect.");
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setServerError("Unable to sign in right now. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to view your account and orders.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-3">
                  <FormLabel>Password</FormLabel>
                  <Link href="/forgot-password" className="text-xs font-medium text-brand-olive hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} autoComplete="current-password" className="pe-11" {...field} />
                    <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-md text-muted-foreground hover:text-brand-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-olive">
                      {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to IDAI? <Link href="/register" className="font-medium text-brand-olive hover:underline">Create an account</Link>
        </p>
      </CardContent>
    </Card>
  );
}
